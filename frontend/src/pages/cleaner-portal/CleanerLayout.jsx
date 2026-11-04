import { useEffect, useState } from 'react';
import {
    NavLink,
    Link,
    useNavigate,
    Outlet
} from 'react-router-dom';
import './CleanerPortal.css';

const NAV_ITEMS = [
    {
        path: '/cleaner/dashboard',
        label: 'Tổng quan',
        icon: 'dashboard'
    },
    {
        path: '/cleaner/jobs',
        label: 'Công việc của tôi',
        icon: 'jobs'
    },
    {
        path: '/cleaner/calendar',
        label: 'Lịch làm việc',
        icon: 'calendar'
    },
    {
        path: '/cleaner/history',
        label: 'Lịch sử công việc',
        icon: 'history'
    },
    {
        path: '/cleaner/notifications',
        label: 'Thông báo',
        icon: 'bell'
    },
    {
        path: '/cleaner/profile',
        label: 'Hồ sơ của tôi',
        icon: 'user'
    }
];

function getCleanerUser() {
    try {
        const savedUser =
            sessionStorage.getItem('user') ||
            localStorage.getItem('user') ||
            sessionStorage.getItem('userInfo') ||
            localStorage.getItem('userInfo');

        return savedUser ? JSON.parse(savedUser) : {};
    } catch {
        return {};
    }
}

function Icon({ name, size = 20 }) {
    const commonProps = {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true
    };

    const paths = {
        dashboard: (
            <>
                <rect x="3" y="3" width="8" height="8" rx="1.5" />
                <rect x="14" y="3" width="7" height="5" rx="1.5" />
                <rect x="14" y="11" width="7" height="10" rx="1.5" />
                <rect x="3" y="14" width="8" height="7" rx="1.5" />
            </>
        ),
        jobs: (
            <>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M8 5V3h8v2M3 11h18M10 11v2h4v-2" />
            </>
        ),
        calendar: (
            <>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01" />
            </>
        ),
        history: (
            <>
                <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
                <path d="M3 3v5h5M12 7v5l3 2" />
            </>
        ),
        bell: (
            <>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M10 21h4" />
            </>
        ),
        user: (
            <>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
            </>
        ),
        logout: (
            <>
                <path d="M10 17l5-5-5-5M15 12H3" />
                <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
            </>
        ),
        home: (
            <>
                <path d="m3 10 9-7 9 7" />
                <path d="M5 9v12h14V9M9 21v-7h6v7" />
            </>
        ),
        menu: (
            <>
                <path d="M4 6h16M4 12h16M4 18h16" />
            </>
        ),
        close: (
            <>
                <path d="M18 6 6 18M6 6l12 12" />
            </>
        )
    };

    return <svg {...commonProps}>{paths[name] || null}</svg>;
}

function CleanerLayout() {
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [user] = useState(getCleanerUser);

    const userName = user.fullName || user.name || 'Nhân viên';
    const userEmail = user.email || 'Tài khoản nhân viên';

    useEffect(() => {
        const token =
            sessionStorage.getItem('accessToken') ||
            localStorage.getItem('accessToken');

        if (!token) {
            navigate('/login', { replace: true });
        }
    }, [navigate]);

    const handleLogout = () => {
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('userInfo');

        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        localStorage.removeItem('userInfo');

        navigate('/login', { replace: true });
    };

    const closeMobileMenu = () => {
        setMobileMenuOpen(false);
    };

    return (
        <div className="cl-app">
            {mobileMenuOpen && (
                <div
                    className="cl-overlay"
                    onClick={closeMobileMenu}
                />
            )}

            <aside
                className={`cl-sidebar ${
                    mobileMenuOpen ? 'cl-sidebar-open' : ''
                }`}
            >
                <div className="cl-brand">
                    <Link
                        to="/cleaner/dashboard"
                        className="cl-brand-link"
                        onClick={closeMobileMenu}
                    >
                        <div className="cl-brand-logo">C</div>

                        <div className="cl-brand-text">
                            <span>CleanMate</span>
                            <small>Cleaner Portal</small>
                        </div>
                    </Link>

                    <button
                        className="cl-mobile-close"
                        onClick={closeMobileMenu}
                        aria-label="Đóng menu"
                        type="button"
                    >
                        <Icon name="close" />
                    </button>
                </div>

                <div className="cl-sidebar-label">
                    MENU CHÍNH
                </div>

                <nav className="cl-nav">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `cl-nav-link ${isActive ? 'active' : ''}`
                            }
                            onClick={closeMobileMenu}
                        >
                            <Icon name={item.icon} size={19} />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="cl-sidebar-bottom">
                    <div className="cl-sidebar-support">
                        <div className="cl-support-icon">?</div>

                        <div>
                            <strong>Cần hỗ trợ?</strong>
                            <span>Liên hệ quản lý của bạn</span>
                        </div>
                    </div>

                    <div className="cl-sidebar-actions">
                        <Link
                            to="/"
                            className="cl-home-btn"
                            title="Quay về trang chủ"
                        >
                            <Icon name="home" size={17} />
                            <span>Về trang chủ</span>
                        </Link>

                        <button
                            className="cl-logout-btn"
                            onClick={handleLogout}
                            type="button"
                        >
                            <Icon name="logout" size={17} />
                            <span>Đăng xuất</span>
                        </button>
                    </div>
                </div>
            </aside>

            <div className="cl-main">
                <header className="cl-topbar">
                    <div className="cl-topbar-left">
                        <button
                            className="cl-menu-toggle"
                            onClick={() => setMobileMenuOpen(true)}
                            aria-label="Mở menu"
                            type="button"
                        >
                            <Icon name="menu" />
                        </button>

                        <div className="cl-breadcrumb">
                            <span>CleanMate</span>
                            <span className="cl-breadcrumb-separator">/</span>
                            <strong>Nhân viên vệ sinh</strong>
                        </div>
                    </div>

                    <div className="cl-topbar-right">
                        <Link
                            to="/"
                            className="cl-topbar-home-btn"
                            title="Quay về trang chủ"
                        >
                            <Icon name="home" size={16} />
                            <span>Về trang chủ</span>
                        </Link>

                        <div className="cl-user-info">
                            <div className="cl-user-avatar">
                                {userName.charAt(0).toUpperCase()}
                            </div>

                            <div className="cl-user-details">
                                <strong>{userName}</strong>
                                <span>{userEmail}</span>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="cl-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

export default CleanerLayout;