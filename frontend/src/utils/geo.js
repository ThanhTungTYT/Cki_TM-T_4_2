export const DEFAULT_CENTER = {
    latitude: 10.776889,
    longitude: 106.700806
};

export function toNumberOrNull(val) {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
}

export function hasValidCoords(lat, lng) {
    const la = toNumberOrNull(lat);
    const lo = toNumberOrNull(lng);
    return (
        la !== null &&
        lo !== null &&
        la >= -90 &&
        la <= 90 &&
        lo >= -180 &&
        lo <= 180 &&
        !(la === 0 && lo === 0)
    );
}

export function calculateDistanceKm(lat1, lng1, lat2, lng2) {
    if (!hasValidCoords(lat1, lng1) || !hasValidCoords(lat2, lng2)) return null;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const r = 6371;
    const dLat = toRad(Number(lat2) - Number(lat1));
    const dLng = toRad(Number(lng2) - Number(lng1));
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(Number(lat1))) *
            Math.cos(toRad(Number(lat2))) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(r * c * 10) / 10;
}

export function formatDistanceKm(km) {
    if (km === null || km === undefined || !Number.isFinite(km)) return '';
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export function parseOsmAddress(addr = {}, displayName = '') {
    const house = addr.house_number || '';
    const road = addr.road || addr.pedestrian || addr.residential || addr.footway || addr.neighbourhood || '';
    const streetAddress = [house, road].filter(Boolean).join(' ').trim() || displayName.split(',')[0]?.trim() || '';
    const ward =
        addr.quarter ||
        addr.suburb ||
        addr.village ||
        addr.hamlet ||
        addr.neighbourhood ||
        '';
    const district =
        addr.city_district ||
        addr.county ||
        addr.district ||
        addr.town ||
        '';
    const province =
        addr.city ||
        addr.state ||
        addr.province ||
        'TP. Hồ Chí Minh';
    const fullAddress =
        displayName ||
        [streetAddress, ward, district, province].filter(Boolean).join(', ');
    return { streetAddress, ward, district, province, fullAddress };
}

export async function searchAddresses(query, signal) {
    const q = String(query || '').trim();
    if (q.length < 3) return [];
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lat=10.7769&lon=106.7008`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const features = Array.isArray(data?.features) ? data.features : [];
    return features.map((f, idx) => {
        const [lon, lat] = f.geometry?.coordinates || [];
        const p = f.properties || {};
        const label = [p.name, p.housenumber, p.street, p.district, p.city || p.county, p.state]
            .filter(Boolean)
            .join(', ');
        return {
            id: `${lat}-${lon}-${idx}`,
            latitude: Number(lat),
            longitude: Number(lon),
            label: label || `${lat}, ${lon}`,
            streetAddress: [p.housenumber, p.street || p.name].filter(Boolean).join(' ').trim(),
            ward: p.locality || p.suburb || '',
            district: p.district || p.county || '',
            province: p.city || p.state || 'TP. Hồ Chí Minh',
            fullAddress: label
        };
    });
}

export async function reverseGeocode(lat, lng, signal) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&accept-language=vi`;
    const res = await fetch(url, { signal });
    if (!res.ok) {
        return {
            latitude: Number(lat),
            longitude: Number(lng),
            streetAddress: '',
            ward: '',
            district: '',
            province: 'TP. Hồ Chí Minh',
            fullAddress: `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`
        };
    }
    const data = await res.json();
    const parsed = parseOsmAddress(data?.address || {}, data?.display_name || '');
    return {
        latitude: Number(lat),
        longitude: Number(lng),
        ...parsed
    };
}

export function getCurrentBrowserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Trình duyệt không hỗ trợ định vị GPS.'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    latitude: Number(pos.coords.latitude.toFixed(6)),
                    longitude: Number(pos.coords.longitude.toFixed(6))
                });
            },
            (err) => {
                if (err.code === 1) {
                    reject(new Error('Bạn đã từ chối quyền truy cập vị trí trên trình duyệt.'));
                } else {
                    reject(new Error('Không thể xác định tọa độ GPS hiện tại. Hãy chọn trực tiếp trên bản đồ.'));
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    });
}

export function saveUserGeoPreference(lat, lng, label = '') {
    if (!hasValidCoords(lat, lng)) return;
    try {
        localStorage.setItem(
            'cleanmate_user_geo',
            JSON.stringify({ latitude: Number(lat), longitude: Number(lng), label, updatedAt: Date.now() })
        );
    } catch {
        // ignore storage errors
    }
}

export function readUserGeoPreference() {
    try {
        const raw = localStorage.getItem('cleanmate_user_geo');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (hasValidCoords(parsed?.latitude, parsed?.longitude)) {
            return {
                latitude: Number(parsed.latitude),
                longitude: Number(parsed.longitude),
                label: parsed.label || ''
            };
        }
    } catch {
        // ignore
    }
    return null;
}
