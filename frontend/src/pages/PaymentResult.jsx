import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getVNPayStatus } from '../services/paymentService';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function PaymentResult() {
    const [searchParams] = useSearchParams();

    const [status, setStatus] = useState('CHECKING');
    const [bookingId, setBookingId] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');

    const txnRef = searchParams.get('vnp_TxnRef');

    useEffect(() => {
        if (!txnRef) {
            setStatus('UNKNOWN');
            return;
        }

        let cancelled = false;
        let timerId;
        let attempts = 0;

        const checkPayment = async () => {
            try {
                const result = await getVNPayStatus(txnRef);

                if (cancelled) return;

                setStatus(result.status);
                setBookingId(result.bookingId);

                if (result.status === 'PENDING' && attempts < 10) {
                    attempts++;
                    timerId = setTimeout(checkPayment, 2000);
                }
            } catch (error) {
                if (!cancelled) {
                    setErrorMessage(error.message);
                    setStatus('UNKNOWN');
                }
            }
        };

        checkPayment();

        return () => {
            cancelled = true;
            clearTimeout(timerId);
        };
    }, [txnRef]);

    return (
        <div className="checkout-page">
            <Header />

            <div className="checkout-success-container">
                <div className="success-header-card">

                    <h1>Kết quả thanh toán VNPay</h1>

                    {status === 'CHECKING' && (
                        <p>Đang kiểm tra giao dịch...</p>
                    )}

                    {status === 'PENDING' && (
                        <p>
                            VNPay chưa xác nhận giao dịch.
                            Vui lòng kiểm tra lại sau.
                        </p>
                    )}

                    {status === 'SUCCESS' && (
                        <div>
                            <h2>Thanh toán thành công!</h2>
                            <p>Mã Booking: {bookingId}</p>
                        </div>
                    )}

                    {status === 'FAILED' && (
                        <p>Thanh toán thất bại.</p>
                    )}

                    {status === 'REVIEW' && (
                        <p>
                            Giao dịch cần được kiểm tra và đối soát.
                        </p>
                    )}

                    {status === 'UNKNOWN' && (
                        <p>
                            {errorMessage ||
                                'Chưa thể xác định kết quả giao dịch.'}
                        </p>
                    )}

                    <div className="success-actions-block">
                        <Link
                            to="/customer/bookings"
                            className="btn-pay-vnpay"
                        >
                            Xem đơn hàng của tôi
                        </Link>

                        <Link
                            to="/"
                            className="btn-secondary-link"
                        >
                            Về trang chủ
                        </Link>
                    </div>

                </div>
            </div>

            <Footer />
        </div>
    );
}