import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faMagnifyingGlass,
    faEye,
    faRotateLeft,
    faXmark,
    faCheck,
    faTruck,
    faArrowsRotate,
} from "@fortawesome/free-solid-svg-icons";
import "./AdminOrders.css";

const API_BASE = "http://localhost:8080/api/admin/orders";

const STATUS_LABELS = {
    PENDING_PAYMENT: "Chờ thanh toán",
    PENDING_PROVIDER: "Chờ xác nhận",
    CONFIRMED: "Đã xác nhận",
    ASSIGNED: "Đã phân công",
    EN_ROUTE: "Đang di chuyển",
    IN_PROGRESS: "Đang thực hiện",
    PENDING_COMPLETION: "Chờ nghiệm thu",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã hủy",
    REJECTED: "Bị từ chối",
    EXPIRED: "Hết hạn",
};

const PAYMENT_LABELS = {
    PAID: "Đã thanh toán",
    UNPAID: "Chưa thanh toán",
};

const ACTIONS_BY_STATUS = {
    PENDING_PAYMENT: [
        { action: "cancel", label: "Hủy đơn", icon: faXmark, style: "cancel" },
    ],
    PENDING_PROVIDER: [
        { action: "provider-accept", label: "Xác nhận", icon: faCheck, style: "approve" },
        { action: "provider-reject", label: "Từ chối", icon: faXmark, style: "cancel" },
        { action: "cancel", label: "Hủy đơn", icon: faXmark, style: "cancel" },
    ],
    CONFIRMED: [
        { action: "assign-cleaner", label: "Phân công", icon: faCheck, style: "approve" },
        { action: "cancel", label: "Hủy đơn", icon: faXmark, style: "cancel" },
    ],
    ASSIGNED: [
        { action: "start-travel", label: "Bắt đầu di chuyển", icon: faTruck, style: "approve" },
        { action: "cancel", label: "Hủy đơn", icon: faXmark, style: "cancel" },
    ],
    EN_ROUTE: [
        { action: "start-job", label: "Bắt đầu làm", icon: faTruck, style: "approve" },
    ],
    IN_PROGRESS: [
        { action: "submit-completion", label: "Gửi nghiệm thu", icon: faCheck, style: "approve" },
    ],
    PENDING_COMPLETION: [
        { action: "customer-accept", label: "Xác nhận hoàn thành", icon: faCheck, style: "approve" },
        { action: "cancel", label: "Hủy đơn", icon: faXmark, style: "cancel" },
    ],
};

const formatCurrency = (value) =>
    new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    }).format(Number(value) || 0);

const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("vi-VN");
};

const formatTime = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
    });
};

const getStatusLabel = (status) =>
    STATUS_LABELS[String(status || "").toUpperCase()] || status || "Không rõ";

const getStatusClass = (status) => {
    const value = String(status || "").toUpperCase();

    if (value === "COMPLETED") return "completed";
    if (["CANCELLED", "REJECTED", "EXPIRED"].includes(value)) return "cancelled";
    if (["PENDING_PAYMENT", "PENDING_PROVIDER", "PENDING_COMPLETION"].includes(value)) {
        return "pending";
    }
    if (value === "CONFIRMED") return "confirmed";

    return "processing";
};

const getOrderServiceNames = (order) => {
    if (Array.isArray(order.items) && order.items.length > 0) {
        return order.items
            .map((item) => item.serviceName || item.packageName || "Dịch vụ")
            .filter(Boolean)
            .join(", ");
    }

    return "Chưa có thông tin dịch vụ";
};

function mapOrder(order) {
    return {
        ...order,
        id: order.id,
        code: order.bookingCode || `#${order.id}`,
        customer: order.customerName || "Khách hàng",
        phone: order.customerPhone || "Chưa có số điện thoại",
        provider: order.partnerName || "Chưa phân công",
        service: getOrderServiceNames(order),
        date: order.scheduledStart || order.createdAt || null,
        amount: Number(order.totalAmount) || 0,
        status: String(order.status || "").toUpperCase(),
        payment: String(order.paymentStatus || "UNPAID").toUpperCase(),
    };
}

