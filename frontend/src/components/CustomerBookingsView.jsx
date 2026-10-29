import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faClock,
    faCalendarDays,
    faLocationDot,
    faPhone,
    faBuilding,
    faCheckCircle,
    faCircleDot,
    faCreditCard,
    faBroom,
    faUserCheck,
    faRoute,
    faHourglassHalf,
    faStar,
    faShieldHalved,
    faFileInvoice,
    faCheck
} from '@fortawesome/free-solid-svg-icons';
import { bookingApi, refundApi } from '../services/api';
import './CustomerBookingsView.css';

function formatPrice(amount) {
    if (amount == null || amount === '') return 'Chưa có dữ liệu';
    return Number(amount).toLocaleString('vi-VN') + 'đ';
}

const STATUS_CONFIG = {
    PENDING_PAYMENT: {
        label: 'Chờ thanh toán',
        color: '#f59e0b',
        bgColor: '#fef3c7',
        stepIndex: 0,
        desc: 'Đơn đang chờ thanh toán.'
    },
    PENDING_PROVIDER: {
        label: 'Chờ đối tác tiếp nhận',
        color: '#3b82f6',
        bgColor: '#eff6ff',
        stepIndex: 1,
        desc: 'Đơn đang chờ đối tác tiếp nhận.'
    },
    CONFIRMED: {
        label: 'Đối tác đã xác nhận',
        color: '#2563eb',
        bgColor: '#dbeafe',
        stepIndex: 1,
        desc: 'Đối tác đã xác nhận đơn hàng.'
    },
    ASSIGNED: {
        label: 'Đã phân công nhân sự',
        color: '#6366f1',
        bgColor: '#e0e7ff',
        stepIndex: 2,
        desc: 'Đơn hàng đã được phân công nhân sự.'
    },
    EN_ROUTE: {
        label: 'Nhân viên đang di chuyển',
        color: '#8b5cf6',
        bgColor: '#ede9fe',
        stepIndex: 3,
        desc: 'Nhân viên đang di chuyển đến địa chỉ thực hiện dịch vụ.'
    },
    IN_PROGRESS: {
        label: 'Đang thực hiện dịch vụ',
        color: '#0284c7',
        bgColor: '#e0f2fe',
        stepIndex: 4,
        desc: 'Dịch vụ đang được thực hiện.'
    },
    PENDING_COMPLETION: {
        label: 'Chờ khách hàng nghiệm thu',
        color: '#ea580c',
        bgColor: '#ffedd5',
        stepIndex: 5,
        desc: 'Đơn đang chờ khách hàng xác nhận hoàn thành.'
    },
    COMPLETED: {
        label: 'Hoàn thành dịch vụ',
        color: '#059669',
        bgColor: '#d1fae5',
        stepIndex: 5,
        desc: 'Đơn hàng đã hoàn thành.'
    },
    CANCELLED: {
        label: 'Đã hủy',
        color: '#dc2626',
        bgColor: '#fee2e2',
        stepIndex: -1,
        desc: 'Đơn hàng đã bị hủy.'
    },
    REJECTED: {
        label: 'Đối tác từ chối',
        color: '#991b1b',
        bgColor: '#fee2e2',
        stepIndex: -1,
        desc: 'Đối tác đã từ chối đơn hàng.'
    },
    EXPIRED: {
        label: 'Đã hết hạn',
        color: '#64748b',
        bgColor: '#f1f5f9',
        stepIndex: -1,
        desc: 'Đơn hàng đã hết hạn.'
    }
};

const TIMELINE_STEPS = [
    { title: 'Tạo đơn', icon: faClock },
    { title: 'Đối tác tiếp nhận', icon: faBuilding },
    { title: 'Phân công nhân viên', icon: faUserCheck },
    { title: 'Đang di chuyển', icon: faRoute },
    { title: 'Đang thực hiện', icon: faBroom },
    { title: 'Hoàn tất', icon: faCheckCircle }
];

function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('vi-VN');
}

function formatDateOnly(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('vi-VN');
}

