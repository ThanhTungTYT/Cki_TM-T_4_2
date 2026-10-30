import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { providerScheduleApi } from '../../services/providerApi';

function toInputDate(d) {
    return d.toISOString().slice(0, 10);
}

function ProviderSchedule() {
    const navigate = useNavigate();
    const today = new Date();
    const [fromDate, setFromDate] = useState(toInputDate(today));
    const [toDate, setToDate] = useState(toInputDate(new Date(today.getTime() + 6 * 86400000)));
    const [schedule, setSchedule] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    function load() {
        setLoading(true);
        setError('');
        providerScheduleApi
            .get(fromDate, toDate)
            .then((data) => setSchedule(Array.isArray(data) ? data : []))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }

    useEffect(() => { load(); }, []); // eslint-disable-line

    function statusBadge(s) {
        const map = {
            ASSIGNED:  { cls: 'pp-badge-assigned',  label: 'Đã phân công' },
            ACCEPTED:  { cls: 'pp-badge-confirmed', label: 'Đã nhận' },
            STARTED:   { cls: 'pp-badge-warning',   label: 'Đang làm' },
            COMPLETED: { cls: 'pp-badge-completed', label: 'Hoàn thành' },
        };
        const cfg = map[(s || '').toUpperCase()] || { cls: '', label: s || '—' };
        return <span className={`pp-badge ${cfg.cls}`}>{cfg.label}</span>;
    }

    // Group by date
    const grouped = schedule.reduce((acc, item) => {
        const date = item.scheduledStart
            ? new Date(item.scheduledStart).toLocaleDateString('vi-VN', {
                  weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
              })
            : 'Chưa xác định';
        if (!acc[date]) acc[date] = [];
        acc[date].push(item);
        return acc;
    }, {});

    return (
        <>
            <div className="pp-page-header">
                <h1 className="pp-page-title">Lịch làm việc</h1>
            </div>

            {/* Date range filter */}
            <div className="pp-card" style={{ marginBottom: 16, padding: '14px 20px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="pp-form-group" style={{ margin: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <label className="pp-label" style={{ whiteSpace: 'nowrap' }}>Từ ngày</label>
                        <input
                            className="pp-input"
                            type="date"
                            style={{ width: 150 }}
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                        />
                    </div>
                    <div className="pp-form-group" style={{ margin: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <label className="pp-label" style={{ whiteSpace: 'nowrap' }}>Đến ngày</label>
                        <input
                            className="pp-input"
                            type="date"
                            style={{ width: 150 }}
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                        />
                    </div>
                    <button className="pp-btn pp-btn-primary" onClick={load} disabled={loading}>
                        {loading ? 'Đang tải...' : 'Xem lịch'}
                    </button>
                </div>
            </div>

            {error && <div className="pp-alert pp-alert-error">⚠️ {error}</div>}

            {!loading && !error && schedule.length === 0 && (
                <div className="pp-card">
                    <div className="pp-empty">
                        <p>Không có lịch làm việc nào trong khoảng thời gian này.</p>
                    </div>
                </div>
            )}

            {/* Grouped schedule */}
            {Object.entries(grouped).map(([date, items]) => (
                <div key={date} className="pp-card" style={{ marginBottom: 16 }}>
                    <p className="pp-card-title" style={{ textTransform: 'capitalize' }}>
                        📅 {date} ({items.length} lịch)
                    </p>
                    <div className="pp-table-wrap">
                        <table className="pp-table">
                            <thead>
                                <tr>
                                    <th>Giờ</th>
                                    <th>Mã đơn</th>
                                    <th>Khách hàng</th>
                                    <th>Nhân viên</th>
                                    <th>TT phân công</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.assignmentId}>
                                        <td>
                                            {item.scheduledStart
                                                ? new Date(item.scheduledStart).toLocaleTimeString('vi-VN', {
                                                      hour: '2-digit', minute: '2-digit',
                                                  })
                                                : '—'}
                                            {item.scheduledEnd && (
                                                <>
                                                    {' – '}
                                                    {new Date(item.scheduledEnd).toLocaleTimeString('vi-VN', {
                                                        hour: '2-digit', minute: '2-digit',
                                                    })}
                                                </>
                                            )}
                                        </td>
                                        <td><strong>{item.bookingCode}</strong></td>
                                        <td>{item.customerName || '—'}</td>
                                        <td>
                                            {item.employeeName
                                                ? `${item.employeeName} (${item.employeeCode})`
                                                : '—'}
                                        </td>
                                        <td>{statusBadge(item.assignmentStatus)}</td>
                                        <td>
                                            <button
                                                className="pp-btn pp-btn-ghost pp-btn-sm"
                                                onClick={() =>
                                                    navigate(`/provider-portal/bookings/${item.bookingId}`)
                                                }
                                            >
                                                Xem đơn
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </>
    );
}

export default ProviderSchedule;
