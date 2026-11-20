import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    DEFAULT_CENTER,
    getCurrentBrowserLocation,
    hasValidCoords,
    reverseGeocode,
    saveUserGeoPreference,
    searchAddresses
} from '../../utils/geo';
import './LocationPickerMap.css';

// Fix default Leaflet marker icons when bundled by Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow
});

export default function LocationPickerMap({
    latitude,
    longitude,
    address = '',
    radiusKm = 0,
    showRadius = false,
    readOnly = false,
    height = 280,
    placeholder = 'Tìm địa chỉ đường, phường, quận (VD: 123 Nguyễn Văn Linh, Quận 7)...',
    onChange
}) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const circleRef = useRef(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const valid = hasValidCoords(latitude, longitude);
    const activeLat = valid ? Number(latitude) : DEFAULT_CENTER.latitude;
    const activeLng = valid ? Number(longitude) : DEFAULT_CENTER.longitude;

    const [query, setQuery] = useState(address || '');
    const [suggestions, setSuggestions] = useState([]);
    const [searching, setSearching] = useState(false);
    const [locating, setLocating] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (address && !query) {
            setQuery(address);
        }
    }, [address]);

    const emitPosition = async (lat, lng, preset = null) => {
        const roundedLat = Number(Number(lat).toFixed(6));
        const roundedLng = Number(Number(lng).toFixed(6));
        setErrorMsg('');
        setStatusMsg('Đang xác định địa chỉ...');
        try {
            const info = preset || (await reverseGeocode(roundedLat, roundedLng));
            const payload = {
                latitude: roundedLat,
                longitude: roundedLng,
                streetAddress: info.streetAddress || '',
                ward: info.ward || '',
                district: info.district || '',
                province: info.province || 'TP. Hồ Chí Minh',
                fullAddress: info.fullAddress || `${roundedLat}, ${roundedLng}`
            };
            setQuery(payload.fullAddress);
            setStatusMsg('Đã cập nhật vị trí từ OpenStreetMap');
            saveUserGeoPreference(roundedLat, roundedLng, payload.district || payload.fullAddress);
            if (typeof onChangeRef.current === 'function') {
                onChangeRef.current(payload);
            }
        } catch {
            const fallback = {
                latitude: roundedLat,
                longitude: roundedLng,
                streetAddress: '',
                ward: '',
                district: '',
                province: 'TP. Hồ Chí Minh',
                fullAddress: `${roundedLat}, ${roundedLng}`
            };
            setStatusMsg('Đã cập nhật tọa độ');
            if (typeof onChangeRef.current === 'function') {
                onChangeRef.current(fallback);
            }
        }
    };

    // Initialize Leaflet map once
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
            center: [activeLat, activeLng],
            zoom: valid ? 15 : 13,
            scrollWheelZoom: !readOnly
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        const marker = L.marker([activeLat, activeLng], {
            draggable: !readOnly
        }).addTo(map);

        if (!readOnly) {
            marker.on('dragend', () => {
                const pos = marker.getLatLng();
                emitPosition(pos.lat, pos.lng);
            });
            map.on('click', (e) => {
                marker.setLatLng(e.latlng);
                emitPosition(e.latlng.lat, e.latlng.lng);
            });
        }

        mapRef.current = map;
        markerRef.current = marker;

        const timer = window.setTimeout(() => map.invalidateSize(), 200);

        return () => {
            window.clearTimeout(timer);
            map.remove();
            mapRef.current = null;
            markerRef.current = null;
            circleRef.current = null;
        };
    }, [readOnly]);

    // Sync marker & radius circle when props change
    useEffect(() => {
        const map = mapRef.current;
        const marker = markerRef.current;
        if (!map || !marker) return;

        marker.setLatLng([activeLat, activeLng]);
        map.panTo([activeLat, activeLng], { animate: true });

        if (circleRef.current) {
            circleRef.current.remove();
            circleRef.current = null;
        }
        if (showRadius && Number(radiusKm) > 0) {
            circleRef.current = L.circle([activeLat, activeLng], {
                radius: Number(radiusKm) * 1000,
                color: '#2563eb',
                fillColor: '#3b82f6',
                fillOpacity: 0.14,
                weight: 2
            }).addTo(map);
        }
    }, [activeLat, activeLng, showRadius, radiusKm]);

    // Debounced address search via Photon API
    useEffect(() => {
        if (readOnly) return;
        const text = query.trim();
        if (text.length < 3) {
            setSuggestions([]);
            return;
        }
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setSearching(true);
            try {
                const items = await searchAddresses(text, controller.signal);
                setSuggestions(items);
            } catch {
                // ignore aborted requests
            } finally {
                setSearching(false);
            }
        }, 400);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [query, readOnly]);

    const handlePickSuggestion = (item) => {
        setSuggestions([]);
        if (mapRef.current && markerRef.current) {
            markerRef.current.setLatLng([item.latitude, item.longitude]);
            mapRef.current.setView([item.latitude, item.longitude], 16);
        }
        emitPosition(item.latitude, item.longitude, item);
    };

    const handleGps = async () => {
        setLocating(true);
        setErrorMsg('');
        try {
            const coords = await getCurrentBrowserLocation();
            if (mapRef.current && markerRef.current) {
                markerRef.current.setLatLng([coords.latitude, coords.longitude]);
                mapRef.current.setView([coords.latitude, coords.longitude], 16);
            }
            await emitPosition(coords.latitude, coords.longitude);
        } catch (err) {
            setErrorMsg(err.message || 'Không thể lấy vị trí hiện tại.');
        } finally {
            setLocating(false);
        }
    };

    return (
        <div className="cm-map-picker">
            {!readOnly && (
                <div className="cm-map-toolbar">
                    <div className="cm-map-search-wrap">
                        <input
                            type="text"
                            className="cm-map-search-input"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={placeholder}
                        />
                        {searching && (
                            <div className="cm-map-suggestions">
                                <div className="cm-map-suggestion-item">Đang tìm địa chỉ...</div>
                            </div>
                        )}
                        {!searching && suggestions.length > 0 && (
                            <div className="cm-map-suggestions">
                                {suggestions.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className="cm-map-suggestion-item"
                                        onClick={() => handlePickSuggestion(item)}
                                    >
                                        📍 {item.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        className="cm-map-gps-btn"
                        onClick={handleGps}
                        disabled={locating}
                    >
                        {locating ? '⏳ Đang định vị...' : '📍 Vị trí hiện tại'}
                    </button>
                </div>
            )}

            <div
                ref={containerRef}
                className="cm-map-canvas"
                style={{ height: `${height}px` }}
            />

            <div className="cm-map-footer">
                <span className="cm-map-coords">
                    Tọa độ: {activeLat.toFixed(6)}, {activeLng.toFixed(6)}
                    {showRadius && Number(radiusKm) > 0 ? ` · Bán kính ${radiusKm} km` : ''}
                </span>
                {!readOnly && (
                    <span className="cm-map-status">
                        {statusMsg || 'Bấm hoặc kéo ghim trên bản đồ để chọn chính xác vị trí'}
                    </span>
                )}
            </div>

            {errorMsg && <p className="cm-map-error">⚠️ {errorMsg}</p>}
        </div>
    );
}
