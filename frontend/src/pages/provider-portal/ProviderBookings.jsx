import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { providerBookingApi } from '../../services/providerApi';

const VND = (v) => (v != null ? `${Number(v).toLocaleString('vi-VN')}đ` : '—');

const STATUS_CONFIG = {
    PENDING_PROVIDER: { cls: 'pp-badge-pending',   label: 'Chờ duyệt' },
    CONFIRMED:        { cls: 'pp-badge-confirmed',  label: 'Đã xác nhận' },
    ASSIGNED:         { cls: 'pp-badge-assigned',   label: 'Đã phân công' },
    COMPLETED:        { cls: 'pp-badge-completed',  label: 'Hoàn thành' },
    CANCELLED_BY_CUSTOMER: { cls: 'pp-badge-cancelled', label: 'KH hủy' },
    CANCELLED_BY_PROVIDER: { cls: 'pp-badge-cancelled', label: 'NCC hủy' },
    CANCELLED_BY_ADMIN:    { cls: 'pp-badge-cancelled', label: 'Admin hủy' },
};

function statusBadge(status) {
    const cfg = STATUS_CONFIG[(status || '').toUpperCase()] ||
                { cls: '', label: status || '—' };
    return <span className={`pp-badge ${cfg.cls}`}>{cfg.label}</span>;
}

const STATUS_FILTERS = [
    { value: '', label: 'Tất cả' },
    { value: 'PENDING_PROVIDER', label: 'Chờ duyệt' },
    { value: 'CONFIRMED', label: 'Đã xác nhận' },
    { value: 'ASSIGNED', label: 'Đã phân công' },
    { value: 'COMPLETED', label: 'Hoàn thành' },
    { value: 'CANCEL', label: 'Đã hủy' },
];

function ProviderBookings() {
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        setLoading(true);
        providerBookingApi
            .list()
            .then((data) => setBookings(Array.isArray(data) ? data : []))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    const filtered = bookings.filter((b) => {
        const matchStatus = !filter ||
            (filter === 'CANCEL'
                ? (b.status || '').toUpperCase().includes('CANCEL')
                : (b.status || '').toUpperCase() === filter);
        const matchSearch =
            !search ||
            (b.bookingCode || '').toLowerCase().includes(search.toLowerCase()) ||
            (b.customerName || '').toLowerCase().includes(search.toLowerCase());
        return matchStatus && matchSearch;
    });

    return (
        <>
            <div className="pp-page-header">
                <h1 className="pp-page-title">Đơn hàng ({filtered.length})</h1>
            </div>

            {/* Filters */}
            <div className="pp-card" style={{ marginBottom: 16, padding: '14px 20px' }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        className="pp-input"
                        style={{ maxWidth: 240 }}
                        placeholder="Tìm mã đơn, khách hàng..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <select
                        className="pp-select"
                        style={{ maxWidth: 180 }}
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    >
                        {STATUS_FILTERS.map((f) => (
                            <option key={f.value} value={f.value}>
                                {f.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {loading && <div className="pp-loading">Đang tải đơn hàng...</div>}
            {error  && <div className="pp-alert pp-alert-error">⚠️ {error}</div>}

            {!loading && !error && (
                <div className="pp-card" style={{ padding: 0 }}>
                    {filtered.length === 0 ? (
                        <div className="pp-empty">
                            <p>Không có đơn hàng nào phù hợp.</p>
                        </div>
                    ) : (
                        <div className="pp-table-wrap">
                            <table className="pp-table">
                                <thead>
                                    <tr>
                                        <th>Mã đơn</th>
                                        <th>Khách hàng</th>
                                        <th>SĐT</th>
                                        <th>Ngày thực hiện</th>
                                        <th>Tổng tiền</th>
                                        <th>Trạng thái</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((b) => (
                                        <tr key={b.id}>
                                            <td>
                                                <strong>{b.bookingCode}</strong>
                                            </td>
                                            <td>{b.customerName || '—'}</td>
                                            <td>{b.customerPhone || '—'}</td>
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
                                                        navigate(
                                                            `/provider-portal/bookings/${b.id}`
                                                        )
                                                    }
                                                >
                                                    Chi tiết
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

export default ProviderBookings;
