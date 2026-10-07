import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import { Link, useNavigate } from 'react-router-dom';
import {faEye, faEyeSlash} from "@fortawesome/free-solid-svg-icons";
import {faFacebookF, faGoogle} from "@fortawesome/free-brands-svg-icons";
import Header from '../components/Header';
import Footer from '../components/Footer';
import './register.css'
import {useState} from "react";

function Register() {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const navigate = useNavigate();
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [agree, setAgree] = useState(false);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const handleRegister = async (e) => {
        e.preventDefault();
        setMessage("");
        if (password !== confirmPassword) {
            setMessage("Mật khẩu xác nhận không khớp");
            return;
        }
        if (!agree) {
            setMessage("Bạn phải đồng ý với điều khoản sử dụng");
            return;
        }
        setLoading(true);
        try {
            const response = await fetch(
                "http://localhost:8080/api/auth/register",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        fullName: fullName,
                        email: email,
                        phone: phone,
                        password: password
                    })
                }
            );
            const text = await response.text();
            let data = {};
            if (text) {
                data = JSON.parse(text);
            }
            if (!response.ok) {
                throw new Error(
                    data.message || `Đăng ký thất bại (${response.status})`
                );
            }
            setMessage("Đăng ký thành công");
            setTimeout(() => {
                navigate("/login");
            }, 1000);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="home">
            <Header />
            <main className="register-main">
                <div className="register-card">
                    <div className="register-title">
                        <h2>Đăng ký tài khoản</h2>
                        <p>Tạo tài khoản miễn phí để nhận trọn vẹn ưu đãi và dịch vụ từ CleanMate.</p>
                    </div>
                    <form onSubmit={handleRegister}>
                        <div className="form-group">
                            <label>Họ và tên</label>
                            <input type="text" placeholder="Họ và tên" value={fullName} onChange={(e) => setFullName(e.target.value)} required/>
                        </div>
                        <div className="form-group">
                            <label>Địa chỉ Email</label>
                            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required/>
                        </div>
                        <div className="form-group">
                            <label>Số điện thoại</label>
                            <input type="text" placeholder="091234567" value={phone} onChange={(e) => setPhone(e.target.value)} required/>
                        </div>
                        <div className="form-group">
                            <label>Mật khẩu</label>
                            <div className="password-wrapper">
                                <input type={showPassword ? "text" : "password"} placeholder="Nhập mật khẩu (ít nhất 6 ký tự)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required/>
                                <button type="button" className="eye-btn"
                                        onClick={() => setShowPassword(!showPassword)}>
                                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye}/>
                                </button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Xác nhận mật khẩu</label>
                            <div className="password-wrapper">
                                <input type={showConfirmPassword ? "text" : "password"} placeholder="Xác nhận lại mật khẩu của bạn" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} required/>
                                <button type="button" className="eye-btn"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                    <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye}/>
                                </button>
                            </div>
                        </div>
                        <div className="register-options">
                            <label>
                                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)}/>
                                <span>Tôi đồng ý với <a href="#">Điều khoản sử dụng</a> và <a href="#">Chính sách bảo mật</a> của CleanMate.</span>
                            </label>
                        </div>
                        <button type="submit" className="register-submit" disabled={loading}>
                            {loading ? "Đang đăng ký..." : "Đăng ký"}
                        </button>
                        {message && (
                            <p className="auth-message">
                                {message}
                            </p>
                        )}
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
            <Footer />
        </div>
    )
}
export default Register