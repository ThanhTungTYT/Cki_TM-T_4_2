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
    faCheck,
    faSliders
} from '@fortawesome/free-solid-svg-icons';
import './CustomerBookingsView.css';

function formatPrice(amount) {
    return (amount || 0).toLocaleString('vi-VN') + 'đ';
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
        desc: 'Đối tác không đủ năng lực phục vụ, hệ thống đã mở hoàn tiền 100%.'
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

const DEFAULT_BOOKINGS = [
    {
        id: 'CM-2026-928174',
        providerId: 1,
        providerName: 'Công ty TNHH Vệ sinh CleanHome Pro',
        providerPhone: '0908 123 456',
        status: 'PENDING_COMPLETION',
        createdAt: '16/10/2026 14:30',
        customer: {
            fullName: 'Trần Minh Danh',
            phone: '0912 345 678',
            email: 'danh.tran@gmail.com'
        },
        address: {
            city: 'TP. Hồ Chí Minh',
            district: 'Quận 1',
            ward: 'Phường Bến Nghé',
            streetAddress: 'Tòa Landmark 81, Căn 24.08, 720A Điện Biên Phủ',
            formattedAddress: 'Tòa Landmark 81, Căn 24.08, 720A Điện Biên Phủ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            lat: 10.7952,
            lng: 106.7218
        },
        cleaner: {
            name: 'Nguyễn Văn Hùng',
            phone: '0978 999 888',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
            rating: 4.9,
            completedJobs: 142
        },
        schedule: {
            date: '16/10/2026',
            startTime: '15:00',
            endTime: '18:00',
            durationHours: 3
        },
        items: [
            {
                serviceName: 'Dịch vụ dọn dẹp nhà tiêu chuẩn',
                packageName: 'Chuyên sâu (3-4 giờ)',
                quantity: 1,
                unitPrice: 350000,
                estimatedPrice: 350000,
                notes: 'Lau sạch bụi kính ban công và hút bụi thảm phòng khách'
            },
            {
                serviceName: 'Khử khuẩn & Vệ sinh nệm sofa',
                packageName: 'Ghế sofa 3 chỗ ngồi',
                quantity: 1,
                unitPrice: 200000,
                estimatedPrice: 200000,
                notes: 'Dùng hơi nước nóng diệt khuẩn'
            }
        ],
        pricing: {
            subtotal: 550000,
            discount: 50000,
            totalAmount: 500000
        },
        paymentMethod: 'VNPAY',
        paymentStatus: 'PAID',
        history: [
            { time: '14:30 16/10/2026', actor: 'Khách hàng', text: 'Tạo đơn đặt lịch và giữ chỗ thành công.' },
            { time: '14:32 16/10/2026', actor: 'Cổng VNPAY (CN08)', text: 'Xác thực thanh toán 500.000đ thành công. Mã GD: VNP149201.' },
            { time: '14:38 16/10/2026', actor: 'Đối tác CleanHome', text: 'Tiếp nhận đơn hàng và duyệt năng lực phục vụ.' },
            { time: '14:45 16/10/2026', actor: 'Đối tác CleanHome', text: 'Phân công nhân viên Nguyễn Văn Hùng nhận việc.' },
            { time: '14:50 16/10/2026', actor: 'Nhân viên Hùng', text: 'Bắt đầu di chuyển đến địa chỉ khách hàng.' },
            { time: '15:02 16/10/2026', actor: 'Nhân viên Hùng', text: 'Check-in GPS tại tọa độ 10.7952, 106.7218 (sai số 12m). Bắt đầu làm việc.' },
            { time: '17:55 16/10/2026', actor: 'Nhân viên Hùng', text: 'Đã hoàn thành vệ sinh sạch sẽ, gửi yêu cầu khách hàng nghiệm thu.' }
        ]
    },
    {
        id: 'CM-2026-834190',
        providerId: 2,
        providerName: 'Dịch vụ Vệ sinh Xanh GreenClean',
        providerPhone: '0938 777 666',
        status: 'CONFIRMED',
        createdAt: '15/10/2026 09:15',
        customer: {
            fullName: 'Trần Minh Danh',
            phone: '0912 345 678',
            email: 'danh.tran@gmail.com'
        },
        address: {
            city: 'TP. Hồ Chí Minh',
            district: 'Quận 7',
            ward: 'Phường Tân Phong',
            streetAddress: '15 Đường số 8, KDC Him Lam',
            formattedAddress: '15 Đường số 8, KDC Him Lam, Phường Tân Phong, Quận 7, TP. Hồ Chí Minh',
            lat: 10.7423,
            lng: 106.6985
        },
        cleaner: null,
        schedule: {
            date: '17/10/2026',
            startTime: '09:00',
            endTime: '11:00',
            durationHours: 2
        },
        items: [
            {
                serviceName: 'Vệ sinh máy lạnh treo tường Inverter',
                packageName: 'Bảo dưỡng 2 dàn lạnh',
                quantity: 2,
                unitPrice: 180000,
                estimatedPrice: 360000,
                notes: 'Kiểm tra gas và xịt rửa màng lọc'
            }
        ],
        pricing: {
            subtotal: 360000,
            discount: 0,
            totalAmount: 360000
        },
        paymentMethod: 'CASH',
        paymentStatus: 'UNPAID',
        history: [
            { time: '09:15 15/10/2026', actor: 'Khách hàng', text: 'Đặt lịch thành công (Phương thức Tiền mặt COD).' },
            { time: '09:30 15/10/2026', actor: 'Đối tác GreenClean', text: 'Xác nhận tiếp nhận đơn, chuẩn bị nhân sự kỹ thuật máy lạnh.' }
        ]
    },
    {
        id: 'CM-2026-619203',
        providerId: 1,
        providerName: 'Công ty TNHH Vệ sinh CleanHome Pro',
        providerPhone: '0908 123 456',
        status: 'COMPLETED',
        createdAt: '10/10/2026 08:00',
        customer: {
            fullName: 'Trần Minh Danh',
            phone: '0912 345 678',
            email: 'danh.tran@gmail.com'
        },
        address: {
            city: 'TP. Hồ Chí Minh',
            district: 'Quận 1',
            ward: 'Phường Bến Nghé',
            streetAddress: '123 Nguyễn Huệ, Căn hộ 402',
            formattedAddress: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
            lat: 10.7769,
            lng: 106.7009
        },
        cleaner: {
            name: 'Lê Thị Mai',
            phone: '0933 111 222',
            avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
            rating: 5.0,
            completedJobs: 98
        },
        schedule: {
            date: '10/10/2026',
            startTime: '08:30',
            endTime: '11:30',
            durationHours: 3
        },
        items: [
            {
                serviceName: 'Dịch vụ dọn dẹp nhà tiêu chuẩn',
                packageName: 'Tiêu chuẩn (2-3 giờ)',
                quantity: 1,
                unitPrice: 280000,
                estimatedPrice: 280000,
                notes: 'Lau sàn và cọ rửa 2 phòng tắm'
            }
        ],
        pricing: {
            subtotal: 280000,
            discount: 30000,
            totalAmount: 250000
        },
        paymentMethod: 'VNPAY',
        paymentStatus: 'PAID',
        history: [
            { time: '08:00 10/10/2026', actor: 'Khách hàng', text: 'Khởi tạo đơn hàng.' },
            { time: '08:05 10/10/2026', actor: 'Hệ thống VNPAY', text: 'Thanh toán thành công 250.000đ.' },
            { time: '08:15 10/10/2026', actor: 'Đối tác CleanHome', text: 'Phân công chị Mai.' },
            { time: '08:30 10/10/2026', actor: 'Nhân viên Mai', text: 'Check-in và bắt đầu ca.' },
            { time: '11:30 10/10/2026', actor: 'Nhân viên Mai', text: 'Hoàn thành công việc.' },
            { time: '11:35 10/10/2026', actor: 'Khách hàng', text: 'Nghiệm thu hài lòng 5 sao và hoàn tất đơn hàng.' }
        ]
    }
];

export default function CustomerBookingsView() {
    const [searchParams] = useSearchParams();
    const highlightId = searchParams.get('id');

    const [bookings, setBookings] = useState(() => {
        try {
            const saved = localStorage.getItem('cleanmate_bookings');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch {
            // ignore
        }
        return DEFAULT_BOOKINGS;
    });

    useEffect(() => {
        localStorage.setItem('cleanmate_bookings', JSON.stringify(bookings));
    }, [bookings]);

    const [filterTab, setFilterTab] = useState('ALL');

    const [selectedBookingId, setSelectedBookingId] = useState(() => {
        if (highlightId) {
            const matched = bookings.find(b => b.id === highlightId);
            if (matched) return matched.id;
        }
        return bookings[0]?.id || '';
    });

    const selectedBooking = useMemo(() => {
        return bookings.find(b => b.id === selectedBookingId) || bookings[0] || null;
    }, [bookings, selectedBookingId]);

    const filteredBookings = useMemo(() => {
        if (filterTab === 'ALL') return bookings;
        if (filterTab === 'ACTIVE') {
            return bookings.filter(b => ['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'PENDING_COMPLETION'].includes(b.status));
        }
        if (filterTab === 'PENDING') {
            return bookings.filter(b => ['PENDING_PAYMENT', 'PENDING_PROVIDER', 'CONFIRMED'].includes(b.status));
        }
        if (filterTab === 'COMPLETED') {
            return bookings.filter(b => b.status === 'COMPLETED');
        }
        if (filterTab === 'CANCELLED') {
            return bookings.filter(b => ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(b.status));
        }
        return bookings;
    }, [bookings, filterTab]);

    const [showReviewModal, setShowReviewModal] = useState(false);
    const [ratingScore, setRatingScore] = useState(5);
    const [ratingComment, setRatingComment] = useState('');
    const [actionFeedback, setActionFeedback] = useState('');

    const handleCustomerAcceptCompletion = (bookingId) => {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

        setBookings(prev => prev.map(b => {
            if (b.id !== bookingId) return b;
            return {
                ...b,
                status: 'COMPLETED',
                history: [
                    ...b.history,
                    {
                        time: timeStr,
                        actor: 'Khách hàng',
                        text: 'Khách hàng đã trực tiếp kiểm tra, nghiệm thu đạt chuẩn và xác nhận hoàn tất dịch vụ.'
                    }
                ]
            };
        }));

        setActionFeedback('Tuyệt vời! Bạn đã xác nhận hoàn thành dịch vụ.');
        setShowReviewModal(true);
    };

    const handleTransitionState = (nextStatus, eventDesc) => {
        if (!selectedBooking) return;
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

        setBookings(prev => prev.map(b => {
            if (b.id !== selectedBooking.id) return b;
            return {
                ...b,
                status: nextStatus,
                history: [
                    ...b.history,
                    {
                        time: timeStr,
                        actor: 'Mô phỏng State Machine (CN17)',
                        text: eventDesc
                    }
                ]
            };
        }));
    };

    const statusObj = selectedBooking ? STATUS_CONFIG[selectedBooking.status] || STATUS_CONFIG.PENDING_PROVIDER : null;

    return (
        <div className="customer-bookings-view-root">
            <div className="view-header-bar">
                <div>
                    <h2>Đơn hàng của tôi & Tiến độ dịch vụ</h2>
                    <p>Theo dõi thời gian thực, tiến trình State Machine (CN17) và xác nhận nghiệm thu dịch vụ</p>
                </div>
            </div>

            {/* Bộ lọc trạng thái */}
            <div className="view-filter-tabs">
                <button
                    type="button"
                    className={`tab-btn ${filterTab === 'ALL' ? 'active' : ''}`}
                    onClick={() => setFilterTab('ALL')}
                >
                    Tất cả ({bookings.length})
                </button>
                <button
                    type="button"
                    className={`tab-btn ${filterTab === 'ACTIVE' ? 'active' : ''}`}
                    onClick={() => setFilterTab('ACTIVE')}
                >
                    Đang thực hiện
                </button>
                <button
                    type="button"
                    className={`tab-btn ${filterTab === 'PENDING' ? 'active' : ''}`}
                    onClick={() => setFilterTab('PENDING')}
                >
                    Chờ tiếp nhận
                </button>
                <button
                    type="button"
                    className={`tab-btn ${filterTab === 'COMPLETED' ? 'active' : ''}`}
                    onClick={() => setFilterTab('COMPLETED')}
                >
                    Đã hoàn thành
                </button>
                <button
                    type="button"
                    className={`tab-btn ${filterTab === 'CANCELLED' ? 'active' : ''}`}
                    onClick={() => setFilterTab('CANCELLED')}
                >
                    Đã hủy / Từ chối
                </button>
            </div>

            {actionFeedback && (
                <div className="view-alert-success">
                    <FontAwesomeIcon icon={faCheckCircle} />
                    <span>{actionFeedback}</span>
                </div>
            )}

            <div className="view-content-grid">
                {/* Danh sách đơn hàng bên trái */}
                <div className="view-list-pane">
                    {filteredBookings.length === 0 ? (
                        <div className="empty-bookings-box">
                            <FontAwesomeIcon icon={faHourglassHalf} className="empty-icon" />
                            <p>Không có đơn hàng nào trong trạng thái này.</p>
                        </div>
                    ) : (
                        filteredBookings.map(b => {
                            const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.PENDING_PROVIDER;
                            const isSelected = selectedBooking?.id === b.id;
                            return (
                                <div
                                    key={b.id}
                                    className={`b-item-card ${isSelected ? 'selected' : ''}`}
                                    onClick={() => setSelectedBookingId(b.id)}
                                >
                                    <div className="card-top-line">
                                        <span className="card-code">#{b.id}</span>
                                        <span
                                            className="card-status-badge"
                                            style={{ color: cfg.color, backgroundColor: cfg.bgColor }}
                                        >
                                            <FontAwesomeIcon icon={faCircleDot} /> {cfg.label}
                                        </span>
                                    </div>

                                    <h4 className="card-p-name">{b.providerName}</h4>

                                    <div className="card-info-row">
                                        <span>
                                            <FontAwesomeIcon icon={faCalendarDays} /> {b.schedule?.date || 'Hôm nay'} ({b.schedule?.startTime || '08:00'})
                                        </span>
                                        <strong className="card-price">{formatPrice(b.pricing?.totalAmount || 0)}</strong>
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

                {/* Chi tiết đơn & State Machine bên phải */}
                {selectedBooking && statusObj ? (
                    <div className="view-detail-pane">
                        {/* Thanh tổng quan trạng thái & Nút nghiệm thu */}
                        <div className="detail-status-banner">
                            <div className="banner-top">
                                <div>
                                    <div className="banner-code-line">
                                        Đơn dịch vụ: <strong>#{selectedBooking.id}</strong>
                                        <span className="sub-time">Tạo lúc: {selectedBooking.createdAt}</span>
                                    </div>
                                    <h3 style={{ color: statusObj.color, margin: '8px 0 4px' }}>
                                        {statusObj.label}
                                    </h3>
                                    <p className="banner-desc">{statusObj.desc}</p>
                                </div>

                                {selectedBooking.status === 'PENDING_COMPLETION' && (
                                    <div className="customer-action-container">
                                        <button
                                            type="button"
                                            className="btn-action-accept"
                                            onClick={() => handleCustomerAcceptCompletion(selectedBooking.id)}
                                        >
                                            <FontAwesomeIcon icon={faCheck} /> Nghiệm thu & Xác nhận hoàn thành
                                        </button>
                                        <small>Bấm để xác nhận nhân viên đã dọn dẹp đạt chuẩn</small>
                                    </div>
                                )}

                                {selectedBooking.status === 'COMPLETED' && (
                                    <div className="completed-pill">
                                        <FontAwesomeIcon icon={faCheckCircle} /> Đã nghiệm thu hoàn tất
                                    </div>
                                )}
                            </div>

                            {/* Dòng thời gian State Machine */}
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
                                                    <FontAwesomeIcon icon={isDone ? faCheck : st.icon} />
                                                </div>
                                                <span className="st-label">{st.title}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Bộ giả lập State Machine cho kiểm thử đồ án */}
                            <div className="sim-control-panel">
                                <div className="sim-label">
                                    <FontAwesomeIcon icon={faSliders} />
                                    <span>Bộ mô phỏng luồng chuyển trạng thái (CN17 Demo):</span>
                                </div>
                                <div className="sim-btns-row">
                                    <button
                                        type="button"
                                        className="btn-sim-step"
                                        onClick={() => handleTransitionState('CONFIRMED', 'Đối tác xác nhận đủ năng lực phục vụ.')}
                                    >
                                        1. Chấp nhận
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-sim-step"
                                        onClick={() => handleTransitionState('ASSIGNED', 'Đã phân công nhân viên Nguyễn Văn Hùng.')}
                                    >
                                        2. Phân công
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-sim-step"
                                        onClick={() => handleTransitionState('EN_ROUTE', 'Nhân viên bắt đầu di chuyển qua CN24.')}
                                    >
                                        3. Di chuyển
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-sim-step"
                                        onClick={() => handleTransitionState('IN_PROGRESS', 'Check-in GPS đạt chuẩn, bắt đầu dọn dẹp.')}
                                    >
                                        4. Bắt đầu
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-sim-step"
                                        onClick={() => handleTransitionState('PENDING_COMPLETION', 'Hoàn tất dọn dẹp, gửi khách nghiệm thu.')}
                                    >
                                        5. Nộp kết quả
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-sim-step done-step"
                                        onClick={() => handleTransitionState('COMPLETED', 'Khách hàng nghiệm thu đạt chất lượng.')}
                                    >
                                        6. Nghiệm thu xong
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Thẻ thông tin đối tác & nhân viên */}
                        <div className="cards-two-cols">
                            <div className="panel-card">
                                <h4><FontAwesomeIcon icon={faBuilding} /> Đơn vị cung cấp</h4>
                                <strong>{selectedBooking.providerName}</strong>
                                <p><FontAwesomeIcon icon={faPhone} /> Hotline: {selectedBooking.providerPhone}</p>
                                <span className="verified-badge">
                                    <FontAwesomeIcon icon={faShieldHalved} /> Đối tác xác thực CleanMate
                                </span>
                            </div>

                            <div className="panel-card">
                                <h4><FontAwesomeIcon icon={faUserCheck} /> Nhân viên làm sạch</h4>
                                {selectedBooking.cleaner ? (
                                    <div className="cleaner-flex">
                                        <img src={selectedBooking.cleaner.avatar} alt={selectedBooking.cleaner.name} className="c-avatar" />
                                        <div className="c-info">
                                            <strong>{selectedBooking.cleaner.name}</strong>
                                            <span className="c-phone"><FontAwesomeIcon icon={faPhone} /> {selectedBooking.cleaner.phone}</span>
                                            <div className="c-stats">
                                                <span className="star-tag"><FontAwesomeIcon icon={faStar} /> {selectedBooking.cleaner.rating}</span>
                                                <span>{selectedBooking.cleaner.completedJobs} đơn thành công</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="no-cleaner-notice">
                                        <FontAwesomeIcon icon={faHourglassHalf} />
                                        <span>Đang sắp xếp nhân sự chuyên nghiệp cho ca này...</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Thẻ Địa chỉ & Thời gian */}
                        <div className="panel-card">
                            <h4><FontAwesomeIcon icon={faLocationDot} /> Địa điểm & Lịch hẹn làm sạch</h4>
                            <div className="addr-time-grid">
                                <div>
                                    <span className="label-dim">Địa chỉ thực hiện:</span>
                                    <p className="addr-text">{selectedBooking.address?.formattedAddress || selectedBooking.address?.streetAddress || '123 Nguyễn Huệ, Quận 1, TP. HCM'}</p>
                                    <span className="gps-pill">GPS: Lat {selectedBooking.address?.lat || 10.7769}, Lng {selectedBooking.address?.lng || 106.7009}</span>
                                </div>
                                <div>
                                    <span className="label-dim">Khung giờ hẹn:</span>
                                    <strong className="time-val">{selectedBooking.schedule?.startTime || '08:00'} - {selectedBooking.schedule?.endTime || '11:00'}</strong>
                                    <span className="date-val"><FontAwesomeIcon icon={faCalendarDays} /> Ngày: {selectedBooking.schedule?.date || 'Hôm nay'} ({selectedBooking.schedule?.durationHours || 3} tiếng)</span>
                                </div>
                            </div>
                        </div>

                        {/* Snapshot dịch vụ & Bảng giá */}
                        <div className="panel-card">
                            <h4><FontAwesomeIcon icon={faFileInvoice} /> Chi tiết dịch vụ đã chốt (Snapshot)</h4>
                            <div className="items-snapshot-list">
                                {(selectedBooking.items || []).map((it, idx) => (
                                    <div key={idx} className="snapshot-row">
                                        <div>
                                            <strong>{it.serviceName}</strong>
                                            <span className="pkg-name">Gói: {it.packageName} (x{it.quantity})</span>
                                            {it.notes && <p className="pkg-note">Ghi chú: {it.notes}</p>}
                                        </div>
                                        <strong className="row-price">{formatPrice(it.estimatedPrice)}</strong>
                                    </div>
                                ))}

                                <div className="total-calc-box">
                                    <div className="calc-row">
                                        <span>Tạm tính:</span>
                                        <span>{formatPrice(selectedBooking.pricing?.subtotal || 0)}</span>
                                    </div>
                                    {(selectedBooking.pricing?.discount || 0) > 0 && (
                                        <div className="calc-row discount">
                                            <span>Giảm giá:</span>
                                            <span>-{formatPrice(selectedBooking.pricing?.discount || 0)}</span>
                                        </div>
                                    )}
                                    <div className="calc-row final">
                                        <span>Tổng tiền ({selectedBooking.paymentMethod || 'VNPAY'}):</span>
                                        <strong className="price-big">{formatPrice(selectedBooking.pricing?.totalAmount || 0)}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Nhật ký lịch sử chuyển trạng thái */}
                        <div className="panel-card">
                            <h4><FontAwesomeIcon icon={faClock} /> Nhật ký trạng thái (Booking Status History)</h4>
                            <div className="history-flow">
                                {(selectedBooking.history || []).map((h, idx) => (
                                    <div key={idx} className="history-flow-item">
                                        <div className="flow-dot" />
                                        <div className="flow-body">
                                            <div className="flow-meta">
                                                <span className="flow-actor">{h.actor}</span>
                                                <span className="flow-time">{h.time}</span>
                                            </div>
                                            <p className="flow-desc">{h.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Modal đánh giá */}
            {showReviewModal && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-top">
                            <FontAwesomeIcon icon={faCheckCircle} className="modal-ico" />
                            <h3>Nghiệm thu hoàn tất!</h3>
                            <p>Cảm ơn quý khách đã tin tưởng dịch vụ CleanMate</p>
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
                            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                                Nhận xét chất lượng làm sạch:
                            </label>
                            <textarea
                                rows="3"
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                                placeholder="Nhân viên rất nhiệt tình, làm sạch bóng sàn nhà và ban công..."
                                value={ratingComment}
                                onChange={(e) => setRatingComment(e.target.value)}
                            />
                        </div>

                        <div className="modal-actions">
                            <button
                                type="button"
                                className="btn-save-review"
                                onClick={() => {
                                    setShowReviewModal(false);
                                    setActionFeedback('Đánh giá của bạn đã được ghi nhận. Cảm ơn bạn!');
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
