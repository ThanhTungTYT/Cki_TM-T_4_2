import { useState } from "react";
import { Link } from 'react-router-dom';
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import { GoogleLogin } from "@react-oauth/google";
import {faEye, faEyeSlash} from "@fortawesome/free-solid-svg-icons";
import {faFacebookF, faGoogle} from "@fortawesome/free-brands-svg-icons";
import Header from '../components/Header';
import Footer from '../components/Footer';
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
            sessionStorage.setItem("accessToken", data.accessToken);
            sessionStorage.setItem("user", JSON.stringify({
                userId: data.userId,
                fullName: data.fullName,
                email: data.email,
                role: data.role
            }));

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
            sessionStorage.setItem("accessToken", data.accessToken);

            sessionStorage.setItem("user", JSON.stringify({
                userId: data.userId,
                fullName: data.fullName,
                email: data.email,
                role: data.role
            }));
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
            <Header />
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
            <Footer />
        </div>
    )
}
export default Login