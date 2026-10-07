import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBroom, faUser } from '@fortawesome/free-solid-svg-icons';
import './Header.css';

function Header() {
    const storedUser = sessionStorage.getItem("user");
    const user = storedUser ? JSON.parse(storedUser) : null;

    return (
        <header className="header">
            <div className="header-inner">
                <Link to="/" className="logo">
                    <div className="logo-icon">
                        <FontAwesomeIcon icon={faBroom} />
                    </div>
                    <span>CleanMate</span>
                </Link>

                <nav className="nav">
                    <Link to="/">Trang chủ</Link>
                    <Link to="/services">Dịch vụ</Link>
                    <a href="#">Đối tác vệ sinh</a>
                    <a href="#">Về chúng tôi</a>
                    <a href="#">Hỗ trợ</a>
                </nav>

                <div className="header-actions">
                    {user ? (
                        <Link to="/profile" className="user-btn">
                            <FontAwesomeIcon icon={faUser} />
                            <span>{user.fullName}</span>
                        </Link>
                    ) : (
                        <>
                            <Link to="/login" className="login-btn">
                                Đăng nhập
                            </Link>
                            <Link to="/register" className="register-btn">
                                Đăng ký
                            </Link>
                        </>
                    )}
                    <button className="service-btn">
                        Đặt dịch vụ
                    </button>
                </div>
            </div>
        </header>
    );
}

export default Header;
