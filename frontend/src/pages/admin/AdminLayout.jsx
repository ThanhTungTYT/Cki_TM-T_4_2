
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
    faGift,
    faUserGear,
    faBell,
    faBoxOpen,
    faFileInvoiceDollar
} from "@fortawesome/free-solid-svg-icons";
import AdminNotificationRealtime from "../../components/AdminNotificationRealtime";
import AdminOverviewCards from "./AdminOverviewCards";
import "./AdminDashboard.css";
import "./AdminSidebar.css";

const menuItems = [
    { label: "Tổng quan", path: "/admin", icon: faHouse },
    { label: "Quản lý đơn hàng", path: "/admin/orders", icon: faClipboardList },
    { label: "Nhà cung cấp", path: "/admin/providers", icon: faStore },
    { label: "Duyệt yêu cầu ĐT", path: "/admin/provider-requests", icon: faClipboardCheck },
    { label: "Quản lý tài khoản", path: "/admin/accounts", icon: faUsers },
    { label: "Quản lý dịch vụ", path: "/admin/services", icon: faTags },
    { label: "Duyệt dịch vụ Provider", path: "/admin/provider-service-approvals", icon: faClipboardCheck },
    { label: "Quản lý giao dịch", path: "/admin/transactions", icon: faCreditCard },
    { label: "Đối soát Provider", path: "/admin/provider-settlements", icon: faFileInvoiceDollar },
    { label: "Quản lý hoàn tiền", path: "/admin/refunds", icon: faMoneyBillTransfer },
    { label: "Quản lý khiếu nại", path: "/admin/complaints", icon: faTriangleExclamation },
    { label: "Ưu đãi & điểm thưởng", path: "/admin/promotions", icon: faGift },
    { label: "Nhân sự & vận hành", path: "/admin/staff-operations", icon: faUserGear },
    { label: "Giám sát thông báo", path: "/admin/outbox", icon: faBell },
    { label: "Đơn hàng khuyến mãi", path: "/admin/reward-orders", icon: faBoxOpen }
];

function getCurrentUser() {
    try {
        return JSON.parse(
            sessionStorage.getItem("user") ||
            localStorage.getItem("user") ||
            "{}"
        );
    } catch {
        return {};
    }
}

function normalizeRole(role) {
    return String(role || "")
        .trim()
        .toUpperCase()
        .replace(/^ROLE_/, "");
}

function AdminLayout({ children }) {
    const location = useLocation();
    const navigate = useNavigate();

    const currentUser = getCurrentUser();
    const currentRole = normalizeRole(currentUser.role);

    const isStaff = currentRole === "STAFF";
    const isAdmin = currentRole === "ADMIN";

    const staffAllowedPaths = [
        "/admin/complaints",
        "/admin/staff-operations",
        "/admin/reward-orders"
    ];

    const visibleMenuItems = isStaff
        ? menuItems.filter(item => staffAllowedPaths.includes(item.path))
        : isAdmin
            ? menuItems
            : [];

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("accessToken");
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("accessToken");
        localStorage.removeItem("user");
        sessionStorage.removeItem("user");

        navigate("/login", { replace: true });
    };

    return (
        <div className="admin-layout">
            {(isAdmin || isStaff) && <AdminNotificationRealtime />}

            <aside className="admin-sidebar">
                <Link
                    to="/"
                    className="admin-brand"
                    style={{
                        textDecoration: "none",
                        color: "inherit"
                    }}
                    title="Trở về trang chủ CleanMate"
                >
                    <div className="admin-brand-icon">
                        <FontAwesomeIcon icon={faHouse} />
                    </div>

                    <div>
                        <strong>CleanMate</strong>
                        <span>ADMIN PANEL</span>
                    </div>
                </Link>

                <div className="admin-menu-title">
                    MENU QUẢN TRỊ
                </div>

                <nav className="admin-menu">
                    {visibleMenuItems.map(item => {
                        const isActive = item.path === "/admin"
                            ? location.pathname === "/admin"
                            : location.pathname === item.path ||
                            location.pathname.startsWith(`${item.path}/`);

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`admin-menu-item ${isActive ? "active" : ""}`}
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
                            {isStaff ? "ST" : "AD"}
                        </div>

                        <div className="admin-user-info">
                            <strong>
                                {currentUser.fullName ||
                                    (isStaff ? "Nhân viên" : "Quản trị viên")}
                            </strong>
                            <span>
                                {isStaff ? "Staff" : "Administrator"}
                            </span>
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
                            font: "inherit"
                        }}
                    >
                        <FontAwesomeIcon icon={faArrowRightFromBracket} />
                        <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>

            <main className="admin-main">
                {isAdmin && location.pathname === "/admin" && (
                    <AdminOverviewCards />
                )}

                {children}
            </main>
        </div>
    );
}

export default AdminLayout;
