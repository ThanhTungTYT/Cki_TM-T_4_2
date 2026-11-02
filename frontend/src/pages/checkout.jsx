import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faBroom, faBuilding, faCalendarDays, faCheck, faCircleCheck, faCircleExclamation, faClock, faCrosshairs, faCreditCard, faLocationDot, faMapPin, faMoneyBillWave, faPhone, faQrcode, faRoute, faShieldHalved, faSpinner, faTag, faUser } from '@fortawesome/free-solid-svg-icons';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useCart, useCartDispatch } from '../context/CartContext';
import { bookingApi } from '../services/api';
import { createVNPayPayment } from '../services/paymentService';
import './checkout.css';

function formatPrice(amount) {
    return Number(amount || 0).toLocaleString('vi-VN') + 'đ';
}

function formatDateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const TIME_SLOTS = ['08:00', '09:30', '11:00', '13:30', '15:00', '16:30', '18:00'];

export default function Checkout() {
    const [searchParams] = useSearchParams();
    const { cartItems } = useCart();
    const dispatch = useCartDispatch();
    const providerIdParam = searchParams.get('providerId');
    const providerNameParam = searchParams.get('providerName');

    const checkoutItems = useMemo(() => {
        if (!cartItems?.length) return [];
        if (providerIdParam) {
            const matched = cartItems.filter(item => String(item.providerId ?? '') === String(providerIdParam));
            if (matched.length) return matched;
        }
        const firstProviderId = String(cartItems[0]?.providerId ?? '');
        return cartItems.filter(item => String(item.providerId ?? '') === firstProviderId);
    }, [cartItems, providerIdParam]);

    const partnerId = Number(checkoutItems[0]?.providerId);

    const currentProviderName = useMemo(() => {
        if (providerNameParam) {
            try {
                return decodeURIComponent(providerNameParam);
            } catch {
                return providerNameParam;
            }
        }
        return checkoutItems[0]?.providerName || 'Đơn vị vệ sinh CleanMate';
    }, [providerNameParam, checkoutItems]);

    const quoteItems = useMemo(() => checkoutItems.map(item => ({
        serviceId: Number(item.serviceId),
        packageId: item.packageId ? Number(item.packageId) : null,
        quantity: Number(item.quantity) || 1,
        note: item.notes || ''
    })), [checkoutItems]);

    const [customerInfo, setCustomerInfo] = useState(() => {
        try {
            const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
            const user = stored ? JSON.parse(stored) : {};
            return {
                fullName: user.fullName || '',
                phone: user.phone || '',
                email: user.email || ''
            };
        } catch {
            return { fullName: '', phone: '', email: '' };
        }
    });

    const [addressForm, setAddressForm] = useState({
        city: '',
        district: '',
        ward: '',
        streetAddress: '',
        lat: null,
        lng: null
    });

    const [defaultAddressId, setDefaultAddressId] = useState(null);
    const [addressLoading, setAddressLoading] = useState(true);
    const [defaultAddressError, setDefaultAddressError] = useState('');
    const [specialNotes, setSpecialNotes] = useState('');

    const todayStr = useMemo(() => formatDateString(new Date()), []);
    const tomorrowStr = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        return formatDateString(date);
    }, []);

    const [selectedDate, setSelectedDate] = useState(() =>
        checkoutItems[0]?.scheduledDate || checkoutItems[0]?.date || tomorrowStr
    );

    const [selectedTimeSlot, setSelectedTimeSlot] = useState(() =>
        checkoutItems[0]?.scheduledTime || checkoutItems[0]?.time || '08:00'
    );

    const [paymentMethod, setPaymentMethod] = useState('VNPAY');
    const [voucherCode, setVoucherCode] = useState('');
    const [appliedVoucherCode, setAppliedVoucherCode] = useState('');
    const [redeemPoints, setRedeemPoints] = useState(0);
    const [quote, setQuote] = useState(null);
    const [quoteLoading, setQuoteLoading] = useState(false);
    const [quoteError, setQuoteError] = useState('');
    const [voucherMessage, setVoucherMessage] = useState({ type: '', text: '' });
    const [agreePolicy, setAgreePolicy] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isPaying, setIsPaying] = useState(false);
    const [bookingSuccessData, setBookingSuccessData] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [holdSecondsLeft, setHoldSecondsLeft] = useState(15 * 60);
    const [idempotencyKey] = useState(() =>
        `IDEM-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    );

    useEffect(() => {
        if (!checkoutItems.length) return;

        const firstItem = checkoutItems[0];
        const date = firstItem.scheduledDate || firstItem.date;
        const time = firstItem.scheduledTime || firstItem.time;

        if (date) setSelectedDate(date);
        if (time && TIME_SLOTS.includes(time)) setSelectedTimeSlot(time);
    }, [checkoutItems]);

    useEffect(() => {
        const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');

        if (!token) {
            setAddressLoading(false);
            setDefaultAddressError('Vui lòng đăng nhập để tải địa chỉ mặc định.');
            return;
        }

        fetch('http://localhost:8080/api/users/me/addresses', {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(async response => {
                const data = await response.json().catch(() => []);

                if (!response.ok) {
                    throw new Error(data.message || data.detail || 'Không thể tải địa chỉ đã lưu.');
                }

                const address = data.find(item => item.isDefault);

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

                setCustomerInfo(current => ({
                    ...current,
                    fullName: current.fullName || address.receiverName || '',
                    phone: current.phone || address.phone || ''
                }));
            })
            .catch(error => setDefaultAddressError(error.message))
            .finally(() => setAddressLoading(false));
    }, []);

    useEffect(() => {
        let cancelled = false;
        const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');

        if (!token) {
            setQuoteLoading(false);
            setQuote(null);
            setQuoteError('Vui lòng đăng nhập để xem báo giá chính xác.');
            return;
        }

        if (
            !Number.isInteger(partnerId)
            || partnerId <= 0
            || !quoteItems.length
            || quoteItems.some(item => !Number.isInteger(item.serviceId) || item.serviceId <= 0)
        ) {
            setQuoteLoading(false);
            setQuote(null);
            setQuoteError('Thông tin nhà cung cấp hoặc dịch vụ trong giỏ hàng không hợp lệ.');
            return;
        }

        const timer = setTimeout(async () => {
            setQuoteLoading(true);
            setQuoteError('');

            try {
                const result = await bookingApi.getQuote({
                    partnerId,
                    addressId: defaultAddressId ? Number(defaultAddressId) : null,
                    items: quoteItems,
                    scheduledStart: `${selectedDate}T${selectedTimeSlot}:00`,
                    voucherCode: appliedVoucherCode || null,
                    redeemPoints: Number(redeemPoints) || 0
                });

                if (cancelled) return;

                setQuote(result);
                setRedeemPoints(current =>
                    Math.min(current, Number(result.rewardBalance || 0))
                );

                if (appliedVoucherCode) {
                    setVoucherMessage({
                        type: 'success',
                        text: `Áp dụng mã ${result.promotionCode || appliedVoucherCode} thành công. Giảm ${formatPrice(result.discountAmount || 0)}.`
                    });
                } else {
                    setVoucherMessage({ type: '', text: '' });
                }
            } catch (error) {
                if (cancelled) return;

                setQuote(null);
                setQuoteError(error.message || 'Không thể tính báo giá.');

                if (appliedVoucherCode) {
                    setVoucherMessage({
                        type: 'error',
                        text: error.message || 'Mã khuyến mãi không hợp lệ.'
                    });
                }
            } finally {
                if (!cancelled) setQuoteLoading(false);
            }
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [
        partnerId,
        quoteItems,
        selectedDate,
        selectedTimeSlot,
        appliedVoucherCode,
        redeemPoints,
        defaultAddressId
    ]);

    useEffect(() => {
        if (!bookingSuccessData || paymentMethod !== 'VNPAY') return undefined;

        const timer = setInterval(() => {
            setHoldSecondsLeft(previous => Math.max(0, previous - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, [bookingSuccessData, paymentMethod]);

    const totalDurationHours = useMemo(() =>
            checkoutItems.reduce(
                (total, item) =>
                    total + (Number(item.durationHours) || 1) * (Number(item.quantity) || 1),
                0
            ),
        [checkoutItems]
    );

    const calculatedEndTime = useMemo(() => {
        const [hour, minute] = selectedTimeSlot.split(':').map(Number);
        const totalMinutes = hour * 60 + minute + Math.round(totalDurationHours * 60);

        return `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
    }, [selectedTimeSlot, totalDurationHours]);

    const subtotal = Number(quote?.subtotal || 0);
    const appliedDiscount = Number(quote?.discountAmount || 0);
    const pointsDiscount = Number(quote?.pointsDiscount || 0);
    const platformFee = Number(quote?.platformFee || 0);
    const finalTotal = Number(quote?.totalAmount || 0);
    const rewardBalance = Number(quote?.rewardBalance || 0);
    const pointsUsed = Number(quote?.pointsUsed || 0);

    const handleApplyVoucher = () => {
        const code = voucherCode.trim().toUpperCase();

        if (!code) {
            setAppliedVoucherCode('');
            setVoucherMessage({
                type: 'error',
                text: 'Vui lòng nhập mã giảm giá.'
            });
            return;
        }

        setAppliedVoucherCode(code);
        setVoucherMessage({
            type: '',
            text: 'Đang kiểm tra mã khuyến mãi...'
        });
    };

    const handleGetLocation = () => {
        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            position => setAddressForm(current => ({
                ...current,
                lat: Number(position.coords.latitude.toFixed(6)),
                lng: Number(position.coords.longitude.toFixed(6))
            })),
            () => setErrorMessage('Không thể lấy tọa độ GPS. Bạn vẫn có thể tiếp tục bằng địa chỉ mặc định.')
        );
    };

    const handleVNPayPayment = async () => {
        const bookingId = bookingSuccessData?.backendBookingId;

        if (!bookingId) {
            setErrorMessage('Không tìm thấy đơn hàng trong hệ thống.');
            return;
        }

        setIsPaying(true);
        setErrorMessage('');

        try {
            const data = await createVNPayPayment(bookingId);

            if (!data.txnRef || !data.paymentUrl) {
                throw new Error('Backend trả về thông tin thanh toán không hợp lệ.');
            }

            sessionStorage.setItem('pendingPaymentRef', data.txnRef);
            window.location.assign(data.paymentUrl);
        } catch (error) {
            setErrorMessage(error.message);
            setIsPaying(false);
        }
    };

    const handleConfirmBooking = async event => {
        event.preventDefault();
        setErrorMessage('');

        if (!checkoutItems.length) {
            setErrorMessage('Giỏ dịch vụ đang trống.');
            return;
        }

        if (!customerInfo.fullName.trim() || !customerInfo.phone.trim()) {
            setErrorMessage('Vui lòng điền họ tên và số điện thoại liên hệ.');
            return;
        }

        if (!addressForm.streetAddress.trim() || !defaultAddressId) {
            setErrorMessage('Cần có địa chỉ mặc định hợp lệ trong hồ sơ để tiếp tục đặt lịch.');
            return;
        }

        if (!agreePolicy) {
            setErrorMessage('Bạn cần đồng ý với Điều khoản dịch vụ và Chính sách hủy đơn.');
            return;
        }

        if (!quote || quoteLoading) {
            setErrorMessage('Vui lòng chờ hệ thống tính báo giá trước khi xác nhận.');
            return;
        }

        if (!quote.capacityAvailable) {
            setErrorMessage(quote.capacityMessage || 'Khung giờ này không còn khả dụng.');
            return;
        }

        if (
            !Number.isInteger(partnerId)
            || partnerId <= 0
            || quoteItems.some(item => !Number.isInteger(item.serviceId) || item.serviceId <= 0)
        ) {
            setErrorMessage('Thông tin dịch vụ hoặc nhà cung cấp không hợp lệ. Vui lòng kiểm tra lại giỏ hàng.');
            return;
        }

        const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');

        if (!token) {
            setErrorMessage('Vui lòng đăng nhập để đặt dịch vụ.');
            return;
        }

        setIsSubmitting(true);

        try {
            const apiRequest = {
                partnerId,
                addressId: Number(defaultAddressId),
                paymentMethod,
                items: quoteItems,
                scheduledStart: `${selectedDate}T${selectedTimeSlot}:00`,
                customerNote: specialNotes || '',
                voucherCode: appliedVoucherCode || null,
                redeemPoints: Number(redeemPoints) || 0,
                idempotencyKey
            };

            const apiResponse = await bookingApi.createBooking(
                apiRequest,
                idempotencyKey
            );

            if (!apiResponse?.id || !apiResponse?.bookingCode) {
                throw new Error('Backend không trả về thông tin đơn hàng hợp lệ.');
            }

            const bookingPayload = {
                idempotencyKey,
                providerId: partnerId,
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
                    pointsDiscount,
                    platformFee,
                    pointsUsed,
                    totalAmount: finalTotal
                },
                paymentMethod
            };

            const newBookingRecord = {
                id: apiResponse.bookingCode,
                dbId: apiResponse.id,
                ...bookingPayload,
                status: apiResponse.status || (
                    paymentMethod === 'CASH'
                        ? 'PENDING_PROVIDER'
                        : 'PENDING_PAYMENT'
                ),
                createdAt: new Date().toLocaleString('vi-VN'),
                history: [{
                    time: new Date().toLocaleString('vi-VN'),
                    actor: 'Khách hàng',
                    text: 'Tạo đơn đặt lịch thành công.'
                }]
            };

            try {
                const previous = JSON.parse(
                    localStorage.getItem('cleanmate_bookings') || '[]'
                );

                localStorage.setItem(
                    'cleanmate_bookings',
                    JSON.stringify([newBookingRecord, ...previous])
                );
            } catch {}

            setBookingSuccessData({
                bookingCode: apiResponse.bookingCode,
                backendBookingId: apiResponse.id,
                ...bookingPayload
            });

            dispatch({
                type: 'REMOVE_PROVIDER_ITEMS',
                payload: partnerId
            });
        } catch (error) {
            setErrorMessage(`Không thể tạo đơn hàng: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatTimer = seconds =>
        `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

    if (!checkoutItems.length && !bookingSuccessData) {
        return (
            <div className="checkout-page">
                <Header />
                <div className="checkout-empty-container">
                    <div className="empty-icon-circle">
                        <FontAwesomeIcon icon={faBroom} />
                    </div>
                    <h2>Chưa có dịch vụ nào được chọn để đặt lịch</h2>
                    <p>Hãy chọn dịch vụ vệ sinh từ trang tìm kiếm hoặc kiểm tra giỏ hàng của bạn.</p>
                    <div className="empty-actions">
                        <Link to="/cart" className="btn-back-cart">
                            <FontAwesomeIcon icon={faArrowLeft} /> Xem giỏ hàng
                        </Link>
                        <Link to="/services" className="btn-explore">
                            Khám phá dịch vụ CleanMate
                        </Link>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    if (bookingSuccessData) {
        return (
            <div className="checkout-page">
                <Header />
                <div className="checkout-success-container">
                    <div className="success-header-card">
                        <div className="success-badge-icon">
                            <FontAwesomeIcon icon={faCircleCheck} />
                        </div>
                        <h1>Đặt lịch thành công!</h1>
                        <p className="order-code-text">
                            Mã đơn dịch vụ: <strong>#{bookingSuccessData.bookingCode}</strong>
                        </p>
                        {paymentMethod === 'VNPAY' && (
                            <div className="hold-timer-alert">
                                <div className="timer-icon">
                                    <FontAwesomeIcon icon={faClock} />
                                </div>
                                <div className="timer-info">
                                    <strong>Thời gian giữ chỗ thanh toán còn:</strong>
                                    <span className="timer-countdown">{formatTimer(holdSecondsLeft)}</span>
                                    <small>Vui lòng hoàn tất thanh toán trước khi thời gian giữ chỗ kết thúc.</small>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="success-details-card">
                        <h3>Thông tin lịch hẹn</h3>
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="label">Đơn vị cung cấp:</span>
                                <strong>{bookingSuccessData.providerName}</strong>
                            </div>
                            <div className="info-item">
                                <span className="label">Khách hàng:</span>
                                <strong>{bookingSuccessData.customer.fullName} - {bookingSuccessData.customer.phone}</strong>
                            </div>
                            <div className="info-item">
                                <span className="label">Địa điểm:</span>
                                <strong>{bookingSuccessData.address.formattedAddress}</strong>
                            </div>
                            <div className="info-item">
                                <span className="label">Tọa độ:</span>
                                <code>Lat: {bookingSuccessData.address.lat ?? 'Chưa có'}, Lng: {bookingSuccessData.address.lng ?? 'Chưa có'}</code>
                            </div>
                            <div className="info-item">
                                <span className="label">Lịch thực hiện:</span>
                                <strong>{bookingSuccessData.schedule.date} ({bookingSuccessData.schedule.startTime} - {bookingSuccessData.schedule.endTime})</strong>
                            </div>
                            <div className="info-item">
                                <span className="label">Thanh toán:</span>
                                <strong>{paymentMethod === 'VNPAY' ? 'VNPAY' : 'Tiền mặt khi hoàn thành'}</strong>
                            </div>
                        </div>

                        <div className="success-items-list">
                            <h4>Dịch vụ đã đặt ({bookingSuccessData.items.length})</h4>
                            {bookingSuccessData.items.map((item, index) => (
                                <div key={`${item.serviceId}-${index}`} className="success-item-row">
                                    <div>
                                        <strong>{item.serviceName}</strong>
                                        <span className="sub-pkg">Gói: {item.packageName || 'Tiêu chuẩn'} (x{item.quantity})</span>
                                    </div>
                                    <strong className="item-price">
                                        {formatPrice(item.estimatedPrice || item.unitPrice || 0)}
                                    </strong>
                                </div>
                            ))}
                            <div className="success-total-row">
                                <span>Tổng thanh toán:</span>
                                <span className="total-highlight">
                                    {formatPrice(bookingSuccessData.pricing.totalAmount)}
                                </span>
                            </div>
                        </div>

                        <div className="success-actions-block">
                            {paymentMethod === 'VNPAY' && (
                                <button
                                    type="button"
                                    className="btn-pay-vnpay"
                                    onClick={handleVNPayPayment}
                                    disabled={isPaying || !bookingSuccessData.backendBookingId}
                                >
                                    {isPaying ? (
                                        <>
                                            <FontAwesomeIcon icon={faSpinner} spin /> Đang chuyển đến VNPay...
                                        </>
                                    ) : (
                                        <>
                                            <FontAwesomeIcon icon={faQrcode} />
                                            Thanh toán VNPAY ngay ({formatPrice(bookingSuccessData.pricing.totalAmount)})
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
                                <FontAwesomeIcon icon={faRoute} /> Xem tiến độ đơn hàng
                            </Link>
                            <Link to="/services" className="btn-secondary-link">
                                Tiếp tục khám phá dịch vụ
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
                        <p>Xác nhận địa chỉ, lịch thực hiện và báo giá trước khi đặt dịch vụ.</p>
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
                    <div className="checkout-main-column">
                        <section className="checkout-section-card">
                            <div className="section-card-header">
                                <div className="step-number">1</div>
                                <div>
                                    <h2>Nhà cung cấp & Dịch vụ được chọn</h2>
                                    <p>Đơn hàng được tạo theo từng nhà cung cấp.</p>
                                </div>
                            </div>

                            <div className="provider-info-badge">
                                <FontAwesomeIcon icon={faBuilding} className="p-icon" />
                                <div>
                                    <strong>{currentProviderName}</strong>
                                    <span className="verified-tag">
                                        <FontAwesomeIcon icon={faShieldHalved} /> Đối tác CleanMate
                                    </span>
                                </div>
                            </div>

                            <div className="checkout-items-list">
                                {checkoutItems.map((item, index) => (
                                    <div key={item.id || `${item.serviceId}-${index}`} className="checkout-item-card">
                                        <div className="item-icon-box">
                                            <FontAwesomeIcon icon={faBroom} />
                                        </div>
                                        <div className="item-details">
                                            <h4>{item.serviceName}</h4>
                                            <div className="item-meta">
                                                <span className="badge-package">Gói: {item.packageName || 'Tiêu chuẩn'}</span>
                                                <span className="badge-duration">
                                                    <FontAwesomeIcon icon={faClock} /> {item.durationHours || 1} giờ
                                                </span>
                                                <span>Số lượng: x{item.quantity || 1}</span>
                                            </div>
                                            {item.notes && <p className="item-user-notes">Ghi chú: {item.notes}</p>}
                                        </div>
                                        <div className="item-pricing">
                                            <strong>{formatPrice(item.estimatedPrice || item.unitPrice || 0)}</strong>
                                            <small>Giá tham khảo từ giỏ hàng</small>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="checkout-section-card">
                            <div className="section-card-header">
                                <div className="step-number">2</div>
                                <div>
                                    <h2>Địa chỉ thực hiện dịch vụ</h2>
                                    <p>Sử dụng địa chỉ mặc định đã lưu trong hồ sơ.</p>
                                </div>
                            </div>

                            {addressLoading && <p>Đang tải địa chỉ mặc định...</p>}
                            {defaultAddressError && (
                                <p className="checkout-error-message">
                                    {defaultAddressError} <Link to="/profile">Mở hồ sơ</Link>
                                </p>
                            )}
                            {defaultAddressId && <p>Địa chỉ đang dùng được lấy từ địa chỉ mặc định trong hồ sơ.</p>}

                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label htmlFor="customerFullName">
                                        <FontAwesomeIcon icon={faUser} /> Họ tên người nhận việc *
                                    </label>
                                    <input
                                        id="customerFullName"
                                        value={customerInfo.fullName}
                                        onChange={event => setCustomerInfo(current => ({
                                            ...current,
                                            fullName: event.target.value
                                        }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="customerPhone">
                                        <FontAwesomeIcon icon={faPhone} /> Số điện thoại *
                                    </label>
                                    <input
                                        id="customerPhone"
                                        type="tel"
                                        value={customerInfo.phone}
                                        onChange={event => setCustomerInfo(current => ({
                                            ...current,
                                            phone: event.target.value
                                        }))}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-grid-3">
                                <div className="form-group">
                                    <label htmlFor="citySelect">Tỉnh / Thành phố</label>
                                    <input id="citySelect" value={addressForm.city} readOnly />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="districtSelect">Quận / Huyện</label>
                                    <input id="districtSelect" value={addressForm.district} readOnly />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="wardInput">Phường / Xã</label>
                                    <input id="wardInput" value={addressForm.ward} readOnly />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="streetInput">
                                    <FontAwesomeIcon icon={faLocationDot} /> Số nhà, tên đường *
                                </label>
                                <input id="streetInput" value={addressForm.streetAddress} readOnly required />
                            </div>

                            <div className="map-pin-widget">
                                <div className="map-widget-header">
                                    <div className="map-title">
                                        <FontAwesomeIcon icon={faMapPin} className="pin-icon" />
                                        <span>Tọa độ GPS:</span>
                                        <strong>{addressForm.lat ?? 'Chưa có'} | {addressForm.lng ?? 'Chưa có'}</strong>
                                    </div>
                                    <button type="button" className="btn-detect-gps" onClick={handleGetLocation}>
                                        <FontAwesomeIcon icon={faCrosshairs} /> Lấy tọa độ GPS
                                    </button>
                                </div>
                                <div className="map-visual-placeholder">
                                    <div className="pin-marker">
                                        <FontAwesomeIcon icon={faLocationDot} />
                                    </div>
                                    <div className="map-overlay-info">
                                        <FontAwesomeIcon icon={faCircleCheck} />
                                        <span>Địa chỉ lấy từ hồ sơ khách hàng.</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="checkout-section-card">
                            <div className="section-card-header">
                                <div className="step-number">3</div>
                                <div>
                                    <h2>Thời gian thực hiện</h2>
                                    <p>Hệ thống kiểm tra năng lực tiếp nhận theo khung giờ.</p>
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
                                        onChange={event => setSelectedDate(event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="time-slots-section">
                                <span className="time-section-title">Chọn giờ bắt đầu:</span>
                                <div className="time-slots-grid">
                                    {TIME_SLOTS.map(time => (
                                        <button
                                            key={time}
                                            type="button"
                                            className={`time-slot-btn ${selectedTimeSlot === time ? 'active' : ''}`}
                                            onClick={() => setSelectedTimeSlot(time)}
                                        >
                                            <FontAwesomeIcon icon={faClock} />
                                            <strong>{time}</strong>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="capacity-summary-box">
                                <div className="capacity-stat">
                                    <span className="stat-label">Thời gian dự kiến:</span>
                                    <strong className="stat-value">
                                        {selectedTimeSlot} - {calculatedEndTime} ({totalDurationHours} tiếng)
                                    </strong>
                                </div>
                                <div className="capacity-stat">
                                    <span className="stat-label">Kiểm tra lịch:</span>
                                    <span
                                        className="capacity-badge available"
                                        style={quote && !quote.capacityAvailable ? {
                                            color: '#dc2626',
                                            background: '#fff5f5',
                                            border: '1px solid #fecaca'
                                        } : undefined}
                                    >
                                        <FontAwesomeIcon icon={quote?.capacityAvailable ? faCircleCheck : faCircleExclamation} />
                                        {quoteLoading
                                            ? 'Đang kiểm tra...'
                                            : quote?.capacityMessage || quoteError || 'Đang chờ kết quả kiểm tra.'}
                                    </span>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: '20px' }}>
                                <label htmlFor="specialNotes">Ghi chú bổ sung (nếu có):</label>
                                <textarea
                                    id="specialNotes"
                                    rows="2"
                                    value={specialNotes}
                                    onChange={event => setSpecialNotes(event.target.value)}
                                    placeholder="Ghi chú cho nhân viên vệ sinh..."
                                />
                            </div>
                        </section>

                        <section className="checkout-section-card">
                            <div className="section-card-header">
                                <div className="step-number">4</div>
                                <div>
                                    <h2>Phương thức thanh toán</h2>
                                    <p>Chọn phương thức thanh toán cho đơn dịch vụ.</p>
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
                                        <strong>Thanh toán VNPAY</strong>
                                        <p>Thanh toán trực tuyến qua cổng VNPAY.</p>
                                    </div>
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
                                        <strong>Tiền mặt khi hoàn thành</strong>
                                        <p>Thanh toán trực tiếp sau khi dịch vụ hoàn tất.</p>
                                    </div>
                                </label>

                                <label className="payment-method-item">
                                    <input type="radio" name="bankTransfer" disabled />
                                    <div className="method-icon-box bank-icon">
                                        <FontAwesomeIcon icon={faCreditCard} />
                                    </div>
                                    <div className="method-info">
                                        <strong>Chuyển khoản ngân hàng</strong>
                                        <p>Phương thức hiện chưa được hỗ trợ.</p>
                                    </div>
                                </label>
                            </div>
                        </section>
                    </div>

                    <div className="checkout-summary-column">
                        <div className="summary-sticky-card">
                            <h3>Báo giá & Chốt đơn</h3>

                            <div className="voucher-input-block">
                                <div className="voucher-input-group">
                                    <input
                                        type="text"
                                        placeholder="Nhập mã khuyến mãi"
                                        value={voucherCode}
                                        onChange={event => setVoucherCode(event.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleApplyVoucher}
                                        disabled={quoteLoading}
                                    >
                                        <FontAwesomeIcon icon={faTag} /> Áp dụng
                                    </button>
                                </div>
                                {appliedVoucherCode && (
                                    <button
                                        type="button"
                                        style={{
                                            marginTop: '6px',
                                            border: 0,
                                            background: 'transparent',
                                            color: '#dc2626',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                        onClick={() => {
                                            setVoucherCode('');
                                            setAppliedVoucherCode('');
                                        }}
                                    >
                                        Bỏ mã {appliedVoucherCode}
                                    </button>
                                )}
                                {voucherMessage.text && (
                                    <div className={`voucher-msg ${voucherMessage.type}`}>
                                        {voucherMessage.text}
                                    </div>
                                )}
                            </div>

                            <div className="form-group" style={{ marginBottom: '18px' }}>
                                <label htmlFor="redeemPoints">Đổi điểm thưởng</label>
                                <div style={{
                                    fontSize: '12px',
                                    color: '#64748b',
                                    margin: '5px 0'
                                }}>
                                    Số dư hiện tại: <strong>{rewardBalance.toLocaleString('vi-VN')} điểm</strong>
                                </div>
                                <input
                                    id="redeemPoints"
                                    type="number"
                                    min="0"
                                    max={rewardBalance}
                                    step="1"
                                    value={redeemPoints}
                                    onChange={event => setRedeemPoints(
                                        Math.max(0, Math.min(
                                            rewardBalance,
                                            Number(event.target.value) || 0
                                        ))
                                    )}
                                />
                                <small>Điểm đổi và số tiền giảm được kiểm tra theo chính sách hệ thống.</small>
                            </div>

                            <div className="pricing-rows">
                                <div className="price-row">
                                    <span>Tạm tính dịch vụ ({checkoutItems.length})</span>
                                    <strong>{quote ? formatPrice(subtotal) : '--'}</strong>
                                </div>
                                <div className="price-row">
                                    <span>Phí nền tảng</span>
                                    <strong>{quote ? formatPrice(platformFee) : '--'}</strong>
                                </div>
                                {appliedDiscount > 0 && (
                                    <div className="price-row discount-row">
                                        <span>Giảm giá khuyến mãi</span>
                                        <strong>-{formatPrice(appliedDiscount)}</strong>
                                    </div>
                                )}
                                {pointsDiscount > 0 && (
                                    <div className="price-row discount-row">
                                        <span>Giảm từ {pointsUsed.toLocaleString('vi-VN')} điểm</span>
                                        <strong>-{formatPrice(pointsDiscount)}</strong>
                                    </div>
                                )}
                                <div className="summary-divider" />
                                <div className="price-row final-total-row">
                                    <span>Tổng thanh toán:</span>
                                    <strong className="final-price">
                                        {quote ? formatPrice(finalTotal) : '--'}
                                    </strong>
                                </div>
                                {quoteLoading && <small className="price-note">Đang cập nhật báo giá từ hệ thống...</small>}
                                {quoteError && <small className="checkout-error-message">{quoteError}</small>}
                                {quote && <small className="price-note">Báo giá được tính từ backend và kiểm tra lại khi tạo đơn.</small>}
                            </div>

                            <div className="cancellation-policy-box">
                                <h4>
                                    <FontAwesomeIcon icon={faShieldHalved} /> Chính sách hủy & Cam kết
                                </h4>
                                <ul>
                                    <li><strong>Trước 24h:</strong> Miễn phí hủy theo chính sách áp dụng.</li>
                                    <li><strong>Cam kết chất lượng:</strong> Gửi yêu cầu hỗ trợ nếu dịch vụ chưa đạt yêu cầu.</li>
                                </ul>
                            </div>

                            <label className="policy-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={agreePolicy}
                                    onChange={event => setAgreePolicy(event.target.checked)}
                                />
                                <span>Tôi đã đọc và đồng ý với Quy chế hoạt động & Chính sách hủy của CleanMate.</span>
                            </label>

                            <button
                                type="submit"
                                className="btn-confirm-booking"
                                disabled={isSubmitting || quoteLoading || !quote || !quote.capacityAvailable}
                            >
                                {isSubmitting ? (
                                    <>
                                        <FontAwesomeIcon icon={faSpinner} spin /> Đang xác nhận...
                                    </>
                                ) : (
                                    <>
                                        <FontAwesomeIcon icon={faCheck} />
                                        Xác nhận đặt lịch ({quote ? formatPrice(finalTotal) : '--'})
                                    </>
                                )}
                            </button>

                            <div className="secure-badge">
                                <FontAwesomeIcon icon={faShieldHalved} /> Giao dịch được bảo vệ.
                            </div>
                        </div>
                    </div>
                </form>
            </main>
            <Footer />
        </div>
    );
}