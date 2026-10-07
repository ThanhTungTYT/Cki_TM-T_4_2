import { useState } from "react";
import { Link } from 'react-router-dom';
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import { GoogleLogin } from "@react-oauth/google";
import {faBroom, faEye, faEyeSlash} from "@fortawesome/free-solid-svg-icons";
import {faFacebookF, faInstagram, faYoutube, faGoogle} from "@fortawesome/free-brands-svg-icons";
import './login.css'

function Login() {
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const handleLogin = async (e) => {
        e.preventDefault();
        setMessage("");
        setLoading(true);
        try {
            const response = await fetch(
                "http://localhost:8080/api/auth/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                }
            );
            const data = await response.json();
            if (!response.ok) {
                throw new Error(
                    data.message || "Đăng nhập thất bại"
                );
            }
            localStorage.setItem(
                "accessToken",
                data.accessToken
            );
            localStorage.setItem(
                "user",
                JSON.stringify({
                    userId: data.userId,
                    fullName: data.fullName,
                    email: data.email,
                    role: data.role
                })
            );
            setMessage("Đăng nhập thành công");
            if (data.role === "ADMIN") {
                window.location.href = "/admin";
            } else {
                window.location.href = "/";
            }
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };
    const handleGoogleLogin = async (credentialResponse) => {
        setMessage("");
        setLoading(true);
        try {
            const response = await fetch(
                "http://localhost:8080/api/auth/google",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        credential: credentialResponse.credential
                    })
                }
            );
            const text = await response.text();
            let data = {};
            if (text) {
                try {
                    data = JSON.parse(text);
                } catch {
                    throw new Error("Backend trả về dữ liệu không hợp lệ");
                }
            }
            if (!response.ok) {
                throw new Error(
                    data.message || "Đăng nhập Google thất bại"
                );
            }
            localStorage.setItem(
                "accessToken",
                data.accessToken
            );
            localStorage.setItem(
                "user",
                JSON.stringify({
                    userId: data.userId,
                    fullName: data.fullName,
                    email: data.email,
                    role: data.role
                })
            );
            setMessage("Đăng nhập Google thành công");
            if (data.role === "ADMIN") {
                window.location.href = "/admin";
            } else {
                window.location.href = "/";
            }
        } catch (error) {
            console.error(error);
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="home">
            <header className="header">
                <div className="header-inner">
                    <div className="logo">
                        <div className="logo-icon">
                            <FontAwesomeIcon icon={faBroom} />
                        </div>
                        <span>CleanMate</span>
                    </div>

                    <nav className="nav">
                        <a href="/">Trang chủ</a>
                        <a href="/sevices">Dịch vụ</a>
                        <a href="#">Đối tác vệ sinh</a>
                        <a href="#">Về chúng tôi</a>
                        <a href="#">Hỗ trợ</a>
                    </nav>

                    <div className="header-actions">
                        <Link to="/login" className="login-btn">
                            Đăng nhập
                        </Link>

                        <Link to="/register" className="register-btn">
                            Đăng ký
                        </Link>

                        <button className="service-btn">
                            Đặt dịch vụ
                        </button>
                    </div>
                </div>
            </header>
            <main className="login-main">
                <div className="login-card">
                    <div className="login-title">
                        <h2>Đăng nhập</h2>
                        <p>Chào mừng bạn trở lại với ứng dụng CleanMate!</p>
                    </div>
                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label>Email</label>
                            <input type="text" placeholder="Nhập email" value={email} onChange={(e) => setEmail(e.target.value)} required/>
                        </div>
                        <div className="form-group">
                            <label>Mật khẩu</label>
                            <div className="password-wrapper">
                                <input type={showPassword ? "text" : "password"} placeholder="Nhập mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} required/>
                                <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>
                                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye}/>
                                </button>
                            </div>
                        </div>
                        <div className="login-options">
                            <label>
                                <input type="checkbox" />
                                <span>Ghi nhớ đăng nhập</span>
                            </label>
                            <a href="#">Quên mật khẩu?</a>
                        </div>
                        <button type="submit" className="login-submit" disabled={loading}>{loading ? "Đang đăng nhập..." : "Đăng nhập"}</button>
                        {message && (
                            <p className="auth-message">
                                {message}
                            </p>
                        )}
                    </form>
                    <div className="login-divider">
                        <span>hoặc</span>
                    </div>
                    <div className="social-login">
                        <div className="google-login-wrapper">
                            <button type="button" className="custom-google-btn">
                                <FontAwesomeIcon icon={faGoogle} />
                                <span>Google</span>
                            </button>

                            <div className="google-login-hidden">
                                <GoogleLogin
                                    onSuccess={handleGoogleLogin}
                                    onError={() => {
                                        setMessage("Không thể đăng nhập bằng Google");
                                    }}
                                />
                            </div>
                        </div>

                        <button>
                            <FontAwesomeIcon icon={faFacebookF} />
                            <span>Facebook</span>
                        </button>
                    </div>
                    <div className="register-link">
                        <span>Chưa có tài khoản?</span>
                        <Link to="/register">Đăng ký ngay</Link>
                    </div>
                </div>
            </main>
            <footer className="footer">
                <div className="footer-content">
                    <div className="footer-brand">
                        <div className="logo">
                            <div className="logo-icon">
                                <FontAwesomeIcon icon={faBroom} />
                            </div>
                            <span>CleanMate</span>
                        </div>
                        <p>
                            Nền tảng công nghệ kết nối khách hàng với các đối tác
                            vệ sinh chuyên nghiệp, tận tâm hàng đầu tại Việt Nam.
                        </p>
                        <span>Hotline: 1900 8198</span>
                        <span>Email: 23130241@st.hcmuaf.edu.vn</span>
                    </div>

                    <div className="footer-column">
                        <h3>Dịch vụ</h3>
                        <a href="#">Vệ sinh nhà ở</a>
                        <a href="#">Vệ sinh văn phòng</a>
                        <a href="#">Vệ sinh sau xây dựng</a>
                        <a href="#">Vệ sinh máy lạnh</a>
                        <a href="#">Tổng vệ sinh</a>
                    </div>

                    <div className="footer-column">
                        <h3>Hỗ trợ</h3>
                        <a href="#">Trung tâm trợ giúp</a>
                        <a href="#">Chính sách giá</a>
                        <a href="#">Quy trình đặt lịch</a>
                        <a href="#">Câu hỏi thường gặp</a>
                    </div>

                    <div className="footer-column">
                        <h3>Về chúng tôi</h3>
                        <a href="#">Giới thiệu</a>
                        <a href="#">Tin tức & Sự kiện</a>
                        <a href="#">Tuyển dụng</a>
                        <a href="#">Trở thành đối tác</a>
                        <a href="#">Liên hệ hệ thống</a>
                    </div>

                    <div className="footer-column">
                        <h3>Kết nối với chúng tôi</h3>
                        <div className="socials">
                            <span><FontAwesomeIcon icon={faFacebookF} /></span>
                            <span><FontAwesomeIcon icon={faInstagram} /></span>
                            <span><FontAwesomeIcon icon={faYoutube} /></span>
                        </div>
                    </div>
                </div>

                <div className="footer-bottom">
                    <span>© 2026 CleanMate Marketplace. Tất cả quyền được bảo lưu.</span>
                    <div>
                        <a href="#">Điều khoản sử dụng</a>
                        <a href="#">Chính sách bảo mật</a>
                    </div>
                </div>
            </footer>
        </div>
    )
}
export default Login