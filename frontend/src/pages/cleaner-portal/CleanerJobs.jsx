import { useCallback, useEffect, useMemo, useState } from 'react';
import { bookingApi } from '../../services/api';
import './CleanerJobs.css';

const STATUS_CONFIG = {
    PENDING_PAYMENT: { label: 'Chờ thanh toán', type: 'pending' },
    PENDING_PROVIDER: { label: 'Chờ nhà cung cấp', type: 'pending' },
    CONFIRMED: { label: 'Đã xác nhận', type: 'confirmed' },
    ASSIGNED: { label: 'Chờ nhận việc', type: 'assigned' },
    ACCEPTED: { label: 'Đã nhận việc', type: 'confirmed' },
    EN_ROUTE: { label: 'Đang di chuyển', type: 'progress' },
    IN_PROGRESS: { label: 'Đang thực hiện', type: 'progress' },
    WORK_SUBMITTED: {
        label: 'Chờ xác nhận hoàn thành',
        type: 'waiting'
    },
    PENDING_COMPLETION: {
        label: 'Chờ nghiệm thu',
        type: 'waiting'
    },
    COMPLETED: { label: 'Hoàn thành', type: 'completed' },
    DECLINED: { label: 'Đã từ chối', type: 'cancelled' },
    CANCELLED: { label: 'Đã hủy', type: 'cancelled' },
    REJECTED: { label: 'Bị từ chối', type: 'cancelled' },
    EXPIRED: { label: 'Hết hạn', type: 'cancelled' }
};

const FILTERS = [
    { value: 'ALL', label: 'Tất cả' },
    { value: 'UPCOMING', label: 'Sắp thực hiện' },
    { value: 'IN_PROGRESS', label: 'Đang thực hiện' },
    { value: 'COMPLETED', label: 'Hoàn thành' },
    { value: 'CANCELLED', label: 'Đã hủy' }
];