function mapHistory(statusHistory) {
    if (!Array.isArray(statusHistory)) return [];

    return statusHistory.map(item => ({
        time: formatDate(item.createdAt),
        actor: item.changedByName || '',
        text: item.note || [
            item.oldStatus || '',
            item.newStatus || ''
        ].filter(Boolean).join(' → ')
    }));
}

function mapBooking(booking) {
    return {
        id: booking.bookingCode || String(booking.id),
        dbId: booking.id,
        version: booking.version,
        providerId: booking.partnerId ?? null,
        providerName: booking.partnerName || '',
        providerPhone: booking.partnerPhone || '',
        status: booking.status || '',
        createdAt: formatDate(booking.createdAt),
        customer: {
            fullName: booking.customerName || '',
            phone: booking.customerPhone || ''
        },
        address: {
            formattedAddress: booking.fullAddress || '',
            lat: booking.latitude != null ? Number(booking.latitude) : null,
            lng: booking.longitude != null ? Number(booking.longitude) : null
        },
        cleaner: booking.cleanerName
            ? {
                name: booking.cleanerName,
                phone: booking.cleanerPhone || '',
                avatar: booking.cleanerAvatar || '',
                rating: booking.cleanerRating ?? null,
                completedJobs: booking.cleanerCompletedJobs ?? null
            }
            : null,
        schedule: {
            date: formatDateOnly(booking.scheduledStart),
            startTime: booking.scheduledStart
                ? booking.scheduledStart.split('T')[1]?.substring(0, 5) || ''
                : '',
            endTime: booking.scheduledEnd
                ? booking.scheduledEnd.split('T')[1]?.substring(0, 5) || ''
                : '',
            durationHours: booking.durationHours ?? null
        },
        items: Array.isArray(booking.items)
            ? booking.items.map(item => ({
                serviceName: item.serviceName || '',
                packageName: item.packageName || '',
                quantity: item.quantity ?? null,
                unitPrice: item.unitPrice ?? null,
                estimatedPrice: item.totalPrice ?? null,
                notes: item.note || ''
            }))
            : [],
        pricing: {
            subtotal: booking.subtotal ?? null,
            discount: booking.discountAmount ?? null,
            totalAmount: booking.totalAmount ?? null
        },
        paymentMethod: booking.paymentMethod || '',
        paymentStatus: booking.paymentStatus || '',
        history: mapHistory(booking.statusHistory)
    };
}

