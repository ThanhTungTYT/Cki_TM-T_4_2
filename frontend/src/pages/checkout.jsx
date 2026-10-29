import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBuilding,
    faCalendarDays,
    faClock,
    faLocationDot,
    faUser,
    faPhone,
    faShieldHalved,
    faCheck,
    faArrowLeft,
    faCreditCard,
    faMoneyBillWave,
    faQrcode,
    faTag,
    faCircleCheck,
    faSpinner,
    faBroom,
    faHourglassHalf,
    faCircleExclamation,
    faMapPin,
    faCrosshairs,
    faRoute
} from '@fortawesome/free-solid-svg-icons';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useCart, useCartDispatch } from '../context/CartContext';
import { bookingApi } from '../services/api';
import { createVNPayPayment } from '../services/paymentService';
import './checkout.css';

function formatPrice(amount) {
    return (amount || 0).toLocaleString('vi-VN') + 'đ';
}

function formatDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const TIME_SLOTS = [
    { id: '08:00', label: '08:00 - Sáng sớm', period: 'morning' },
    { id: '09:30', label: '09:30 - Buổi sáng', period: 'morning' },
    { id: '11:00', label: '11:00 - Trưa', period: 'morning' },
    { id: '13:30', label: '13:30 - Đầu chiều', period: 'afternoon' },
    { id: '15:00', label: '15:00 - Chiều', period: 'afternoon' },
    { id: '16:30', label: '16:30 - Cuối chiều', period: 'afternoon' },
    { id: '18:00', label: '18:00 - Buổi tối', period: 'evening' }
];