function formatDate(value) {
    if (!value) return 'Chưa có thời gian';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatMoney(value) {
    if (value == null) return '—';

    return `${Number(value).toLocaleString('vi-VN')}đ`;
}

function getStatus(status) {
    const key = (status || '').toUpperCase();

    return STATUS_CONFIG[key] || {
        label: status || 'Chưa xác định',
        type: 'pending'
    };
}

function getFilterGroup(status) {
    const key = (status || '').toUpperCase();

    if (key === 'COMPLETED') {
        return 'COMPLETED';
    }

    if (
        ['CANCELLED', 'REJECTED', 'EXPIRED', 'DECLINED'].includes(key)
    ) {
        return 'CANCELLED';
    }

    if (
        [
            'ACCEPTED',
            'EN_ROUTE',
            'IN_PROGRESS',
            'WORK_SUBMITTED',
            'PENDING_COMPLETION'
        ].includes(key)
    ) {
        return 'IN_PROGRESS';
    }

    return 'UPCOMING';
}

function CleanerJobs() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('ALL');
    const [expandedId, setExpandedId] = useState(null);

    const [processingId, setProcessingId] = useState(null);

    const [actionFeedback, setActionFeedback] = useState({
        bookingId: null,
        message: '',
        type: ''
    });
    // CN3: Quản lý nhật ký công việc
    const [workLogs, setWorkLogs] = useState({});
    const [logType, setLogType] = useState({});
    const [logNote, setLogNote] = useState({});
    const [logLoading, setLogLoading] = useState({});
    const [logFeedback, setLogFeedback] = useState({});

    // Lấy Assignment của Cleaner đang đăng nhập.
    // Mỗi Booking được gắn với Assignment tương ứng của Cleaner.
    const fetchBookings = useCallback(async () => {
        const assignments = await bookingApi.getCleanerAssignments();

        if (!Array.isArray(assignments)) {
            return [];
        }

        return assignments
            .filter((assignment) => assignment?.booking)
            .map((assignment) => ({
                ...assignment.booking,
                cleanerAssignment: assignment
            }));
    }, []);

    // Tải lại danh sách công việc.
    const loadBookings = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const data = await fetchBookings();
            setBookings(data);
        } catch (err) {
            setError(
                err.message || 'Không thể tải danh sách công việc.'
            );
        } finally {
            setLoading(false);
        }
    }, [fetchBookings]);

    // Tải dữ liệu lần đầu.
    useEffect(() => {
        let cancelled = false;

        fetchBookings()
            .then((data) => {
                if (!cancelled) {
                    setBookings(data);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(
                        err.message || 'Không thể tải danh sách công việc.'
                    );
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [fetchBookings]);
    // CN3: Gửi nhật ký tiến độ hoặc báo sự cố
    async function handleSubmitWorkLog(assignmentId) {
        if (!assignmentId) return;

        const note = (logNote[assignmentId] || '').trim();
        const type = logType[assignmentId] || 'PROGRESS';

        if (!note) {
            setLogFeedback((prev) => ({
                ...prev,
                [assignmentId]: {
                    type: 'error',
                    message: 'Vui lòng nhập nội dung nhật ký.'
                }
            }));
            return;
        }

        setLogLoading((prev) => ({
            ...prev,
            [assignmentId]: true
        }));

        setLogFeedback((prev) => ({
            ...prev,
            [assignmentId]: null
        }));

        try {
            await bookingApi.createCleanerWorkLog(assignmentId, {
                logType: type,
                note,
                imageUrls: []
            });

            setLogNote((prev) => ({
                ...prev,
                [assignmentId]: ''
            }));

            setLogFeedback((prev) => ({
                ...prev,
                [assignmentId]: {
                    type: 'success',
                    message: 'Đã gửi nhật ký công việc.'
                }
            }));

            await loadWorkLogs(assignmentId);
        } catch (err) {
            setLogFeedback((prev) => ({
                ...prev,
                [assignmentId]: {
                    type: 'error',
                    message: err.message || 'Không thể gửi nhật ký.'
                }
            }));
        } finally {
            setLogLoading((prev) => ({
                ...prev,
                [assignmentId]: false
            }));
        }
    }
    // CN3: Tải lịch sử nhật ký của một phân công
    async function loadWorkLogs(assignmentId) {
        if (!assignmentId) return;

        setLogLoading((prev) => ({
            ...prev,
            [assignmentId]: true
        }));

        try {
            const data = await bookingApi.getCleanerWorkLogs(assignmentId);

            setWorkLogs((prev) => ({
                ...prev,
                [assignmentId]: Array.isArray(data) ? data : []
            }));
        } catch (err) {
            setLogFeedback((prev) => ({
                ...prev,
                [assignmentId]: {
                    type: 'error',
                    message: err.message || 'Không thể tải nhật ký.'
                }
            }));
        } finally {
            setLogLoading((prev) => ({
                ...prev,
                [assignmentId]: false
            }));
        }
    }
    // Xử lý các thao tác trên Assignment của Cleaner.
    async function handleBookingAction(booking, action) {
        if (processingId !== null) return;

        const assignment = booking.cleanerAssignment;

        if (!assignment?.assignmentId) {
            setActionFeedback({
                bookingId: booking.id,
                message: 'Không tìm thấy phân công của bạn.',
                type: 'error'
            });
            return;
        }

        const actionMessages = {
            ACCEPT: 'Đã nhận công việc.',
            START_JOB: 'Đã bắt đầu thực hiện công việc.',
            SUBMIT_COMPLETION:
                'Đã gửi yêu cầu xác nhận hoàn thành cho khách hàng.'
        };

        setProcessingId(booking.id);

        setActionFeedback({
            bookingId: booking.id,
            message: '',
            type: ''
        });

        try {
            await bookingApi.executeCleanerAssignmentAction(
                assignment.assignmentId,
                action
            );

            setActionFeedback({
                bookingId: booking.id,
                message: actionMessages[action] || 'Cập nhật thành công.',
                type: 'success'
            });

            await loadBookings();
        } catch (err) {
            setActionFeedback({
                bookingId: booking.id,
                message:
                    err.message ||
                    'Không thể cập nhật trạng thái công việc.',
                type: 'error'
            });

            await loadBookings();
        } finally {
            setProcessingId(null);
        }
    }

    // Cleaner từ chối nhận phân công.
    async function handleDeclineAssignment(booking) {
        if (processingId !== null) return;

        const assignment = booking.cleanerAssignment;

        if (!assignment?.assignmentId) {
            setActionFeedback({
                bookingId: booking.id,
                message: 'Không tìm thấy phân công của bạn.',
                type: 'error'
            });
            return;
        }

        const note = window.prompt(
            'Nhập lý do từ chối công việc này:'
        );

        if (note == null) return;

        if (!note.trim()) {
            window.alert('Vui lòng nhập lý do từ chối.');
            return;
        }

        setProcessingId(booking.id);

        setActionFeedback({
            bookingId: booking.id,
            message: '',
            type: ''
        });

        try {
            await bookingApi.executeCleanerAssignmentAction(
                assignment.assignmentId,
                'DECLINE',
                note.trim()
            );

            setActionFeedback({
                bookingId: booking.id,
                message: 'Đã từ chối nhận phân công này.',
                type: 'success'
            });

            await loadBookings();
        } catch (err) {
            setActionFeedback({
                bookingId: booking.id,
                message:
                    err.message ||
                    'Không thể từ chối phân công.',
                type: 'error'
            });

            await loadBookings();
        } finally {
            setProcessingId(null);
        }
    }

    // Thống kê công việc theo trạng thái Assignment.
    const stats = useMemo(() => {
        return {
            total: bookings.length,

            upcoming: bookings.filter(
                (booking) =>
                    getFilterGroup(
                        booking.cleanerAssignment?.assignmentStatus ||
                        booking.status
                    ) === 'UPCOMING'
            ).length,

            inProgress: bookings.filter(
                (booking) =>
                    getFilterGroup(
                        booking.cleanerAssignment?.assignmentStatus ||
                        booking.status
                    ) === 'IN_PROGRESS'
            ).length,

            completed: bookings.filter(
                (booking) =>
                    getFilterGroup(
                        booking.cleanerAssignment?.assignmentStatus ||
                        booking.status
                    ) === 'COMPLETED'
            ).length
        };
    }, [bookings]);

    // Tìm kiếm và lọc công việc.
    const filteredBookings = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return bookings.filter((booking) => {
            const assignmentStatus =
                booking.cleanerAssignment?.assignmentStatus ||
                booking.status;

            const matchFilter =
                filter === 'ALL' ||
                getFilterGroup(assignmentStatus) === filter;

            const serviceNames = (booking.items || [])
                .map((item) => item.serviceName || '')
                .join(' ');

            const searchableText = [
                booking.bookingCode,
                booking.customerName,
                booking.customerPhone,
                booking.fullAddress,
                booking.partnerName,
                serviceNames
            ]
                .join(' ')
                .toLowerCase();

            const matchSearch =
                !keyword || searchableText.includes(keyword);

            return matchFilter && matchSearch;
        });
    }, [bookings, filter, search]);

    return (
        <div className="cj-page">
            <div className="cj-header">
                <div>
                    <h1>Công việc của tôi</h1>
                    <p>
                        Danh sách công việc được nhà cung cấp phân công cho bạn.
                    </p>
                </div>

                <button
                    type="button"
                    className="cj-refresh-btn"
                    onClick={loadBookings}
                    disabled={loading}
                >
                    ↻ Làm mới
                </button>
            </div>

            {/* THỐNG KÊ */}
            <div className="cj-stats">
                <div className="cj-stat-card">
                    <div className="cj-stat-icon cj-icon-blue">▤</div>
                    <div>
                        <span>Tổng công việc</span>
                        <strong>{stats.total}</strong>
                    </div>
                </div>

                <div className="cj-stat-card">
                    <div className="cj-stat-icon cj-icon-orange">◷</div>
                    <div>
                        <span>Sắp thực hiện</span>
                        <strong>{stats.upcoming}</strong>
                    </div>
                </div>

                <div className="cj-stat-card">
                    <div className="cj-stat-icon cj-icon-purple">⚙</div>
                    <div>
                        <span>Đang thực hiện</span>
                        <strong>{stats.inProgress}</strong>
                    </div>
                </div>

                <div className="cj-stat-card">
                    <div className="cj-stat-icon cj-icon-green">✓</div>
                    <div>
                        <span>Đã hoàn thành</span>
                        <strong>{stats.completed}</strong>
                    </div>
                </div>
            </div>

            {/* TÌM KIẾM VÀ LỌC */}
            <div className="cj-toolbar">
                <div className="cj-search">
                    <span>⌕</span>

                    <input
                        type="text"
                        placeholder="Tìm mã đơn, khách hàng, địa chỉ..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="cj-filters">
                    {FILTERS.map((item) => (
                        <button
                            type="button"
                            key={item.value}
                            className={
                                filter === item.value ? 'active' : ''
                            }
                            onClick={() => setFilter(item.value)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* LOADING */}
            {loading && (
                <div className="cj-message">
                    <div className="cj-spinner" />
                    <p>Đang tải danh sách công việc...</p>
                </div>
            )}

            {/* ERROR */}
            {!loading && error && (
                <div className="cj-error">
                    <strong>Không tải được công việc</strong>
                    <p>{error}</p>

                    <button
                        type="button"
                        onClick={loadBookings}
                    >
                        Thử lại
                    </button>
                </div>
            )}

            {/* EMPTY */}
            {!loading && !error && filteredBookings.length === 0 && (
                <div className="cj-empty">
                    <div className="cj-empty-icon">▤</div>

                    <h3>
                        {bookings.length === 0
                            ? 'Bạn chưa có công việc nào'
                            : 'Không tìm thấy công việc phù hợp'}
                    </h3>

                    <p>
                        {bookings.length === 0
                            ? 'Các công việc được nhà cung cấp phân công sẽ xuất hiện tại đây.'
                            : 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.'}
                    </p>

                    {(search || filter !== 'ALL') && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearch('');
                                setFilter('ALL');
                            }}
                        >
                            Xóa bộ lọc
                        </button>
                    )}
                </div>
            )}

            {/* DANH SÁCH CÔNG VIỆC */}
            {!loading && !error && filteredBookings.length > 0 && (
                <div className="cj-booking-list">
                    {filteredBookings.map((booking) => {
                        const assignmentStatus = String(
                            booking.cleanerAssignment?.assignmentStatus ||
                            booking.status ||
                            ''
                        ).toUpperCase();

                        const status = getStatus(assignmentStatus);
                        const expanded = expandedId === booking.id;

                        return (
                            <article
                                className="cj-booking-card"
                                key={booking.id}
                            >
                                <div className="cj-card-top">
                                    <div>
                                        <span className="cj-booking-code">
                                            MÃ ĐƠN:{' '}
                                            {booking.bookingCode ||
                                                `#${booking.id}`}
                                        </span>

                                        <h3>
                                            {booking.customerName ||
                                                'Khách hàng'}
                                        </h3>
                                    </div>

                                    <span
                                        className={`cj-status cj-status-${status.type}`}
                                    >
                                        {status.label}
                                    </span>
                                </div>

                                <div className="cj-card-info">
                                    <div>
                                        <span className="cj-info-label">
                                            Thời gian thực hiện
                                        </span>

                                        <strong>
                                            {formatDate(
                                                booking.scheduledStart
                                            )}
                                        </strong>
                                    </div>

                                    <div>
                                        <span className="cj-info-label">
                                            Địa chỉ làm việc
                                        </span>

                                        <strong>
                                            {booking.fullAddress ||
                                                'Chưa có địa chỉ'}
                                        </strong>
                                    </div>

                                    <div>
                                        <span className="cj-info-label">
                                            Dịch vụ
                                        </span>

                                        <strong>
                                            {booking.items?.length
                                                ? booking.items
                                                    .map(
                                                        (item) =>
                                                            item.serviceName
                                                    )
                                                    .filter(Boolean)
                                                    .join(', ')
                                                : 'Chưa có thông tin dịch vụ'}
                                        </strong>
                                    </div>

                                    <div>
                                        <span className="cj-info-label">
                                            Tổng giá trị đơn
                                        </span>

                                        <strong className="cj-amount">
                                            {formatMoney(
                                                booking.totalAmount
                                            )}
                                        </strong>
                                    </div>
                                </div>

                                {/* XEM THÔNG TIN */}
                                <div className="cj-card-bottom">
                                    <span>
                                        {booking.items?.length || 0}{' '}
                                        hạng mục dịch vụ
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setExpandedId(
                                                expanded
                                                    ? null
                                                    : booking.id
                                            )
                                        }
                                    >
                                        {expanded
                                            ? 'Thu gọn'
                                            : 'Xem thông tin'}

                                        <span>
                                            {expanded ? '⌃' : '⌄'}
                                        </span>
                                    </button>
                                </div>

                                {/* CÁC NÚT THAO TÁC CỦA CLEANER */}
                                <div className="cj-actions">
                                    {assignmentStatus === 'ASSIGNED' && (
                                        <>
                                            <button
                                                type="button"
                                                className="cj-action-btn cj-action-start"
                                                disabled={
                                                    processingId !== null
                                                }
                                                onClick={() =>
                                                    handleBookingAction(
                                                        booking,
                                                        'ACCEPT'
                                                    )
                                                }
                                            >
                                                {processingId === booking.id
                                                    ? 'Đang xử lý...'
                                                    : 'Nhận việc'}
                                            </button>

                                            <button
                                                type="button"
                                                className="cj-action-btn cj-action-decline"
                                                disabled={
                                                    processingId !== null
                                                }
                                                onClick={() =>
                                                    handleDeclineAssignment(
                                                        booking
                                                    )
                                                }
                                            >
                                                Từ chối
                                            </button>
                                        </>
                                    )}

                                    {assignmentStatus === 'ACCEPTED' && (
                                        <button
                                            type="button"
                                            className="cj-action-btn cj-action-start"
                                            disabled={
                                                processingId !== null
                                            }
                                            onClick={() =>
                                                handleBookingAction(
                                                    booking,
                                                    'START_JOB'
                                                )
                                            }
                                        >
                                            {processingId === booking.id
                                                ? 'Đang xử lý...'
                                                : 'Bắt đầu làm việc'}
                                        </button>
                                    )}

                                    {assignmentStatus === 'IN_PROGRESS' && (
                                        <button
                                            type="button"
                                            className="cj-action-btn cj-action-complete"
                                            disabled={
                                                processingId !== null
                                            }
                                            onClick={() =>
                                                handleBookingAction(
                                                    booking,
                                                    'SUBMIT_COMPLETION'
                                                )
                                            }
                                        >
                                            {processingId === booking.id
                                                ? 'Đang xử lý...'
                                                : 'Báo hoàn thành'}
                                        </button>
                                    )}

                                    {assignmentStatus === 'WORK_SUBMITTED' && (
                                        <p className="cj-waiting-confirmation">
                                            Bạn đã báo hoàn thành, đang chờ
                                            khách hàng xác nhận.
                                        </p>
                                    )}

                                    {assignmentStatus === 'DECLINED' && (
                                        <p className="cj-waiting-confirmation">
                                            Bạn đã từ chối phân công này.
                                        </p>
                                    )}

                                    {assignmentStatus === 'COMPLETED' && (
                                        <p className="cj-waiting-confirmation">
                                            Công việc đã hoàn thành.
                                        </p>
                                    )}

                                    {/* THÔNG BÁO KẾT QUẢ */}
                                    {actionFeedback.bookingId === booking.id &&
                                        actionFeedback.message && (
                                            <p
                                                className={`cj-action-feedback ${actionFeedback.type}`}
                                            >
                                                {actionFeedback.message}
                                            </p>
                                        )}
                                </div>

                                {/* CHI TIẾT ĐƠN HÀNG */}
                                {expanded && (
                                    <div className="cj-expanded">
                                        <h4>Thông tin khách hàng</h4>

                                        <div className="cj-detail-grid">
                                            <div>
                                                <span>Người nhận</span>

                                                <strong>
                                                    {booking.receiverName ||
                                                        booking.customerName ||
                                                        '—'}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>Số điện thoại</span>

                                                <strong>
                                                    {booking.receiverPhone ||
                                                        booking.customerPhone ||
                                                        '—'}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>Nhà cung cấp</span>

                                                <strong>
                                                    {booking.partnerName || '—'}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    Thời gian kết thúc dự kiến
                                                </span>

                                                <strong>
                                                    {formatDate(
                                                        booking.scheduledEnd
                                                    )}
                                                </strong>
                                            </div>
                                        </div>

                                        <h4>Danh sách dịch vụ</h4>

                                        {booking.items?.length > 0 ? (
                                            <div className="cj-items">
                                                {booking.items.map((item) => (
                                                    <div
                                                        className="cj-item"
                                                        key={item.id}
                                                    >
                                                        <div>
                                                            <strong>
                                                                {item.serviceName ||
                                                                    'Dịch vụ'}
                                                            </strong>

                                                            {item.packageName && (
                                                                <span>
                                                                    Gói:{' '}
                                                                    {item.packageName}
                                                                </span>
                                                            )}

                                                            {item.note && (
                                                                <span>
                                                                    Ghi chú:{' '}
                                                                    {item.note}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <span>
                                                            x{item.quantity || 1}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="cj-no-items">
                                                Không có thông tin chi tiết
                                                dịch vụ.
                                            </p>
                                        )}

                                        {booking.assignments?.length > 1 && (
                                            <>
                                                <h4>
                                                    Đội ngũ cùng thực hiện (
                                                    {booking.assignments.length}{' '}
                                                    người)
                                                </h4>

                                                <div className="cj-items">
                                                    {booking.assignments.map(
                                                        (assignment) => (
                                                            <div
                                                                className="cj-item"
                                                                key={
                                                                    assignment.assignmentId ||
                                                                    assignment.id
                                                                }
                                                            >
                                                                <div>
                                                                    <strong>
                                                                        {assignment.employeeName ||
                                                                            assignment.employeeCode ||
                                                                            'Nhân viên'}
                                                                    </strong>

                                                                    {assignment.employeePhone && (
                                                                        <span>
                                                                            {' '}
                                                                            — SĐT:{' '}
                                                                            {assignment.employeePhone}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <span
                                                                    style={{
                                                                        fontSize:
                                                                            '13px',
                                                                        fontWeight: 600
                                                                    }}
                                                                >
                                                                    {assignment.assignmentStatus ||
                                                                        assignment.status ||
                                                                        'Đã giao'}
                                                                </span>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </>
                                        )}

                                        {booking.customerNote && (
                                            <>
                                                <h4>
                                                    Ghi chú của khách hàng
                                                </h4>

                                                <p className="cj-customer-note">
                                                    {booking.customerNote}
                                                </p>
                                            </>
                                        )}
                                        {/* CN3: NHẬT KÝ CÔNG VIỆC */}
                                        {['ACCEPTED', 'IN_PROGRESS'].includes(assignmentStatus) && (
                                            <div className="cj-work-log">
                                                <h4>Nhật ký công việc</h4>

                                                <p>
                                                    Cập nhật tiến độ hoặc báo cáo sự cố trong quá trình làm việc.
                                                </p>

                                                <div className="cj-log-form">
                                                    <label>Loại nhật ký</label>

                                                    <select
                                                        value={logType[booking.cleanerAssignment?.assignmentId || booking.cleanerAssignment?.id] || 'PROGRESS'}
                                                        onChange={(e) => {
                                                            const id = booking.cleanerAssignment?.assignmentId || booking.cleanerAssignment?.id;
                                                            setLogType((prev) => ({
                                                                ...prev,
                                                                [id]: e.target.value
                                                            }));
                                                        }}
                                                    >
                                                        <option value="PROGRESS">Cập nhật tiến độ</option>
                                                        <option value="INCIDENT">Báo cáo sự cố</option>
                                                    </select>

                                                    <label>Nội dung</label>

                                                    <textarea
                                                        rows="4"
                                                        placeholder="Nhập nội dung tiến độ hoặc mô tả sự cố..."
                                                        value={logNote[booking.cleanerAssignment?.assignmentId || booking.cleanerAssignment?.id] || ''}
                                                        onChange={(e) => {
                                                            const id = booking.cleanerAssignment?.assignmentId || booking.cleanerAssignment?.id;
                                                            setLogNote((prev) => ({
                                                                ...prev,
                                                                [id]: e.target.value
                                                            }));
                                                        }}
                                                    />

                                                    <button
                                                        type="button"
                                                        disabled={!!logLoading[booking.cleanerAssignment?.assignmentId || booking.cleanerAssignment?.id]}
                                                        onClick={() => handleSubmitWorkLog(
                                                            booking.cleanerAssignment?.assignmentId || booking.cleanerAssignment?.id
                                                        )}
                                                    >
                                                        {logLoading[booking.cleanerAssignment?.assignmentId || booking.cleanerAssignment?.id]
                                                            ? 'Đang gửi...'
                                                            : 'Gửi nhật ký'}
                                                    </button>

                                                    {logFeedback[booking.cleanerAssignment?.assignmentId || booking.cleanerAssignment?.id] && (
                                                        <p className={`cj-log-feedback ${logFeedback[booking.cleanerAssignment?.assignmentId || booking.cleanerAssignment?.id].type}`}>
                                                            {logFeedback[booking.cleanerAssignment?.assignmentId || booking.cleanerAssignment?.id].message}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="cj-log-history">
                                                    <div className="cj-log-history-header">
                                                        <strong>Lịch sử cập nhật</strong>

                                                        <button
                                                            type="button"
                                                            onClick={() => loadWorkLogs(
                                                                booking.cleanerAssignment?.assignmentId || booking.cleanerAssignment?.id
                                                            )}
                                                        >
                                                            Tải lịch sử
                                                        </button>
                                                    </div>

                                                    {(workLogs[booking.cleanerAssignment?.assignmentId || booking.cleanerAssignment?.id] || []).length === 0 ? (
                                                        <p>Chưa có nhật ký công việc.</p>
                                                    ) : (
                                                        workLogs[booking.cleanerAssignment?.assignmentId || booking.cleanerAssignment?.id].map((log) => (
                                                            <div className="cj-log-item" key={log.id}>
                                                                <strong>
                                                                    {log.logType === 'INCIDENT'
                                                                        ? '⚠ Báo cáo sự cố'
                                                                        : '✓ Cập nhật tiến độ'}
                                                                </strong>

                                                                <p>{log.note}</p>

                                                                <small>
                                                                    {formatDate(log.createdAt)}
                                                                </small>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default CleanerJobs;