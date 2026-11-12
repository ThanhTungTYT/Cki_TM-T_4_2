
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { bookingApi } from '../../services/api';

const INITIAL_NOW = new Date();

function getCleanerName() {
    try {
        const savedUser =
            sessionStorage.getItem('user') ||
            localStorage.getItem('user') ||
            sessionStorage.getItem('userInfo') ||
            localStorage.getItem('userInfo');

        if (!savedUser) return 'bạn';

        const user = JSON.parse(savedUser);
        return user.fullName || user.name || 'bạn';
    } catch {
        return 'bạn';
    }
}

function getLocalDateKey(value) {
    if (!value) return '';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function formatDateTime(value) {
    if (!value) return 'Chưa xác định';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 'Chưa xác định';

    return date.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatTime(value) {
    if (!value) return '--:--';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '--:--';

    return date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getAssignmentStatus(booking) {
    return String(
        booking?.cleanerAssignment?.assignmentStatus ||
        booking?.cleanerAssignment?.status ||
        booking?.assignmentStatus ||
        booking?.status ||
        ''
    ).toUpperCase();
}

function getStatusInfo(status) {
    const statusMap = {
        ASSIGNED: {
            label: 'Chờ nhận việc',
            className: 'assigned'
        },
        PENDING_ACCEPTANCE: {
            label: 'Chờ nhận việc',
            className: 'assigned'
        },
        ACCEPTED: {
            label: 'Đã nhận việc',
            className: 'confirmed'
        },
        ON_THE_WAY: {
            label: 'Đang di chuyển',
            className: 'in-progress'
        },
        EN_ROUTE: {
            label: 'Đang di chuyển',
            className: 'in-progress'
        },
        IN_PROGRESS: {
            label: 'Đang thực hiện',
            className: 'in-progress'
        },
        WORK_SUBMITTED: {
            label: 'Đã nộp kết quả',
            className: 'pending'
        },
        PENDING_COMPLETION: {
            label: 'Chờ xác nhận',
            className: 'pending'
        },
        AWAITING_CONFIRMATION: {
            label: 'Chờ khách xác nhận',
            className: 'pending'
        },
        COMPLETED: {
            label: 'Đã hoàn thành',
            className: 'completed'
        },
        CANCELLED: {
            label: 'Đã hủy',
            className: 'cancelled'
        },
        DECLINED: {
            label: 'Đã từ chối',
            className: 'cancelled'
        },
        REJECTED: {
            label: 'Bị từ chối',
            className: 'cancelled'
        },
        EXPIRED: {
            label: 'Đã hết hạn',
            className: 'cancelled'
        }
    };

    return statusMap[status] || {
        label: status || 'Chưa xác định',
        className: 'default'
    };
}

function CleanerDashboard() {
    const userName = useMemo(() => getCleanerName(), []);

    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentTime, setCurrentTime] = useState(INITIAL_NOW);

    const todayKey = getLocalDateKey(currentTime);

    const todayLabel = currentTime.toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    const fetchBookings = useCallback(async () => {
        const data = await bookingApi.getCleanerBookings();
        return Array.isArray(data) ? data : [];
    }, []);

    const loadBookings = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const data = await fetchBookings();
            setBookings(data);
            setCurrentTime(new Date());
        } catch (err) {
            setError(
                err.message || 'Không thể tải dữ liệu tổng quan.'
            );
        } finally {
            setLoading(false);
        }
    }, [fetchBookings]);

    useEffect(() => {
        let active = true;

        fetchBookings()
            .then((data) => {
                if (active) {
                    setBookings(data);
                    setCurrentTime(new Date());
                }
            })
            .catch((err) => {
                if (active) {
                    setError(
                        err.message || 'Không thể tải dữ liệu tổng quan.'
                    );
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [fetchBookings]);

    const activeBookings = useMemo(() => {
        return bookings.filter((booking) => {
            const status = getAssignmentStatus(booking);

            return ![
                'CANCELLED',
                'DECLINED',
                'REJECTED',
                'EXPIRED'
            ].includes(status);
        });
    }, [bookings]);

    const todayBookings = useMemo(() => {
        return activeBookings
            .filter((booking) => {
                return getLocalDateKey(booking.scheduledStart) === todayKey;
            })
            .sort((a, b) => {
                return (
                    new Date(a.scheduledStart).getTime() -
                    new Date(b.scheduledStart).getTime()
                );
            });
    }, [activeBookings, todayKey]);

    const newBookings = useMemo(() => {
        return activeBookings.filter((booking) => {
            return ['ASSIGNED', 'PENDING_ACCEPTANCE'].includes(
                getAssignmentStatus(booking)
            );
        });
    }, [activeBookings]);

    const inProgressBookings = useMemo(() => {
        return activeBookings.filter((booking) => {
            return [
                'ON_THE_WAY',
                'EN_ROUTE',
                'IN_PROGRESS'
            ].includes(getAssignmentStatus(booking));
        });
    }, [activeBookings]);

    const submittedBookings = useMemo(() => {
        return activeBookings.filter((booking) => {
            return [
                'WORK_SUBMITTED',
                'PENDING_COMPLETION',
                'AWAITING_CONFIRMATION'
            ].includes(getAssignmentStatus(booking));
        });
    }, [activeBookings]);

    const upcomingBookings = useMemo(() => {
        return activeBookings
            .filter((booking) => {
                const start = new Date(booking.scheduledStart);

                return (
                    !Number.isNaN(start.getTime()) &&
                    start.getTime() > currentTime.getTime() &&
                    getLocalDateKey(booking.scheduledStart) !== todayKey
                );
            })
            .sort((a, b) => {
                return (
                    new Date(a.scheduledStart).getTime() -
                    new Date(b.scheduledStart).getTime()
                );
            });
    }, [activeBookings, currentTime, todayKey]);

    const stats = [
        {
            title: 'Việc mới',
            value: newBookings.length,
            description: 'Đang chờ bạn phản hồi',
            icon: '📩',
            link: '/cleaner/jobs'
        },
        {
            title: 'Công việc hôm nay',
            value: todayBookings.length,
            description: 'Theo lịch được phân công',
            icon: '📋',
            link: '/cleaner/calendar'
        },
        {
            title: 'Đang thực hiện',
            value: inProgressBookings.length,
            description: 'Công việc chưa nộp kết quả',
            icon: '🧹',
            link: '/cleaner/jobs'
        },
        {
            title: 'Chờ xác nhận',
            value: submittedBookings.length,
            description: 'Đã nộp phần việc',
            icon: '⏳',
            link: '/cleaner/history'
        }
    ];

    const renderBookingItem = (booking) => {
        const status = getStatusInfo(getAssignmentStatus(booking));

        return (
            <div
                className="cl-today-item"
                key={
                    booking.cleanerAssignment?.id ||
                    booking.assignmentId ||
                    booking.id
                }
            >
                <div className="cl-today-time">
                    {formatTime(booking.scheduledStart)}
                </div>

                <div className="cl-today-content">
                    <strong>
                        {booking.customerName || 'Khách hàng'}
                    </strong>

                    <span>
                        {booking.items?.length
                            ? booking.items
                                .map((item) => item.serviceName)
                                .filter(Boolean)
                                .join(', ')
                            : 'Chưa có thông tin dịch vụ'}
                    </span>

                    <small>
                        {booking.fullAddress || 'Chưa có địa chỉ'}
                    </small>

                    <span
                        className={`cl-today-status cl-today-status-${status.className}`}
                    >
                        {status.label}
                    </span>
                </div>

                <span className="cl-today-code">
                    {booking.bookingCode || `#${booking.id}`}
                </span>
            </div>
        );
    };

    return (
        <div className="cl-page">
            <div className="cl-page-heading">
                <div>
                    <h1>Tổng quan công việc</h1>
                    <p>
                        Theo dõi công việc và lịch làm việc của bạn.
                    </p>
                </div>

                <div className="cl-current-date">
                    <span>Hôm nay</span>
                    <strong>{todayLabel}</strong>
                </div>
            </div>

            <section className="cl-welcome">
                <div className="cl-welcome-content">
                    <span className="cl-welcome-label">
                        CLEANMATE - CLEANER PORTAL
                    </span>

                    <h2>Xin chào, {userName}!</h2>

                    <p>
                        Chúc bạn có một ngày làm việc hiệu quả.
                        Hãy kiểm tra các công việc mới và lịch làm việc
                        của mình nhé.
                    </p>

                    <Link
                        to="/cleaner/jobs"
                        className="cl-primary-button"
                    >
                        Xem công việc
                        <span>→</span>
                    </Link>
                </div>

                <div className="cl-welcome-decoration">
                    <div className="cl-decoration-circle">
                        <span>✦</span>
                    </div>
                </div>
            </section>

            <section className="cl-section">
                <div className="cl-section-heading">
                    <div>
                        <h2>Tình hình công việc</h2>
                        <p>
                            {loading
                                ? 'Đang tải số liệu...'
                                : 'Thống kê phân công của tài khoản Cleaner hiện tại'}
                        </p>
                    </div>

                    <button
                        type="button"
                        className="cl-dashboard-refresh"
                        onClick={loadBookings}
                        disabled={loading}
                    >
                        ↻ {loading ? 'Đang tải...' : 'Làm mới'}
                    </button>
                </div>

                {error && (
                    <div className="cl-dashboard-error">
                        <span>{error}</span>

                        <button
                            type="button"
                            onClick={loadBookings}
                        >
                            Thử lại
                        </button>
                    </div>
                )}

                <div className="cl-stat-grid">
                    {stats.map((item, index) => (
                        <Link
                            to={item.link}
                            className="cl-stat-card"
                            key={item.title}
                        >
                            <div
                                className={`cl-stat-icon cl-stat-icon-${index + 1}`}
                            >
                                {item.icon}
                            </div>

                            <div className="cl-stat-info">
                                <span>{item.title}</span>

                                <strong>
                                    {loading ? '—' : item.value}
                                </strong>

                                <small>{item.description}</small>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            <div className="cl-dashboard-grid">
                <section className="cl-panel cl-schedule-panel">
                    <div className="cl-panel-heading">
                        <div>
                            <h2>Lịch làm việc hôm nay</h2>

                            <p>
                                {loading
                                    ? 'Đang tải...'
                                    : `${todayBookings.length} công việc theo lịch hôm nay`}
                            </p>
                        </div>

                        <Link
                            to="/cleaner/calendar"
                            className="cl-text-link"
                        >
                            Xem lịch
                        </Link>
                    </div>

                    {loading ? (
                        <div className="cl-dashboard-message">
                            Đang tải lịch làm việc...
                        </div>
                    ) : error ? (
                        <div className="cl-dashboard-message">
                            Chưa thể tải lịch làm việc.
                        </div>
                    ) : todayBookings.length === 0 ? (
                        <div className="cl-empty-state">
                            <div className="cl-empty-icon">📅</div>

                            <strong>
                                Hôm nay chưa có công việc
                            </strong>

                            <p>
                                Các công việc được phân công trong ngày
                                sẽ xuất hiện tại đây.
                            </p>
                        </div>
                    ) : (
                        <div className="cl-today-list">
                            {todayBookings
                                .slice(0, 5)
                                .map(renderBookingItem)}

                            {todayBookings.length > 5 && (
                                <Link
                                    to="/cleaner/jobs"
                                    className="cl-today-more"
                                >
                                    Xem thêm {todayBookings.length - 5} công việc
                                </Link>
                            )}
                        </div>
                    )}
                </section>

                <section className="cl-panel cl-shortcut-panel">
                    <div className="cl-panel-heading">
                        <div>
                            <h2>Truy cập nhanh</h2>
                            <p>Các chức năng thường dùng</p>
                        </div>
                    </div>

                    <div className="cl-shortcut-list">
                        <Link
                            to="/cleaner/jobs"
                            className="cl-shortcut-item"
                        >
                            <div className="cl-shortcut-icon">📋</div>

                            <div>
                                <strong>Công việc của tôi</strong>
                                <span>
                                    Xem, nhận và cập nhật công việc
                                </span>
                            </div>

                            <span className="cl-shortcut-arrow">›</span>
                        </Link>

                        <Link
                            to="/cleaner/calendar"
                            className="cl-shortcut-item"
                        >
                            <div className="cl-shortcut-icon">🗓️</div>

                            <div>
                                <strong>Lịch làm việc</strong>
                                <span>Theo dõi lịch được phân công</span>
                            </div>

                            <span className="cl-shortcut-arrow">›</span>
                        </Link>

                        <Link
                            to="/cleaner/history"
                            className="cl-shortcut-item"
                        >
                            <div className="cl-shortcut-icon">🕘</div>

                            <div>
                                <strong>Lịch sử công việc</strong>
                                <span>Xem các công việc trước đây</span>
                            </div>

                            <span className="cl-shortcut-arrow">›</span>
                        </Link>

                        <Link
                            to="/cleaner/notifications"
                            className="cl-shortcut-item"
                        >
                            <div className="cl-shortcut-icon">🔔</div>

                            <div>
                                <strong>Thông báo</strong>
                                <span>Xem phân công và cập nhật mới</span>
                            </div>

                            <span className="cl-shortcut-arrow">›</span>
                        </Link>

                        <Link
                            to="/cleaner/profile"
                            className="cl-shortcut-item"
                        >
                            <div className="cl-shortcut-icon">👤</div>

                            <div>
                                <strong>Hồ sơ của tôi</strong>
                                <span>Thông tin tài khoản cá nhân</span>
                            </div>

                            <span className="cl-shortcut-arrow">›</span>
                        </Link>
                    </div>
                </section>
            </div>

            <section className="cl-panel cl-schedule-panel">
                <div className="cl-panel-heading">
                    <div>
                        <h2>Công việc sắp tới</h2>
                        <p>
                            Các công việc sau ngày hôm nay
                        </p>
                    </div>

                    <Link
                        to="/cleaner/calendar"
                        className="cl-text-link"
                    >
                        Xem lịch
                    </Link>
                </div>

                {loading ? (
                    <div className="cl-dashboard-message">
                        Đang tải công việc...
                    </div>
                ) : upcomingBookings.length === 0 ? (
                    <div className="cl-dashboard-message">
                        Chưa có công việc sắp tới.
                    </div>
                ) : (
                    <div className="cl-today-list">
                        {upcomingBookings
                            .slice(0, 4)
                            .map((booking) => (
                                <div
                                    className="cl-today-item"
                                    key={
                                        booking.cleanerAssignment?.id ||
                                        booking.assignmentId ||
                                        booking.id
                                    }
                                >
                                    <div className="cl-today-time">
                                        {formatTime(booking.scheduledStart)}
                                    </div>

                                    <div className="cl-today-content">
                                        <strong>
                                            {booking.customerName || 'Khách hàng'}
                                        </strong>

                                        <span>
                                            {booking.items?.length
                                                ? booking.items
                                                    .map((item) => item.serviceName)
                                                    .filter(Boolean)
                                                    .join(', ')
                                                : 'Chưa có thông tin dịch vụ'}
                                        </span>

                                        <small>
                                            {formatDateTime(booking.scheduledStart)}
                                        </small>

                                        <span
                                            className={`cl-today-status cl-today-status-${getStatusInfo(
                                                getAssignmentStatus(booking)
                                            ).className}`}
                                        >
                                            {getStatusInfo(
                                                getAssignmentStatus(booking)
                                            ).label}
                                        </span>
                                    </div>

                                    <span className="cl-today-code">
                                        {booking.bookingCode || `#${booking.id}`}
                                    </span>
                                </div>
                            ))}
                    </div>
                )}
            </section>

            <div className="cl-info-note">
                <span className="cl-info-note-icon">i</span>

                <p>
                    <strong>Lưu ý:</strong> Đây là thông tin công việc
                    được phân công cho tài khoản Cleaner hiện tại.
                    Trạng thái nộp kết quả không đồng nghĩa với việc
                    Booking đã được khách hàng xác nhận hoàn thành.
                </p>
            </div>
        </div>
    );
}

export default CleanerDashboard;
