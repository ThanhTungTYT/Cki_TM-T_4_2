
import { useCallback, useEffect, useMemo, useState } from 'react';
import { bookingApi } from '../../services/api';
import './CleanerJobs.css';

const STATUS_CONFIG = {
    PENDING_PAYMENT: { label: 'Chờ thanh toán', type: 'pending' },
    PENDING_PROVIDER: { label: 'Chờ nhà cung cấp', type: 'pending' },
    CONFIRMED: { label: 'Đã xác nhận', type: 'confirmed' },
    ASSIGNED: { label: 'Đã phân công', type: 'assigned' },
    EN_ROUTE: { label: 'Đang di chuyển', type: 'progress' },
    IN_PROGRESS: { label: 'Đang thực hiện', type: 'progress' },
    PENDING_COMPLETION: { label: 'Chờ nghiệm thu', type: 'waiting' },
    COMPLETED: { label: 'Hoàn thành', type: 'completed' },
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

    if (key === 'COMPLETED') return 'COMPLETED';

    if (['CANCELLED', 'REJECTED', 'EXPIRED'].includes(key)) {
        return 'CANCELLED';
    }

    if (['EN_ROUTE', 'IN_PROGRESS', 'PENDING_COMPLETION'].includes(key)) {
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

    // Quản lý trạng thái thao tác trên từng đơn
    const [processingId, setProcessingId] = useState(null);

    // Thông báo kết quả thao tác
    const [actionFeedback, setActionFeedback] = useState({
        bookingId: null,
        message: '',
        type: ''
    });

    // Hàm chỉ gọi API và trả về dữ liệu
    const fetchBookings = useCallback(async () => {
        const data = await bookingApi.getCleanerBookings();
        return Array.isArray(data) ? data : [];
    }, []);

    // Tải lại danh sách khi người dùng chủ động yêu cầu
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
    // Các setState chỉ chạy trong callback bất đồng bộ của Promise.
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

    // Xử lý các thao tác cập nhật trạng thái đơn hàng
    async function handleBookingAction(booking, action) {
        if (processingId !== null) return;

        const actionMessages = {
            START_TRAVEL: 'Đã bắt đầu di chuyển đến địa điểm làm việc.',
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
            const updatedBooking = await bookingApi.executeAction(
                booking.id,
                {
                    action,
                    version: booking.version
                }
            );

            if (updatedBooking && updatedBooking.id != null) {
                setBookings((currentBookings) =>
                    currentBookings.map((item) =>
                        item.id === updatedBooking.id
                            ? updatedBooking
                            : item
                    )
                );
            } else {
                await loadBookings();
            }

            setActionFeedback({
                bookingId: booking.id,
                message: actionMessages[action] || 'Cập nhật thành công.',
                type: 'success'
            });

        } catch (err) {
            setActionFeedback({
                bookingId: booking.id,
                message:
                    err.message || 'Không thể cập nhật trạng thái công việc.',
                type: 'error'
            });

            // Tải lại dữ liệu mới nhất nếu thao tác thất bại
            await loadBookings();

        } finally {
            setProcessingId(null);
        }
    }

    // Thống kê công việc
    const stats = useMemo(() => {
        return {
            total: bookings.length,

            upcoming: bookings.filter(
                (b) => getFilterGroup(b.status) === 'UPCOMING'
            ).length,

            inProgress: bookings.filter(
                (b) => getFilterGroup(b.status) === 'IN_PROGRESS'
            ).length,

            completed: bookings.filter(
                (b) => getFilterGroup(b.status) === 'COMPLETED'
            ).length
        };
    }, [bookings]);

    // Tìm kiếm và lọc công việc
    const filteredBookings = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return bookings.filter((booking) => {
            const matchFilter =
                filter === 'ALL' ||
                getFilterGroup(booking.status) === filter;

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
            ].join(' ').toLowerCase();

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
                            className={filter === item.value ? 'active' : ''}
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
                    <button type="button" onClick={loadBookings}>
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
                        const status = getStatus(booking.status);
                        const expanded = expandedId === booking.id;

                        return (
                            <article
                                className="cj-booking-card"
                                key={booking.id}
                            >
                                <div className="cj-card-top">
                                    <div>
                                        <span className="cj-booking-code">
                                            MÃ ĐƠN: {booking.bookingCode || `#${booking.id}`}
                                        </span>

                                        <h3>
                                            {booking.customerName || 'Khách hàng'}
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
                                            {formatDate(booking.scheduledStart)}
                                        </strong>
                                    </div>

                                    <div>
                                        <span className="cj-info-label">
                                            Địa chỉ làm việc
                                        </span>

                                        <strong>
                                            {booking.fullAddress || 'Chưa có địa chỉ'}
                                        </strong>
                                    </div>

                                    <div>
                                        <span className="cj-info-label">
                                            Dịch vụ
                                        </span>

                                        <strong>
                                            {booking.items?.length
                                                ? booking.items
                                                    .map((item) => item.serviceName)
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
                                            {formatMoney(booking.totalAmount)}
                                        </strong>
                                    </div>
                                </div>

                                {/* XEM THÔNG TIN */}
                                <div className="cj-card-bottom">
                                    <span>
                                        {booking.items?.length || 0} hạng mục dịch vụ
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setExpandedId(
                                                expanded ? null : booking.id
                                            )
                                        }
                                    >
                                        {expanded ? 'Thu gọn' : 'Xem thông tin'}
                                        <span>{expanded ? '⌃' : '⌄'}</span>
                                    </button>
                                </div>

                                {/* CÁC NÚT THAO TÁC */}
                                <div className="cj-actions">
                                    {String(booking.status).toUpperCase() === 'ASSIGNED' && (
                                        <>
                                            <button
                                                type="button"
                                                className="cj-action-btn cj-action-travel"
                                                disabled={processingId !== null}
                                                onClick={() =>
                                                    handleBookingAction(
                                                        booking,
                                                        'START_TRAVEL'
                                                    )
                                                }
                                            >
                                                {processingId === booking.id
                                                    ? 'Đang xử lý...'
                                                    : 'Bắt đầu di chuyển'}
                                            </button>

                                            <button
                                                type="button"
                                                className="cj-action-btn cj-action-start"
                                                disabled={processingId !== null}
                                                onClick={() =>
                                                    handleBookingAction(
                                                        booking,
                                                        'START_JOB'
                                                    )
                                                }
                                            >
                                                {processingId === booking.id
                                                    ? 'Đang xử lý...'
                                                    : 'Bắt đầu làm ngay'}
                                            </button>
                                        </>
                                    )}

                                    {String(booking.status).toUpperCase() === 'EN_ROUTE' && (
                                        <button
                                            type="button"
                                            className="cj-action-btn cj-action-start"
                                            disabled={processingId !== null}
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

                                    {String(booking.status).toUpperCase() === 'IN_PROGRESS' && (
                                        <button
                                            type="button"
                                            className="cj-action-btn cj-action-complete"
                                            disabled={processingId !== null}
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

                                    {String(booking.status).toUpperCase() === 'PENDING_COMPLETION' && (
                                        <p className="cj-waiting-confirmation">
                                            Đã báo hoàn thành, đang chờ khách hàng xác nhận.
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
                                                <span>Thời gian kết thúc dự kiến</span>
                                                <strong>
                                                    {formatDate(booking.scheduledEnd)}
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
                                                                {item.serviceName || 'Dịch vụ'}
                                                            </strong>

                                                            {item.packageName && (
                                                                <span>
                                                                    Gói: {item.packageName}
                                                                </span>
                                                            )}

                                                            {item.note && (
                                                                <span>
                                                                    Ghi chú: {item.note}
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
                                                Không có thông tin chi tiết dịch vụ.
                                            </p>
                                        )}

                                        {booking.customerNote && (
                                            <>
                                                <h4>Ghi chú của khách hàng</h4>

                                                <p className="cj-customer-note">
                                                    {booking.customerNote}
                                                </p>
                                            </>
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
