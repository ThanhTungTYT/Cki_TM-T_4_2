import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faUsers,
    faStore,
    faClipboardList,
    faTriangleExclamation,
    faRotate,
} from "@fortawesome/free-solid-svg-icons";
import "./AdminOverviewCards.css";

const formatNumber = (value) =>
    new Intl.NumberFormat("vi-VN").format(Number(value) || 0);

function AdminOverviewCards() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchOverview = async () => {
        setLoading(true);
        setError("");

        try {
            const token =
                localStorage.getItem("accessToken") ||
                localStorage.getItem("token") ||
                sessionStorage.getItem("accessToken") ||
                sessionStorage.getItem("token");

            const response = await fetch("/api/admin/dashboard/overview", {
                headers: {
                    Accept: "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });

            if (!response.ok) {
                throw new Error(
                    response.status === 401
                        ? "Phiên đăng nhập đã hết hạn."
                        : response.status === 403
                            ? "Bạn không có quyền xem dữ liệu này."
                            : `Không thể tải tổng quan (HTTP ${response.status}).`
                );
            }

            setData(await response.json());
        } catch (err) {
            setError(err.message || "Không thể kết nối máy chủ.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOverview();
    }, []);

    const cards = [
        {
            title: "Tổng tài khoản",
            value: data?.totalUsers,
            description: `${formatNumber(data?.totalCustomers)} khách hàng · ${formatNumber(data?.totalCleaners)} Cleaner`,
            icon: faUsers,
            color: "blue",
            path: "/admin/accounts",
        },
        {
            title: "Provider chờ duyệt",
            value: data?.pendingProviders,
            description: `${formatNumber(data?.activeProviders)} đang hoạt động`,
            icon: faStore,
            color: "purple",
            path: "/admin/provider-requests",
        },
        {
            title: "Đơn hàng chờ xử lý",
            value: data?.pendingBookings,
            description: `${formatNumber(data?.processingBookings)} đơn đang thực hiện`,
            icon: faClipboardList,
            color: "orange",
            path: "/admin/orders",
        },
        {
            title: "Khiếu nại chưa xử lý",
            value: Number(data?.openComplaints || 0) + Number(data?.processingComplaints || 0),
            description: `${formatNumber(data?.resolvedComplaints)} đã giải quyết`,
            icon: faTriangleExclamation,
            color: "red",
            path: "/admin/complaints",
        },
    ];

    return (
        <section className="admin-overview-section">
            <div className="admin-overview-heading">
                <div>
                    <h2>Tình hình quản trị</h2>
                    <p>Số liệu tổng hợp từ dữ liệu hệ thống</p>
                </div>

                <button
                    type="button"
                    className="admin-overview-refresh"
                    onClick={fetchOverview}
                    disabled={loading}
                >
                    <FontAwesomeIcon icon={faRotate} spin={loading} />
                    Làm mới
                </button>
            </div>

            {error && (
                <div className="admin-overview-error" role="alert">
                    {error}
                </div>
            )}

            <div className="admin-overview-grid">
                {cards.map((card) => (
                    <button
                        type="button"
                        key={card.title}
                        className="admin-overview-card"
                        onClick={() => navigate(card.path)}
                        disabled={loading || !data}
                    >
                        <div className="admin-overview-card-top">
                            <span className={`admin-overview-icon ${card.color}`}>
                                <FontAwesomeIcon icon={card.icon} />
                            </span>
                            <span className="admin-overview-arrow">↗</span>
                        </div>

                        <span className="admin-overview-label">
                            {card.title}
                        </span>

                        <strong className="admin-overview-value">
                            {loading ? "..." : formatNumber(card.value)}
                        </strong>

                        <span className="admin-overview-description">
                            {loading ? "Đang tải dữ liệu..." : card.description}
                        </span>
                    </button>
                ))}
            </div>
        </section>
    );
}

export default AdminOverviewCards;