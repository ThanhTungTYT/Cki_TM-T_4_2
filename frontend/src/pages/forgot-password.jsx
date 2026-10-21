
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faEnvelope,
    faArrowLeft,
    faLock,
    faKey
} from "@fortawesome/free-solid-svg-icons";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "./verify-otp.css";
import "./forgot-password.css";

function ForgotPassword() {
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [email, setEmail] = useState("");
    const [temporaryPassword, setTemporaryPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const callApi = async (endpoint, body) => {
        const response = await fetch(
            `http://localhost:8080/api/auth/${endpoint}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify(body)
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
                data.message || `Yêu cầu thất bại (${response.status})`
            );
        }

        return data;
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setMessage("");
        setLoading(true);

        try {
            await callApi("forgot-password", { email });
            setStep(2);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyPassword = async (e) => {
        e.preventDefault();
        setMessage("");

        if (temporaryPassword.length !== 8) {
            setMessage("Mật khẩu tạm thời phải gồm đúng 8 ký tự");
            return;
        }

        setLoading(true);

        try {
            await callApi("verify-reset-password", {
                temporaryPassword
            });

            setStep(3);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setMessage("");

        if (newPassword.length < 8) {
            setMessage("Mật khẩu mới phải có ít nhất 8 ký tự");
            return;
        }
        if (newPassword !== confirmPassword) {
            setMessage("Mật khẩu xác nhận không khớp");
            return;
        }
        setLoading(true);
        try {
            await callApi("reset-password", {
                newPassword
            });
            const response = await fetch(
                "http://localhost:8080/api/auth/login",
                {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        email: email,
                        password: newPassword
                    })
                }
            );
            const data = await response.json();
            if (!response.ok) {
                throw new Error(
                    data.message || "Đăng nhập tự động thất bại"
                );
            }
            sessionStorage.setItem("accessToken", data.accessToken);
            sessionStorage.setItem(
                "user",
                JSON.stringify({
                    userId: data.userId,
                    fullName: data.fullName,
                    email: data.email,
                    role: data.role
                })
            );
            navigate("/", {
                replace: true
            });
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="home">
            <Header />

            <main className="verify-main">
                <div className="verify-card forgot-card">

                    <div className="verify-title">
                        <div className="verify-icon">
                            <FontAwesomeIcon
                                icon={
                                    step === 1
                                        ? faEnvelope
                                        : step === 2
                                            ? faKey
                                            : faLock
                                }
                            />
                        </div>

                        <h2>
                            {step === 1 && "Quên mật khẩu"}
                            {step === 2 && "Xác thực mật khẩu"}
                            {step === 3 && "Đặt mật khẩu mới"}
                        </h2>

                        <p>
                            {step === 1 &&
                                "Nhập địa chỉ email đã đăng ký để nhận mật khẩu tạm thời."}

                            {step === 2 &&
                                "Chúng tôi đã gửi mật khẩu tạm thời gồm 8 ký tự đến email của bạn."}

                            {step === 3 &&
                                "Xác thực thành công! Vui lòng thiết lập mật khẩu mới cho tài khoản."}
                        </p>

                        {step === 2 && email && (
                            <span className="verify-email">
                                {email}
                            </span>
                        )}
                    </div>

                    {step === 1 && (
                        <form onSubmit={handleForgotPassword}>
                            <div className="form-group">
                                <label>Địa chỉ Email</label>

                                <input
                                    type="email"
                                    placeholder="Nhập email của bạn"
                                    value={email}
                                    onChange={(e) =>
                                        setEmail(e.target.value)
                                    }
                                    required
                                />
                            </div>

                            <p className="verify-note">
                                Mật khẩu tạm thời sẽ được gửi đến email
                                đã đăng ký tài khoản CleanMate.
                            </p>

                            {message && (
                                <p className="auth-message">
                                    {message}
                                </p>
                            )}

                            <button
                                type="submit"
                                className="verify-submit"
                                disabled={loading || !email.trim()}
                            >
                                {loading
                                    ? "Đang gửi..."
                                    : "Gửi mật khẩu tạm thời"}
                            </button>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleVerifyPassword}>
                            <div className="form-group">
                                <label>Mật khẩu tạm thời</label>

                                <input
                                    type="text"
                                    placeholder="Nhập mật khẩu 8 ký tự"
                                    value={temporaryPassword}
                                    onChange={(e) =>
                                        setTemporaryPassword(
                                            e.target.value.slice(0, 8)
                                        )
                                    }
                                    maxLength={8}
                                    autoComplete="one-time-code"
                                    required
                                />
                            </div>

                            <p className="verify-note">
                                Mật khẩu tạm thời có hiệu lực trong 10 phút.
                            </p>

                            {message && (
                                <p className="auth-message">
                                    {message}
                                </p>
                            )}

                            <button
                                type="submit"
                                className="verify-submit"
                                disabled={
                                    loading ||
                                    temporaryPassword.length !== 8
                                }
                            >
                                {loading
                                    ? "Đang xác thực..."
                                    : "Xác nhận mật khẩu"}
                            </button>
                        </form>
                    )}

                    {step === 3 && (
                        <form onSubmit={handleResetPassword}>
                            <div className="form-group">
                                <label>Mật khẩu mới</label>

                                <input
                                    type="password"
                                    placeholder="Nhập mật khẩu mới"
                                    value={newPassword}
                                    onChange={(e) =>
                                        setNewPassword(e.target.value)
                                    }
                                    autoComplete="new-password"
                                    minLength={8}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Xác nhận mật khẩu mới</label>

                                <input
                                    type="password"
                                    placeholder="Nhập lại mật khẩu mới"
                                    value={confirmPassword}
                                    onChange={(e) =>
                                        setConfirmPassword(e.target.value)
                                    }
                                    autoComplete="new-password"
                                    required
                                />
                            </div>

                            <p className="verify-note">
                                Mật khẩu mới phải có ít nhất 8 ký tự.
                            </p>

                            {message && (
                                <p className="auth-message">
                                    {message}
                                </p>
                            )}

                            <button
                                type="submit"
                                className="verify-submit"
                                disabled={loading}
                            >
                                {loading
                                    ? "Đang cập nhật..."
                                    : "Đổi mật khẩu"}
                            </button>
                        </form>
                    )}

                    <div className="verify-back">
                        {step === 1 ? (
                            <Link to="/login">
                                <FontAwesomeIcon icon={faArrowLeft} />
                                <span>Quay lại đăng nhập</span>
                            </Link>
                        ) : (
                            <button
                                type="button"
                                className="forgot-back-button"
                                onClick={() => {
                                    setMessage("");
                                    setStep(step - 1);
                                }}
                                disabled={loading}
                            >
                                <FontAwesomeIcon icon={faArrowLeft} />
                                <span>Quay lại</span>
                            </button>
                        )}
                    </div>

                </div>
            </main>

            <Footer />
        </div>
    );
}

export default ForgotPassword;
