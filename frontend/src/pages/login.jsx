import { useEffect, useState } from "react";
import { Link, useLocation } from 'react-router-dom';
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import { GoogleLogin } from "@react-oauth/google";
import {faEye, faEyeSlash} from "@fortawesome/free-solid-svg-icons";
import {faFacebookF, faGoogle} from "@fortawesome/free-brands-svg-icons";
import Header from '../components/Header';
import Footer from '../components/Footer';
import './login.css'

function Login() {
    const location = useLocation();
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState(
        location.state?.reason === 'expired'
            ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
            : location.state?.reason === 'login-required'
                ? 'Vui lòng đăng nhập để tiếp tục.'
                : location.state?.reason === 'invalid'
                    ? 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.'
                : ''
    );
    const [loading, setLoading] = useState(false);
    const [facebookReady, setFacebookReady] = useState(false);
    const customerReturnPath = () => {
        const requested = location.state?.from;
        const path = requested?.pathname || '';
        return /^\/(checkout|profile|customer\/)/.test(path)
            ? `${path}${requested.search || ''}${requested.hash || ''}`
            : '/';
    };
    useEffect(() => {
        const initFacebook = () => {
            if (!window.FB) return;
            window.FB.init({
                appId: "2165525424321923",
                cookie: true,
                xfbml: false,
                // Tránh luồng FedCM đang trả lỗi 500 từ endpoint của Meta.
                fedCM: false,
                version: "v26.0"
            });
            setFacebookReady(true);
        };
        window.fbAsyncInit = initFacebook;
        if (window.FB) {
            initFacebook();
        } else if (!document.getElementById("facebook-jssdk")) {
            const script = document.createElement("script");
            script.id = "facebook-jssdk";
            script.src = "https://connect.facebook.net/vi_VN/sdk.js";
            script.async = true;
            script.onerror = () => {
                setMessage("Không thể tải Facebook SDK");
            };
            document.body.appendChild(script);
        }
        return () => {
            window.fbAsyncInit = null;
        };
    }, []);
    const redirectByRole = (rawRole) => {
        const role = String(rawRole || "").trim().toUpperCase().replace(/^ROLE_/, "");
        if (role === "ADMIN" || role === "STAFF") {
            window.location.href = "/admin";
        } else if (role === "PROVIDER" || role === "PARTNER") {
            window.location.href = "/provider-portal/dashboard";
        } else if (role === "CLEANER" || role === "EMPLOYEE") {
            window.location.href = "/cleaner/dashboard";
        } else {
            window.location.href = customerReturnPath();
        }
    };
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
            localStorage.removeItem("accessToken");
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            localStorage.removeItem("userInfo");
            sessionStorage.setItem("accessToken", data.accessToken);
            sessionStorage.setItem("user", JSON.stringify({
                userId: data.userId,
                fullName: data.fullName,
                email: data.email,
                role: data.role
            }));
            window.dispatchEvent(new Event("cleanmate-auth-changed"));

            setMessage("Đăng nhập thành công");
            redirectByRole(data.role);
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
            localStorage.removeItem("accessToken");
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            localStorage.removeItem("userInfo");
            sessionStorage.setItem("accessToken", data.accessToken);

            sessionStorage.setItem("user", JSON.stringify({
                userId: data.userId,
                fullName: data.fullName,
                email: data.email,
                role: data.role
            }));
            window.dispatchEvent(new Event("cleanmate-auth-changed"));
            setMessage("Đăng nhập Google thành công");
            redirectByRole(data.role);
        } catch (error) {
            console.error(error);
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };
    const completeFacebookLogin = async (facebookResponse) => {
        try {
            const response = await fetch(
                "https://handmade-opponent-punk.ngrok-free.dev/api/auth/facebook",
                {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({accessToken: facebookResponse.authResponse.accessToken})
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
                throw new Error(data.message || "Đăng nhập Facebook thất bại");
            }
            sessionStorage.setItem("accessToken", data.accessToken);
            sessionStorage.setItem("user", JSON.stringify({
                userId: data.userId,
                fullName: data.fullName,
                email: data.email,
                role: data.role
            }));
            setMessage("Đăng nhập Facebook thành công");
            redirectByRole(data.role);
        } catch (error) {
            console.error(error);
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFacebookLogin = () => {
        setMessage("");

        if (loading) return;
        if (!facebookReady || !window.FB) {
            setMessage("Facebook Login chưa sẵn sàng");
            return;
        }

        setLoading(true);
        try {
            window.FB.login((facebookResponse) => {
                if (!facebookResponse.authResponse?.accessToken) {
                    setMessage("Đăng nhập Facebook thất bại hoặc đã bị hủy");
                    setLoading(false);
                    return;
                }

                void completeFacebookLogin(facebookResponse);
            }, {
                scope: "public_profile,email"
            });
        } catch (error) {
            console.error(error);
            setMessage(error.message || "Không thể mở cửa sổ đăng nhập Facebook.");
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
                            <Link to="/forgot-password">
                                Quên mật khẩu?
                            </Link>
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
                        <button type="button" onClick={handleFacebookLogin} disabled={loading || !facebookReady}>
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
