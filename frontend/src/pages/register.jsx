import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import { Link } from 'react-router-dom';
import {faBroom, faEye, faEyeSlash} from "@fortawesome/free-solid-svg-icons";
import {faFacebookF, faGoogle, faInstagram, faYoutube} from "@fortawesome/free-brands-svg-icons";
import './register.css'
import {useState} from "react";

function Register() {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    return (
        <div className="home">
            <header className="header">
                <div className="header-inner">
                    <div className="logo">
                        <div className="logo-icon">
                            <FontAwesomeIcon icon={faBroom}/>
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
                        <button className="register-btn">Đăng ký</button>
                        <button className="service-btn">Đặt dịch vụ</button>
                    </div>
                </div>
            </header>
            <main className="register-main">
                <div className="register-card">
                    <div className="register-title">
                        <h2>Đăng ký tài khoản</h2>
                        <p>Tạo tài khoản miễn phí để nhận trọn vẹn ưu đãi và dịch vụ từ CleanMate.</p>
                    </div>
                    <form>
                        <div className="form-group">
                            <label>Họ và tên</label>
                            <input type="text" placeholder="Nhập họ và tên đầy đủ của bạn"/>
                        </div>
                        <div className="form-group">
                            <label>Địa chỉ Email</label>
                            <input type="email" placeholder="tuilaphune@gmail.com"/>
                        </div>
                        <div className="form-group">
                            <label>Số điện thoại</label>
                            <input type="text" placeholder="091234567"/>
                        </div>
                        <div className="form-group">
                            <label>Mật khẩu</label>
                            <div className="password-wrapper">
                                <input type={showPassword ? "text" : "password"} placeholder="Nhập mật khẩu (ít nhất 6 ký tự)"/>
                                <button type="button" className="eye-btn"
                                        onClick={() => setShowPassword(!showPassword)}>
                                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye}/>
                                </button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Xác nhận mật khẩu</label>
                            <div className="password-wrapper">
                                <input type={showConfirmPassword ? "text" : "password"} placeholder="Xác nhận lại mật khẩu của bạn"/>
                                <button type="button" className="eye-btn"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                    <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye}/>
                                </button>
                            </div>
                        </div>
                        <div className="register-options">
                            <label>
                                <input type="checkbox"/>
                                <span>Tôi đồng ý với <a href="#">Điều khoản sử dụng</a> và <a href="#">Chính sách bảo mật</a> của CleanMate.</span>
                            </label>
                        </div>
                        <button type="submit" className="register-submit">Đăng ký</button>
                    </form>
                    <div className="register-divider">
                        <span>hoặc đăng ký bằng</span>
                    </div>
                    <div className="social-login">
                        <button type="button">
                            <FontAwesomeIcon icon={faGoogle}/>
                            <span>Google</span>
                        </button>

                        <button type="button">
                            <FontAwesomeIcon icon={faFacebookF}/>
                            <span>Facebook</span>
                        </button>
                    </div>
                    <div className="login-link">
                        <span>Đã có tài khoản?</span>
                        <Link to="/login">Đăng nhập</Link>
                    </div>
                </div>
            </main>
            <footer className="footer">
                <div className="footer-content">
                    <div className="footer-brand">
                        <div className="logo">
                            <div className="logo-icon">
                                <FontAwesomeIcon icon={faBroom}/>
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
                            <span><FontAwesomeIcon icon={faFacebookF}/></span>
                            <span><FontAwesomeIcon icon={faInstagram}/></span>
                            <span><FontAwesomeIcon icon={faYoutube}/></span>
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
export default Register