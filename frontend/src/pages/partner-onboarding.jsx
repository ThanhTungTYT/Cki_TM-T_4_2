import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LocationPickerMap from '../components/map/LocationPickerMap';
import { clearStoredAuth } from '../utils/authSession';
import './become-partner.css';

const ENTITY_TYPES = [
    { value: 'SINGLE_MEMBER_LLC', label: 'Công ty TNHH Một thành viên (LLC)' },
    { value: 'MULTI_MEMBER_LLC', label: 'Công ty TNHH Hai thành viên trở lên' },
    { value: 'JOINT_STOCK_COMPANY', label: 'Công ty Cổ phần (JSC)' },
    { value: 'HOUSEHOLD_BUSINESS', label: 'Hộ kinh doanh cá thể' },
    { value: 'PRIVATE_ENTERPRISE', label: 'Doanh nghiệp tư nhân' }
];

function getToken() {
    return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken') || '';
}

export default function PartnerOnboarding() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [statusData, setStatusData] = useState(null);
    const [editing, setEditing] = useState(false);

    const [form, setForm] = useState({
        representativeName: '',
        representativeTitle: '',
        phone: '',
        businessName: '',
        entityType: 'SINGLE_MEMBER_LLC',
        countryCode: 'VN',
        taxCode: '',
        businessLicenseNumber: '',
        address: '',
        latitude: 10.776889,
        longitude: 106.700806,
        serviceRadiusKm: 10,
        bankName: '',
        bankAccountNumber: '',
        bankAccountHolder: '',
        description: ''
    });
    const [licenseFile, setLicenseFile] = useState(null);
    const [idCardFile, setIdCardFile] = useState(null);

    const loadStatus = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/partner-onboarding/status', {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Không thể tải trạng thái hồ sơ đối tác.');
            if (String(data.status || '').toUpperCase() === 'ACTIVE') {
                navigate('/provider-portal/dashboard', { replace: true });
                return;
            }
            setStatusData(data);
            setForm({
                representativeName: data.representativeName || '',
                representativeTitle: data.representativeTitle || 'Giám đốc',
                phone: data.phone || '',
                businessName: data.businessName || '',
                entityType: data.entityType || 'SINGLE_MEMBER_LLC',
                countryCode: data.countryCode || 'VN',
                taxCode: data.taxCode || '',
                businessLicenseNumber: data.businessLicenseNumber || '',
                address: data.address || '',
                latitude: data.latitude ?? 10.776889,
                longitude: data.longitude ?? 106.700806,
                serviceRadiusKm: data.serviceRadiusKm ?? 10,
                bankName: data.bankName || '',
                bankAccountNumber: data.bankAccountNumber || '',
                bankAccountHolder: data.bankAccountHolder || '',
                description: data.description || ''
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();
    }, []);

    const handleResubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setNotice('');
        try {
            const fd = new FormData();
            Object.entries(form).forEach(([k, v]) => fd.append(k, String(v ?? '')));
            fd.append('termsAccepted', 'true');
            if (licenseFile) fd.append('businessLicenseFile', licenseFile);
            if (idCardFile) fd.append('representativeIdCardFile', idCardFile);

            const res = await fetch('/api/partner-onboarding/resubmit', {
                method: 'PUT',
                headers: { Authorization: `Bearer ${getToken()}` },
                body: fd
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Không thể gửi lại hồ sơ.');
            setStatusData(data);
            setEditing(false);
            setNotice(data.message || 'Đã gửi lại hồ sơ thành công.');
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const statusUpper = String(statusData?.status || 'PENDING').toUpperCase();

    return (
        <div className="bp-page">
            <Header />

            <section className="bp-hero">
                <span className="bp-hero-badge">THEO DÕI HỒ SƠ KYB DOANH NGHIỆP</span>
                <h1>{statusData?.businessName || 'Hồ sơ Đối tác CleanMate'}</h1>
                <p>
                    Cổng theo dõi tiến độ thẩm định hồ sơ pháp nhân, tọa độ trụ sở và bổ sung thông tin khi cần.
                </p>
            </section>

            <main className="bp-container">
                <div className="bp-card">
                    {loading && <p>Đang tải trạng thái hồ sơ...</p>}
                    {error && <div className="bp-alert error">⚠️ {error}</div>}
                    {notice && <div className="bp-alert success">✓ {notice}</div>}

                    {!loading && statusData && (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                                <div>
                                    <span className={`bp-status-pill ${statusUpper.toLowerCase()}`}>
                                        {statusUpper === 'PENDING'
                                            ? '⏳ Đang chờ Admin thẩm định'
                                            : statusUpper === 'REJECTED'
                                            ? '❌ Hồ sơ bị từ chối — Cần chỉnh sửa & nộp lại'
                                            : statusUpper}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button type="button" className="bp-btn bp-btn-secondary" onClick={loadStatus}>
                                        ↻ Làm mới trạng thái
                                    </button>
                                    {['PENDING', 'REJECTED'].includes(statusUpper) && !editing && (
                                        <button type="button" className="bp-btn bp-btn-primary" onClick={() => setEditing(true)}>
                                            ✏️ Chỉnh sửa &amp; Gửi duyệt lại
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="bp-btn bp-btn-secondary"
                                        onClick={() => {
                                            clearStoredAuth();
                                            navigate('/login', { replace: true });
                                        }}
                                    >
                                        Đăng xuất
                                    </button>
                                </div>
                            </div>

                            {statusUpper === 'REJECTED' && statusData.rejectionReason && (
                                <div className="bp-alert error">
                                    <strong>Lý do từ chối từ Admin:</strong> {statusData.rejectionReason}
                                </div>
                            )}

                            {statusUpper === 'PENDING' && statusData.latestRequestInfoNote && (
                                <div
                                    className="bp-alert"
                                    style={{
                                        background: '#fffbeb',
                                        border: '1px solid #fcd34d',
                                        color: '#92400e',
                                        marginBottom: 16
                                    }}
                                >
                                    <strong>⚠️ Admin yêu cầu bổ sung thông tin hồ sơ:</strong>{' '}
                                    {statusData.latestRequestInfoNote}
                                    {!editing && (
                                        <div style={{ marginTop: 8 }}>
                                            <button
                                                type="button"
                                                className="bp-btn bp-btn-primary"
                                                onClick={() => setEditing(true)}
                                            >
                                                ✏️ Bổ sung hồ sơ &amp; Gửi lại ngay
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!editing ? (
                                <div className="bp-grid">
                                    <div className="bp-field">
                                        <label>Người đại diện</label>
                                        <div>{statusData.representativeName || '—'} ({statusData.representativeTitle || 'Đại diện'})</div>
                                    </div>
                                    <div className="bp-field">
                                        <label>Email / SĐT</label>
                                        <div>{statusData.email} · {statusData.phone || '—'}</div>
                                    </div>
                                    <div className="bp-field">
                                        <label>Mã số thuế / Số GPKD</label>
                                        <div>{statusData.taxCode || '—'} / {statusData.businessLicenseNumber || '—'}</div>
                                    </div>
                                    <div className="bp-field">
                                        <label>Tài khoản nhận đối soát</label>
                                        <div>{statusData.bankName || '—'} · {statusData.bankAccountNumber || '—'} ({statusData.bankAccountHolder || '—'})</div>
                                    </div>
                                    <div className="bp-field full">
                                        <label>Địa chỉ trụ sở &amp; Bán kính phục vụ ({statusData.serviceRadiusKm || 10} km)</label>
                                        <div style={{ marginBottom: 8 }}>{statusData.address || '—'}</div>
                                        <LocationPickerMap
                                            latitude={statusData.latitude}
                                            longitude={statusData.longitude}
                                            radiusKm={statusData.serviceRadiusKm || 10}
                                            showRadius
                                            readOnly
                                            height={230}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleResubmit}>
                                    <div className="bp-grid">
                                        <div className="bp-field">
                                            <label>Họ tên người đại diện *</label>
                                            <input value={form.representativeName} onChange={(e) => setForm({ ...form, representativeName: e.target.value })} required />
                                        </div>
                                        <div className="bp-field">
                                            <label>Số điện thoại *</label>
                                            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                                        </div>
                                        <div className="bp-field full">
                                            <label>Tên pháp lý doanh nghiệp *</label>
                                            <input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} required />
                                        </div>
                                        <div className="bp-field">
                                            <label>Loại hình doanh nghiệp</label>
                                            <select value={form.entityType} onChange={(e) => setForm({ ...form, entityType: e.target.value })}>
                                                {ENTITY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="bp-field">
                                            <label>Mã số thuế *</label>
                                            <input value={form.taxCode} onChange={(e) => setForm({ ...form, taxCode: e.target.value })} required />
                                        </div>
                                        <div className="bp-field full">
                                            <label>Số Giấy phép ĐKKD *</label>
                                            <input value={form.businessLicenseNumber} onChange={(e) => setForm({ ...form, businessLicenseNumber: e.target.value })} required />
                                        </div>
                                        <div className="bp-field">
                                            <label>Cập nhật GPKD (tùy chọn)</label>
                                            <div className={`bp-upload-box ${licenseFile ? 'has-file' : ''}`}>
                                                <div className="bp-upload-controls">
                                                    <label className="bp-upload-btn">
                                                        <span>{licenseFile ? '↻ Đổi tệp GPKD' : '📎 Chọn tệp GPKD'}</span>
                                                        <input
                                                            type="file"
                                                            className="bp-file-input-hidden"
                                                            accept=".jpg,.jpeg,.png,.webp,.pdf"
                                                            onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                                                        />
                                                    </label>
                                                    {licenseFile && (
                                                        <button
                                                            type="button"
                                                            className="bp-upload-clear-btn"
                                                            onClick={() => setLicenseFile(null)}
                                                        >
                                                            ✕ Bỏ chọn
                                                        </button>
                                                    )}
                                                </div>
                                                {licenseFile ? (
                                                    <div className="bp-upload-filename" title={licenseFile.name}>✓ {licenseFile.name}</div>
                                                ) : (
                                                    <span className="bp-upload-hint">JPG, PNG, WEBP hoặc PDF (≤ 5MB)</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="bp-field">
                                            <label>Cập nhật CCCD đại diện (tùy chọn)</label>
                                            <div className={`bp-upload-box ${idCardFile ? 'has-file' : ''}`}>
                                                <div className="bp-upload-controls">
                                                    <label className="bp-upload-btn">
                                                        <span>{idCardFile ? '↻ Đổi tệp CCCD' : '📎 Chọn tệp CCCD'}</span>
                                                        <input
                                                            type="file"
                                                            className="bp-file-input-hidden"
                                                            accept=".jpg,.jpeg,.png,.webp,.pdf"
                                                            onChange={(e) => setIdCardFile(e.target.files?.[0] || null)}
                                                        />
                                                    </label>
                                                    {idCardFile && (
                                                        <button
                                                            type="button"
                                                            className="bp-upload-clear-btn"
                                                            onClick={() => setIdCardFile(null)}
                                                        >
                                                            ✕ Bỏ chọn
                                                        </button>
                                                    )}
                                                </div>
                                                {idCardFile ? (
                                                    <div className="bp-upload-filename" title={idCardFile.name}>✓ {idCardFile.name}</div>
                                                ) : (
                                                    <span className="bp-upload-hint">JPG, PNG, WEBP hoặc PDF (≤ 5MB)</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="bp-field full">
                                            <label>Địa chỉ &amp; Tọa độ trụ sở trên Bản đồ *</label>
                                            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={{ marginBottom: 8 }} required />
                                            <LocationPickerMap
                                                latitude={form.latitude}
                                                longitude={form.longitude}
                                                address={form.address}
                                                radiusKm={form.serviceRadiusKm}
                                                showRadius
                                                height={240}
                                                onChange={(loc) => setForm((prev) => ({ ...prev, latitude: loc.latitude, longitude: loc.longitude, address: loc.fullAddress || prev.address }))}
                                            />
                                        </div>
                                        <div className="bp-field">
                                            <label>Ngân hàng *</label>
                                            <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} required />
                                        </div>
                                        <div className="bp-field">
                                            <label>Số tài khoản *</label>
                                            <input value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} required />
                                        </div>
                                        <div className="bp-field full">
                                            <label>Chủ tài khoản *</label>
                                            <input value={form.bankAccountHolder} onChange={(e) => setForm({ ...form, bankAccountHolder: e.target.value.toUpperCase() })} required />
                                        </div>
                                    </div>
                                    <div className="bp-actions">
                                        <button type="button" className="bp-btn bp-btn-secondary" onClick={() => setEditing(false)}>Hủy</button>
                                        <button type="submit" className="bp-btn bp-btn-primary" disabled={saving}>
                                            {saving ? 'Đang gửi lại...' : '✓ Lưu & Gửi duyệt lại'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}
