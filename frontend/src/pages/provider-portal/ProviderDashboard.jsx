import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { providerDashboardApi } from '../../services/providerApi';

const VND = (v) =>
    v != null
        ? `${Number(v).toLocaleString('vi-VN')}đ`
        : '—';

function statusBadge(status) {
    const map = {
        PENDING_PROVIDER: { cls: 'pp-badge-pending',   label: 'Chờ duyệt' },
        CONFIRMED:        { cls: 'pp-badge-confirmed',  label: 'Đã xác nhận' },
        ASSIGNED:         { cls: 'pp-badge-assigned',   label: 'Đã phân công' },
        COMPLETED:        { cls: 'pp-badge-completed',  label: 'Hoàn thành' },
        CANCELLED:        { cls: 'pp-badge-cancelled',  label: 'Đã hủy' },
    };
    const s = (status || '').toUpperCase();
    const matched = Object.entries(map).find(([k]) => s.includes(k) || s === k);
    const cfg = matched ? matched[1] : { cls: '', label: status || '—' };
    return <span className={`pp-badge ${cfg.cls}`}>{cfg.label}</span>;
}

function ProviderDashboard() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        providerDashboardApi
            .get()
            .then(setData)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="pp-loading">Đang tải tổng quan...</div>;
    }

    if (error) {
        return (
            <div className="pp-alert pp-alert-error">
                ⚠️ {error}
            </div>
        );
    }

    const stats = data?.stats || {};
    const pending = data?.pendingBookings || [];

    return (
        <>
            <div className="pp-page-header">
                <h1 className="pp-page-title">Tổng quan</h1>
            </div>

            {/* Stat cards */}
            <div className="pp-stats-grid">
                <div className="pp-stat-card warning">
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
                <div className="pp-stat-card">
                    <span className="pp-stat-label">Nhân viên</span>
                    <span className="pp-stat-value">{stats.totalEmployees ?? 0}</span>
                </div>
                <div className="pp-stat-card success">
                    <span className="pp-stat-label">Doanh thu tháng</span>
                    <span className="pp-stat-value" style={{ fontSize: 16, marginTop: 4 }}>
                        {VND(stats.revenueThisMonth)}
                    </span>
                </div>
            </div>

            {/* Pending bookings table */}
            <div className="pp-card">
                <p className="pp-card-title">
                    📋 Đơn hàng chờ xác nhận ({pending.length})
                </p>

                {pending.length === 0 ? (
                    <div className="pp-empty">
                        <p>Không có đơn hàng nào đang chờ xác nhận.</p>
                    </div>
                ) : (
                    <div className="pp-table-wrap">
                        <table className="pp-table">
                            <thead>
                                <tr>
                                    <th>Mã đơn</th>
                                    <th>Khách hàng</th>
                                    <th>Ngày thực hiện</th>
                                    <th>Tổng tiền</th>
                                    <th>Trạng thái</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {pending.map((b) => (
                                    <tr key={b.id}>
                                        <td>
                                            <strong>{b.bookingCode}</strong>
                                        </td>
                                        <td>{b.customerName || '—'}</td>
                                        <td>
                                            {b.scheduledStart
                                                ? new Date(b.scheduledStart).toLocaleString('vi-VN', {
                                                      day: '2-digit',
                                                      month: '2-digit',
                                                      year: 'numeric',
                                                      hour: '2-digit',
                                                      minute: '2-digit',
                                                  })
                                                : '—'}
                                        </td>
                                        <td>{VND(b.totalAmount)}</td>
                                        <td>{statusBadge(b.status)}</td>
                                        <td>
                                            <button
                                                className="pp-btn pp-btn-outline pp-btn-sm"
                                                onClick={() =>
                                                    navigate(`/provider-portal/bookings/${b.id}`)
                                                }
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

                <div style={{ marginTop: 14 }}>
                    <button
                        className="pp-btn pp-btn-ghost pp-btn-sm"
                        onClick={() => navigate('/provider-portal/bookings')}
                    >
                        Xem tất cả đơn hàng
                    </button>
                </div>
            </div>
        </>
    );
}

export default ProviderDashboard;