export default function CustomerBookingsView() {
    const [searchParams] = useSearchParams();
    const highlightId = searchParams.get('id');

    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [filterTab, setFilterTab] = useState('ALL');
    const [selectedBookingId, setSelectedBookingId] = useState(highlightId || '');
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [ratingScore, setRatingScore] = useState(5);
    const [ratingComment, setRatingComment] = useState('');
    const [actionFeedback, setActionFeedback] = useState('');
    const [feedbackType, setFeedbackType] = useState('success');
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [refundReason, setRefundReason] = useState('');
    const [refundLoading, setRefundLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const showFeedback = (message, type = 'success') => {
        setFeedbackType(type);
        setActionFeedback(message);
    };

    const loadBookings = async () => {
        setLoading(true);
        setLoadError('');

        const token =
            sessionStorage.getItem('accessToken') ||
            localStorage.getItem('accessToken');

        if (!token) {
            setBookings([]);
            setLoadError('Vui lòng đăng nhập để xem lịch sử đặt dịch vụ.');
            setLoading(false);
            return;
        }

        try {
            const response = await bookingApi.getMyBookings();

            if (!Array.isArray(response)) {
                throw new Error('Dữ liệu lịch sử đơn hàng từ backend không hợp lệ.');
            }

            const mapped = response.map(mapBooking);
            setBookings(mapped);

            if (highlightId) {
                const matched = mapped.find(
                    booking =>
                        String(booking.dbId) === String(highlightId) ||
                        booking.id === highlightId
                );

                if (matched) setSelectedBookingId(matched.id);
            }
        } catch (error) {
            setBookings([]);
            setLoadError(
                error.message || 'Không thể tải lịch sử đặt dịch vụ.'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBookings();
    }, []);

    const selectedBooking = useMemo(() => {
        return bookings.find(booking => booking.id === selectedBookingId)
            || bookings.find(booking =>
                String(booking.dbId) === String(highlightId)
            )
            || bookings[0]
            || null;
    }, [bookings, selectedBookingId, highlightId]);

    useEffect(() => {
        if (
            selectedBooking &&
            selectedBooking.id !== selectedBookingId
        ) {
            setSelectedBookingId(selectedBooking.id);
        }
    }, [selectedBooking, selectedBookingId]);

    const filteredBookings = useMemo(() => {
        if (filterTab === 'ALL') return bookings;

        if (filterTab === 'ACTIVE') {
            return bookings.filter(booking =>
                ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'PENDING_COMPLETION']
                    .includes(booking.status)
            );
        }

        if (filterTab === 'PENDING') {
            return bookings.filter(booking =>
                ['PENDING_PAYMENT', 'PENDING_PROVIDER', 'CONFIRMED']
                    .includes(booking.status)
            );
        }

        if (filterTab === 'COMPLETED') {
            return bookings.filter(
                booking => booking.status === 'COMPLETED'
            );
        }

        if (filterTab === 'CANCELLED') {
            return bookings.filter(booking =>
                ['CANCELLED', 'REJECTED', 'EXPIRED']
                    .includes(booking.status)
            );
        }

        return bookings;
    }, [bookings, filterTab]);

    const statusObj = selectedBooking
        ? STATUS_CONFIG[selectedBooking.status] || {
        label: selectedBooking.status || 'Chưa có trạng thái',
        color: '#64748b',
        bgColor: '#f1f5f9',
        stepIndex: -1,
        desc: 'Trạng thái do backend trả về.'
    }
        : null;

    const updateBookingFromResponse = updated => {
        if (!updated?.id) return;

        setBookings(previous =>
            previous.map(booking =>
                String(booking.dbId) === String(updated.id)
                    ? {
                        ...booking,
                        status: updated.status ?? booking.status,
                        version: updated.version ?? booking.version,
                        history: Array.isArray(updated.statusHistory)
                            ? mapHistory(updated.statusHistory)
                            : booking.history
                    }
                    : booking
            )
        );
    };

    const handleCustomerAcceptCompletion = async () => {
        if (!selectedBooking?.dbId || actionLoading) return;

        if (selectedBooking.status !== 'PENDING_COMPLETION') {
            showFeedback(
                'Đơn hàng không ở trạng thái chờ nghiệm thu.',
                'error'
            );
            return;
        }

        try {
            setActionLoading(true);
            setActionFeedback('');

            const updated = await bookingApi.executeAction(
                selectedBooking.dbId,
                {
                    action: 'CUSTOMER_ACCEPT',
                    note: 'Khách hàng xác nhận hoàn thành dịch vụ.',
                    version: selectedBooking.version
                }
            );

            updateBookingFromResponse(updated);
            setShowReviewModal(true);
        } catch (error) {
            showFeedback(
                error.message || 'Không thể xác nhận hoàn thành đơn hàng.',
                'error'
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleCustomerCancel = async () => {
        if (!selectedBooking?.dbId || actionLoading) return;

        const canCancel = [
            'PENDING_PAYMENT',
            'PENDING_PROVIDER',
            'CONFIRMED',
            'ASSIGNED'
        ].includes(selectedBooking.status);

        if (!canCancel) {
            showFeedback(
                'Đơn hàng không thể hủy ở trạng thái hiện tại.',
                'error'
            );
            return;
        }

        if (!window.confirm(`Bạn có chắc muốn hủy đơn ${selectedBooking.id}?`)) {
            return;
        }

        try {
            setActionLoading(true);
            setActionFeedback('');

            const updated = await bookingApi.executeAction(
                selectedBooking.dbId,
                {
                    action: 'CANCEL',
                    note: 'Khách hàng yêu cầu hủy đơn.',
                    version: selectedBooking.version
                }
            );

            updateBookingFromResponse(updated);
            showFeedback('Đã gửi yêu cầu hủy đơn đến backend.', 'success');
        } catch (error) {
            showFeedback(
                error.message || 'Không thể hủy đơn ở trạng thái hiện tại.',
                'error'
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleRequestRefund = async () => {
        if (refundLoading) return;

        if (!selectedBooking?.dbId) {
            showFeedback(
                'Không tìm thấy ID đơn hàng từ database.',
                'error'
            );
            return;
        }

        if (!['CANCELLED', 'REJECTED'].includes(selectedBooking.status)) {
            showFeedback(
                'Chỉ đơn đã hủy hoặc bị từ chối mới có thể gửi yêu cầu hoàn tiền.',
                'error'
            );
            return;
        }

        if (!refundReason.trim()) {
            showFeedback('Vui lòng nhập lý do yêu cầu hoàn tiền.', 'error');
            return;
        }

        try {
            setRefundLoading(true);
            setActionFeedback('');

            await refundApi.requestRefund(
                selectedBooking.dbId,
                refundReason.trim()
            );

            setShowRefundModal(false);
            setRefundReason('');

            showFeedback(
                'Đã gửi yêu cầu hoàn tiền. Vui lòng chờ hệ thống xét duyệt.',
                'success'
            );
        } catch (error) {
            showFeedback(
                error.message || 'Không thể gửi yêu cầu hoàn tiền.',
                'error'
            );
        } finally {
            setRefundLoading(false);
        }
    };

    const handleSubmitReview = () => {
        showFeedback(
            'Chức năng gửi đánh giá cần được kết nối với API đánh giá backend.',
            'error'
        );
    };

    return (
        <div className="customer-bookings-view-root">
            <div className="view-header-bar">
                <div>
                    <h2>Đơn hàng của tôi & Tiến độ dịch vụ</h2>
                    <p>Theo dõi đơn hàng và trạng thái dịch vụ từ hệ thống.</p>
                </div>
                <button
                    type="button"
                    onClick={loadBookings}
                    disabled={loading}
                >
                    {loading ? 'Đang tải...' : 'Tải lại'}
                </button>
            </div>

            {loadError && (
                <div className="view-alert-error" role="alert">
                    {loadError}
                </div>
            )}

            {actionFeedback && (
                <div
                    className={
                        feedbackType === 'error'
                            ? 'view-alert-error'
                            : 'view-alert-success'
                    }
                    role="status"
                >
                    <FontAwesomeIcon icon={faCheckCircle} />
                    <span>{actionFeedback}</span>
                    <button
                        type="button"
                        onClick={() => setActionFeedback('')}
                        aria-label="Đóng thông báo"
                    >
                        ×
                    </button>
                </div>
            )}

            <div className="view-filter-tabs">
                {[
                    ['ALL', `Tất cả (${bookings.length})`],
                    ['ACTIVE', 'Đang thực hiện'],
                    ['PENDING', 'Chờ xử lý'],
                    ['COMPLETED', 'Đã hoàn thành'],
                    ['CANCELLED', 'Đã hủy / Từ chối']
                ].map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        className={`tab-btn ${filterTab === value ? 'active' : ''}`}
                        onClick={() => setFilterTab(value)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="empty-bookings-box">
                    <FontAwesomeIcon icon={faHourglassHalf} className="empty-icon" />
                    <p>Đang tải lịch sử đơn hàng...</p>
                </div>
            ) : (
                <div className="view-content-grid">
                    <div className="view-list-pane">
                        {filteredBookings.length === 0 ? (
                            <div className="empty-bookings-box">
                                <FontAwesomeIcon
                                    icon={faHourglassHalf}
                                    className="empty-icon"
                                />
                                <p>Không có đơn hàng trong danh sách này.</p>
                            </div>
                        ) : (
                            filteredBookings.map(booking => {
                                const config = STATUS_CONFIG[booking.status] || {
                                    label: booking.status || 'Chưa có trạng thái',
                                    color: '#64748b',
                                    bgColor: '#f1f5f9'
                                };

                                const isSelected =
                                    selectedBooking?.id === booking.id;

                                return (
                                    <button
                                        key={booking.id}
                                        type="button"
                                        className={`b-item-card ${isSelected ? 'selected' : ''}`}
                                        onClick={() => {
                                            setSelectedBookingId(booking.id);
                                            setActionFeedback('');
                                        }}
                                    >
                                        <div className="card-top-line">
                                            <span className="card-code">
                                                #{booking.id}
                                            </span>
                                            <span
                                                className="card-status-badge"
                                                style={{
                                                    color: config.color,
                                                    backgroundColor: config.bgColor
                                                }}
                                            >
                                                <FontAwesomeIcon icon={faCircleDot} />
                                                {' '}{config.label}
                                            </span>
                                        </div>

                                        <h4 className="card-p-name">
                                            {booking.providerName || 'Chưa có thông tin đối tác'}
                                        </h4>

                                        <div className="card-info-row">
                                            <span>
                                                <FontAwesomeIcon icon={faCalendarDays} />
                                                {' '}{booking.schedule.date || 'Chưa có ngày'}
                                                {booking.schedule.startTime
                                                    ? ` (${booking.schedule.startTime})`
                                                    : ''}
                                            </span>
                                            <strong className="card-price">
                                                {formatPrice(booking.pricing.totalAmount)}
                                            </strong>
                                        </div>

                                        <div className="card-tags-row">
                                            {booking.items.map((item, index) => (
                                                <span
                                                    key={`${item.serviceName}-${index}`}
                                                    className="card-tag"
                                                >
                                                    {item.serviceName || 'Dịch vụ'}
                                                </span>
                                            ))}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {selectedBooking && statusObj ? (
                        <div className="view-detail-pane">
                            <div className="detail-status-banner">
                                <div className="banner-top">
                                    <div>
                                        <div className="banner-code-line">
                                            Đơn dịch vụ:{' '}
                                            <strong>#{selectedBooking.id}</strong>
                                            {selectedBooking.createdAt && (
                                                <span className="sub-time">
                                                    Tạo lúc: {selectedBooking.createdAt}
                                                </span>
                                            )}
                                        </div>

                                        <h3
                                            style={{
                                                color: statusObj.color,
                                                margin: '8px 0 4px'
                                            }}
                                        >
                                            {statusObj.label}
                                        </h3>

                                        <p className="banner-desc">
                                            {statusObj.desc}
                                        </p>
                                    </div>

                                    {selectedBooking.status === 'PENDING_COMPLETION' && (
                                        <div className="customer-action-container">
                                            <button
                                                type="button"
                                                className="btn-action-accept"
                                                onClick={handleCustomerAcceptCompletion}
                                                disabled={actionLoading}
                                            >
                                                <FontAwesomeIcon icon={faCheck} />
                                                {' '}{actionLoading ? 'Đang xử lý...' : 'Nghiệm thu & Xác nhận hoàn thành'}
                                            </button>
                                        </div>
                                    )}

                                    {[
                                        'PENDING_PAYMENT',
                                        'PENDING_PROVIDER',
                                        'CONFIRMED',
                                        'ASSIGNED'
                                    ].includes(selectedBooking.status) && selectedBooking.dbId && (
                                        <div className="customer-action-container">
                                            <button
                                                type="button"
                                                className="btn-action-cancel"
                                                onClick={handleCustomerCancel}
                                                disabled={actionLoading}
                                            >
                                                {actionLoading ? 'Đang xử lý...' : 'Hủy đơn'}
                                            </button>
                                            <small>
                                                Việc hủy đơn sẽ được backend kiểm tra theo trạng thái hiện tại.
                                            </small>
                                        </div>
                                    )}

                                    {selectedBooking.status === 'COMPLETED' && (
                                        <div className="completed-pill">
                                            <FontAwesomeIcon icon={faCheckCircle} />
                                            {' '}Đã hoàn thành
                                        </div>
                                    )}

                                    {[
                                        'CANCELLED',
                                        'REJECTED'
                                    ].includes(selectedBooking.status) && selectedBooking.dbId && (
                                        <div className="customer-action-container">
                                            <button
                                                type="button"
                                                className="btn-action-accept"
                                                onClick={() => {
                                                    setRefundReason('');
                                                    setShowRefundModal(true);
                                                    setActionFeedback('');
                                                }}
                                            >
                                                <FontAwesomeIcon icon={faCreditCard} />
                                                {' '}Yêu cầu hoàn tiền
                                            </button>
                                            <small>
                                                Yêu cầu sẽ được hệ thống xét duyệt.
                                            </small>
                                        </div>
                                    )}
                                </div>

                                {statusObj.stepIndex >= 0 && (
                                    <div className="state-timeline-horizontal">
                                        {TIMELINE_STEPS.map((step, index) => {
                                            const isDone = index < statusObj.stepIndex;
                                            const isCurrent = index === statusObj.stepIndex;

                                            return (
                                                <div
                                                    key={step.title}
                                                    className={`st-node ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
                                                >
                                                    <div className="st-circle">
                                                        <FontAwesomeIcon
                                                            icon={isDone ? faCheck : step.icon}
                                                        />
                                                    </div>
                                                    <span className="st-label">
                                                        {step.title}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="cards-two-cols">
                                <div className="panel-card">
                                    <h4>
                                        <FontAwesomeIcon icon={faBuilding} />
                                        {' '}Đơn vị cung cấp
                                    </h4>

                                    <strong>
                                        {selectedBooking.providerName || 'Chưa có thông tin đối tác'}
                                    </strong>

                                    {selectedBooking.providerPhone && (
                                        <p>
                                            <FontAwesomeIcon icon={faPhone} />
                                            {' '}Hotline: {selectedBooking.providerPhone}
                                        </p>
                                    )}

                                    {selectedBooking.providerId != null && (
                                        <span className="verified-badge">
                                            <FontAwesomeIcon icon={faShieldHalved} />
                                            {' '}Mã đối tác: {selectedBooking.providerId}
                                        </span>
                                    )}
                                </div>

                                <div className="panel-card">
                                    <h4>
                                        <FontAwesomeIcon icon={faUserCheck} />
                                        {' '}Nhân viên làm sạch
                                    </h4>

                                    {selectedBooking.cleaner ? (
                                        <div className="cleaner-flex">
                                            {selectedBooking.cleaner.avatar && (
                                                <img
                                                    src={selectedBooking.cleaner.avatar}
                                                    alt={selectedBooking.cleaner.name}
                                                    className="c-avatar"
                                                />
                                            )}

                                            <div className="c-info">
                                                <strong>{selectedBooking.cleaner.name}</strong>

                                                {selectedBooking.cleaner.phone && (
                                                    <span className="c-phone">
                                                        <FontAwesomeIcon icon={faPhone} />
                                                        {' '}{selectedBooking.cleaner.phone}
                                                    </span>
                                                )}

                                                {(selectedBooking.cleaner.rating != null ||
                                                    selectedBooking.cleaner.completedJobs != null) && (
                                                    <div className="c-stats">
                                                        {selectedBooking.cleaner.rating != null && (
                                                            <span className="star-tag">
                                                                <FontAwesomeIcon icon={faStar} />
                                                                {' '}{selectedBooking.cleaner.rating}
                                                            </span>
                                                        )}

                                                        {selectedBooking.cleaner.completedJobs != null && (
                                                            <span>
                                                                {selectedBooking.cleaner.completedJobs} đơn thành công
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <p>Backend chưa cung cấp thông tin nhân viên được phân công.</p>
                                    )}
                                </div>
                            </div>

                            <div className="panel-card">
                                <h4>
                                    <FontAwesomeIcon icon={faLocationDot} />
                                    {' '}Địa điểm & Lịch hẹn
                                </h4>

                                <div className="addr-time-grid">
                                    <div>
                                        <span className="label-dim">Địa chỉ thực hiện:</span>
                                        <p className="addr-text">
                                            {selectedBooking.address.formattedAddress || 'Chưa có dữ liệu địa chỉ'}
                                        </p>

                                        {selectedBooking.address.lat != null &&
                                            selectedBooking.address.lng != null && (
                                                <span className="gps-pill">
                                                    GPS: Lat {selectedBooking.address.lat},
                                                    {' '}Lng {selectedBooking.address.lng}
                                                </span>
                                            )}
                                    </div>

                                    <div>
                                        <span className="label-dim">Khung giờ hẹn:</span>
                                        <strong className="time-val">
                                            {selectedBooking.schedule.startTime || '--:--'}
                                            {' - '}
                                            {selectedBooking.schedule.endTime || '--:--'}
                                        </strong>

                                        <span className="date-val">
                                            <FontAwesomeIcon icon={faCalendarDays} />
                                            {' '}Ngày: {selectedBooking.schedule.date || 'Chưa có dữ liệu'}
                                            {selectedBooking.schedule.durationHours != null
                                                ? ` (${selectedBooking.schedule.durationHours} tiếng)`
                                                : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="panel-card">
                                <h4>
                                    <FontAwesomeIcon icon={faFileInvoice} />
                                    {' '}Chi tiết dịch vụ
                                </h4>

                                {selectedBooking.items.length === 0 ? (
                                    <p>Backend chưa trả chi tiết dịch vụ cho đơn này.</p>
                                ) : (
                                    <div className="items-snapshot-list">
                                        {selectedBooking.items.map((item, index) => (
                                            <div
                                                key={`${item.serviceName}-${index}`}
                                                className="snapshot-row"
                                            >
                                                <div>
                                                    <strong>
                                                        {item.serviceName || 'Dịch vụ'}
                                                    </strong>

                                                    {item.packageName && (
                                                        <span className="pkg-name">
                                                            Gói: {item.packageName}
                                                        </span>
                                                    )}

                                                    {item.quantity != null && (
                                                        <span className="pkg-name">
                                                            Số lượng: {item.quantity}
                                                        </span>
                                                    )}

                                                    {item.notes && (
                                                        <p className="pkg-note">
                                                            Ghi chú: {item.notes}
                                                        </p>
                                                    )}
                                                </div>

                                                <strong className="row-price">
                                                    {formatPrice(item.estimatedPrice)}
                                                </strong>
                                            </div>
                                        ))}

                                        <div className="total-calc-box">
                                            <div className="calc-row">
                                                <span>Tạm tính:</span>
                                                <span>
                                                    {formatPrice(selectedBooking.pricing.subtotal)}
                                                </span>
                                            </div>

                                            {Number(selectedBooking.pricing.discount) > 0 && (
                                                <div className="calc-row discount">
                                                    <span>Giảm giá:</span>
                                                    <span>
                                                        -{formatPrice(selectedBooking.pricing.discount)}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="calc-row final">
                                                <span>
                                                    Tổng tiền
                                                    {selectedBooking.paymentMethod
                                                        ? ` (${selectedBooking.paymentMethod})`
                                                        : ''}
                                                </span>
                                                <strong className="price-big">
                                                    {formatPrice(selectedBooking.pricing.totalAmount)}
                                                </strong>
                                            </div>

                                            <div className="calc-row">
                                                <span>Trạng thái thanh toán:</span>
                                                <strong>
                                                    {selectedBooking.paymentStatus || 'Chưa có dữ liệu'}
                                                </strong>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="panel-card">
                                <h4>
                                    <FontAwesomeIcon icon={faClock} />
                                    {' '}Lịch sử trạng thái
                                </h4>

                                {selectedBooking.history.length === 0 ? (
                                    <p>Backend chưa trả lịch sử trạng thái cho đơn này.</p>
                                ) : (
                                    <div className="history-flow">
                                        {selectedBooking.history.map((history, index) => (
                                            <div
                                                key={`${history.time}-${index}`}
                                                className="history-flow-item"
                                            >
                                                <div className="flow-dot" />
                                                <div className="flow-body">
                                                    <div className="flow-meta">
                                                        <span className="flow-actor">
                                                            {history.actor || 'Chưa có thông tin người cập nhật'}
                                                        </span>
                                                        <span className="flow-time">
                                                            {history.time}
                                                        </span>
                                                    </div>
                                                    <p className="flow-desc">
                                                        {history.text || 'Trạng thái đã được cập nhật.'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="view-detail-pane">
                            <p>Chọn một đơn hàng để xem chi tiết.</p>
                        </div>
                    )}
                </div>
            )}

            {showRefundModal && selectedBooking && (
                <div className="modal-overlay">
                    <div
                        className="modal-card"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="refund-modal-title"
                    >
                        <div className="modal-top">
                            <FontAwesomeIcon
                                icon={faCreditCard}
                                className="modal-ico"
                            />
                            <h3 id="refund-modal-title">Yêu cầu hoàn tiền</h3>
                            <p>Đơn hàng #{selectedBooking.id}</p>
                        </div>

                        <div className="form-group" style={{ margin: '16px 0' }}>
                            <label htmlFor="refund-reason">
                                Lý do yêu cầu hoàn tiền
                            </label>

                            <textarea
                                id="refund-reason"
                                rows="4"
                                maxLength={1000}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    marginTop: '8px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    boxSizing: 'border-box',
                                    resize: 'vertical'
                                }}
                                placeholder="Nhập lý do yêu cầu hoàn tiền..."
                                value={refundReason}
                                onChange={event => setRefundReason(event.target.value)}
                                disabled={refundLoading}
                            />

                            <small>{refundReason.length}/1000 ký tự</small>
                        </div>

                        <p style={{ fontSize: '13px', color: '#64748b' }}>
                            Gửi yêu cầu không đồng nghĩa tiền đã được hoàn.
                        </p>

                        <div className="modal-actions">
                            <button
                                type="button"
                                className="btn-save-review"
                                onClick={handleRequestRefund}
                                disabled={refundLoading || !refundReason.trim()}
                            >
                                {refundLoading ? 'Đang gửi...' : 'Gửi yêu cầu'}
                            </button>

                            <button
                                type="button"
                                className="btn-skip"
                                onClick={() => {
                                    if (!refundLoading) setShowRefundModal(false);
                                }}
                                disabled={refundLoading}
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showReviewModal && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-top">
                            <FontAwesomeIcon
                                icon={faCheckCircle}
                                className="modal-ico"
                            />
                            <h3>Nghiệm thu hoàn tất</h3>
                            <p>Đơn hàng đã được cập nhật trên hệ thống.</p>
                        </div>

                        <div className="rating-selector">
                            <span>Mức độ hài lòng:</span>
                            <div className="stars-row">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <FontAwesomeIcon
                                        key={star}
                                        icon={faStar}
                                        className={`star-ico ${star <= ratingScore ? 'active' : ''}`}
                                        onClick={() => setRatingScore(star)}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="form-group" style={{ margin: '16px 0' }}>
                            <label htmlFor="rating-comment">
                                Nhận xét chất lượng dịch vụ
                            </label>
                            <textarea
                                id="rating-comment"
                                rows="3"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    boxSizing: 'border-box'
                                }}
                                placeholder="Nhập nhận xét của bạn..."
                                value={ratingComment}
                                onChange={event => setRatingComment(event.target.value)}
                            />
                        </div>

                        <div className="modal-actions">
                            <button
                                type="button"
                                className="btn-save-review"
                                onClick={handleSubmitReview}
                            >
                                Gửi đánh giá dịch vụ
                            </button>

                            <button
                                type="button"
                                className="btn-skip"
                                onClick={() => setShowReviewModal(false)}
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}