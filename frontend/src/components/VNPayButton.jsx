import { useState } from "react";
import { createVNPayPayment } from "../services/paymentService";

function VNPayButton({ bookingId }) {

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handlePayment = async () => {
        if (!bookingId || loading) return;

        setLoading(true);
        setError("");

        try {
            const data = await createVNPayPayment(bookingId);

            // Lưu mã giao dịch để đối chiếu khi VNPay trả về
            sessionStorage.setItem(
                "pendingPaymentRef",
                data.txnRef
            );

            // Chuyển người dùng sang trang VNPay
            window.location.assign(data.paymentUrl);

        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div>
            <button
                type="button"
                onClick={handlePayment}
                disabled={loading || !bookingId}
            >
                {loading
                    ? "Đang chuyển đến VNPay..."
                    : "Thanh toán bằng VNPay"}
            </button>

            {error && (
                <p style={{ color: "red" }}>
                    {error}
                </p>
            )}
        </div>
    );
}

export default VNPayButton;