import { useState } from "react";
import { Link } from 'react-router-dom';
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faBroom, faEye, faEyeSlash} from "@fortawesome/free-solid-svg-icons";
import {faFacebookF, faInstagram, faYoutube, faGoogle} from "@fortawesome/free-brands-svg-icons";
import './login.css'

function Login() {
    const [showPassword, setShowPassword] = useState(false);

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
                        <a href="#">Trang chủ</a>
                        <a href="#">Dịch vụ</a>
                        <a href="#">Đối tác vệ sinh</a>
                        <a href="#">Về chúng tôi</a>
                        <a href="#">Hỗ trợ</a>
                    </nav>

                    <div className="header-actions">
                        <button className="login-btn">Đăng nhập</button>
                        <button className="register-btn" onClick={() => window.location.href = "/register"}>Đăng ký</button>
                        <button className="service-btn">Đặt dịch vụ</button>
                    </div>
                </div>
            </header>
            <main className="login-main">
                <div className="login-card">
                    <div className="login-title">
                        <h2>Đăng nhập</h2>
                        <p>Chào mừng bạn trở lại với ứng dụng CleanMate!</p>
                    </div>
                    <form>
                        <div className="form-group">
                            <label>Email / Số điện thoại</label>
                            <input type="text" placeholder="Nhập email hoặc số điện thoại"/>
                        </div>
                        <div className="form-group">
                            <label>Mật khẩu</label>
                            <div className="password-wrapper">
                                <input type={showPassword ? "text" : "password"} placeholder="Nhập mật khẩu"/>
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
                        <button type="submit" className="login-submit">Đăng nhập</button>
                    </form>
                    <div className="login-divider">
                        <span>hoặc</span>
                    </div>
                    <div className="social-login">
                        <button>
                            <FontAwesomeIcon icon={faGoogle} />
                            <span>Google</span>
                        </button>

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