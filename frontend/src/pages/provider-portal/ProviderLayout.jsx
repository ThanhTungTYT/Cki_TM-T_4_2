import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { providerDashboardApi } from '../../services/providerApi';
import './ProviderPortal.css';

// Icons (SVG inline để không phụ thuộc thêm thư viện)
function IconGrid() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pp-nav-icon">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
    );
}
function IconClipboard() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pp-nav-icon">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 12h6M9 16h4" />
        </svg>
    );
}
function IconUsers() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pp-nav-icon">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
    );
}
function IconCalendar() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pp-nav-icon">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
    );
}
function IconBroom() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pp-nav-icon">
            <path d="M14 2l4 4-9 9-4-4 9-9zM3 21l4-1-3-3-1 4z" />
            <line x1="14" y1="6" x2="18" y2="10" />
        </svg>
    );
}
function IconShieldAlert() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pp-nav-icon">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
    );
}
function IconTrendingUp() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pp-nav-icon">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
        </svg>
    );
}
function IconLogOut() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    );
}

const NAV_ITEMS = [
    { to: '/provider-portal/dashboard',  label: 'Tổng quan',     icon: <IconGrid /> },
    { to: '/provider-portal/bookings',   label: 'Đơn hàng',      icon: <IconClipboard /> },
    { to: '/provider-portal/services',   label: 'Dịch vụ',       icon: <IconBroom /> },
    { to: '/provider-portal/employees',  label: 'Nhân viên',     icon: <IconUsers /> },
    { to: '/provider-portal/schedule',   label: 'Lịch làm việc', icon: <IconCalendar /> },
    { to: '/provider-portal/complaints', label: 'Khiếu nại',     icon: <IconShieldAlert /> },
];

function ProviderLayout() {
    const navigate = useNavigate();
    const [businessName, setBusinessName] = useState('');
    const [userName, setUserName] = useState('');

    useEffect(() => {
        // Lấy thông tin từ storage
        const stored = localStorage.getItem('user') || sessionStorage.getItem('user') || localStorage.getItem('userInfo') || sessionStorage.getItem('userInfo');
        if (stored) {
            try {
                const info = JSON.parse(stored);
                setUserName(info.fullName || info.name || info.email || '');
                if (info.businessName) {
                    setBusinessName(info.businessName);
                }
            } catch {
                // ignore
            }
        }

        // Kiểm tra đăng nhập
        const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
        if (!token) {
            navigate('/login', { replace: true });
            return;
        }

        // Tải businessName chuẩn từ hồ sơ đối tác
        providerDashboardApi.get()
            .then((res) => {
                if (res?.businessName) {
                    setBusinessName(res.businessName);
                }
            })
            .catch(() => {});
    }, [navigate]);

    function handleLogout() {
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('userInfo');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        localStorage.removeItem('userInfo');
        navigate('/login', { replace: true });
    }

    const initial = (businessName || userName || 'P').charAt(0).toUpperCase();

    return (
        <div className="pp-shell">
            {/* Sidebar */}
            <aside className="pp-sidebar">
                <div className="pp-sidebar-logo">
                    <div className="logo-text">🧹 CleanMate</div>
                    <div className="logo-sub">Cổng thông tin Đối tác</div>
                </div>

                {businessName && (
                    <div className="pp-sidebar-partner">
                        Nhà cung cấp
                        <strong title={businessName}>{businessName}</strong>
                    </div>
                )}

                <nav className="pp-sidebar-nav">
                    {NAV_ITEMS.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `pp-nav-item${isActive ? ' active' : ''}`
                            }
                        >
                            {item.icon}
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="pp-sidebar-footer">
                    <button className="pp-logout-btn" onClick={handleLogout} type="button">
                        <IconLogOut />
                        Đăng xuất
                    </button>
                </div>
            </aside>

            {/* Main area */}
            <div className="pp-main">
                <header className="pp-topbar">
                    <span className="pp-topbar-title">
                        {NAV_ITEMS.find(n =>
                            window.location.pathname.startsWith(n.to)
                        )?.label || 'Cổng đối tác'}
                    </span>
                    <div className="pp-topbar-user">
                        <div className="pp-topbar-avatar">{initial}</div>
                        <span>{userName || 'Đối tác'}</span>
                    </div>
                </header>

                <main className="pp-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

export default ProviderLayout;
