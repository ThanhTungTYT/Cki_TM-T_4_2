import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { providerScheduleApi, providerEmployeeApi } from '../../services/providerApi';

function toInputDate(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseLocalDate(dateStr) {
    if (!dateStr) return null;
    // Handles ISO strings like 2026-11-06T08:30:00 or yyyy-mm-dd
    const [dPart] = dateStr.split('T');
    const [y, m, d] = dPart.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function ProviderSchedule() {
    const navigate = useNavigate();
    const today = new Date();
    
    // Default: next 7 days
    const [fromDate, setFromDate] = useState(toInputDate(today));
    const [toDate, setToDate] = useState(toInputDate(new Date(today.getTime() + 6 * 86400000)));
    
    const [schedule, setSchedule] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('ALL');
    const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'list'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Load employees for filter dropdown
    useEffect(() => {
        providerEmployeeApi.list()
            .then(data => setEmployees(Array.isArray(data) ? data : []))
            .catch(() => {});
    }, []);

    function loadSchedule() {
        setLoading(true);
        setError('');
        providerScheduleApi
            .get(fromDate, toDate)
            .then((data) => setSchedule(Array.isArray(data) ? data : []))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        loadSchedule();
    }, [fromDate, toDate]);

    // Quick date filters
    function setPreset(days) {
        const start = new Date();
        const end = new Date(start.getTime() + days * 86400000);
        setFromDate(toInputDate(start));
        setToDate(toInputDate(end));
    }

    function setThisWeek() {
        const curr = new Date();
        const day = curr.getDay(); // 0 is Sunday
        const diffToMon = curr.getDate() - day + (day === 0 ? -6 : 1);
        const mon = new Date(curr.setDate(diffToMon));
        const sun = new Date(mon.getTime() + 6 * 86400000);
        setFromDate(toInputDate(mon));
        setToDate(toInputDate(sun));
    }

    function statusBadge(s) {
        const map = {
            ASSIGNED:  { cls: 'pp-badge-assigned',  label: 'Đã phân công' },
            ACCEPTED:  { cls: 'pp-badge-confirmed', label: 'Đã nhận việc' },
            STARTED:   { cls: 'pp-badge-warning',   label: 'Đang làm' },
            COMPLETED: { cls: 'pp-badge-completed', label: 'Hoàn thành' },
            CANCELLED: { cls: 'pp-badge-cancelled', label: 'Đã hủy' },
            REJECTED:  { cls: 'pp-badge-rejected',  label: 'Từ chối' },
        };
        const cfg = map[(s || '').toUpperCase()] || { cls: '', label: s || '—' };
        return <span className={`pp-badge ${cfg.cls}`}>{cfg.label}</span>;
    }

    // Filter items by employee
    const filteredSchedule = useMemo(() => {
        if (selectedEmployeeId === 'ALL') return schedule;
        return schedule.filter(item => String(item.employeeId) === String(selectedEmployeeId));
    }, [schedule, selectedEmployeeId]);

    // Generate all dates in selected range for calendar view
    const dateRangeList = useMemo(() => {
        const dates = [];
        const start = parseLocalDate(fromDate);
        const end = parseLocalDate(toDate);
        if (!start || !end || start > end) return dates;

        const curr = new Date(start);
        // limit to max 31 days to avoid browser lockup
        let count = 0;
        while (curr <= end && count < 31) {
            dates.push(toInputDate(curr));
            curr.setDate(curr.getDate() + 1);
            count++;
        }
        return dates;
    }, [fromDate, toDate]);

    // Group filtered schedule by date string YYYY-MM-DD
    const groupedByDate = useMemo(() => {
        const groups = {};
        for (const item of filteredSchedule) {
            if (!item.scheduledStart) continue;
            const dateStr = item.scheduledStart.slice(0, 10);
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(item);
        }
        // sort items within date by scheduledStart
        Object.keys(groups).forEach(d => {
            groups[d].sort((a, b) => (a.scheduledStart || '').localeCompare(b.scheduledStart || ''));
        });
        return groups;
    }, [filteredSchedule]);

    // Summary statistics
    const stats = useMemo(() => {
        const total = filteredSchedule.length;
        const active = filteredSchedule.filter(i => ['ASSIGNED', 'ACCEPTED', 'STARTED'].includes((i.assignmentStatus || '').toUpperCase())).length;
        const completed = filteredSchedule.filter(i => (i.assignmentStatus || '').toUpperCase() === 'COMPLETED').length;
        const uniqueEmployees = new Set(filteredSchedule.map(i => i.employeeId).filter(Boolean)).size;
        return { total, active, completed, uniqueEmployees };
    }, [filteredSchedule]);

    return (
        <div className="pp-schedule-page">
            <div className="pp-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 className="pp-page-title">Lịch làm việc nhân viên</h1>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                        Theo dõi tiến độ và lịch ca theo quy tắc tối ưu: mỗi nhân viên nhận tối đa 1 dịch vụ/ngày.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div className="pp-btn-group" style={{ display: 'inline-flex', background: '#f1f5f9', padding: 3, borderRadius: 8 }}>
                        <button
                            type="button"
                            className={`pp-btn pp-btn-sm ${viewMode === 'calendar' ? 'pp-btn-primary' : 'pp-btn-ghost'}`}
                            style={{ margin: 0, padding: '6px 14px', borderRadius: 6 }}
                            onClick={() => setViewMode('calendar')}
                        >
                            📅 Lịch Tuần / Grid
                        </button>
                        <button
                            type="button"
                            className={`pp-btn pp-btn-sm ${viewMode === 'list' ? 'pp-btn-primary' : 'pp-btn-ghost'}`}
                            style={{ margin: 0, padding: '6px 14px', borderRadius: 6 }}
                            onClick={() => setViewMode('list')}
                        >
                            📋 Dạng Danh Sách
                        </button>
                    </div>
                </div>
            </div>

            {/* F01 Rule Banner */}
            <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 13,
                color: '#1e40af'
            }}>
                <span style={{ fontSize: 18 }}>💡</span>
                <div>
                    <strong>Quy tắc phân công (F01):</strong> Mỗi nhân viên chỉ làm việc <strong>1 dịch vụ duy nhất trong 1 ngày</strong> theo khung giờ khách yêu cầu. Thời gian ca trong mô tả là thời gian ước tính dự kiến.
                </div>
            </div>

            {/* Filter toolbar */}
            <div className="pp-card" style={{ marginBottom: 16, padding: '14px 20px' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Date Inputs */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label className="pp-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Từ ngày:</label>
                        <input
                            className="pp-input"
                            type="date"
                            style={{ width: 145 }}
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label className="pp-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Đến ngày:</label>
                        <input
                            className="pp-input"
                            type="date"
                            style={{ width: 145 }}
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                        />
                    </div>

                    {/* Quick presets */}
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="pp-btn pp-btn-ghost pp-btn-sm" onClick={() => setPreset(0)}>Hôm nay</button>
                        <button type="button" className="pp-btn pp-btn-ghost pp-btn-sm" onClick={setThisWeek}>Tuần này</button>
                        <button type="button" className="pp-btn pp-btn-ghost pp-btn-sm" onClick={() => setPreset(6)}>7 ngày tới</button>
                    </div>

                    {/* Employee Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                        <label className="pp-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Nhân viên:</label>
                        <select
                            className="pp-input"
                            style={{ minWidth: 180 }}
                            value={selectedEmployeeId}
                            onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        >
                            <option value="ALL">Tất cả nhân viên ({employees.length})</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.fullName || emp.user?.fullName} ({emp.employeeCode || emp.code})
                                </option>
                            ))}
                        </select>
                    </div>

                    <button className="pp-btn pp-btn-primary pp-btn-sm" onClick={loadSchedule} disabled={loading}>
                        {loading ? 'Đang tải...' : 'Làm mới'}
                    </button>
                </div>
            </div>

            {error && <div className="pp-alert pp-alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

            {/* Summary Stats */}
            <div className="pp-stats-grid" style={{ marginBottom: 20 }}>
                <div className="pp-stat-card">
                    <span className="pp-stat-label">Tổng ca phân công</span>
                    <span className="pp-stat-value">{stats.total}</span>
                </div>
                <div className="pp-stat-card warning">
                    <span className="pp-stat-label">Đang thực hiện / Chưa xong</span>
                    <span className="pp-stat-value">{stats.active}</span>
                </div>
                <div className="pp-stat-card success">
                    <span className="pp-stat-label">Đã hoàn thành</span>
                    <span className="pp-stat-value">{stats.completed}</span>
                </div>
                <div className="pp-stat-card highlight">
                    <span className="pp-stat-label">Nhân viên bận ca</span>
                    <span className="pp-stat-value">{stats.uniqueEmployees}</span>
                </div>
            </div>

            {/* Main Content Area */}
            {viewMode === 'calendar' ? (
                <div className="pp-calendar-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 16,
                    alignItems: 'start'
                }}>
                    {dateRangeList.map(dateStr => {
                        const items = groupedByDate[dateStr] || [];
                        const dObj = parseLocalDate(dateStr);
                        const isToday = toInputDate(today) === dateStr;
                        const dateFormatted = dObj ? dObj.toLocaleDateString('vi-VN', {
                            weekday: 'short', day: '2-digit', month: '2-digit'
                        }) : dateStr;

                        return (
                            <div
                                key={dateStr}
                                className="pp-card"
                                style={{
                                    padding: 14,
                                    background: isToday ? '#faf5ff' : '#ffffff',
                                    border: isToday ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
                                    borderRadius: 10,
                                    minHeight: 180
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 12,
                                    borderBottom: '1px solid #f1f5f9',
                                    paddingBottom: 8
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontWeight: 700, fontSize: 14, color: isToday ? '#7c3aed' : '#1e293b' }}>
                                            {dateFormatted}
                                        </span>
                                        {isToday && (
                                            <span style={{
                                                fontSize: 10,
                                                fontWeight: 700,
                                                background: '#8b5cf6',
                                                color: '#fff',
                                                padding: '2px 6px',
                                                borderRadius: 10
                                            }}>
                                                HÔM NAY
                                            </span>
                                        )}
                                    </div>
                                    <span style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        padding: '2px 8px',
                                        borderRadius: 12,
                                        background: items.length > 0 ? '#e0f2fe' : '#f1f5f9',
                                        color: items.length > 0 ? '#0369a1' : '#94a3b8'
                                    }}>
                                        {items.length} việc
                                    </span>
                                </div>

                                {items.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '24px 8px', color: '#94a3b8', fontSize: 13 }}>
                                        <div style={{ fontSize: 24, marginBottom: 4 }}>☕</div>
                                        Trống lịch
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {items.map(item => (
                                            <div
                                                key={item.assignmentId}
                                                style={{
                                                    background: '#ffffff',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: 8,
                                                    padding: 10,
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                onClick={() => navigate(`/provider-portal/bookings/${item.bookingId}`)}
                                                title="Bấm để xem chi tiết đơn hàng"
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                    <span style={{ fontWeight: 700, color: '#2563eb', fontSize: 13 }}>
                                                        {item.bookingCode}
                                                    </span>
                                                    {statusBadge(item.assignmentStatus)}
                                                </div>

                                                <div style={{ fontSize: 12, color: '#334155', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <span>⏰</span>
                                                    <strong>
                                                        {item.scheduledStart ? new Date(item.scheduledStart).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                                    </strong>
                                                    {item.scheduledEnd && (
                                                        <span> - {new Date(item.scheduledEnd).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    )}
                                                </div>

                                                <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
                                                    👤 Khách: <strong>{item.customerName || '—'}</strong>
                                                </div>

                                                <div style={{
                                                    fontSize: 11.5,
                                                    color: '#047857',
                                                    background: '#ecfdf5',
                                                    padding: '4px 6px',
                                                    borderRadius: 4,
                                                    marginTop: 4,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between'
                                                }}>
                                                    <span>🧹 {item.employeeName || 'Chưa gán'} ({item.employeeCode || '—'})</span>
                                                    <span style={{ fontSize: 10, color: '#059669', fontWeight: 600 }}>1 ca/ngày</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* List View */
                <div>
                    {filteredSchedule.length === 0 ? (
                        <div className="pp-card">
                            <div className="pp-empty" style={{ padding: 40, textAlign: 'center' }}>
                                <div style={{ fontSize: 40, marginBottom: 8 }}>📅</div>
                                <p style={{ color: '#64748b' }}>Không có lịch làm việc nào trong khoảng thời gian và bộ lọc đã chọn.</p>
                            </div>
                        </div>
                    ) : (
                        Object.entries(groupedByDate).map(([dateStr, items]) => {
                            const dObj = parseLocalDate(dateStr);
                            const dateTitle = dObj ? dObj.toLocaleDateString('vi-VN', {
                                weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
                            }) : dateStr;

                            return (
                                <div key={dateStr} className="pp-card" style={{ marginBottom: 16 }}>
                                    <p className="pp-card-title" style={{ textTransform: 'capitalize' }}>
                                        📅 {dateTitle} ({items.length} việc)
                                    </p>
                                    <div className="pp-table-wrap">
                                        <table className="pp-table">
                                            <thead>
                                                <tr>
                                                    <th>Giờ làm</th>
                                                    <th>Mã đơn</th>
                                                    <th>Khách hàng</th>
                                                    <th>Nhân viên đảm nhận (F01)</th>
                                                    <th>Trạng thái phân công</th>
                                                    <th>Hành động</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map((item) => (
                                                    <tr key={item.assignmentId}>
                                                        <td>
                                                            <strong>
                                                                {item.scheduledStart
                                                                    ? new Date(item.scheduledStart).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                                                                    : '—'}
                                                            </strong>
                                                            {item.scheduledEnd && (
                                                                <>
                                                                    {' – '}
                                                                    {new Date(item.scheduledEnd).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                                </>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <strong style={{ color: 'var(--pp-navy)' }}>{item.bookingCode}</strong>
                                                        </td>
                                                        <td>{item.customerName || '—'}</td>
                                                        <td>
                                                            {item.employeeName ? (
                                                                <div>
                                                                    <span style={{ fontWeight: 600 }}>{item.employeeName}</span>{' '}
                                                                    <span style={{ fontSize: 12, color: '#64748b' }}>({item.employeeCode})</span>
                                                                </div>
                                                            ) : (
                                                                <span style={{ color: '#94a3b8' }}>Chưa phân công</span>
                                                            )}
                                                        </td>
                                                        <td>{statusBadge(item.assignmentStatus)}</td>
                                                        <td>
                                                            <button
                                                                className="pp-btn pp-btn-ghost pp-btn-sm"
                                                                onClick={() => navigate(`/provider-portal/bookings/${item.bookingId}`)}
                                                            >
                                                                Xem chi tiết
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

export default ProviderSchedule;