export default function Checkout() {
    const [searchParams] = useSearchParams();
    const providerIdParam = searchParams.get('providerId');
    const providerNameParam = searchParams.get('providerName');

    const navigate = useNavigate();
    const { cartItems } = useCart();
    const dispatch = useCartDispatch();

    // 1. Lọc các item thuộc về Provider được chọn
    const activeProviderId = providerIdParam ? String(providerIdParam) : null;
    const checkoutItems = useMemo(() => {
        if (!cartItems || cartItems.length === 0) return [];
        if (activeProviderId) {
            const matched = cartItems.filter(i => String(i.providerId || 1) === activeProviderId);
            if (matched.length > 0) return matched;
        }
        // Nếu không có param hoặc không khớp, lấy nhóm provider đầu tiên
        const firstPId = String(cartItems[0]?.providerId || 1);
        return cartItems.filter(i => String(i.providerId || 1) === firstPId);
    }, [cartItems, activeProviderId]);

    const currentProviderName = useMemo(() => {
        if (providerNameParam) {
            try {
                return decodeURIComponent(providerNameParam);
            } catch {
                return providerNameParam;
            }
        }
        if (checkoutItems.length > 0) return checkoutItems[0].providerName || 'Đơn vị vệ sinh CleanMate';
        return 'Đơn vị vệ sinh CleanMate';
    }, [providerNameParam, checkoutItems]);

    // 2. Thông tin khách hàng & Địa chỉ
    const [customerInfo, setCustomerInfo] = useState(() => {
        try {
            const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
            if (stored) {
                const u = JSON.parse(stored);
                return {
                    fullName: u.fullName || '',
                    phone: u.phone || '',
                    email: u.email || ''
                };
            }
        } catch {
            // ignore
        }
        return { fullName: '', phone: '', email: '' };
    });

    const [addressForm, setAddressForm] = useState({ city: '', district: '', ward: '', streetAddress: '', lat: null, lng: null });
    const [defaultAddressId, setDefaultAddressId] = useState(null);
    const [addressLoading, setAddressLoading] = useState(true);
    const [defaultAddressError, setDefaultAddressError] = useState('');

    useEffect(() => {
        const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
        if (!token) {
            setAddressLoading(false);
            setDefaultAddressError('Vui lòng đăng nhập để tải địa chỉ mặc định.');
            return;
        }
        fetch('http://localhost:8080/api/users/me/addresses', {
            headers: { Authorization: `Bearer ${token}` }
        }).then(async (response) => {
            const addresses = await response.json().catch(() => []);
            if (!response.ok) throw new Error(addresses.message || addresses.detail || 'Không thể tải địa chỉ đã lưu.');
            const address = addresses.find((item) => item.isDefault);
            if (!address) {
                setDefaultAddressError('Bạn chưa có địa chỉ mặc định. Hãy đặt một địa chỉ mặc định trong hồ sơ trước khi đặt lịch.');
                return;
            }
            setDefaultAddressId(address.id);
            setAddressForm({
                city: address.province || '',
                district: address.district || '',
                ward: address.ward || '',
                streetAddress: address.streetAddress || '',
                lat: address.latitude ?? null,
                lng: address.longitude ?? null
            });
            setCustomerInfo((current) => ({
                ...current,
                fullName: current.fullName || address.receiverName || '',
                phone: current.phone || address.phone || ''
            }));
        }).catch((err) => setDefaultAddressError(err.message)).finally(() => setAddressLoading(false));
    }, []);

    const [specialNotes, setSpecialNotes] = useState('');

    // 3. Ngày & Khung giờ thực hiện
    const todayStr = useMemo(() => formatDateString(new Date()), []);
    const tomorrowStr = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return formatDateString(d);
    }, []);

    const [selectedDate, setSelectedDate] = useState(() => {
        return checkoutItems[0]?.scheduledDate || checkoutItems[0]?.date || tomorrowStr;
    });

    const [selectedTimeSlot, setSelectedTimeSlot] = useState(() => {
        return checkoutItems[0]?.scheduledTime || checkoutItems[0]?.time || '08:00';
    });

    useEffect(() => {
        if (checkoutItems.length > 0) {
            const d = checkoutItems[0]?.scheduledDate || checkoutItems[0]?.date;
            const t = checkoutItems[0]?.scheduledTime || checkoutItems[0]?.time;
            if (d) setSelectedDate(d);
            if (t) setSelectedTimeSlot(t);
        }
    }, [checkoutItems]);

    // 4. Tính toán thời lượng & giờ kết thúc dự kiến
    const totalDurationHours = useMemo(() => {
        if (checkoutItems.length === 0) return 3;
        return checkoutItems.reduce((sum, item) => sum + (item.durationHours || 3) * (item.quantity || 1), 0);
    }, [checkoutItems]);

    const calculatedEndTime = useMemo(() => {
        if (!selectedTimeSlot || typeof selectedTimeSlot !== 'string' || !selectedTimeSlot.includes(':')) {
            return '11:00';
        }
        const [h, m] = selectedTimeSlot.split(':').map(Number);
        const validH = isNaN(h) ? 8 : h;
        const validM = isNaN(m) ? 0 : m;
        const totalMinutes = validH * 60 + validM + Math.round((totalDurationHours || 3) * 60);
        const endH = Math.floor(totalMinutes / 60) % 24;
        const endM = totalMinutes % 60;
        return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    }, [selectedTimeSlot, totalDurationHours]);

    // 5. Phương thức thanh toán
    const [paymentMethod, setPaymentMethod] = useState('VNPAY'); // 'VNPAY', 'CASH', 'BANK_TRANSFER'

    // 6. Voucher / Khuyến mãi
    const [voucherCode, setVoucherCode] = useState('');
    const [appliedDiscount, setAppliedDiscount] = useState(0);
    const [voucherMessage, setVoucherMessage] = useState({ type: '', text: '' });

    const handleApplyVoucher = (e) => {
        e.preventDefault();
        const code = voucherCode.trim().toUpperCase();
        if (!code) {
            setVoucherMessage({ type: 'error', text: 'Vui lòng nhập mã giảm giá' });
            return;
        }
        if (code === 'CLEANMATE20') {
            setAppliedDiscount(50000);
            setVoucherMessage({ type: 'success', text: 'Áp dụng mã CLEANMATE20 thành công! Giảm 50.000đ' });
        } else if (code === 'BANMOI') {
            setAppliedDiscount(30000);
            setVoucherMessage({ type: 'success', text: 'Áp dụng mã BẠN MỚI thành công! Giảm 30.000đ' });
        } else {
            setVoucherMessage({ type: 'error', text: 'Mã giảm giá không hợp lệ hoặc đã hết lượt dùng' });
            setAppliedDiscount(0);
        }
    };

    // 7. Tính tổng tiền
    const subtotal = useMemo(() => {
        return checkoutItems.reduce((sum, item) => sum + (item.estimatedPrice || 0), 0);
    }, [checkoutItems]);

    const shippingFee = 0; // Miễn phí di chuyển
    const finalTotal = Math.max(0, subtotal + shippingFee - appliedDiscount);

    // 8. Đồng ý điều khoản
    const [agreePolicy, setAgreePolicy] = useState(true);

    // 9. Trạng thái đặt đơn & Chống lặp (Idempotency)
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isPaying, setIsPaying] = useState(false);
    const [bookingSuccessData, setBookingSuccessData] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [idempotencyKey] = useState(() => 'IDEM-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9));

    // 10. Đồng hồ đếm ngược giữ chỗ (Capacity Hold Timer)
    const [holdSecondsLeft, setHoldSecondsLeft] = useState(15 * 60); // 15 phút
    useEffect(() => {
        if (!bookingSuccessData) return;
        const timer = setInterval(() => {
            setHoldSecondsLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [bookingSuccessData]);

    const formatTimer = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    // Định vị GPS giả lập
    const handleGetLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setAddressForm(prev => ({
                        ...prev,
                        lat: Number(pos.coords.latitude.toFixed(4)),
                        lng: Number(pos.coords.longitude.toFixed(4))
                    }));
                },
                () => {
                    // Fallback to random coordinate around HCMC center
                    setAddressForm(prev => ({
                        ...prev,
                        lat: null,
                        lng: null
                    }));
                }
            );
        }
    };

    const handleVNPayPayment = async () => {
        const bookingId = bookingSuccessData?.backendBookingId;

        if (!bookingId) {
            setErrorMessage('Không tìm thấy đơn hàng trong hệ thống.');
            return;
        }

        if (isPaying) return;

        setIsPaying(true);
        setErrorMessage('');

        try {
            const data = await createVNPayPayment(bookingId);

            if (!data.txnRef || !data.paymentUrl) {
                throw new Error('Backend trả về thông tin thanh toán không hợp lệ');
            }

            sessionStorage.setItem('pendingPaymentRef', data.txnRef);

            window.location.assign(data.paymentUrl);

        } catch (err) {
            setErrorMessage(err.message);
            setIsPaying(false);
        }
    };

    // Xử lý tạo đơn đặt lịch
    const handleConfirmBooking = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        if (checkoutItems.length === 0) {
            setErrorMessage('Giỏ dịch vụ của đơn vị này đang trống. Vui lòng chọn lại.');
            return;
        }

        if (!customerInfo.fullName.trim() || !customerInfo.phone.trim()) {
            setErrorMessage('Vui lòng điền họ tên và số điện thoại liên hệ nhận việc.');
            return;
        }

        if (!addressForm.streetAddress.trim()) {
            setErrorMessage('Vui lòng nhập địa chỉ cụ thể nơi thực hiện dịch vụ.');
            return;
        }
        if (!defaultAddressId) {
            setErrorMessage('Cần có địa chỉ mặc định trong hồ sơ để tiếp tục đặt lịch.');
            return;
        }

        if (!agreePolicy) {
            setErrorMessage('Bạn cần đồng ý với Điều khoản dịch vụ và Chính sách hủy đơn.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Giả lập gửi request tạo đơn với Idempotency Key (CN07)
            const bookingPayload = {
                idempotencyKey,
                providerId: checkoutItems[0]?.providerId || 1,
                providerName: currentProviderName,
                customer: customerInfo,
                address: {
                    ...addressForm,
                    formattedAddress: `${addressForm.streetAddress}, ${addressForm.ward}, ${addressForm.district}, ${addressForm.city}`
                },
                schedule: {
                    date: selectedDate,
                    startTime: selectedTimeSlot,
                    endTime: calculatedEndTime,
                    durationHours: totalDurationHours
                },
                items: checkoutItems.map(item => ({
                    serviceId: item.serviceId,
                    serviceName: item.serviceName,
                    packageId: item.packageId,
                    packageName: item.packageName,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    estimatedPrice: item.estimatedPrice,
                    notes: item.notes || ''
                })),
                specialNotes,
                pricing: {
                    subtotal,
                    discount: appliedDiscount,
                    totalAmount: finalTotal
                },
                paymentMethod
            };

            console.log('Tạo đơn dịch vụ (CN07 payload):', bookingPayload);

            let generatedBookingCode = 'CM-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 900000);
            let backendBookingId = null;

            // Gọi API Backend nếu đã đăng nhập
            const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
            if (token) {
                try {
                    const scheduledStart = `${selectedDate}T${selectedTimeSlot}:00`;
                    const apiReq = {
                        partnerId: checkoutItems[0]?.providerId ? Number(checkoutItems[0].providerId) : 1,
                        addressId: Number(defaultAddressId),
                        paymentMethod,
                        items: checkoutItems.map(item => ({
                            serviceId: item.serviceId ? Number(item.serviceId) : 1,
                            packageId: item.packageId ? Number(item.packageId) : null,
                            quantity: item.quantity || 1,
                            note: item.notes || ''
                        })),
                        scheduledStart,
                        customerNote: specialNotes || '',
                        voucherCode: voucherCode || null,
                        idempotencyKey
                    };

                    const apiRes = await bookingApi.createBooking(apiReq, idempotencyKey);
                    if (!apiRes?.id || !apiRes?.bookingCode) {
                        throw new Error('Backend không trả về Booking hợp lệ');
                    }
                    generatedBookingCode = apiRes.bookingCode;
                    backendBookingId = apiRes.id;
                } catch (apiErr) {
                    throw new Error('Không thể tạo đơn hàng: ' + apiErr.message, { cause: apiErr });
                }
            } else {
                throw new Error('Vui lòng đăng nhập để đặt dịch vụ');
            }

            const newBookingRecord = {
                id: generatedBookingCode,
                dbId: backendBookingId,
                ...bookingPayload,
                status: 'PENDING_PROVIDER', // Sau khi giữ chỗ/đặt, chuyển sang chờ đối tác
                createdAt: new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                history: [
                    {
                        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
                        actor: 'Khách hàng',
                        text: 'Tạo đơn đặt lịch và giữ chỗ thành công.'
                    }
                ]
            };

            // Lưu vào danh sách đơn hàng cho CN17 /customer/bookings
            try {
                const prevBookings = JSON.parse(localStorage.getItem('cleanmate_bookings') || '[]');
                localStorage.setItem('cleanmate_bookings', JSON.stringify([newBookingRecord, ...prevBookings]));
            } catch {
                // ignore
            }

            setBookingSuccessData({
                bookingCode: generatedBookingCode,
                backendBookingId,
                ...bookingPayload
            });

            // Xóa các mặt hàng của Provider này khỏi Giỏ
            dispatch({
                type: 'REMOVE_PROVIDER_ITEMS',
                payload: checkoutItems[0]?.providerId || 1
            });

        } catch (err) {
            setErrorMessage('Có lỗi xảy ra trong quá trình đặt lịch: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Nếu không có dịch vụ nào để checkout và chưa đặt thành công
    if (checkoutItems.length === 0 && !bookingSuccessData) {
        return (
            <div className="checkout-page">
                <Header />
                <div className="checkout-empty-container">
                    <div className="empty-icon-circle">
                        <FontAwesomeIcon icon={faHourglassHalf} />
                    </div>
                    <h2>Chưa có dịch vụ nào được chọn để đặt lịch</h2>
                    <p>Hãy chọn dịch vụ vệ sinh từ trang tìm kiếm hoặc kiểm tra giỏ hàng của bạn.</p>
                    <div className="empty-actions">
                        <Link to="/cart" className="btn-back-cart">
                            <FontAwesomeIcon icon={faArrowLeft} /> Xem giỏ hàng
                        </Link>
                        <button
                            type="button"
                            className="btn-back-cart"
                            style={{ background: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe', cursor: 'pointer' }}
                            onClick={() => {
                                dispatch({
                                    type: 'ADD_ITEM',
                                    payload: {
                                        serviceId: 1,
                                        serviceName: 'Dịch vụ dọn dẹp nhà tiêu chuẩn',
                                        providerId: 1,
                                        providerName: 'Công ty TNHH Vệ sinh CleanHome Pro',
                                        packageId: 2,
                                        packageName: 'Chuyên sâu (3-4 giờ)',
                                        quantity: 1,
                                        unitPrice: 350000,
                                        estimatedPrice: 350000,
                                        durationHours: 3,
                                        scheduledDate: '2026-10-17',
                                        scheduledTime: '08:30',
                                        note: 'Lau dọn phòng khách và 2 phòng tắm'
                                    }
                                });
                            }}
                        >
                            <FontAwesomeIcon icon={faBroom} /> Nạp dịch vụ mẫu thử nghiệm
                        </button>
                        <Link to="/services" className="btn-explore">
                            Khám phá dịch vụ CleanMate
                        </Link>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    // MÀN HÌNH XÁC NHẬN ĐƠN THÀNH CÔNG (GIỮ CHỖ THÀNH CÔNG)
    if (bookingSuccessData) {
        return (
            <div className="checkout-page">
                <Header />
                <div className="checkout-success-container">
                    <div className="success-header-card">
                        <div className="success-badge-icon">
                            <FontAwesomeIcon icon={faCircleCheck} />
                        </div>
                        <h1>Đặt lịch & Giữ chỗ thành công!</h1>
                        <p className="order-code-text">
                            Mã đơn dịch vụ: <strong>#{bookingSuccessData.bookingCode}</strong>
                        </p>

                        <div className="hold-timer-alert">
                            <div className="timer-icon">
                                <FontAwesomeIcon icon={faClock} />
                            </div>
                            <div className="timer-info">
                                <strong>Suất làm việc đang được giữ chỗ độc quyền trong:</strong>
                                <span className="timer-countdown">{formatTimer(holdSecondsLeft)}</span>
                                <small>Vui lòng hoàn tất thanh toán trước khi thời gian giữ chỗ kết thúc để đối tác sắp xếp nhân sự.</small>
                            </div>
                        </div>
                    </div>

                    <div className="success-details-card">
                        <h3>Thông tin lịch hẹn đã chốt (Snapshot)</h3>

                        <div className="info-grid">
                            <div className="info-item">
                                <span className="label">Đơn vị cung cấp:</span>
                                <strong>{bookingSuccessData.providerName || 'Đơn vị vệ sinh CleanMate'}</strong>
                            </div>
                            <div className="info-item">
                                <span className="label">Khách hàng:</span>
                                <strong>{bookingSuccessData.customer?.fullName || 'Khách hàng'} - {bookingSuccessData.customer?.phone || ''}</strong>
                            </div>
                            <div className="info-item">
                                <span className="label">Địa điểm thực hiện:</span>
                                <strong>{bookingSuccessData.address?.formattedAddress || 'Địa chỉ thực hiện'}</strong>
                            </div>
                            <div className="info-item">
                                <span className="label">Tọa độ ghim:</span>
                                <code>Lat: {bookingSuccessData.address?.lat || 10.7769}, Lng: {bookingSuccessData.address?.lng || 106.7009}</code>
                            </div>
                            <div className="info-item">
                                <span className="label">Lịch thực hiện:</span>
                                <strong>{bookingSuccessData.schedule?.date || 'Hôm nay'} ({bookingSuccessData.schedule?.startTime || '08:00'} - {bookingSuccessData.schedule?.endTime || '11:00'})</strong>
                            </div>
                            <div className="info-item">
                                <span className="label">Phương thức thanh toán:</span>
                                <strong>
                                    {bookingSuccessData.paymentMethod === 'VNPAY' && 'Cổng trực tuyến VNPAY QR'}
                                    {bookingSuccessData.paymentMethod === 'CASH' && 'Thanh toán trực tiếp khi hoàn thành'}
                                    {bookingSuccessData.paymentMethod === 'BANK_TRANSFER' && 'Chuyển khoản ngân hàng VietQR'}
                                </strong>
                            </div>
                            {bookingSuccessData.paymentMethod === 'CASH' && (
                                <p className="cash-payment-note">Bạn thanh toán cho đối tác sau khi hoàn tất dịch vụ. Đối tác sẽ xác nhận đã thu tiền trên đơn hàng.</p>
                            )}
                        </div>

                        <div className="success-items-list">
                            <h4>Dịch vụ đã đặt ({(bookingSuccessData.items || []).length})</h4>
                            {(bookingSuccessData.items || []).map((it, idx) => (
                                <div key={idx} className="success-item-row">
                                    <div>
                                        <strong>{it.serviceName}</strong>
                                        <span className="sub-pkg">Gói: {it.packageName} (x{it.quantity})</span>
                                    </div>
                                    <strong className="item-price">{formatPrice(it.estimatedPrice || it.unitPrice || 0)}</strong>
                                </div>
                            ))}
                            <div className="success-total-row">
                                <span>Tổng thanh toán:</span>
                                <span className="total-highlight">{formatPrice(bookingSuccessData.pricing?.totalAmount || 0)}</span>
                            </div>
                        </div>

                        <div className="success-actions-block">
                            {bookingSuccessData.paymentMethod === 'VNPAY' && (
                                <button type="button" className="btn-pay-vnpay" onClick={handleVNPayPayment} disabled={isPaying || !bookingSuccessData.backendBookingId}>
                                    {isPaying ? (
                                        <>
                                            <FontAwesomeIcon icon={faSpinner} spin />
                                            Đang chuyển đến VNPay...
                                        </>
                                    ) : (
                                        <>
                                            <FontAwesomeIcon icon={faQrcode} />
                                            Thanh toán VNPAY ngay
                                            ({formatPrice(bookingSuccessData.pricing?.totalAmount || 0)})
                                        </>
                                    )}
                                </button>
                            )}
                            {errorMessage && (
                                <div className="checkout-alert-error">
                                    <FontAwesomeIcon icon={faCircleExclamation} />
                                    <span>{errorMessage}</span>
                                </div>
                            )}
                            <Link
                                to={`/customer/bookings?id=${bookingSuccessData.bookingCode}`}
                                className="btn-pay-vnpay"
                                style={{ background: '#2563eb', textDecoration: 'none' }}
                            >
                                <FontAwesomeIcon icon={faRoute} /> Xem tiến độ đơn hàng (CN17)
                            </Link>

                            <Link to="/services" className="btn-secondary-link">
                                Khám phá thêm dịch vụ khác
                            </Link>
                        </div>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="checkout-page">
            <Header />

            <div className="breadcrumb">
                <Link to="/">Trang chủ</Link>
                <span>›</span>
                <Link to="/cart">Giỏ dịch vụ</Link>
                <span>›</span>
                <strong>Xác nhận đặt lịch</strong>
            </div>

            <main className="checkout-container">
                <div className="checkout-header-title">
                    <div>
                        <h1>Đặt lịch & Xác nhận dịch vụ</h1>
                        <p>Xác nhận địa chỉ, lịch thực hiện và khóa giữ chỗ cho đơn vị cung cấp</p>
                    </div>
                    <Link to="/cart" className="back-to-cart-link">
                        <FontAwesomeIcon icon={faArrowLeft} /> Quay lại giỏ hàng
                    </Link>
                </div>

                {errorMessage && (
                    <div className="checkout-alert-error">
                        <FontAwesomeIcon icon={faCircleExclamation} />
                        <span>{errorMessage}</span>
                    </div>
                )}

                <form onSubmit={handleConfirmBooking} className="checkout-layout">
                    {/* CỘT TRÁI: QUY TRÌNH THÔNG TIN CHÍNH */}
                    <div className="checkout-main-column">

                        {/* MỤC 1: ĐƠN VỊ CUNG CẤP & SNAPSHOT DỊCH VỤ */}
                        <section className="checkout-section-card">
                            <div className="section-card-header">
                                <div className="step-number">1</div>
                                <div>
                                    <h2>Nhà cung cấp & Dịch vụ được chọn</h2>
                                    <p>Chỉ thanh toán theo từng đối tác để đảm bảo tiến độ và bảo hành</p>
                                </div>
                            </div>

                            <div className="provider-info-badge">
                                <FontAwesomeIcon icon={faBuilding} className="p-icon" />
                                <div>
                                    <strong>{currentProviderName}</strong>
                                    <span className="verified-tag">
                                        <FontAwesomeIcon icon={faShieldHalved} /> Đối tác xác thực CleanMate
                                    </span>
                                </div>
                            </div>

                            <div className="checkout-items-list">
                                {checkoutItems.map((item) => (
                                    <div key={item.id} className="checkout-item-card">
                                        <div className="item-icon-box">
                                            <FontAwesomeIcon icon={faBroom} />
                                        </div>
                                        <div className="item-details">
                                            <h4>{item.serviceName}</h4>
                                            <div className="item-meta">
                                                <span className="badge-package">Gói: {item.packageName}</span>
                                                <span className="badge-duration">
                                                    <FontAwesomeIcon icon={faClock} /> {item.durationHours || 3} giờ
                                                </span>
                                                <span>Số lượng: x{item.quantity}</span>
                                            </div>
                                            {item.notes && (
                                                <p className="item-user-notes">Ghi chú: {item.notes}</p>
                                            )}
                                        </div>
                                        <div className="item-pricing">
                                            <strong>{formatPrice(item.estimatedPrice)}</strong>
                                            <small>{formatPrice(item.unitPrice)}/lần</small>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* MỤC 2: ĐỊA CHỈ & TỌA ĐỘ BẢN ĐỒ THỰC HIỆN */}
                        <section className="checkout-section-card">
                            <div className="section-card-header">
                                <div className="step-number">2</div>
                                <div>
                                    <h2>Địa chỉ thực hiện dịch vụ & Tọa độ bản đồ</h2>
                                    <p>Địa chỉ chính xác giúp kỹ thuật viên đến đúng giờ và chuẩn bị công cụ</p>
                                </div>
                            </div>

                            {addressLoading && <p>Đang tải địa chỉ mặc định...</p>}
                            {defaultAddressError && <p className="checkout-error-message">{defaultAddressError} <Link to="/profile">Mở hồ sơ</Link></p>}
                            {defaultAddressId && <p>Địa chỉ đang dùng được lấy từ địa chỉ mặc định trong hồ sơ.</p>}
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label htmlFor="customerFullName">
                                        <FontAwesomeIcon icon={faUser} /> Họ tên người nhận việc *
                                    </label>
                                    <input
                                        id="customerFullName"
                                        type="text"
                                        placeholder="Ví dụ: Nguyễn Văn An"
                                        value={customerInfo.fullName}
                                        onChange={(e) => setCustomerInfo(prev => ({ ...prev, fullName: e.target.value }))}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="customerPhone">
                                        <FontAwesomeIcon icon={faPhone} /> Số điện thoại liên hệ *
                                    </label>
                                    <input
                                        id="customerPhone"
                                        type="tel"
                                        placeholder="Ví dụ: 0912345678"
                                        value={customerInfo.phone}
                                        onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label htmlFor="citySelect">Tỉnh / Thành phố *</label>
                                    <input
                                        id="citySelect"
                                        type="text"
                                        value={addressForm.city}
                                        readOnly
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="districtSelect">Quận / Huyện *</label>
                                    <input
                                        id="districtSelect"
                                        type="text"
                                        value={addressForm.district}
                                        readOnly
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="wardInput">Phường / Xã *</label>
                                    <input
                                        id="wardInput"
                                        type="text"
                                        value={addressForm.ward}
                                        readOnly
                                        placeholder="Ví dụ: Phường Bến Nghé"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="streetInput">
                                    <FontAwesomeIcon icon={faLocationDot} /> Số nhà, Tên đường, Tòa nhà/Căn hộ *
                                </label>
                                <input
                                    id="streetInput"
                                    type="text"
                                    value={addressForm.streetAddress}
                                    readOnly
                                    placeholder="Ví dụ: Tòa Landmark 81, Căn 24.08, 720A Điện Biên Phủ"
                                    required
                                />
                            </div>

                            {/* Widget định vị ghim bản đồ & Tọa độ (CN07 & CN24 GPS) */}
                            <div className="map-pin-widget">
                                <div className="map-widget-header">
                                    <div className="map-title">
                                        <FontAwesomeIcon icon={faMapPin} className="pin-icon" />
                                        <span>Điểm ghim GPS nơi làm việc:</span>
                                        <strong>Vĩ độ: {addressForm.lat} | Kinh độ: {addressForm.lng}</strong>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-detect-gps"
                                        onClick={handleGetLocation}
                                    >
                                        <FontAwesomeIcon icon={faCrosshairs} /> Lấy tọa độ GPS
                                    </button>
                                </div>

                                <div className="map-visual-placeholder">
                                    <div className="radar-sweep" />
                                    <div className="pin-marker">
                                        <FontAwesomeIcon icon={faLocationDot} />
                                        <div className="pin-pulse" />
                                    </div>
                                    <div className="map-overlay-info">
                                        <FontAwesomeIcon icon={faCircleCheck} />
                                        <span>Đã xác thực: Nằm trong vùng phục vụ 15km của đối tác {currentProviderName}</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* MỤC 3: LỊCH HẸN & NĂNG LỰC NHÂN SỰ */}
                        <section className="checkout-section-card">
                            <div className="section-card-header">
                                <div className="step-number">3</div>
                                <div>
                                    <h2>Thời gian thực hiện & Năng lực nhân sự</h2>
                                    <p>Hệ thống tự động tính giờ kết thúc và bảo đảm người làm rảnh lịch</p>
                                </div>
                            </div>

                            <div className="schedule-pills-row">
                                <button
                                    type="button"
                                    className={`pill-btn ${selectedDate === todayStr ? 'active' : ''}`}
                                    onClick={() => setSelectedDate(todayStr)}
                                >
                                    Hôm nay
                                </button>
                                <button
                                    type="button"
                                    className={`pill-btn ${selectedDate === tomorrowStr ? 'active' : ''}`}
                                    onClick={() => setSelectedDate(tomorrowStr)}
                                >
                                    Ngày mai
                                </button>
                                <div className="custom-date-picker-inline">
                                    <FontAwesomeIcon icon={faCalendarDays} className="cal-icon" />
                                    <input
                                        type="date"
                                        min={todayStr}
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        aria-label="Chọn ngày khác"
                                    />
                                </div>
                            </div>

                            <div className="time-slots-section">
                                <span className="time-section-title">Chọn khung giờ bắt đầu:</span>
                                <div className="time-slots-grid">
                                    {TIME_SLOTS.map(slot => (
                                        <button
                                            key={slot.id}
                                            type="button"
                                            className={`time-slot-btn ${selectedTimeSlot === slot.id ? 'active' : ''}`}
                                            onClick={() => setSelectedTimeSlot(slot.id)}
                                        >
                                            <FontAwesomeIcon icon={faClock} />
                                            <strong>{slot.id}</strong>
                                            <small>{slot.label.split('-')[1]?.trim()}</small>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Khối suy luận thời gian kết thúc & Năng lực */}
                            <div className="capacity-summary-box">
                                <div className="capacity-stat">
                                    <span className="stat-label">Thời gian làm việc dự kiến:</span>
                                    <strong className="stat-value">{selectedTimeSlot} - {calculatedEndTime} ({totalDurationHours} tiếng)</strong>
                                </div>
                                <div className="capacity-stat">
                                    <span className="stat-label">Năng lực nhân sự phục vụ:</span>
                                    <span className="capacity-badge available">
                                        <FontAwesomeIcon icon={faCircleCheck} /> Còn 4 nhân viên sẵn sàng ca này
                                    </span>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: '20px' }}>
                                <label htmlFor="specialNotes">
                                    Ghi chú bổ sung cho nhân viên vệ sinh (nếu có):
                                </label>
                                <textarea
                                    id="specialNotes"
                                    rows="2"
                                    placeholder="Ví dụ: Nhà có em bé đang ngủ, vui lòng không bấm chuông cửa; hoặc gửi xe tại tầng hầm B1..."
                                    value={specialNotes}
                                    onChange={(e) => setSpecialNotes(e.target.value)}
                                />
                            </div>
                        </section>

                        {/* MỤC 4: PHƯƠNG THỨC THANH TOÁN */}
                        <section className="checkout-section-card">
                            <div className="section-card-header">
                                <div className="step-number">4</div>
                                <div>
                                    <h2>Phương thức thanh toán</h2>
                                    <p>An toàn, minh bạch, hoàn tiền tự động nếu đối tác không tiếp nhận</p>
                                </div>
                            </div>

                            <div className="payment-methods-list">
                                <label className={`payment-method-item ${paymentMethod === 'VNPAY' ? 'active' : ''}`}>
                                    <input
                                        type="radio"
                                        name="paymentMethod"
                                        value="VNPAY"
                                        checked={paymentMethod === 'VNPAY'}
                                        onChange={() => setPaymentMethod('VNPAY')}
                                    />
                                    <div className="method-icon-box vnpay-icon">
                                        <FontAwesomeIcon icon={faQrcode} />
                                    </div>
                                    <div className="method-info">
                                        <strong>Cổng thanh toán điện tử VNPAY (Khuyên dùng)</strong>
                                        <p>Quét mã VNPAY-QR, thẻ ATM nội địa 40+ ngân hàng hoặc Visa/Mastercard (Tích hợp CN08)</p>
                                    </div>
                                    <span className="recommend-badge">Khuyên dùng</span>
                                </label>

                                <label className={`payment-method-item ${paymentMethod === 'CASH' ? 'active' : ''}`}>
                                    <input
                                        type="radio"
                                        name="paymentMethod"
                                        value="CASH"
                                        checked={paymentMethod === 'CASH'}
                                        onChange={() => setPaymentMethod('CASH')}
                                    />
                                    <div className="method-icon-box cash-icon">
                                        <FontAwesomeIcon icon={faMoneyBillWave} />
                                    </div>
                                    <div className="method-info">
                                        <strong>Thanh toán tiền mặt khi hoàn thành (COD)</strong>
                                        <p>Kiểm tra chất lượng vệ sinh sạch sẽ rồi thanh toán trực tiếp cho nhân viên</p>
                                    </div>
                                </label>

                                <label className={`payment-method-item ${paymentMethod === 'BANK_TRANSFER' ? 'active' : ''}`}>
                                    <input
                                        type="radio"
                                        name="paymentMethod"
                                        value="BANK_TRANSFER"
                                        checked={paymentMethod === 'BANK_TRANSFER'}
                                        disabled
                                    />
                                    <div className="method-icon-box bank-icon">
                                        <FontAwesomeIcon icon={faCreditCard} />
                                    </div>
                                    <div className="method-info">
                                        <strong>Chuyển khoản ngân hàng VietQR</strong>
                                        <p>Phương thức này hiện chưa được hỗ trợ.</p>
                                    </div>
                                </label>
                            </div>
                        </section>
                    </div>

                    {/* CỘT PHẢI: BẢNG GIÁ CHỐT SNAPSHOT & XÁC NHẬN */}
                    <div className="checkout-summary-column">
                        <div className="summary-sticky-card">
                            <h3>Báo giá & Chốt đơn</h3>

                            {/* Nhập mã giảm giá */}
                            <div className="voucher-input-block">
                                <div className="voucher-input-group">
                                    <input
                                        type="text"
                                        placeholder="Mã voucher (ví dụ: BANMOI)"
                                        value={voucherCode}
                                        onChange={(e) => setVoucherCode(e.target.value)}
                                    />
                                    <button type="button" onClick={handleApplyVoucher}>
                                        <FontAwesomeIcon icon={faTag} /> Áp dụng
                                    </button>
                                </div>
                                {voucherMessage.text && (
                                    <div className={`voucher-msg ${voucherMessage.type}`}>
                                        {voucherMessage.text}
                                    </div>
                                )}
                            </div>

                            {/* Chi tiết thanh toán */}
                            <div className="pricing-rows">
                                <div className="price-row">
                                    <span>Tạm tính dịch vụ ({checkoutItems.length})</span>
                                    <strong>{formatPrice(subtotal)}</strong>
                                </div>

                                <div className="price-row">
                                    <span>Phí di chuyển nhân sự</span>
                                    <strong className="free-tag">Miễn phí</strong>
                                </div>

                                {appliedDiscount > 0 && (
                                    <div className="price-row discount-row">
                                        <span>Giảm giá khuyến mãi</span>
                                        <strong>-{formatPrice(appliedDiscount)}</strong>
                                    </div>
                                )}

                                <div className="summary-divider" />

                                <div className="price-row final-total-row">
                                    <span>Tổng số tiền thanh toán:</span>
                                    <strong className="final-price">{formatPrice(finalTotal)}</strong>
                                </div>
                                <small className="price-note">Giá đã bao gồm dụng cụ, dung dịch tẩy rửa và bảo hiểm</small>
                            </div>

                            {/* Cam kết & Chính sách hủy (CN07 Specification) */}
                            <div className="cancellation-policy-box">
                                <h4>
                                    <FontAwesomeIcon icon={faShieldHalved} /> Chính sách hủy & Cam kết
                                </h4>
                                <ul>
                                    <li><strong>Trước 24h:</strong> Miễn phí hủy, hoàn 100% tiền giữ chỗ.</li>
                                    <li><strong>Trước 12h:</strong> Hỗ trợ phí hủy 30% cho đối tác điều phối.</li>
                                    <li><strong>Dưới 12h:</strong> Không hoàn tiền giữ chỗ.</li>
                                    <li><strong>Cam kết chất lượng:</strong> Làm sạch lại miễn phí nếu quý khách chưa hài lòng trong 24 giờ.</li>
                                </ul>
                            </div>

                            <label className="policy-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={agreePolicy}
                                    onChange={(e) => setAgreePolicy(e.target.checked)}
                                />
                                <span>Tôi đã đọc và đồng ý với Quy chế hoạt động & Chính sách hủy của CleanMate.</span>
                            </label>

                            {/* Nút xác nhận đặt lịch */}
                            <button
                                type="submit"
                                className="btn-confirm-booking"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <FontAwesomeIcon icon={faSpinner} spin /> Đang xác nhận & Giữ chỗ...
                                    </>
                                ) : (
                                    <>
                                        <FontAwesomeIcon icon={faCheck} /> Xác nhận đặt lịch ({formatPrice(finalTotal)})
                                    </>
                                )}
                            </button>

                            <div className="secure-badge">
                                <FontAwesomeIcon icon={faShieldHalved} /> Giao dịch được bảo vệ và mã hóa 256-bit
                            </div>
                        </div>
                    </div>
                </form>
            </main>

            <Footer />
        </div>
    );
}