
import { useEffect, useMemo, useState } from 'react';
import { bookingApi } from '../../services/api';
import './CleanerWorkspace.css';

const INITIAL_NOW = new Date();

const pad = (n) => String(n).padStart(2, '0');

const dateKey = (value) => {
    if (!value) return '';

    const d = new Date(value);

    return Number.isNaN(d.getTime())
        ? ''
        : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const dateLabel = (value) => {
    if (!value) return 'Chưa xác định';

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) return 'Chưa xác định';

    return d.toLocaleString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

const timeLabel = (value) => {
    if (!value) return '--:--';

    const d = new Date(value);

    return Number.isNaN(d.getTime())
        ? '--:--'
        : d.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });
};

const dateTimeLabel = (value) => {
    if (!value) return 'Chưa xác định';

    const d = new Date(value);

    return Number.isNaN(d.getTime())
        ? 'Chưa xác định'
        : d.toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
};

const normalizeStatus = (value) =>
    String(value || '').trim().toUpperCase();

const STATUS_CONFIG = {
    PENDING_ACCEPTANCE: {
        label: 'Chờ nhận việc',
        type: 'waiting'
    },
    ASSIGNED: {
        label: 'Chờ nhận việc',
        type: 'waiting'
    },
    ACCEPTED: {
        label: 'Đã nhận việc',
        type: 'confirmed'
    },
    ON_THE_WAY: {
        label: 'Đang di chuyển',
        type: 'confirmed'
    },
    EN_ROUTE: {
        label: 'Đang di chuyển',
        type: 'confirmed'
    },
    IN_PROGRESS: {
        label: 'Đang thực hiện',
        type: 'confirmed'
    },
    WORK_SUBMITTED: {
        label: 'Đã nộp kết quả',
        type: 'waiting'
    },
    AWAITING_CONFIRMATION: {
        label: 'Chờ xác nhận',
        type: 'waiting'
    },
    COMPLETED: {
        label: 'Hoàn thành',
        type: 'success'
    },
    DECLINED: {
        label: 'Đã từ chối',
        type: 'cancelled'
    },
    EXPIRED: {
        label: 'Hết hạn',
        type: 'cancelled'
    },
    CANCELLED: {
        label: 'Đã hủy',
        type: 'cancelled'
    }
};

const statusLabel = (status) =>
    STATUS_CONFIG[normalizeStatus(status)]?.label ||
    status ||
    'Chưa xác định';

const isCancelled = (status) =>
    ['DECLINED', 'EXPIRED', 'CANCELLED', 'REJECTED']
        .includes(normalizeStatus(status));

const getServiceName = (booking) =>
    booking?.items
        ?.map((item) => item.serviceName)
        .filter(Boolean)
        .join(', ') ||
    booking?.bookingCode ||
    `Đơn #${booking?.id || '—'}`;

const getAssignmentRange = (assignment) => {
    const booking = assignment.booking || {};

    const start = booking.scheduledStart
        ? new Date(booking.scheduledStart).getTime()
        : NaN;

    const end = booking.scheduledEnd
        ? new Date(booking.scheduledEnd).getTime()
        : NaN;

    if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end <= start
    ) {
        return null;
    }

    return { start, end };
};

/**
 * Kiểm tra hai khoảng thời gian có giao nhau không.
 * Dùng quy tắc [start, end), không tự giả định thời gian đệm.
 */
const isTimeOverlapping = (first, second) =>
    first.start < second.end &&
    first.end > second.start;

