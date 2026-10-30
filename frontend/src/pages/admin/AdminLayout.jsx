
import { useLocation, Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faHouse,
    faClipboardList,
    faStore,
    faUsers,
    faTags,
    faCreditCard,
    faMoneyBillTransfer,
    faArrowRightFromBracket,
    faTriangleExclamation,
    faClipboardCheck,
} from "@fortawesome/free-solid-svg-icons";
import "./AdminDashboard.css";

const menuItems = [
    { label: "Tổng quan", path: "/admin", icon: faHouse },
    { label: "Quản lý đơn hàng", path: "/admin/orders", icon: faClipboardList },
    { label: "Nhà cung cấp", path: "/admin/providers", icon: faStore },
    { label: "Duyệt yêu cầu ĐT", path: "/admin/provider-requests", icon: faClipboardCheck },
    { label: "Quản lý tài khoản", path: "/admin/accounts", icon: faUsers },
    { label: "Quản lý dịch vụ", path: "/admin/services", icon: faTags },
    { label: "Quản lý giao dịch", path: "/admin/transactions", icon: faCreditCard },
    { label: "Quản lý hoàn tiền", path: "/admin/refunds", icon: faMoneyBillTransfer },
    { label: "Quản lý khiếu nại", path: "/admin/complaints", icon: faTriangleExclamation },
];

function AdminLayout({ children }) {
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("accessToken");
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("accessToken");
        navigate("/login");
    };

    return (
        <div className="admin-layout">
            <aside className="admin-sidebar">
                <Link
                    to="/admin"
                    className="admin-brand"
                    style={{ textDecoration: "none", color: "inherit" }}
                >
                    <div className="admin-brand-icon">
                        <FontAwesomeIcon icon={faHouse} />
                    </div>
                    <div>
                        <strong>CleanMate</strong>
                        <span>ADMIN PANEL</span>
                    </div>
                </Link>

                <div className="admin-menu-title">MENU QUẢN TRỊ</div>

                <nav className="admin-menu">
                    {menuItems.map((item) => {
                        const isActive =
                            item.path === "/admin"
                                ? location.pathname === "/admin"
                                : location.pathname === item.path ||
                                location.pathname.startsWith(`${item.path}/`);

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`admin-menu-item ${
                                    isActive ? "active" : ""
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
                        <div className="admin-avatar">AD</div>
                        <div className="admin-user-info">
                            <strong>Quản trị viên</strong>
                            <span>Administrator</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="admin-menu-item logout"
                        onClick={handleLogout}
                        style={{
                            border: 0,
                            background: "transparent",
                            width: "100%",
                            cursor: "pointer",
                            textAlign: "left",
                            font: "inherit",
                        }}
                    >
                        <FontAwesomeIcon icon={faArrowRightFromBracket} />
                        <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>

            <main className="admin-main">
                {children}
            </main>
        </div>
    );
}

export default AdminLayout;
