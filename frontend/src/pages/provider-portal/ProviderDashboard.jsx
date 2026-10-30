import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { providerDashboardApi, providerChangeRequestApi } from '../../services/providerApi';

const VND = (v) =>
    v != null ? `${Number(v).toLocaleString('vi-VN')}đ` : '—';

function statusBadge(status) {
    const map = {
        PENDING_PROVIDER: { cls: 'pp-badge-pending',   label: 'Chờ duyệt' },
        CONFIRMED:        { cls: 'pp-badge-confirmed',  label: 'Đã xác nhận' },
        ASSIGNED:         { cls: 'pp-badge-assigned',   label: 'Đã phân công' },
        COMPLETED:        { cls: 'pp-badge-completed',  label: 'Hoàn thành' },
        CANCELLED:        { cls: 'pp-badge-cancelled',  label: 'Đã hủy' },
        PENDING_REVIEW:   { cls: 'pp-badge-pending',   label: 'Chờ Admin duyệt' },
        APPROVED:         { cls: 'pp-badge-completed',  label: 'Đã duyệt' },
        REJECTED:         { cls: 'pp-badge-cancelled',  label: 'Bị từ chối' },
        WITHDRAWN:        { cls: 'pp-badge-inactive',   label: 'Đã rút' },
        OPEN:             { cls: 'pp-badge-pending',   label: 'Mới nhận' },
        WAITING_PROVIDER: { cls: 'pp-badge-warning',   label: 'Chờ đối tác' },
        PROVIDER_RESPONDED:{ cls: 'pp-badge-confirmed', label: 'Đã giải trình' },
        RESOLVED:         { cls: 'pp-badge-completed',  label: 'Đã kết luận' },
    };
    const s = (status || '').toUpperCase();
    const matched = Object.entries(map).find(([k]) => s.includes(k) || s === k);
    const cfg = matched ? matched[1] : { cls: '', label: status || '—' };
    return <span className={`pp-badge ${cfg.cls}`}>{cfg.label}</span>;
}

function toInputDate(d) {
    return d.toISOString().slice(0, 10);
}

