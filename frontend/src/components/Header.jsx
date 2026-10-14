import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBroom, faUser, faCartShopping } from '@fortawesome/free-solid-svg-icons';
import { useCart } from '../context/CartContext';
import CartDrawer from './CartDrawer';
import './Header.css';

function Header() {
    const storedUser = sessionStorage.getItem("user");
    const user = storedUser ? JSON.parse(storedUser) : null;
    const { totalItems } = useCart();
    const [isCartOpen, setIsCartOpen] = useState(false);

    return (
        <>
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
                        <Link to="/provider/1">Đối tác vệ sinh</Link>
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
                        <button className="cart-btn" onClick={() => setIsCartOpen(true)} title="Giỏ dịch vụ">
                            <FontAwesomeIcon icon={faCartShopping} />
                            {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
                        </button>
                    </div>
                </div>
            </header>
            <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
        </>
    );
}

export default Header;
