    
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
        return (Number(amount) || 0).toLocaleString('vi-VN') + 'đ';
    }
    
    const STATUS_CONFIG = {
        PENDING_PAYMENT: {
            label: 'Chờ thanh toán',
            color: '#f59e0b',
            bgColor: '#fef3c7',
            stepIndex: 0,
            desc: 'Đơn đang giữ chỗ. Vui lòng thanh toán trước khi hết hạn.'
        },
        PENDING_PROVIDER: {
            label: 'Chờ đối tác tiếp nhận',
            color: '#3b82f6',
            bgColor: '#eff6ff',
            stepIndex: 1,
            desc: 'Đơn đã thanh toán, đối tác đang kiểm tra lịch và năng lực phục vụ.'
        },
        CONFIRMED: {
            label: 'Đối tác đã xác nhận',
            color: '#2563eb',
            bgColor: '#dbeafe',
            stepIndex: 1,
            desc: 'Đối tác đã chấp nhận tiếp nhận đơn, chuẩn bị phân công nhân sự.'
        },
        ASSIGNED: {
            label: 'Đã phân công nhân sự',
            color: '#6366f1',
            bgColor: '#e0e7ff',
            stepIndex: 2,
            desc: 'Đã phân công kỹ thuật viên làm sạch cho đơn hàng.'
        },
        EN_ROUTE: {
            label: 'Nhân viên đang di chuyển',
            color: '#8b5cf6',
            bgColor: '#ede9fe',
            stepIndex: 3,
            desc: 'Kỹ thuật viên đang trên đường đến địa chỉ của bạn.'
        },
        IN_PROGRESS: {
            label: 'Đang thực hiện dịch vụ',
            color: '#0284c7',
            bgColor: '#e0f2fe',
            stepIndex: 4,
            desc: 'Nhân viên đã check-in GPS và đang tiến hành dọn dẹp theo quy trình.'
        },
        PENDING_COMPLETION: {
            label: 'Chờ khách hàng nghiệm thu',
            color: '#ea580c',
            bgColor: '#ffedd5',
            stepIndex: 5,
            desc: 'Nhân viên đã hoàn tất dọn dẹp, kính mời quý khách kiểm tra và xác nhận hoàn thành.'
        },
        COMPLETED: {
            label: 'Hoàn thành dịch vụ',
            color: '#059669',
            bgColor: '#d1fae5',
            stepIndex: 5,
            desc: 'Đơn hàng đã hoàn tất thành công. Cảm ơn quý khách đã tin tưởng CleanMate!'
        },
        CANCELLED: {
            label: 'Đã hủy',
            color: '#dc2626',
            bgColor: '#fee2e2',
            stepIndex: -1,
            desc: 'Đơn hàng đã được hủy theo chính sách của CleanMate.'
        },
        REJECTED: {
            label: 'Đối tác từ chối',
            color: '#991b1b',
            bgColor: '#fee2e2',
            stepIndex: -1,
            desc: 'Đơn hàng bị đối tác từ chối. Bạn có thể gửi yêu cầu hoàn tiền nếu đủ điều kiện.'
        },
        EXPIRED: {
            label: 'Đã hết hạn giữ chỗ',
            color: '#64748b',
            bgColor: '#f1f5f9',
            stepIndex: -1,
            desc: 'Hết thời gian giữ chỗ mà chưa nhận được thanh toán.'
        }
    };
    
    const TIMELINE_STEPS = [
        { title: 'Tạo đơn & Giữ chỗ', icon: faClock },
        { title: 'Đối tác tiếp nhận', icon: faBuilding },
        { title: 'Phân công nhân viên', icon: faUserCheck },
        { title: 'Đang di chuyển', icon: faRoute },
        { title: 'Đang thực hiện', icon: faBroom },
        { title: 'Nghiệm thu hoàn tất', icon: faCheckCircle }
    ];
    
    export default function CustomerBookingsView() {
        const [searchParams] = useSearchParams();
        const highlightId = searchParams.get('id');
    
        const [bookings, setBookings] = useState([]);
    
        const [filterTab, setFilterTab] = useState('ALL');
        const [selectedBookingId, setSelectedBookingId] = useState(
            () => highlightId || ''
        );
    
        const [showReviewModal, setShowReviewModal] = useState(false);
        const [ratingScore, setRatingScore] = useState(5);
        const [ratingComment, setRatingComment] = useState('');
    
        const [actionFeedback, setActionFeedback] = useState('');
        const [feedbackType, setFeedbackType] = useState('success');
    
        // CN18: Trạng thái modal và gửi yêu cầu hoàn tiền.
        const [showRefundModal, setShowRefundModal] = useState(false);
        const [refundReason, setRefundReason] = useState('');
        const [refundLoading, setRefundLoading] = useState(false);
    
        // Đồng bộ đơn hàng từ backend.
        useEffect(() => {
            const token =
                sessionStorage.getItem('accessToken') ||
                localStorage.getItem('accessToken');
    
            if (!token) return;
    
            bookingApi.getMyBookings()
                .then(apiBookings => {
                    if (!Array.isArray(apiBookings)) return;
    
                    const mapped = apiBookings.map(b => ({
                        id: b.bookingCode || `CM-${b.id}`,
                        dbId: b.id,
                        version: b.version,
                        providerId: b.partnerId || 1,
                        providerName: b.partnerName || 'CleanMate Partner',
                        providerPhone: b.partnerPhone || '0908 123 456',
                        status: b.status,
                        createdAt: b.createdAt
                            ? new Date(b.createdAt).toLocaleString('vi-VN')
                            : '',
                        customer: {
                            fullName: b.customerName || '',
                            phone: b.customerPhone || ''
                        },
                        address: {
                            formattedAddress: b.fullAddress || '',
                            lat: b.latitude != null ? Number(b.latitude) : null,
                            lng: b.longitude != null ? Number(b.longitude) : null
                        },
                        cleaner: b.cleanerName
                            ? {
                                name: b.cleanerName,
                                phone: b.cleanerPhone || '',
                                rating: b.cleanerRating || 0,
                                completedJobs: b.cleanerCompletedJobs || 0
                            }
                            : null,
                        schedule: {
                            date: b.scheduledStart
                                ? new Date(b.scheduledStart).toLocaleDateString('vi-VN')
                                : '',
                            startTime: b.scheduledStart
                                ? b.scheduledStart.split('T')[1]?.substring(0, 5) || '08:00'
                                : '08:00',
                            endTime: b.scheduledEnd
                                ? b.scheduledEnd.split('T')[1]?.substring(0, 5) || '11:00'
                                : '11:00',
                            durationHours: 3
                        },
                        items: (b.items || []).map(it => ({
                            serviceName: it.serviceName || 'Dịch vụ CleanMate',
                            packageName: it.packageName || '',
                            quantity: it.quantity || 1,
                            unitPrice: it.unitPrice || 0,
                            estimatedPrice: it.totalPrice || 0,
                            notes: it.note || ''
                        })),
                        pricing: {
                            subtotal: b.subtotal || 0,
                            discount: b.discountAmount || 0,
                            totalAmount: b.totalAmount || 0
                        },
                        paymentMethod: b.paymentMethod || 'VNPAY',
                        paymentStatus: b.paymentStatus || 'UNPAID',
                        history: Array.isArray(b.statusHistory) && b.statusHistory.length > 0
                            ? b.statusHistory.map(h => ({
                                time: h.createdAt
                                    ? new Date(h.createdAt).toLocaleString('vi-VN')
                                    : '',
                                actor: h.changedByName || 'Hệ thống',
                                text: h.note || `${h.oldStatus || ''} → ${h.newStatus || ''}`
                            }))
                            : [
                                {
                                    time: b.createdAt
                                        ? new Date(b.createdAt).toLocaleString('vi-VN')
                                        : '',
                                    actor: 'Hệ thống',
                                    text: 'Khởi tạo đơn đặt dịch vụ.'
                                }
                            ]
                    }));
    
                    // Backend trả về [] thì danh sách đơn thật cũng là [].
                    setBookings(mapped);
                })
                .catch(err => {
                    console.warn(
                        'Không thể đồng bộ đơn hàng từ backend:',
                        err.message
                    );
                });
        }, []);
    
        // Chọn đơn mặc định sau khi có dữ liệu.
        const selectedBooking = useMemo(() => {
            return bookings.find(b => b.id === selectedBookingId)
                || bookings.find(b => b.id === highlightId)
                || bookings[0]
                || null;
        }, [bookings, selectedBookingId, highlightId]);
    
        useEffect(() => {
            if (selectedBooking && selectedBooking.id !== selectedBookingId) {
                setSelectedBookingId(selectedBooking.id);
            }
        }, [selectedBooking, selectedBookingId]);
    
        const filteredBookings = useMemo(() => {
            if (filterTab === 'ALL') return bookings;
    
            if (filterTab === 'ACTIVE') {
                return bookings.filter(b =>
                    ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'PENDING_COMPLETION']
                        .includes(b.status)
                );
            }
    
            if (filterTab === 'PENDING') {
                return bookings.filter(b =>
                    ['PENDING_PAYMENT', 'PENDING_PROVIDER', 'CONFIRMED']
                        .includes(b.status)
                );
            }
    
            if (filterTab === 'COMPLETED') {
                return bookings.filter(b => b.status === 'COMPLETED');
            }
    
            if (filterTab === 'CANCELLED') {
                return bookings.filter(b =>
                    ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(b.status)
                );
            }
    
            return bookings;
        }, [bookings, filterTab]);
    
        const statusObj = selectedBooking
            ? STATUS_CONFIG[selectedBooking.status] || STATUS_CONFIG.PENDING_PROVIDER
            : null;
    
        const showFeedback = (message, type = 'success') => {
            setFeedbackType(type);
            setActionFeedback(message);
        };
    
        // CN18: Gửi yêu cầu hoàn tiền đến backend.
        const handleRequestRefund = async () => {
            if (refundLoading) return;
    
            if (!selectedBooking?.dbId) {
                showFeedback(
                    'Đơn này chưa có ID từ database. Vui lòng chọn đơn hàng thật từ backend.',
                    'error'
                );
                return;
            }
    
            if (!['CANCELLED', 'REJECTED'].includes(selectedBooking.status)) {
                showFeedback(
                    'Chỉ đơn đã hủy hoặc bị đối tác từ chối mới được yêu cầu hoàn tiền.',
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
                    'Đã gửi yêu cầu hoàn tiền thành công. Vui lòng chờ Admin/Staff xét duyệt.',
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
    
        const handleCustomerAcceptCompletion = async (bookingId) => {
            const targetBooking = bookings.find(b => b.id === bookingId);
    
            if (targetBooking?.dbId) {
                try {
                    const updated = await bookingApi.executeAction(targetBooking.dbId, {
                        action: 'CUSTOMER_ACCEPT',
                        note: 'Khách hàng đã kiểm tra, nghiệm thu và xác nhận hoàn tất dịch vụ.',
                        version: targetBooking.version
                    });
                    setBookings((previous) => previous.map((booking) => booking.dbId === updated.id
                        ? {
                            ...booking,
                            status: updated.status,
                            version: updated.version,
                            history: (updated.statusHistory || []).map((entry) => ({
                                time: entry.createdAt ? new Date(entry.createdAt).toLocaleString('vi-VN') : '',
                                actor: entry.changedByName || 'Hệ thống',
                                text: entry.note || `${entry.oldStatus || ''} → ${entry.newStatus || ''}`
                            }))
                        }
                        : booking));
                } catch (err) {
                    console.warn('API executeAction thông báo:', err.message);
                    showFeedback(
                        'Chưa thể xác nhận hoàn tất trên backend: ' + err.message,
                        'error'
                    );
                    return;
                }
            }
    
            showFeedback(
                'Tuyệt vời! Bạn đã xác nhận hoàn thành dịch vụ.',
                'success'
            );
            setShowReviewModal(true);
        };

        const handleCustomerCancel = async () => {
            if (!selectedBooking?.dbId) return;
            if (!window.confirm(`Bạn có chắc muốn hủy đơn ${selectedBooking.id}?`)) return;
            try {
                const updated = await bookingApi.executeAction(selectedBooking.dbId, {
                    action: 'CANCEL',
                    note: 'Khách hàng yêu cầu hủy đơn.',
                    version: selectedBooking.version
                });
                setBookings((previous) => previous.map((booking) => booking.dbId === updated.id
                    ? {
                        ...booking,
                        status: updated.status,
                        version: updated.version,
                        cancelReason: updated.cancelReason,
                        history: (updated.statusHistory || []).map((entry) => ({
                            time: entry.createdAt ? new Date(entry.createdAt).toLocaleString('vi-VN') : '',
                            actor: entry.changedByName || 'Hệ thống',
                            text: entry.note || `${entry.oldStatus || ''} → ${entry.newStatus || ''}`
                        }))
                    }
                    : booking));
                showFeedback('Đơn đã được hủy.', 'success');
            } catch (err) {
                showFeedback(err.message || 'Không thể hủy đơn ở trạng thái hiện tại.', 'error');
            }
        };
    
        return (
            <div className="customer-bookings-view-root">
                <div className="view-header-bar">
                    <div>
                        <h2>Đơn hàng của tôi & Tiến độ dịch vụ</h2>
                        <p>
                            Theo dõi tiến trình đơn hàng và xác nhận nghiệm thu dịch vụ
                        </p>
                    </div>
                </div>
    
                {/* Bộ lọc trạng thái */}
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
                            style={{
                                marginLeft: 'auto',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer'
                            }}
                        >
                            ×
                        </button>
                    </div>
                )}
    
                <div className="view-content-grid">
                    {/* Danh sách đơn hàng */}
                    <div className="view-list-pane">
                        {filteredBookings.length === 0 ? (
                            <div className="empty-bookings-box">
                                <FontAwesomeIcon
                                    icon={faHourglassHalf}
                                    className="empty-icon"
                                />
                                <p>Không có đơn hàng nào trong trạng thái này.</p>
                            </div>
                        ) : (
                            filteredBookings.map(b => {
                                const cfg =
                                    STATUS_CONFIG[b.status] ||
                                    STATUS_CONFIG.PENDING_PROVIDER;
    
                                const isSelected = selectedBooking?.id === b.id;
    
                                return (
                                    <div
                                        key={b.id}
                                        className={`b-item-card ${isSelected ? 'selected' : ''}`}
                                        onClick={() => {
                                            setSelectedBookingId(b.id);
                                            setActionFeedback('');
                                        }}
                                    >
                                        <div className="card-top-line">
                                            <span className="card-code">
                                                #{b.id}
                                            </span>
    
                                            <span
                                                className="card-status-badge"
                                                style={{
                                                    color: cfg.color,
                                                    backgroundColor: cfg.bgColor
                                                }}
                                            >
                                                <FontAwesomeIcon icon={faCircleDot} />
                                                {' '}{cfg.label}
                                            </span>
                                        </div>
    
                                        <h4 className="card-p-name">
                                            {b.providerName}
                                        </h4>
    
                                        <div className="card-info-row">
                                            <span>
                                                <FontAwesomeIcon icon={faCalendarDays} />
                                                {' '}{b.schedule?.date || 'Chưa có ngày'}
                                                {' '}({b.schedule?.startTime || '08:00'})
                                            </span>
    
                                            <strong className="card-price">
                                                {formatPrice(b.pricing?.totalAmount)}
                                            </strong>
                                        </div>
    
                                        <div className="card-tags-row">
                                            {(b.items || []).map((it, idx) => (
                                                <span key={idx} className="card-tag">
                                                    {it.serviceName}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
    
                    {/* Chi tiết đơn hàng */}
                    {selectedBooking && statusObj ? (
                        <div className="view-detail-pane">
                            <div className="detail-status-banner">
                                <div className="banner-top">
                                    <div>
                                        <div className="banner-code-line">
                                            Đơn dịch vụ:{' '}
                                            <strong>#{selectedBooking.id}</strong>
                                            <span className="sub-time">
                                                Tạo lúc: {selectedBooking.createdAt}
                                            </span>
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
                                                onClick={() =>
                                                    handleCustomerAcceptCompletion(selectedBooking.id)
                                                }
                                            >
                                                <FontAwesomeIcon icon={faCheck} />
                                                {' '}Nghiệm thu & Xác nhận hoàn thành
                                            </button>
    
                                            <small>
                                                Bấm để xác nhận nhân viên đã dọn dẹp đạt chuẩn.
                                            </small>
                                        </div>
                                    )}
    
                                    {['PENDING_PAYMENT', 'PENDING_PROVIDER', 'CONFIRMED', 'ASSIGNED'].includes(selectedBooking.status)
                                        && selectedBooking.dbId && (
                                            <div className="customer-action-container">
                                                <button type="button" className="btn-action-cancel" onClick={handleCustomerCancel}>
                                                    Hủy đơn
                                                </button>
                                                <small>Có thể hủy trước khi nhân viên bắt đầu di chuyển.</small>
                                            </div>
                                        )}

                                    {selectedBooking.status === 'COMPLETED' && (
                                        <div className="completed-pill">
                                            <FontAwesomeIcon icon={faCheckCircle} />
                                            {' '}Đã nghiệm thu hoàn tất
                                        </div>
                                    )}
    
                                    {/* CN18: Nút yêu cầu hoàn tiền */}
                                    {['CANCELLED', 'REJECTED'].includes(selectedBooking.status)
                                        && selectedBooking.dbId && (
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
                                                    Gửi yêu cầu để Admin/Staff xét duyệt.
                                                </small>
                                            </div>
                                        )}
                                </div>
    
                                {/* Timeline */}
                                {statusObj.stepIndex >= 0 && (
                                    <div className="state-timeline-horizontal">
                                        {TIMELINE_STEPS.map((st, idx) => {
                                            const isDone = idx < statusObj.stepIndex;
                                            const isCurrent = idx === statusObj.stepIndex;
    
                                            return (
                                                <div
                                                    key={idx}
                                                    className={`st-node ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
                                                >
                                                    <div className="st-circle">
                                                        <FontAwesomeIcon
                                                            icon={isDone ? faCheck : st.icon}
                                                        />
                                                    </div>
                                                    <span className="st-label">
                                                        {st.title}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
    
                                {/* Bộ mô phỏng CN17 */}

                            </div>
    
                            {/* Thông tin đối tác và nhân viên */}
                            <div className="cards-two-cols">
                                <div className="panel-card">
                                    <h4>
                                        <FontAwesomeIcon icon={faBuilding} />
                                        {' '}Đơn vị cung cấp
                                    </h4>
    
                                    <strong>{selectedBooking.providerName}</strong>
    
                                    <p>
                                        <FontAwesomeIcon icon={faPhone} />
                                        {' '}Hotline: {selectedBooking.providerPhone || 'Chưa cập nhật'}
                                    </p>
    
                                    <span className="verified-badge">
                                        <FontAwesomeIcon icon={faShieldHalved} />
                                        {' '}Đối tác xác thực CleanMate
                                    </span>
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
                                                <strong>
                                                    {selectedBooking.cleaner.name}
                                                </strong>
    
                                                <span className="c-phone">
                                                    <FontAwesomeIcon icon={faPhone} />
                                                    {' '}{selectedBooking.cleaner.phone}
                                                </span>
    
                                                <div className="c-stats">
                                                    <span className="star-tag">
                                                        <FontAwesomeIcon icon={faStar} />
                                                        {' '}{selectedBooking.cleaner.rating}
                                                    </span>
    
                                                    <span>
                                                        {selectedBooking.cleaner.completedJobs}
                                                        {' '}đơn thành công
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="no-cleaner-notice">
                                            <FontAwesomeIcon icon={faHourglassHalf} />
                                            <span>
                                                Đang sắp xếp nhân sự chuyên nghiệp cho ca này...
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
    
                            {/* Địa chỉ và thời gian */}
                            <div className="panel-card">
                                <h4>
                                    <FontAwesomeIcon icon={faLocationDot} />
                                    {' '}Địa điểm & Lịch hẹn làm sạch
                                </h4>
    
                                <div className="addr-time-grid">
                                    <div>
                                        <span className="label-dim">
                                            Địa chỉ thực hiện:
                                        </span>
    
                                        <p className="addr-text">
                                            {selectedBooking.address?.formattedAddress
                                                || selectedBooking.address?.streetAddress
                                                || 'Chưa cập nhật địa chỉ'}
                                        </p>
    
                                        <span className="gps-pill">
                                            GPS: Lat {selectedBooking.address?.lat ?? 'N/A'},
                                            {' '}Lng {selectedBooking.address?.lng ?? 'N/A'}
                                        </span>
                                    </div>
    
                                    <div>
                                        <span className="label-dim">
                                            Khung giờ hẹn:
                                        </span>
    
                                        <strong className="time-val">
                                            {selectedBooking.schedule?.startTime || '08:00'}
                                            {' - '}
                                            {selectedBooking.schedule?.endTime || '11:00'}
                                        </strong>
    
                                        <span className="date-val">
                                            <FontAwesomeIcon icon={faCalendarDays} />
                                            {' '}Ngày: {selectedBooking.schedule?.date || 'Chưa cập nhật'}
                                            {' '}({selectedBooking.schedule?.durationHours || 3} tiếng)
                                        </span>
                                    </div>
                                </div>
                            </div>
    
                            {/* Chi tiết dịch vụ và bảng giá */}
                            <div className="panel-card">
                                <h4>
                                    <FontAwesomeIcon icon={faFileInvoice} />
                                    {' '}Chi tiết dịch vụ đã chốt (Snapshot)
                                </h4>
    
                                <div className="items-snapshot-list">
                                    {(selectedBooking.items || []).map((it, idx) => (
                                        <div key={idx} className="snapshot-row">
                                            <div>
                                                <strong>{it.serviceName}</strong>
    
                                                <span className="pkg-name">
                                                    Gói: {it.packageName || 'Không có'}
                                                    {' '}(x{it.quantity || 1})
                                                </span>
    
                                                {it.notes && (
                                                    <p className="pkg-note">
                                                        Ghi chú: {it.notes}
                                                    </p>
                                                )}
                                            </div>
    
                                            <strong className="row-price">
                                                {formatPrice(it.estimatedPrice)}
                                            </strong>
                                        </div>
                                    ))}
    
                                    <div className="total-calc-box">
                                        <div className="calc-row">
                                            <span>Tạm tính:</span>
                                            <span>
                                                {formatPrice(selectedBooking.pricing?.subtotal)}
                                            </span>
                                        </div>
    
                                        {(Number(selectedBooking.pricing?.discount) || 0) > 0 && (
                                            <div className="calc-row discount">
                                                <span>Giảm giá:</span>
                                                <span>
                                                    -{formatPrice(selectedBooking.pricing?.discount)}
                                                </span>
                                            </div>
                                        )}
    
                                        <div className="calc-row final">
                                                <span>
                                                Tổng tiền ({selectedBooking.paymentMethod === 'CASH' ? 'Tiền mặt khi hoàn tất' : 'VNPay'}):
                                            </span>
    
                                            <strong className="price-big">
                                                {formatPrice(selectedBooking.pricing?.totalAmount)}
                                            </strong>
                                        </div>
                                        <div className="calc-row">
                                            <span>Thanh toán:</span>
                                            <strong>{selectedBooking.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
    
                            {/* Nhật ký lịch sử */}
                            <div className="panel-card">
                                <h4>
                                    <FontAwesomeIcon icon={faClock} />
                                    {' '}Nhật ký trạng thái (Booking Status History)
                                </h4>
    
                                <div className="history-flow">
                                    {(selectedBooking.history || []).map((h, idx) => (
                                        <div key={idx} className="history-flow-item">
                                            <div className="flow-dot" />
    
                                            <div className="flow-body">
                                                <div className="flow-meta">
                                                    <span className="flow-actor">
                                                        {h.actor}
                                                    </span>
                                                    <span className="flow-time">
                                                        {h.time}
                                                    </span>
                                                </div>
    
                                                <p className="flow-desc">
                                                    {h.text}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="view-detail-pane">
                            <p>Chọn một đơn hàng để xem chi tiết.</p>
                        </div>
                    )}
                </div>
    
                {/* Modal yêu cầu hoàn tiền - CN18 */}
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
    
                                <h3 id="refund-modal-title">
                                    Yêu cầu hoàn tiền
                                </h3>
    
                                <p>
                                    Đơn hàng #{selectedBooking.id}
                                </p>
                            </div>
    
                            <div
                                className="form-group"
                                style={{ margin: '16px 0' }}
                            >
                                <label
                                    htmlFor="refund-reason"
                                    style={{
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        color: '#334155'
                                    }}
                                >
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
                                    placeholder="Nhập lý do bạn muốn yêu cầu hoàn tiền..."
                                    value={refundReason}
                                    onChange={e => setRefundReason(e.target.value)}
                                    disabled={refundLoading}
                                />
    
                                <small>
                                    {refundReason.length}/1000 ký tự
                                </small>
                            </div>
    
                            <p style={{ fontSize: '13px', color: '#64748b' }}>
                                Yêu cầu sẽ được Admin/Staff xem xét. Gửi yêu cầu
                                không đồng nghĩa tiền đã được hoàn.
                            </p>
    
                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="btn-save-review"
                                    onClick={handleRequestRefund}
                                    disabled={refundLoading || !refundReason.trim()}
                                >
                                    {refundLoading
                                        ? 'Đang gửi...'
                                        : 'Gửi yêu cầu'}
                                </button>
    
                                <button
                                    type="button"
                                    className="btn-skip"
                                    onClick={() => {
                                        if (!refundLoading) {
                                            setShowRefundModal(false);
                                        }
                                    }}
                                    disabled={refundLoading}
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                )}
    
                {/* Modal đánh giá */}
                {showReviewModal && (
                    <div className="modal-overlay">
                        <div className="modal-card">
                            <div className="modal-top">
                                <FontAwesomeIcon
                                    icon={faCheckCircle}
                                    className="modal-ico"
                                />
    
                                <h3>Nghiệm thu hoàn tất!</h3>
    
                                <p>
                                    Cảm ơn quý khách đã tin tưởng dịch vụ CleanMate
                                </p>
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
    
                            <div
                                className="form-group"
                                style={{ margin: '16px 0' }}
                            >
                                <label
                                    htmlFor="rating-comment"
                                    style={{
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        color: '#334155'
                                    }}
                                >
                                    Nhận xét chất lượng làm sạch:
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
                                    placeholder="Nhân viên rất nhiệt tình, làm sạch bóng sàn nhà và ban công..."
                                    value={ratingComment}
                                    onChange={e => setRatingComment(e.target.value)}
                                />
                            </div>
    
                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="btn-save-review"
                                    onClick={() => {
                                        setShowReviewModal(false);
                                        showFeedback(
                                            'Đánh giá của bạn đã được ghi nhận. Cảm ơn bạn!',
                                            'success'
                                        );
                                    }}
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
