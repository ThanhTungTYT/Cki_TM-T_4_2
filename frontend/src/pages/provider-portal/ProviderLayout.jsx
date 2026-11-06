import { NavLink, Link, useNavigate, Outlet } from 'react-router-dom';
import React, { Component, useEffect, useState } from 'react';
import { providerDashboardApi, providerNotificationApi } from '../../services/providerApi';
import './ProviderPortal.css';

// Icons (SVG inline để không phụ thuộc thêm thư viện)
function IconBell() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
    );
}

function IconHome() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    );
}
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

class ProviderErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('Provider portal error:', error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="pp-card" style={{ maxWidth: 600, margin: '40px auto', padding: 24, textAlign: 'center' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
                    <h2 style={{ fontSize: 18, color: '#0f172a', marginBottom: 8 }}>Đã xảy ra sự cố khi tải trang</h2>
                    <p style={{ color: '#64748b', fontSize: 13.5, marginBottom: 16 }}>
                        {this.state.error?.message || 'Lỗi không xác định'}
                    </p>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                        <button
                            className="pp-btn pp-btn-outline"
                            onClick={() => window.location.reload()}
                        >
                            Tải lại trang
                        </button>
                        <button
                            className="pp-btn pp-btn-primary"
                            onClick={() => {
                                this.setState({ hasError: false, error: null });
                                window.location.href = '/provider-portal/bookings';
                            }}
                        >
                            Về danh sách đơn hàng
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

function ProviderLayout() {
    const navigate = useNavigate();
    const [businessName, setBusinessName] = useState('');
    const [userName, setUserName] = useState('');
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifs, setShowNotifs] = useState(false);

    function loadNotifications() {
        providerNotificationApi.list()
            .then(data => {
                if (data) {
                    setNotifications(data.items || []);
                    setUnreadCount(data.unreadCount || 0);
                }
            })
            .catch(() => {});
    }

    async function handleNotificationClick(notif) {
        if (!notif.read) {
            try {
                await providerNotificationApi.markRead(notif.id);
                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch {}
        }
        setShowNotifs(false);
        if (notif.referenceType === 'BOOKING' && notif.referenceId) {
            navigate(`/provider-portal/bookings/${notif.referenceId}`);
        }
    }

    async function handleMarkAllRead() {
        try {
            await providerNotificationApi.markAllRead();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch {}
    }

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
        loadNotifications();
        const interval = setInterval(loadNotifications, 30000);
        return () => clearInterval(interval);
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
                <Link to="/" className="pp-sidebar-logo" style={{ textDecoration: 'none', display: 'block' }} title="Về trang chủ CleanMate">
                    <div className="logo-text">🧹 CleanMate</div>
                    <div className="logo-sub">Cổng thông tin Đối tác</div>
                </Link>

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
                    <Link to="/" className="pp-home-btn" title="Quay về trang chủ">
                        <IconHome />
                        <span>Về trang chủ</span>
                    </Link>
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
                    <div className="pp-topbar-actions">
                        <Link to="/" className="pp-topbar-home-btn" title="Quay về trang chủ CleanMate">
                            <IconHome />
                            <span>Về trang chủ</span>
                        </Link>
                        {/* Notification Bell Dropdown */}
                        <div style={{ position: 'relative' }}>
                            <button
                                type="button"
                                onClick={() => setShowNotifs(!showNotifs)}
                                style={{
                                    position: 'relative',
                                    background: showNotifs ? '#f1f5f9' : 'transparent',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '50%',
                                    width: 36,
                                    height: 36,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#334155'
                                }}
                                title="Thông báo đối tác"
                            >
                                <IconBell />
                                {unreadCount > 0 && (
                                    <span style={{
                                        position: 'absolute',
                                        top: -4,
                                        right: -4,
                                        background: '#ef4444',
                                        color: '#fff',
                                        fontSize: 10,
                                        fontWeight: 700,
                                        minWidth: 18,
                                        height: 18,
                                        borderRadius: 9,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0 4px',
                                        border: '2px solid #fff'
                                    }}>
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {showNotifs && (
                                <div style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: 44,
                                    width: 350,
                                    maxHeight: 440,
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 10,
                                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                                    zIndex: 1000,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        padding: '10px 14px',
                                        borderBottom: '1px solid #f1f5f9',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: '#f8fafc'
                                    }}>
                                        <strong style={{ fontSize: 13.5, color: '#0f172a' }}>
                                            Thông báo ({unreadCount})
                                        </strong>
                                        {unreadCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={handleMarkAllRead}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#2563eb',
                                                    fontSize: 12,
                                                    cursor: 'pointer',
                                                    fontWeight: 600
                                                }}
                                            >
                                                Đọc tất cả
                                            </button>
                                        )}
                                    </div>

                                    <div style={{ overflowY: 'auto', flex: 1, maxHeight: 380 }}>
                                        {notifications.length === 0 ? (
                                            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                                                Không có thông báo nào.
                                            </div>
                                        ) : (
                                            notifications.map((n) => {
                                                const isDeclined = n.type === 'ASSIGNMENT_DECLINED';
                                                return (
                                                    <div
                                                        key={n.id}
                                                        onClick={() => handleNotificationClick(n)}
                                                        style={{
                                                            padding: '10px 14px',
                                                            borderBottom: '1px solid #f1f5f9',
                                                            background: n.read ? '#ffffff' : (isDeclined ? '#fff1f2' : '#f0fdf4'),
                                                            cursor: 'pointer',
                                                            transition: 'background 0.2s',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: 3
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span style={{
                                                                fontSize: 12.5,
                                                                fontWeight: n.read ? 600 : 700,
                                                                color: isDeclined ? '#e11d48' : '#0f172a'
                                                            }}>
                                                                {isDeclined ? '⚠️ ' : '🔔 '}{n.title}
                                                            </span>
                                                            {!n.read && (
                                                                <span style={{
                                                                    width: 7,
                                                                    height: 7,
                                                                    borderRadius: '50%',
                                                                    background: isDeclined ? '#e11d48' : '#2563eb'
                                                                }} />
                                                            )}
                                                        </div>
                                                        <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.4 }}>
                                                            {n.message}
                                                        </p>
                                                        <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                                            {n.createdAt ? new Date(n.createdAt).toLocaleString('vi-VN') : ''}
                                                        </span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pp-topbar-user">
                            <div className="pp-topbar-avatar">{initial}</div>
                            <span>{userName || 'Đối tác'}</span>
                        </div>
                    </div>
                </header>

                <main className="pp-content">
                    <ProviderErrorBoundary><Outlet /></ProviderErrorBoundary>
                </main>
            </div>
        </div>
    );
}

export default ProviderLayout;
