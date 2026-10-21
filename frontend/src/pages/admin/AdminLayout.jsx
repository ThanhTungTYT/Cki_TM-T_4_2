import { useLocation, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faHouse,
    faChartColumn,
    faClipboardList,
    faStore,
    faUsers,
    faTags,
    faCreditCard,
    faChartPie,
    faMoneyBillTransfer,
    faArrowRightFromBracket,
} from '@fortawesome/free-solid-svg-icons';
import './AdminDashboard.css';

const menuItems = [
    {
        label: 'Tổng quan',
        path: '/admin',
        icon: faChartColumn,
    },
    {
        label: 'Quản lý đơn hàng',
        path: '/admin/orders',
        icon: faClipboardList,
    },
    {
        label: 'Nhà cung cấp',
        path: '/admin/providers',
        icon: faStore,
    },
    {
        label: 'Quản lý tài khoản',
        path: '/admin/accounts',
        icon: faUsers,
    },
    {
        label: 'Quản lý dịch vụ',
        path: '/admin/services',
        icon: faTags,
    },
    {
        label: 'Giao dịch',
        path: '/admin/transactions',
        icon: faCreditCard,
    },
    {
        label: 'Quản lý hoàn tiền',
        path: '/admin/refunds',
        icon: faMoneyBillTransfer,
    },
    {
        label: 'Thống kê & báo cáo',
        path: '/admin/reports',
        icon: faChartPie,
    },
];

function AdminLayout({ children }) {
    const location = useLocation();

    return (
        <div className="admin-layout">
            <aside className="admin-sidebar">
                <div className="admin-brand">
                    <div className="admin-brand-icon">
                        <FontAwesomeIcon icon={faHouse} />
                    </div>

                    <div>
                        <strong>CleanMate</strong>
                        <span>ADMIN PANEL</span>
                    </div>
                </div>

                <div className="admin-menu-title">
                    MENU CHÍNH
                </div>

                <nav className="admin-menu">
                    {menuItems.map((item) => {
                        const isActive =
                            location.pathname === item.path ||
                            (item.path !== '/admin' &&
                                location.pathname.startsWith(
                                    `${item.path}/`
                                ));

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`admin-menu-item ${
                                    isActive ? 'active' : ''
                                }`}
                            >
                                <FontAwesomeIcon icon={item.icon} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="admin-sidebar-bottom">
                    <div className="admin-user">
                        <div className="admin-avatar">
                            AD
                        </div>

                        <div className="admin-user-info">
                            <strong>Quản trị viên</strong>
                            <span>Administrator</span>
                        </div>
                    </div>

                    <Link
                        className="admin-menu-item logout"
                        to="/login"
                    >
                        <FontAwesomeIcon
                            icon={faArrowRightFromBracket}
                        />
                        <span>Đăng xuất</span>
                    </Link>
                </div>
            </aside>

            <main className="admin-main">
                {children}
            </main>
        </div>
    );
}

export default AdminLayout;