export default function CleanerCalendar() {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    const [month, setMonth] = useState(() =>
        new Date(
            INITIAL_NOW.getFullYear(),
            INITIAL_NOW.getMonth(),
            1
        )
    );

    const [selected, setSelected] = useState(() =>
        dateKey(INITIAL_NOW)
    );

    const [todayKey, setTodayKey] = useState(() =>
        dateKey(INITIAL_NOW)
    );

    const [currentTime, setCurrentTime] = useState(() =>
        INITIAL_NOW.getTime()
    );

    const [statusFilter, setStatusFilter] = useState('ALL');

    // Tải dữ liệu lần đầu: chỉ cập nhật state sau khi Promise hoàn tất.
    useEffect(() => {
        let active = true;

        const fetchAssignments = async () => {
            try {
                const rows = await bookingApi.getCleanerAssignments();

                if (!active) return;

                setAssignments(Array.isArray(rows) ? rows : []);
                setError('');
            } catch (e) {
                if (active) {
                    setError(
                        e.message || 'Không thể tải lịch làm việc.'
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        fetchAssignments();

        return () => {
            active = false;
        };
    }, []);

    // Làm mới thủ công.
    const loadAssignments = async () => {
        setRefreshing(true);
        setError('');

        try {
            const rows = await bookingApi.getCleanerAssignments();

            setAssignments(Array.isArray(rows) ? rows : []);
            setCurrentTime(Date.now());
        } catch (e) {
            setError(
                e.message || 'Không thể tải lịch làm việc.'
            );
        } finally {
            setRefreshing(false);
        }
    };

    const jobs = useMemo(() => {
        return assignments
            .map((assignment) => ({
                ...assignment,
                booking: assignment.booking || {}
            }))
            .filter((assignment) => {
                const status = normalizeStatus(
                    assignment.assignmentStatus ||
                    assignment.status
                );

                return (
                    assignment.booking.scheduledStart &&
                    !isCancelled(status)
                );
            })
            .sort((a, b) =>
                new Date(a.booking.scheduledStart) -
                new Date(b.booking.scheduledStart)
            );
    }, [assignments]);

    /**
     * Tìm các phân công có giờ thực tế bị trùng.
     */
    const conflictIds = useMemo(() => {
        const conflicts = new Set();

        for (let i = 0; i < jobs.length; i += 1) {
            const first = jobs[i];
            const firstRange = getAssignmentRange(first);

            if (!firstRange) continue;

            for (let j = i + 1; j < jobs.length; j += 1) {
                const second = jobs[j];
                const secondRange = getAssignmentRange(second);

                if (!secondRange) continue;

                if (isTimeOverlapping(firstRange, secondRange)) {
                    conflicts.add(first.assignmentId);
                    conflicts.add(second.assignmentId);
                }
            }
        }

        return conflicts;
    }, [jobs]);

    const jobsByDay = useMemo(() => {
        return jobs.reduce((acc, assignment) => {
            const key = dateKey(
                assignment.booking.scheduledStart
            );

            if (!key) return acc;

            if (!acc[key]) {
                acc[key] = [];
            }

            acc[key].push(assignment);

            return acc;
        }, {});
    }, [jobs]);

    const firstDay = new Date(
        month.getFullYear(),
        month.getMonth(),
        1
    );

    const offset = (firstDay.getDay() + 6) % 7;

    const days = new Date(
        month.getFullYear(),
        month.getMonth() + 1,
        0
    ).getDate();

    const selectedJobs = useMemo(() => {
        const rows = jobsByDay[selected] || [];

        if (statusFilter === 'ALL') {
            return rows;
        }

        return rows.filter((assignment) => {
            const status = normalizeStatus(
                assignment.assignmentStatus ||
                assignment.status
            );

            if (statusFilter === 'WAITING') {
                return [
                    'ASSIGNED',
                    'PENDING_ACCEPTANCE'
                ].includes(status);
            }

            if (statusFilter === 'ACCEPTED') {
                return status === 'ACCEPTED';
            }

            if (statusFilter === 'IN_PROGRESS') {
                return [
                    'ON_THE_WAY',
                    'EN_ROUTE',
                    'IN_PROGRESS'
                ].includes(status);
            }

            if (statusFilter === 'SUBMITTED') {
                return [
                    'WORK_SUBMITTED',
                    'AWAITING_CONFIRMATION'
                ].includes(status);
            }

            if (statusFilter === 'COMPLETED') {
                return status === 'COMPLETED';
            }

            return true;
        });
    }, [jobsByDay, selected, statusFilter]);

    const monthJobs = useMemo(() => {
        return jobs.filter((assignment) => {
            const d = new Date(
                assignment.booking.scheduledStart
            );

            return (
                d.getFullYear() === month.getFullYear() &&
                d.getMonth() === month.getMonth()
            );
        });
    }, [jobs, month]);

    const upcomingCount = useMemo(() => {
        return jobs.filter((assignment) => {
            const start = new Date(
                assignment.booking.scheduledStart
            ).getTime();

            return (
                Number.isFinite(start) &&
                start >= currentTime
            );
        }).length;
    }, [jobs, currentTime]);

    const conflictCount = conflictIds.size;

    const goToToday = () => {
        const now = new Date();
        const key = dateKey(now);

        setMonth(new Date(
            now.getFullYear(),
            now.getMonth(),
            1
        ));

        setSelected(key);
        setTodayKey(key);
        setCurrentTime(now.getTime());
    };

    const changeMonth = (amount) => {
        setMonth((current) =>
            new Date(
                current.getFullYear(),
                current.getMonth() + amount,
                1
            )
        );
    };

    const selectDay = (key) => {
        setSelected(key);
    };

    return (
        <section className="cw-page">
            <header className="cw-heading">
                <div>
                    <span className="cw-eyebrow">
                        LỊCH CÁ NHÂN
                    </span>

                    <h1>Lịch làm việc</h1>

                    <p>
                        Theo dõi các công việc được phân công
                        theo ngày và kiểm tra thời gian làm việc.
                    </p>
                </div>

                <div className="cw-heading-actions">
                    <button
                        type="button"
                        className="cw-button secondary"
                        disabled={loading || refreshing}
                        onClick={loadAssignments}
                    >
                        {refreshing ? 'Đang tải...' : 'Làm mới'}
                    </button>

                    <button
                        type="button"
                        className="cw-button secondary"
                        onClick={goToToday}
                    >
                        Hôm nay
                    </button>
                </div>
            </header>

            {error && (
                <div className="cw-alert error">
                    {error}
                </div>
            )}

            <div className="cw-stats-grid">
                <div className="cw-panel">
                    <span className="cw-eyebrow">
                        CÔNG VIỆC TRONG THÁNG
                    </span>

                    <h2>{monthJobs.length}</h2>

                    <small>
                        Các phân công có lịch trong tháng đang xem
                    </small>
                </div>

                <div className="cw-panel">
                    <span className="cw-eyebrow">
                        SẮP TỚI
                    </span>

                    <h2>{upcomingCount}</h2>

                    <small>
                        Công việc chưa đến thời gian bắt đầu
                    </small>
                </div>

                <div className="cw-panel">
                    <span className="cw-eyebrow">
                        CẦN KIỂM TRA
                    </span>

                    <h2>{conflictCount}</h2>

                    <small>
                        Phân công có thời gian thực tế bị trùng
                    </small>
                </div>
            </div>

            {conflictCount > 0 && (
                <div className="cw-alert error">
                    <strong>Cảnh báo trùng lịch:</strong>{' '}
                    Có {conflictCount} phân công đang có khung giờ
                    giao nhau. Vui lòng liên hệ Provider/Staff để
                    kiểm tra và điều phối. Hệ thống không tự thay đổi
                    phân công của bạn.
                </div>
            )}

            <div className="cw-calendar-layout">
                <div className="cw-panel cw-calendar-panel">
                    <div className="cw-monthbar">
                        <button
                            type="button"
                            aria-label="Tháng trước"
                            onClick={() => changeMonth(-1)}
                        >
                            ‹
                        </button>

                        <h2>
                            Tháng {month.getMonth() + 1}/
                            {month.getFullYear()}
                        </h2>

                        <button
                            type="button"
                            aria-label="Tháng sau"
                            onClick={() => changeMonth(1)}
                        >
                            ›
                        </button>
                    </div>

                    <div className="cw-calendar-grid">
                        {[
                            'T2',
                            'T3',
                            'T4',
                            'T5',
                            'T6',
                            'T7',
                            'CN'
                        ].map((day) => (
                            <b key={day}>{day}</b>
                        ))}

                        {Array.from(
                            { length: offset },
                            (_, index) => (
                                <span
                                    className="cw-day empty"
                                    key={`empty-${index}`}
                                />
                            )
                        )}

                        {Array.from(
                            { length: days },
                            (_, index) => {
                                const day = index + 1;

                                const key =
                                    `${month.getFullYear()}-` +
                                    `${pad(month.getMonth() + 1)}-` +
                                    `${pad(day)}`;

                                const dayJobs =
                                    jobsByDay[key] || [];

                                const hasConflict =
                                    dayJobs.some((assignment) =>
                                        conflictIds.has(
                                            assignment.assignmentId
                                        )
                                    );

                                return (
                                    <button
                                        type="button"
                                        key={key}
                                        className={[
                                            'cw-day',
                                            selected === key
                                                ? 'selected'
                                                : '',
                                            todayKey === key
                                                ? 'today'
                                                : '',
                                            hasConflict
                                                ? 'conflict'
                                                : ''
                                        ].filter(Boolean).join(' ')}
                                        onClick={() => selectDay(key)}
                                        title={
                                            hasConflict
                                                ? 'Ngày có phân công trùng giờ'
                                                : `${dayJobs.length} công việc`
                                        }
                                    >
                                        <span>{day}</span>

                                        {dayJobs.length > 0 && (
                                            <i>{dayJobs.length}</i>
                                        )}

                                        {hasConflict && (
                                            <small>!</small>
                                        )}
                                    </button>
                                );
                            }
                        )}
                    </div>

                    <div className="cw-legend">
                        <span>
                            <i />
                            Có công việc
                        </span>

                        <span>
                            <b />
                            Hôm nay
                        </span>

                        <span>
                            <strong>!</strong>
                            Trùng giờ
                        </span>
                    </div>
                </div>

                <div className="cw-panel cw-day-panel">
                    <div className="cw-panel-title">
                        <div>
                            <span className="cw-eyebrow">
                                CHI TIẾT NGÀY
                            </span>

                            <h2>
                                {selected
                                    ? dateLabel(
                                        `${selected}T12:00:00`
                                    )
                                    : 'Chọn một ngày'}
                            </h2>
                        </div>

                        <span className="cw-count">
                            {selectedJobs.length} công việc
                        </span>
                    </div>

                    <div className="cw-toolbar">
                        <label htmlFor="cleaner-calendar-filter">
                            Lọc trạng thái
                        </label>

                        <select
                            id="cleaner-calendar-filter"
                            value={statusFilter}
                            onChange={(event) =>
                                setStatusFilter(event.target.value)
                            }
                        >
                            <option value="ALL">
                                Tất cả trạng thái
                            </option>

                            <option value="WAITING">
                                Chờ nhận việc
                            </option>

                            <option value="ACCEPTED">
                                Đã nhận việc
                            </option>

                            <option value="IN_PROGRESS">
                                Đang thực hiện
                            </option>

                            <option value="SUBMITTED">
                                Đã nộp kết quả
                            </option>

                            <option value="COMPLETED">
                                Hoàn thành
                            </option>
                        </select>
                    </div>

                    {loading ? (
                        <p className="cw-muted">
                            Đang tải lịch...
                        </p>
                    ) : selectedJobs.length === 0 ? (
                        <div className="cw-empty">
                            <span>📅</span>

                            <strong>
                                Chưa có công việc
                            </strong>

                            <p>
                                Không có phân công phù hợp trong ngày
                                này với bộ lọc hiện tại.
                            </p>
                        </div>
                    ) : (
                        <div className="cw-job-list">
                            {selectedJobs.map((assignment) => {
                                const booking =
                                    assignment.booking || {};

                                const status = normalizeStatus(
                                    assignment.assignmentStatus ||
                                    assignment.status
                                );

                                const statusConfig =
                                    STATUS_CONFIG[status] || {};

                                const hasConflict =
                                    conflictIds.has(
                                        assignment.assignmentId
                                    );

                                return (
                                    <article
                                        className="cw-job"
                                        key={assignment.assignmentId}
                                    >
                                        <div className="cw-job-time">
                                            {timeLabel(
                                                booking.scheduledStart
                                            )}

                                            <small>
                                                {timeLabel(
                                                    booking.scheduledEnd
                                                )}
                                            </small>
                                        </div>

                                        <div className="cw-job-info">
                                            <strong>
                                                {getServiceName(booking)}
                                            </strong>

                                            <span>
                                                {booking.fullAddress ||
                                                    'Chưa có địa chỉ'}
                                            </span>

                                            <small>
                                                {booking.receiverName ||
                                                    booking.customerName ||
                                                    'Khách hàng'}
                                                {' · '}
                                                {statusLabel(status)}
                                            </small>

                                            <small>
                                                Mã đơn:{' '}
                                                {booking.bookingCode ||
                                                    booking.id ||
                                                    '—'}
                                            </small>

                                            {hasConflict && (
                                                <div className="cw-alert error">
                                                    Khung giờ công việc này
                                                    đang trùng với một phân
                                                    công khác của bạn.
                                                </div>
                                            )}

                                            {booking.scheduledStart && (
                                                <small>
                                                    Bắt đầu:{' '}
                                                    {dateTimeLabel(
                                                        booking.scheduledStart
                                                    )}
                                                </small>
                                            )}
                                        </div>

                                        <span
                                            className={
                                                `cw-status ${statusConfig.type || ''}`
                                            }
                                        >
                                            {statusLabel(status)}
                                        </span>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
