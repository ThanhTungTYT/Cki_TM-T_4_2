import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBroom, faUser, faCartShopping, faStore } from '@fortawesome/free-solid-svg-icons';
import { useCart } from '../context/CartContext';
import CartDrawer from './CartDrawer';
import CustomerNotifications from './CustomerNotifications';
import './Header.css';

function Header() {
    const storedUser = sessionStorage.getItem("user") || localStorage.getItem("user");
    const user = storedUser ? JSON.parse(storedUser) : null;
    const { totalItems } = useCart();
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const role = (user?.role || '').toUpperCase();
    const isProvider = ['PROVIDER', 'PARTNER', 'ROLE_PROVIDER', 'ROLE_PARTNER'].includes(role);
    const isCustomer = ['CUSTOMER', 'ROLE_CUSTOMER'].includes(role);
    const profilePath = isProvider ? '/provider-portal/dashboard' : '/profile';

    return (
        <>
            <header className={`header${isScrolled ? ' is-scrolled' : ''}`}>
                <div className="header-inner">
                    <Link to="/" className="logo">
                        <div className="logo-icon">
                            <FontAwesomeIcon icon={faBroom} />
                        </div>
                        <span>CleanMate</span>
                    </Link>

                    <nav className="nav">
                        <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>Trang chủ</NavLink>
                        <NavLink to="/services" className={({ isActive }) => isActive ? 'active' : ''}>Dịch vụ</NavLink>
                        <NavLink to="/providers" className={({ isActive }) => isActive ? 'active' : ''}>Đối tác vệ sinh</NavLink>
                        <NavLink to="/become-partner" className={({ isActive }) => isActive ? 'active' : ''}>Trở thành đối tác</NavLink>
                        <NavLink to="/customer/reports" className={({ isActive }) => isActive ? 'active' : ''}>Hỗ trợ</NavLink>
                    </nav>

                    <div className="header-actions">
                        {user ? (
                            <Link to={profilePath} className="user-btn">
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
                        <Link to="/rewards" className="cart-btn" title="Cửa hàng đổi thưởng Ccoin" aria-label="Cửa hàng đổi thưởng Ccoin">
                            <FontAwesomeIcon icon={faStore} />
                        </Link>
                        {isCustomer && <CustomerNotifications />}
                        <button className="cart-btn" onClick={() => setIsCartOpen(true)} title="Giỏ dịch vụ">
                            <FontAwesomeIcon icon={faCartShopping} />
                            {totalItems > 0 && <span key={totalItems} className="cart-badge">{totalItems}</span>}
                        </button>
                    </div>
                </div>
            </header>
            <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
        </>
    );
}

export default Header;
