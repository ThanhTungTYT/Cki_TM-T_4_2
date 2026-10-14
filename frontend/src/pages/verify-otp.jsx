import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope, faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "./verify-otp.css";

function VerifyOtp() {
    const navigate = useNavigate();
    const location = useLocation();

    const email = location.state?.email || "";

    const [otp, setOtp] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setMessage("");

        if (!/^\d{6}$/.test(otp)) {
            setMessage("Mã OTP phải gồm đúng 6 chữ số");
            return;
        }
        setLoading(true);
        try {
            const response = await fetch(
                "http://localhost:8080/api/auth/register/verify-otp",
                {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    credentials: "include",
                    body: JSON.stringify({
                        otp: otp
                    })
                }
            );
            const text = await response.text();
            let data = {};
            try {
                data = text ? JSON.parse(text) : {};
            } catch {
                data = {
                    message: text || "Backend trả về dữ liệu không hợp lệ"
                };
            }
            if (!response.ok) {
                throw new Error(
                    data.message || `Xác thực OTP thất bại (${response.status})`
                );
            }
            navigate("/login", {
                replace: true,
                state: {
                    message: "Đăng ký thành công! Vui lòng đăng nhập."
                }
            });
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };
    const handleResendOtp = async () => {
        setMessage("");
        setResending(true);
        try {
            const response = await fetch(
                "http://localhost:8080/api/auth/register/resend-otp",
                {
                    method: "POST",
                    credentials: "include"
                }
            );
            const text = await response.text();
            let data = {};
            try {
                data = text ? JSON.parse(text) : {};
            } catch {
                data = {
                    message: text || "Backend trả về dữ liệu không hợp lệ"
                };
            }
            if (!response.ok) {
                throw new Error(
                    data.message || `Gửi lại OTP thất bại (${response.status})`
                );
            }
            setOtp("");
            setMessage("Mã OTP mới đã được gửi đến email của bạn");
        } catch (error) {
            setMessage(error.message);
        } finally {
            setResending(false);
        }
    };
    return (
        <div className="home">
            <Header />
            <main className="verify-main">
                <div className="verify-card">

                    <div className="verify-title">
                        <div className="verify-icon">
                            <FontAwesomeIcon icon={faEnvelope} />
                        </div>

                        <h2>Xác thực Email</h2>

                        <p>
                            Chúng tôi đã gửi mã xác thực gồm 6 chữ số
                            đến địa chỉ email của bạn.
                        </p>

                        {email && (
                            <span className="verify-email">
                                {email}
                            </span>
                        )}
                    </div>

                    <form onSubmit={handleVerifyOtp}>
                        <div className="form-group">
                            <label>Mã xác thực OTP</label>

                            <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={6}
                                placeholder="Nhập mã OTP"
                                value={otp}
                                onChange={(e) => {
                                    const value = e.target.value
                                        .replace(/\D/g, "")
                                        .slice(0, 6);

                                    setOtp(value);
                                }}
                                required
                            />
                        </div>

                        <p className="verify-note">
                            Mã OTP có hiệu lực trong 5 phút.
                        </p>

                        {message && (
                            <p className="auth-message">
                                {message}
                            </p>
                        )}

                        <button
                            type="submit"
                            className="verify-submit"
                            disabled={loading || otp.length !== 6}
                        >
                            {loading ? "Đang xác thực..." : "Xác nhận OTP"}
                        </button>
                    </form>

                    <div className="verify-resend">
                        <span>Chưa nhận được mã?</span>

                        <button
                            type="button"
                            onClick={handleResendOtp}
                            disabled={resending || loading}
                        >
                            {resending ? "Đang gửi..." : "Gửi lại OTP"}
                        </button>
                    </div>

                    <div className="verify-back">
                        <Link to="/register">
                            <FontAwesomeIcon icon={faArrowLeft} />
                            <span>Quay lại đăng ký</span>
                        </Link>
                    </div>

                </div>
            </main>

            <Footer />
        </div>
    );
}

export default VerifyOtp;