function AdminOrders() {
    const [orders, setOrders] = useState([]);
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("Tất cả");
    const [paymentFilter, setPaymentFilter] = useState("Tất cả");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const getToken = () =>
        localStorage.getItem("accessToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("accessToken") ||
        sessionStorage.getItem("token");

    const request = useCallback(async (url, options = {}) => {
        const token = getToken();

        const response = await fetch(url, {
            ...options,
            headers: {
                Accept: "application/json",
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...options.headers,
            },
        });

        if (!response.ok) {
            let message = `Yêu cầu thất bại (HTTP ${response.status}).`;

            try {
                const data = await response.json();
                message = data.message || data.error || message;
            } catch {
                try {
                    const text = await response.text();
                    if (text) message = text;
                } catch {
                    // Giữ thông báo HTTP mặc định.
                }
            }

            throw new Error(message);
        }

        if (response.status === 204) return null;
        return response.json();
    }, []);

    const loadOrders = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const data = await request(API_BASE);
            const list = Array.isArray(data)
                ? data
                : Array.isArray(data.content)
                    ? data.content
                    : [];

            setOrders(list.map(mapOrder));
        } catch (err) {
            setError(
                err.message ||
                "Không thể tải đơn hàng. Hãy kiểm tra backend và quyền Admin."
            );
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [request]);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    const filteredOrders = useMemo(() => {
        const search = keyword.trim().toLowerCase();

        return orders.filter((order) => {
            const matchKeyword =
                !search ||
                String(order.code).toLowerCase().includes(search) ||
                String(order.customer).toLowerCase().includes(search) ||
                String(order.phone).toLowerCase().includes(search) ||
                String(order.service).toLowerCase().includes(search) ||
                String(order.provider).toLowerCase().includes(search);

            const matchStatus =
                statusFilter === "Tất cả" || order.status === statusFilter;

            const matchPayment =
                paymentFilter === "Tất cả" || order.payment === paymentFilter;

            const orderDate = order.date
                ? String(order.date).slice(0, 10)
                : "";

            const matchFromDate = !fromDate || (orderDate && orderDate >= fromDate);
            const matchToDate = !toDate || (orderDate && orderDate <= toDate);

            return (
                matchKeyword &&
                matchStatus &&
                matchPayment &&
                matchFromDate &&
                matchToDate
            );
        });
    }, [orders, keyword, statusFilter, paymentFilter, fromDate, toDate]);

    const completedCount = orders.filter(
        (order) => order.status === "COMPLETED"
    ).length;

    const pendingCount = orders.filter((order) =>
        ["PENDING_PAYMENT", "PENDING_PROVIDER"].includes(order.status)
    ).length;

    const processingCount = orders.filter((order) =>
        ["CONFIRMED", "ASSIGNED", "EN_ROUTE", "IN_PROGRESS", "PENDING_COMPLETION"].includes(
            order.status
        )
    ).length;

    const totalRevenue = orders
        .filter((order) => order.status === "COMPLETED")
        .reduce((sum, order) => sum + order.amount, 0);

    const resetFilters = () => {
        setKeyword("");
        setStatusFilter("Tất cả");
        setPaymentFilter("Tất cả");
        setFromDate("");
        setToDate("");
        setNotice("");
    };

    const executeAction = async (order, action) => {
        const actionLabels = {
            cancel: "hủy đơn hàng",
            "provider-accept": "xác nhận đơn hàng",
            "provider-reject": "từ chối đơn hàng",
            "assign-cleaner": "phân công đơn hàng",
            "start-travel": "bắt đầu di chuyển",
            "start-job": "bắt đầu thực hiện",
            "submit-completion": "gửi yêu cầu nghiệm thu",
            "customer-accept": "xác nhận hoàn thành đơn hàng",
        };

        const label = actionLabels[action] || action;

        if (!window.confirm(`Bạn có chắc muốn ${label} ${order.code}?`)) {
            return;
        }

        setBusyId(order.id);
        setError("");
        setNotice("");

        try {
            await request(
                `${API_BASE}/${order.id}/actions/${action}`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        version: order.version,
                        note: `Thao tác từ trang quản lý đơn hàng Admin: ${label}`,
                    }),
                }
            );

            setNotice(`Đã gửi yêu cầu ${label} thành công.`);
            await loadOrders();

            if (selectedOrder?.id === order.id) {
                const detail = await request(`${API_BASE}/${order.id}`);
                setSelectedOrder(mapOrder(detail));
            }
        } catch (err) {
            setError(
                err.message ||
                "Không thể cập nhật trạng thái. Vui lòng tải lại dữ liệu."
            );
        } finally {
            setBusyId(null);
        }
    };

    const openDetail = async (order) => {
        setSelectedOrder(order);
        setError("");

        try {
            const detail = await request(`${API_BASE}/${order.id}`);
            setSelectedOrder(mapOrder(detail));
        } catch (err) {
            setError(err.message || "Không tải được chi tiết đơn hàng.");
        }
    };

    return (
        <AdminLayout>
            <div className="admin-orders-page">
                <div className="orders-heading">
                    <div>
                        <h1>Quản lý đơn hàng</h1>
                        <p>Theo dõi trạng thái, thanh toán và tiến độ đơn hàng.</p>
                    </div>

                    <div className="orders-heading-icon">
                        <FontAwesomeIcon icon={faTruck} />
                    </div>
                </div>

                {error && (
                    <div className="orders-message orders-message-error" role="alert">
                        {error}
                    </div>
                )}

                {notice && (
                    <div className="orders-message orders-message-success" role="status">
                        {notice}
                    </div>
                )}

                <div className="orders-stats">
                    <div className="order-stat-card">
                        <span>Tổng đơn hàng</span>
                        <strong>{orders.length}</strong>
                    </div>

                    <div className="order-stat-card">
                        <span>Chờ xử lý</span>
                        <strong className="order-orange">{pendingCount}</strong>
                    </div>

                    <div className="order-stat-card">
                        <span>Đang xử lý</span>
                        <strong className="order-blue">{processingCount}</strong>
                    </div>

                    <div className="order-stat-card">
                        <span>Hoàn thành</span>
                        <strong className="order-green">{completedCount}</strong>
                    </div>

                    <div className="order-stat-card">
                        <span>Giá trị đơn hoàn thành</span>
                        <strong className="order-revenue">
                            {formatCurrency(totalRevenue)}
                        </strong>
                    </div>
                </div>

                <div className="orders-content">
                    <div className="orders-content-heading">
                        <h2>Danh sách đơn hàng</h2>

                        <button
                            className="order-reset-btn"
                            type="button"
                            onClick={loadOrders}
                            disabled={loading}
                        >
                            <FontAwesomeIcon icon={faArrowsRotate} />
                            Tải lại
                        </button>
                    </div>

                    <div className="orders-filters">
                        <div className="order-search">
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                            <input
                                type="text"
                                placeholder="Tìm mã đơn, khách hàng, SĐT, dịch vụ..."
                                value={keyword}
                                onChange={(event) => setKeyword(event.target.value)}
                            />
                        </div>

                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                        >
                            <option value="Tất cả">Tất cả trạng thái</option>
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>

                        <select
                            value={paymentFilter}
                            onChange={(event) => setPaymentFilter(event.target.value)}
                        >
                            <option value="Tất cả">Tất cả thanh toán</option>
                            <option value="PAID">Đã thanh toán</option>
                            <option value="UNPAID">Chưa thanh toán</option>
                        </select>

                        <button
                            className="order-reset-btn"
                            type="button"
                            onClick={resetFilters}
                        >
                            <FontAwesomeIcon icon={faRotateLeft} />
                            Đặt lại
                        </button>
                    </div>

                    <div className="orders-date-filters">
                        <label>
                            Từ ngày
                            <input
                                type="date"
                                value={fromDate}
                                max={toDate || undefined}
                                onChange={(event) => setFromDate(event.target.value)}
                            />
                        </label>

                        <label>
                            Đến ngày
                            <input
                                type="date"
                                value={toDate}
                                min={fromDate || undefined}
                                onChange={(event) => setToDate(event.target.value)}
                            />
                        </label>

                        <span>
                            Tìm thấy <strong>{filteredOrders.length}</strong> đơn hàng
                        </span>
                    </div>

                    <div className="orders-table-wrapper">
                        <table className="orders-table">
                            <thead>
                            <tr>
                                <th>Mã đơn</th>
                                <th>Khách hàng</th>
                                <th>Dịch vụ</th>
                                <th>Lịch đặt</th>
                                <th>Tổng tiền</th>
                                <th>Thanh toán</th>
                                <th>Trạng thái</th>
                                <th>Thao tác</th>
                            </tr>
                            </thead>

                            <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan="8" className="order-empty">
                                        Đang tải danh sách đơn hàng...
                                    </td>
                                </tr>
                            )}

                            {!loading && filteredOrders.map((order) => {
                                const actions = ACTIONS_BY_STATUS[order.status] || [];

                                return (
                                    <tr key={order.id}>
                                        <td>
                                            <strong>{order.code}</strong>
                                        </td>

                                        <td>
                                            <strong>{order.customer}</strong>
                                            <small>{order.phone}</small>
                                        </td>

                                        <td>
                                            <span>{order.service}</span>
                                            <small>{order.provider}</small>
                                        </td>

                                        <td>
                                            {formatDate(order.date)}
                                            <small>{formatTime(order.date)}</small>
                                        </td>

                                        <td className="order-amount">
                                            {formatCurrency(order.amount)}
                                        </td>

                                        <td>
                                                <span
                                                    className={`order-payment ${
                                                        order.payment === "PAID"
                                                            ? "payment-paid"
                                                            : "payment-unpaid"
                                                    }`}
                                                >
                                                    {PAYMENT_LABELS[order.payment] || "Chưa thanh toán"}
                                                </span>
                                        </td>

                                        <td>
                                                <span
                                                    className={`order-status order-status-${getStatusClass(
                                                        order.status
                                                    )}`}
                                                >
                                                    {getStatusLabel(order.status)}
                                                </span>
                                        </td>

                                        <td>
                                            <div className="order-actions">
                                                <button
                                                    className="order-view-btn"
                                                    title="Xem chi tiết"
                                                    type="button"
                                                    onClick={() => openDetail(order)}
                                                >
                                                    <FontAwesomeIcon icon={faEye} />
                                                </button>

                                                {actions.map((action) => (
                                                    <button
                                                        key={action.action}
                                                        className={
                                                            action.style === "cancel"
                                                                ? "order-cancel-btn"
                                                                : "order-approve-btn"
                                                        }
                                                        title={action.label}
                                                        type="button"
                                                        disabled={busyId === order.id}
                                                        onClick={() =>
                                                            executeAction(order, action.action)
                                                        }
                                                    >
                                                        <FontAwesomeIcon icon={action.icon} />
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {!loading && filteredOrders.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="order-empty">
                                        Không tìm thấy đơn hàng phù hợp.
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {selectedOrder && (
                    <div
                        className="order-modal-overlay"
                        onClick={() => setSelectedOrder(null)}
                    >
                        <div
                            className="order-modal"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="order-modal-header">
                                <h2>Chi tiết đơn hàng {selectedOrder.code}</h2>
                                <button
                                    type="button"
                                    onClick={() => setSelectedOrder(null)}
                                    aria-label="Đóng"
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>

                            <div className="order-detail">
                                <p><strong>Khách hàng:</strong> {selectedOrder.customer}</p>
                                <p><strong>Số điện thoại:</strong> {selectedOrder.phone}</p>
                                <p><strong>Dịch vụ:</strong> {selectedOrder.service}</p>
                                <p><strong>Nhà cung cấp:</strong> {selectedOrder.provider}</p>
                                <p><strong>Địa chỉ:</strong> {selectedOrder.address || "—"}</p>
                                <p><strong>Ngày đặt:</strong> {formatDate(selectedOrder.createdAt)}</p>
                                <p><strong>Lịch thực hiện:</strong> {formatDate(selectedOrder.date)} {formatTime(selectedOrder.date)}</p>
                                <p><strong>Tổng tiền:</strong> {formatCurrency(selectedOrder.amount)}</p>
                                <p><strong>Thanh toán:</strong> {PAYMENT_LABELS[selectedOrder.payment] || "Chưa thanh toán"}</p>
                                <p><strong>Trạng thái:</strong> {getStatusLabel(selectedOrder.status)}</p>
                                <p><strong>Ghi chú khách hàng:</strong> {selectedOrder.customerNote || "Không có"}</p>
                                <p><strong>Lý do hủy:</strong> {selectedOrder.cancelReason || "Không có"}</p>

                                {Array.isArray(selectedOrder.items) &&
                                    selectedOrder.items.length > 0 && (
                                        <>
                                            <p><strong>Chi tiết dịch vụ:</strong></p>
                                            {selectedOrder.items.map((item) => (
                                                <p key={item.id}>
                                                    {item.serviceName || item.packageName || "Dịch vụ"}
                                                    {" — SL: "}{item.quantity || 1}
                                                    {" — "}{formatCurrency(item.totalPrice || item.unitPrice)}
                                                </p>
                                            ))}
                                        </>
                                    )}

                                {Array.isArray(selectedOrder.statusHistory) &&
                                    selectedOrder.statusHistory.length > 0 && (
                                        <>
                                            <p><strong>Lịch sử trạng thái:</strong></p>
                                            {selectedOrder.statusHistory.map((history, index) => (
                                                <p key={history.id || index}>
                                                    {history.oldStatus || "Mới"}
                                                    {" → "}
                                                    {history.newStatus || "—"}
                                                    {history.createdAt
                                                        ? ` (${formatDate(history.createdAt)} ${formatTime(history.createdAt)})`
                                                        : ""}
                                                    {history.note ? ` — ${history.note}` : ""}
                                                </p>
                                            ))}
                                        </>
                                    )}
                            </div>

                            <div className="order-modal-footer">
                                {(ACTIONS_BY_STATUS[selectedOrder.status] || []).map((action) => (
                                    <button
                                        key={action.action}
                                        className={
                                            action.style === "cancel"
                                                ? "order-cancel-btn"
                                                : "order-approve-btn"
                                        }
                                        type="button"
                                        disabled={busyId === selectedOrder.id}
                                        onClick={() =>
                                            executeAction(selectedOrder, action.action)
                                        }
                                    >
                                        {action.label}
                                    </button>
                                ))}

                                <button
                                    className="order-modal-close"
                                    type="button"
                                    onClick={() => setSelectedOrder(null)}
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

export default AdminOrders;