function ProviderDashboard() {
    const navigate = useNavigate();
    const today = new Date();
    const [fromDate, setFromDate] = useState(
        toInputDate(new Date(today.getFullYear(), today.getMonth(), 1))
    );
    const [toDate, setToDate] = useState(toInputDate(today));

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionMsg, setActionMsg] = useState('');

    // Modal Yêu cầu thay đổi thông tin / vị trí
    const [showChangeModal, setShowChangeModal] = useState(false);
    const [modalTab, setModalTab] = useState('LOCATION_UPDATE'); // LOCATION_UPDATE or PROFILE_UPDATE
    const [changeReason, setChangeReason] = useState('');
    const [submittingChange, setSubmittingChange] = useState(false);
    const [modalError, setModalError] = useState('');

    // State form cho vị trí đề xuất
    const [propAddress, setPropAddress] = useState('');
    const [propLat, setPropLat] = useState('');
    const [propLon, setPropLon] = useState('');

    // State form cho thông tin công ty đề xuất
    const [propBusinessName, setPropBusinessName] = useState('');
    const [propDesc, setPropDesc] = useState('');
    const [propTaxCode, setPropTaxCode] = useState('');

    function loadDashboard(fDate = fromDate, tDate = toDate) {
        setLoading(true);
        providerDashboardApi
            .get(fDate, tDate)
            .then((res) => {
                setData(res);
                setError('');
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        loadDashboard();
    }, []); // eslint-disable-line

    function openChangeModal(tab = 'LOCATION_UPDATE') {
        setModalTab(tab);
        setModalError('');
        setChangeReason('');
        const p = data?.approvedProfile || {};
        if (tab === 'LOCATION_UPDATE') {
            setPropAddress(p.address || '');
            setPropLat(p.latitude ? String(p.latitude) : '');
            setPropLon(p.longitude ? String(p.longitude) : '');
        } else {
            setPropBusinessName(p.businessName || '');
            setPropDesc(p.description || '');
            setPropTaxCode(p.taxCode || '');
        }
        setShowChangeModal(true);
    }

    async function handleSubmitChange() {
        setModalError('');
        if (!changeReason.trim()) {
            setModalError('Vui lòng nhập lý do đề nghị thay đổi.');
            return;
        }

        const p = data?.approvedProfile || {};
        const payload = {
            type: modalTab,
            reason: changeReason.trim(),
        };

        if (modalTab === 'LOCATION_UPDATE') {
            if (!propAddress.trim()) {
                setModalError('Vui lòng nhập địa chỉ hoạt động đề xuất.');
                return;
            }
            const latNum = parseFloat(propLat);
            const lonNum = parseFloat(propLon);
            if (isNaN(latNum) || isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180 || (latNum === 0 && lonNum === 0)) {
                setModalError('Tọa độ Latitude [-90, 90] và Longitude [-180, 180] không hợp lệ.');
                return;
            }
            payload.address = propAddress.trim();
            payload.latitude = latNum;
            payload.longitude = lonNum;
            payload.oldSnapshot = `address=${p.address || ''};latitude=${p.latitude || ''};longitude=${p.longitude || ''}`;
            payload.proposedSnapshot = `address=${propAddress.trim()};latitude=${latNum};longitude=${lonNum}`;
        } else {
            if (!propBusinessName.trim()) {
                setModalError('Tên doanh nghiệp không được để trống.');
                return;
            }
            payload.businessName = propBusinessName.trim();
            payload.description = propDesc.trim();
            payload.taxCode = propTaxCode.trim();
            payload.oldSnapshot = `businessName=${p.businessName || ''};description=${p.description || ''};taxCode=${p.taxCode || ''}`;
            payload.proposedSnapshot = `businessName=${propBusinessName.trim()};description=${propDesc.trim()};taxCode=${propTaxCode.trim()}`;
        }

        setSubmittingChange(true);
        try {
            await providerChangeRequestApi.create(payload);
            setActionMsg('✅ Đã gửi yêu cầu thay đổi thành công! Vui lòng chờ Admin xét duyệt.');
            setShowChangeModal(false);
            loadDashboard();
        } catch (e) {
            setModalError(e.message);
        } finally {
            setSubmittingChange(false);
        }
    }

    async function handleWithdraw(id) {
        if (!window.confirm('Bạn có chắc chắn muốn rút yêu cầu xét duyệt này?')) return;
        try {
            await providerChangeRequestApi.withdraw(id);
            setActionMsg('Đã rút yêu cầu thành công.');
            loadDashboard();
        } catch (e) {
            alert('Lỗi: ' + e.message);
        }
    }

    function copyCoords() {
        const p = data?.approvedProfile;
        if (p?.latitude && p?.longitude) {
            navigator.clipboard.writeText(`${p.latitude}, ${p.longitude}`);
            alert(`Đã sao chép tọa độ: ${p.latitude}, ${p.longitude}`);
        }
    }

    if (loading && !data) {
        return <div className="pp-loading">Đang tải dữ liệu tổng quan đối tác...</div>;
    }

    if (error && !data) {
        return <div className="pp-alert pp-alert-error">⚠️ {error}</div>;
    }

    const p = data?.approvedProfile || {};
    const stats = data?.stats || {};
    const fin = data?.financial || {};
    const pendingBookings = data?.pendingBookings || [];
    const recentRequests = data?.recentChangeRequests || [];
    const recentComplaints = data?.recentComplaints || [];

    const hasCoords = p.latitude != null && p.longitude != null;

    return (
        <>
            <div className="pp-page-header">
                <div>
                    <h1 className="pp-page-title">Tổng quan đối tác</h1>
                    <span style={{ fontSize: 13, color: 'var(--pp-muted)' }}>
                        Xin chào, {p.businessName || 'Nhà cung cấp'} • Mã đối tác: #{p.id} (Hồ sơ v{p.version || 1})
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        className="pp-btn pp-btn-outline"
                        onClick={() => openChangeModal('LOCATION_UPDATE')}
                    >
                        📍 Đổi vị trí / Tọa độ
                    </button>
                    <button
                        className="pp-btn pp-btn-primary"
                        onClick={() => openChangeModal('PROFILE_UPDATE')}
                    >
                        ⚙️ Yêu cầu đổi thông tin
                    </button>
                </div>
            </div>

            {actionMsg && <div className="pp-alert pp-alert-success">{actionMsg}</div>}

            {/* KHỐI 1: HỒ SƠ DOANH NGHIỆP & VỊ TRÍ ĐÃ DUYỆT */}
            <div className="pp-card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--pp-navy)' }}>
                                {p.businessName}
                            </h2>
                            <span className="pp-badge pp-badge-active">{p.status || 'ACTIVE'}</span>
                            {p.ratingAverage && (
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pp-warning)' }}>
                                    ⭐ {Number(p.ratingAverage).toFixed(1)}
                                </span>
                            )}
                        </div>
                        <p style={{ margin: '4px 0', fontSize: 13.5, color: 'var(--pp-muted)' }}>
                            <strong>Địa chỉ hoạt động:</strong> {p.address || 'Chưa có vị trí được xác nhận'}
                        </p>
                        <p style={{ margin: '4px 0', fontSize: 13, color: 'var(--pp-muted)' }}>
                            <strong>Mã số thuế:</strong> {p.taxCode || 'Chưa cập nhật'} • <strong>Liên hệ:</strong> {p.phone || '—'} ({p.email || '—'})
                        </p>
                    </div>

                    {/* Vị trí Lat/Lon đã duyệt */}
                    <div style={{ background: '#f8fafc', padding: '12px 18px', borderRadius: 10, border: '1px solid var(--pp-border)', minWidth: 260 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pp-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                            Tọa độ đăng ký được duyệt
                        </div>
                        {hasCoords ? (
                            <div>
                                <div className="pp-coord-pill" style={{ marginBottom: 8 }}>
                                    📍 Lat: {Number(p.latitude).toFixed(7)} | Lon: {Number(p.longitude).toFixed(7)}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        type="button"
                                        className="pp-btn pp-btn-ghost pp-btn-sm"
                                        onClick={copyCoords}
                                    >
                                        📋 Copy
                                    </button>
                                    <a
                                        href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="pp-btn pp-btn-outline pp-btn-sm"
                                        style={{ textDecoration: 'none' }}
                                    >
                                        🗺️ Xem bản đồ
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <div style={{ fontSize: 13, color: 'var(--pp-warning)' }}>
                                ⚠️ Chưa có vị trí được xác nhận. Vui lòng bấm "Đổi vị trí" để gửi tọa độ cho Admin duyệt.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* KHỐI 2: THỐNG KÊ VẬN HÀNH */}
            <div className="pp-stats-grid">
                <div className="pp-stat-card warning" onClick={() => navigate('/provider-portal/bookings')} style={{ cursor: 'pointer' }}>
                    <span className="pp-stat-label">Chờ xác nhận</span>
                    <span className="pp-stat-value">{stats.pendingBookings ?? 0}</span>
                </div>
                <div className="pp-stat-card highlight">
                    <span className="pp-stat-label">Đã xác nhận</span>
                    <span className="pp-stat-value">{stats.confirmedBookings ?? 0}</span>
                </div>
                <div className="pp-stat-card">
                    <span className="pp-stat-label">Đã phân công</span>
                    <span className="pp-stat-value">{stats.assignedBookings ?? 0}</span>
                </div>
                <div className="pp-stat-card success">
                    <span className="pp-stat-label">Hoàn thành</span>
                    <span className="pp-stat-value">{stats.completedBookings ?? 0}</span>
                </div>
                <div className="pp-stat-card" onClick={() => navigate('/provider-portal/employees')} style={{ cursor: 'pointer' }}>
                    <span className="pp-stat-label">Nhân viên</span>
                    <span className="pp-stat-value">{stats.totalEmployees ?? 0}</span>
                </div>
                <div className="pp-stat-card warning" onClick={() => navigate('/provider-portal/complaints')} style={{ cursor: 'pointer' }}>
                    <span className="pp-stat-label">Khiếu nại cần xử lý</span>
                    <span className="pp-stat-value">{stats.pendingComplaints ?? 0}</span>
                </div>
                <div className="pp-stat-card highlight">
                    <span className="pp-stat-label">Đề nghị chờ duyệt</span>
                    <span className="pp-stat-value">{stats.pendingChangeRequests ?? 0}</span>
                </div>
            </div>

            {/* KHỐI 3: HỢP NHẤT DOANH THU & ĐỐI SOÁT (F01-06) */}
            <div className="pp-card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <p className="pp-card-title" style={{ margin: 0 }}>
                            💰 Doanh thu & Đối soát
                        </p>
                        <span style={{ fontSize: 12, color: 'var(--pp-muted)' }}>
                            Kỳ tính: {fin.fromDate || fromDate} → {fin.toDate || toDate}
                        </span>
                    </div>

                    {/* Bộ lọc ngày */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                            className="pp-input"
                            type="date"
                            style={{ width: 140, padding: '6px 10px', fontSize: 13 }}
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                        />
                        <span>→</span>
                        <input
                            className="pp-input"
                            type="date"
                            style={{ width: 140, padding: '6px 10px', fontSize: 13 }}
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                        />
                        <button
                            className="pp-btn pp-btn-primary pp-btn-sm"
                            onClick={() => loadDashboard(fromDate, toDate)}
                        >
                            Lọc
                        </button>
                    </div>
                </div>

                <div className="pp-stats-grid" style={{ marginBottom: 14 }}>
                    <div className="pp-stat-card success">
                        <span className="pp-stat-label">Đơn hoàn thành</span>
                        <span className="pp-stat-value">{fin.completedOrders ?? 0}</span>
                    </div>
                    <div className="pp-stat-card highlight" style={{ gridColumn: 'span 2' }}>
                        <span className="pp-stat-label">Tổng giá trị đơn</span>
                        <span className="pp-stat-value" style={{ fontSize: 20 }}>
                            {VND(fin.completedOrderValue)}
                        </span>
                    </div>
                    <div className="pp-stat-card warning">
                        <span className="pp-stat-label">Khoản hoàn tiền</span>
                        <span className="pp-stat-value" style={{ fontSize: 18 }}>
                            {VND(fin.approvedRefundAmount)}
                        </span>
                    </div>
                    <div className="pp-stat-card success" style={{ gridColumn: 'span 2' }}>
                        <span className="pp-stat-label">Doanh thu thực tế (sau hoàn tiền)</span>
                        <span className="pp-stat-value" style={{ fontSize: 20 }}>
                            {VND(fin.valueAfterApprovedRefunds)}
                        </span>
                    </div>
                </div>

                {fin.note && (
                    <div style={{ fontSize: 12, color: 'var(--pp-muted)', background: '#f8fafc', padding: '8px 12px', borderRadius: 6 }}>
                        ℹ️ {fin.note}
                    </div>
                )}
            </div>

            {/* KHỐI 4: ĐƠN HÀNG CHỜ XÁC NHẬN */}
            <div className="pp-card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <p className="pp-card-title" style={{ margin: 0 }}>
                        📋 Đơn hàng chờ xác nhận ({pendingBookings.length})
                    </p>
                    <button
                        className="pp-btn pp-btn-ghost pp-btn-sm"
                        onClick={() => navigate('/provider-portal/bookings')}
                    >
                        Xem tất cả đơn hàng →
                    </button>
                </div>

                {pendingBookings.length === 0 ? (
                    <div className="pp-empty" style={{ padding: '20px 0' }}>
                        <p>Hiện không có đơn hàng nào chờ xác nhận.</p>
                    </div>
                ) : (
                    <div className="pp-table-wrap">
                        <table className="pp-table">
                            <thead>
                                <tr>
                                    <th>Mã đơn</th>
                                    <th>Khách hàng</th>
                                    <th>Thời gian thực hiện</th>
                                    <th>Tổng tiền</th>
                                    <th>Trạng thái</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingBookings.map((b) => (
                                    <tr key={b.id}>
                                        <td><strong>{b.bookingCode}</strong></td>
                                        <td>{b.customerName || '—'}</td>
                                        <td>{b.scheduledStart ? new Date(b.scheduledStart).toLocaleString('vi-VN') : '—'}</td>
                                        <td>{VND(b.totalAmount)}</td>
                                        <td>{statusBadge(b.status)}</td>
                                        <td>
                                            <button
                                                className="pp-btn pp-btn-outline pp-btn-sm"
                                                onClick={() => navigate(`/provider-portal/bookings/${b.id}`)}
                                            >
                                                Xử lý →
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* KHỐI 5: YÊU CẦU THAY ĐỔI ĐÃ GỬI & CHỜ DUYỆT */}
            <div className="pp-card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <p className="pp-card-title" style={{ margin: 0 }}>
                        📝 Đề nghị thay đổi đã gửi ({recentRequests.length})
                    </p>
                    <span style={{ fontSize: 12, color: 'var(--pp-muted)' }}>
                        Các thay đổi phải được Admin duyệt trước khi có hiệu lực
                    </span>
                </div>

                {recentRequests.length === 0 ? (
                    <div className="pp-empty" style={{ padding: '20px 0' }}>
                        <p>Chưa có đề nghị thay đổi nào. Bạn có thể gửi yêu cầu cập nhật vị trí hoặc thông tin qua nút ở đầu trang.</p>
                    </div>
                ) : (
                    <div className="pp-table-wrap">
                        <table className="pp-table">
                            <thead>
                                <tr>
                                    <th>Mã #</th>
                                    <th>Loại thay đổi</th>
                                    <th>Lý do đề nghị</th>
                                    <th>Ngày gửi</th>
                                    <th>Trạng thái</th>
                                    <th>Ghi chú / Quyết định</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentRequests.map((r) => (
                                    <tr key={r.id}>
                                        <td><strong>#{r.id}</strong></td>
                                        <td>
                                            {r.requestType === 'LOCATION_UPDATE' && '📍 Thay đổi vị trí / Tọa độ'}
                                            {r.requestType === 'PROFILE_UPDATE' && '🏢 Thay đổi thông tin công ty'}
                                            {r.requestType === 'SERVICE_REGISTER' && '🧹 Đăng ký cung cấp dịch vụ'}
                                            {r.requestType === 'SERVICE_UPDATE' && '💵 Điều chỉnh giá dịch vụ'}
                                            {!['LOCATION_UPDATE', 'PROFILE_UPDATE', 'SERVICE_REGISTER', 'SERVICE_UPDATE'].includes(r.requestType) && r.requestType}
                                        </td>
                                        <td>{r.reason}</td>
                                        <td>{r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '—'}</td>
                                        <td>{statusBadge(r.status)}</td>
                                        <td>
                                            {r.status === 'REJECTED' && (
                                                <span style={{ color: 'var(--pp-danger)', fontSize: 12 }}>
                                                    Lý do từ chối: {r.rejectReason || 'Không chấp thuận'}
                                                </span>
                                            )}
                                            {r.status === 'APPROVED' && (
                                                <span style={{ color: 'var(--pp-success)', fontSize: 12 }}>
                                                    Đã áp dụng bởi {r.reviewedBy || 'Admin'}
                                                </span>
                                            )}
                                            {r.status === 'PENDING_REVIEW' && (
                                                <span style={{ color: 'var(--pp-warning)', fontSize: 12 }}>
                                                    Đang chờ Admin duyệt
                                                </span>
                                            )}
                                            {r.status === 'WITHDRAWN' && (
                                                <span style={{ color: 'var(--pp-muted)', fontSize: 12 }}>
                                                    Đã rút yêu cầu
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {r.status === 'PENDING_REVIEW' && (
                                                <button
                                                    className="pp-btn pp-btn-danger pp-btn-sm"
                                                    onClick={() => handleWithdraw(r.id)}
                                                >
                                                    Rút
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* KHỐI 6: KHIẾU NẠI LIÊN QUAN */}
            <div className="pp-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <p className="pp-card-title" style={{ margin: 0 }}>
                        🛡️ Khiếu nại từ khách hàng ({recentComplaints.length})
                    </p>
                    <button
                        className="pp-btn pp-btn-ghost pp-btn-sm"
                        onClick={() => navigate('/provider-portal/complaints')}
                    >
                        Quản lý khiếu nại →
                    </button>
                </div>

                {recentComplaints.length === 0 ? (
                    <div className="pp-empty" style={{ padding: '20px 0' }}>
                        <p>Không có khiếu nại nào liên quan đến đơn hàng của bạn.</p>
                    </div>
                ) : (
                    <div className="pp-table-wrap">
                        <table className="pp-table">
                            <thead>
                                <tr>
                                    <th>Mã #</th>
                                    <th>Mã đơn</th>
                                    <th>Tiêu đề khiếu nại</th>
                                    <th>Khách hàng</th>
                                    <th>Ngày tạo</th>
                                    <th>Trạng thái</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentComplaints.map((c) => (
                                    <tr key={c.id}>
                                        <td><strong>#{c.id}</strong></td>
                                        <td><strong>{c.bookingCode || '—'}</strong></td>
                                        <td>{c.subject}</td>
                                        <td>{c.reporterName || '—'}</td>
                                        <td>{c.createdAt ? new Date(c.createdAt).toLocaleString('vi-VN') : '—'}</td>
                                        <td>{statusBadge(c.status)}</td>
                                        <td>
                                            <button
                                                className="pp-btn pp-btn-outline pp-btn-sm"
                                                onClick={() => navigate(`/provider-portal/complaints`)}
                                            >
                                                Phản hồi →
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL POP-UP YÊU CẦU THAY ĐỔI THÔNG TIN / VỊ TRÍ */}
            {showChangeModal && (
                <div className="pp-modal-overlay">
                    <div className="pp-modal" style={{ maxWidth: 600 }}>
                        <div className="pp-modal-header">
                            <span className="pp-modal-title">Yêu cầu thay đổi hồ sơ doanh nghiệp</span>
                            <button className="pp-modal-close" onClick={() => setShowChangeModal(false)}>×</button>
                        </div>
                        <div className="pp-modal-body">
                            {/* Tab chọn loại thay đổi */}
                            <div className="pp-tabs" style={{ marginBottom: 16 }}>
                                <button
                                    className={`pp-tab ${modalTab === 'LOCATION_UPDATE' ? 'active' : ''}`}
                                    onClick={() => setModalTab('LOCATION_UPDATE')}
                                >
                                    📍 Vị trí & Tọa độ
                                </button>
                                <button
                                    className={`pp-tab ${modalTab === 'PROFILE_UPDATE' ? 'active' : ''}`}
                                    onClick={() => setModalTab('PROFILE_UPDATE')}
                                >
                                    🏢 Thông tin công ty
                                </button>
                            </div>

                            {modalError && <div className="pp-alert pp-alert-error">{modalError}</div>}

                            {modalTab === 'LOCATION_UPDATE' && (
                                <>
                                    <div className="pp-form-group">
                                        <label className="pp-label">Địa chỉ đề xuất mới *</label>
                                        <input
                                            className="pp-input"
                                            placeholder="Số nhà, đường, phường, quận..."
                                            value={propAddress}
                                            onChange={(e) => setPropAddress(e.target.value)}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <div className="pp-form-group">
                                            <label className="pp-label">Latitude đề xuất *</label>
                                            <input
                                                className="pp-input"
                                                type="number"
                                                step="0.0000001"
                                                placeholder="10.8300000"
                                                value={propLat}
                                                onChange={(e) => setPropLat(e.target.value)}
                                            />
                                        </div>
                                        <div className="pp-form-group">
                                            <label className="pp-label">Longitude đề xuất *</label>
                                            <input
                                                className="pp-input"
                                                type="number"
                                                step="0.0000001"
                                                placeholder="106.7340000"
                                                value={propLon}
                                                onChange={(e) => setPropLon(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Bảng so sánh Trước -> Sau */}
                                    <div style={{ marginTop: 10 }}>
                                        <label className="pp-label">So sánh đối chiếu Trước → Sau</label>
                                        <table className="pp-diff-table">
                                            <thead>
                                                <tr>
                                                    <th>Thông tin</th>
                                                    <th>Hiện tại (Đã duyệt)</th>
                                                    <th>Đề xuất mới</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td>Địa chỉ</td>
                                                    <td className="pp-diff-old">{p.address || 'Chưa có'}</td>
                                                    <td className="pp-diff-new">{propAddress || '—'}</td>
                                                </tr>
                                                <tr>
                                                    <td>Tọa độ</td>
                                                    <td className="pp-diff-old">{hasCoords ? `${p.latitude}, ${p.longitude}` : 'Chưa có'}</td>
                                                    <td className="pp-diff-new">{propLat && propLon ? `${propLat}, ${propLon}` : '—'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}

                            {modalTab === 'PROFILE_UPDATE' && (
                                <>
                                    <div className="pp-form-group">
                                        <label className="pp-label">Tên doanh nghiệp *</label>
                                        <input
                                            className="pp-input"
                                            value={propBusinessName}
                                            onChange={(e) => setPropBusinessName(e.target.value)}
                                        />
                                    </div>
                                    <div className="pp-form-group">
                                        <label className="pp-label">Mô tả hồ sơ</label>
                                        <textarea
                                            className="pp-textarea"
                                            value={propDesc}
                                            onChange={(e) => setPropDesc(e.target.value)}
                                        />
                                    </div>
                                    <div className="pp-form-group">
                                        <label className="pp-label">Mã số thuế</label>
                                        <input
                                            className="pp-input"
                                            value={propTaxCode}
                                            onChange={(e) => setPropTaxCode(e.target.value)}
                                        />
                                    </div>

                                    {/* Bảng so sánh Trước -> Sau */}
                                    <div style={{ marginTop: 10 }}>
                                        <label className="pp-label">So sánh đối chiếu Trước → Sau</label>
                                        <table className="pp-diff-table">
                                            <thead>
                                                <tr>
                                                    <th>Thông tin</th>
                                                    <th>Hiện tại (Đã duyệt)</th>
                                                    <th>Đề xuất mới</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td>Tên doanh nghiệp</td>
                                                    <td className="pp-diff-old">{p.businessName}</td>
                                                    <td className="pp-diff-new">{propBusinessName || '—'}</td>
                                                </tr>
                                                <tr>
                                                    <td>Mã số thuế</td>
                                                    <td className="pp-diff-old">{p.taxCode || 'Chưa có'}</td>
                                                    <td className="pp-diff-new">{propTaxCode || '—'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}

                            <div className="pp-form-group" style={{ marginTop: 14 }}>
                                <label className="pp-label">Lý do đề nghị thay đổi *</label>
                                <textarea
                                    className="pp-textarea"
                                    placeholder="Nêu rõ lý do cần điều chỉnh thông tin..."
                                    value={changeReason}
                                    onChange={(e) => setChangeReason(e.target.value)}
                                />
                            </div>

                            <p style={{ fontSize: 12, color: 'var(--pp-muted)', background: '#eff6ff', padding: '10px 14px', borderRadius: 8, margin: 0, border: '1px solid #bfdbfe' }}>
                                ℹ️ <strong>Quy tắc xét duyệt:</strong> Mọi thông tin đề xuất sẽ được lưu dưới dạng yêu cầu chờ duyệt (<code>PENDING_REVIEW</code>) và chỉ có hiệu lực sau khi Admin phê duyệt. Thông tin hiện tại vẫn áp dụng bình thường.
                            </p>
                        </div>
                        <div className="pp-modal-footer">
                            <button
                                className="pp-btn pp-btn-ghost"
                                onClick={() => setShowChangeModal(false)}
                            >
                                Hủy
                            </button>
                            <button
                                className="pp-btn pp-btn-primary"
                                onClick={handleSubmitChange}
                                disabled={submittingChange}
                            >
                                {submittingChange ? 'Đang gửi...' : 'Gửi yêu cầu xét duyệt'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default ProviderDashboard;
