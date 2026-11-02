import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faMagnifyingGlass,
    faEye,
    faRotateLeft,
    faXmark,
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

const CANCELLABLE_STATUSES = [
    "PENDING_PAYMENT",
    "PENDING_PROVIDER",
    "CONFIRMED",
    "ASSIGNED",
];

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
    if (["PENDING_PAYMENT", "PENDING_PROVIDER", "PENDING_COMPLETION"].includes(value)) return "pending";
    if (value === "CONFIRMED") return "confirmed";

    return "processing";
};

const getOrderServiceNames = (order) => {
    if (Array.isArray(order.items) && order.items.length > 0) {
        return order.items
            .map((item) => item.serviceName || item.packageName)
            .filter(Boolean)
            .join(", ") || "Chưa có thông tin dịch vụ";
    }

    return "Chưa có thông tin dịch vụ";
};

const getToken = () =>
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("accessToken") ||
    sessionStorage.getItem("token");

async function apiRequest(url, options = {}) {
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

    const text = await response.text();
    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { message: text };
        }
    }

    if (!response.ok) {
        throw new Error(
            data?.message ||
            data?.detail ||
            data?.error ||
            `Yêu cầu thất bại (HTTP ${response.status}).`
        );
    }

    return data;
}

function mapOrder(order) {
    const status = String(order.status || "").toUpperCase();
    const paymentStatus = String(order.paymentStatus || "UNPAID").toUpperCase();

    return {
        ...order,
        id: order.id,
        code: order.bookingCode || `#${order.id}`,
        customer: order.customerName || "Chưa có thông tin khách hàng",
        phone: order.customerPhone || "—",
        provider: order.partnerName || "Chưa có nhà cung cấp",
        service: getOrderServiceNames(order),
        date: order.scheduledStart || order.createdAt || null,
        amount: Number(order.totalAmount) || 0,
        status,
        payment: paymentStatus,
        paymentMethod: String(order.paymentMethod || "").toUpperCase(),
        items: Array.isArray(order.items) ? order.items : [],
        paymentRecords: Array.isArray(order.paymentRecords) ? order.paymentRecords : [],
        statusHistory: Array.isArray(order.statusHistory) ? order.statusHistory : [],
        version: order.version,
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

    const loadOrders = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const data = await apiRequest(API_BASE);
            const list = Array.isArray(data)
                ? data
                : Array.isArray(data?.content)
                    ? data.content
                    : [];

            setOrders(list.map(mapOrder));
        } catch (err) {
            setOrders([]);
            setError(err.message || "Không thể tải danh sách đơn hàng.");
        } finally {
            setLoading(false);
        }
    }, []);

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
                String(order.provider).toLowerCase().includes(search) ||
                String(order.address || "").toLowerCase().includes(search);

            const matchStatus =
                statusFilter === "Tất cả" || order.status === statusFilter;

            const matchPayment =
                paymentFilter === "Tất cả" || order.payment === paymentFilter;

            const orderDate = order.date ? String(order.date).slice(0, 10) : "";
            const matchFromDate = !fromDate || (orderDate && orderDate >= fromDate);
            const matchToDate = !toDate || (orderDate && orderDate <= toDate);

            return matchKeyword && matchStatus && matchPayment && matchFromDate && matchToDate;
        });
    }, [orders, keyword, statusFilter, paymentFilter, fromDate, toDate]);

    const completedCount = orders.filter((order) => order.status === "COMPLETED").length;

    const pendingCount = orders.filter((order) =>
        ["PENDING_PAYMENT", "PENDING_PROVIDER"].includes(order.status)
    ).length;

    const processingCount = orders.filter((order) =>
        ["CONFIRMED", "ASSIGNED", "EN_ROUTE", "IN_PROGRESS", "PENDING_COMPLETION"].includes(order.status)
    ).length;

    const completedOrderValue = orders
        .filter((order) => order.status === "COMPLETED")
        .reduce((sum, order) => sum + order.amount, 0);

    const resetFilters = () => {
        setKeyword("");
        setStatusFilter("Tất cả");
        setPaymentFilter("Tất cả");
        setFromDate("");
        setToDate("");
        setNotice("");
        setError("");
    };

    const openDetail = async (order) => {
        setSelectedOrder(order);
        setError("");

        try {
            const detail = await apiRequest(`${API_BASE}/${order.id}`);
            if (detail) {
                setSelectedOrder(mapOrder(detail));
            }
        } catch (err) {
            setError(err.message || "Không tải được chi tiết đơn hàng.");
        }
    };

    const cancelOrder = async (order) => {
        if (!CANCELLABLE_STATUSES.includes(order.status)) {
            setError("Đơn đã bắt đầu thực hiện hoặc đã kết thúc. Không thể hủy tại màn hình này.");
            return;
        }

        if (order.version === null || order.version === undefined) {
            setError("Không có phiên bản đơn hàng. Vui lòng tải lại dữ liệu trước khi thao tác.");
            return;
        }

        const reason = window.prompt(`Nhập lý do hủy đơn ${order.code}:`);

        if (reason === null) return;

        if (!reason.trim()) {
            setError("Bạn phải nhập lý do trước khi hủy đơn.");
            return;
        }

        let refundPlan = "";

        if (order.payment === "PAID") {
            refundPlan = window.prompt(
                `Đơn ${order.code} đã thanh toán.\nNhập kế hoạch xử lý Customer/refund (chưa tự động hoàn tiền):`
            );

            if (refundPlan === null) return;

            if (!refundPlan.trim()) {
                setError("Đơn đã thanh toán cần có kế hoạch xử lý Customer/refund.");
                return;
            }
        }

        const confirmed = window.confirm(
            order.payment === "PAID"
                ? `Xác nhận hủy đơn ${order.code}?\nLưu ý: thao tác này không tự động hoàn tiền.`
                : `Bạn có chắc chắn muốn hủy đơn ${order.code}?`
        );

        if (!confirmed) return;

        setBusyId(order.id);
        setError("");
        setNotice("");

        try {
            await apiRequest(`${API_BASE}/${order.id}/actions/cancel`, {
                method: "POST",
                body: JSON.stringify({
                    version: order.version,
                    note: reason.trim(),
                    refundPlan: refundPlan.trim(),
                }),
            });

            setNotice(
                order.payment === "PAID"
                    ? `Đã hủy đơn ${order.code}. Khoản thanh toán cần được xử lý refund riêng.`
                    : `Đã hủy đơn ${order.code}.`
            );

            await loadOrders();

            if (selectedOrder?.id === order.id) {
                const detail = await apiRequest(`${API_BASE}/${order.id}`);
                setSelectedOrder(mapOrder(detail));
            }
        } catch (err) {
            setError(err.message || "Không thể hủy đơn hàng. Vui lòng tải lại dữ liệu.");
        } finally {
            setBusyId(null);
        }
    };

    const canAdminCancel = (order) =>
        CANCELLABLE_STATUSES.includes(order.status);

    return (
        <AdminLayout>
            <div className="admin-orders-page">
                <div className="orders-heading">
                    <div>
                        <h1>Quản lý đơn hàng</h1>
                        <p>Theo dõi trạng thái, thanh toán, lịch thực hiện và lịch sử đơn hàng.</p>
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
                        <span>Giá trị đơn hoàn tất</span>
                        <strong className="order-revenue">{formatCurrency(completedOrderValue)}</strong>
                    </div>
                </div>

                <div className="orders-content">
                    <div className="orders-content-heading">
                        <div>
                            <h2>Danh sách đơn hàng</h2>
                            <p>Giá trị đơn hoàn tất là tổng giá trị booking COMPLETED, không đồng nghĩa tiền đã thu hoặc doanh thu sau đối soát.</p>
                        </div>
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
                                placeholder="Tìm mã đơn, khách hàng, SĐT, Provider, địa chỉ..."
                                value={keyword}
                                onChange={(event) => setKeyword(event.target.value)}
                            />
                        </div>

                        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                            <option value="Tất cả">Tất cả trạng thái</option>
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>

                        <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
                            <option value="Tất cả">Tất cả thanh toán</option>
                            <option value="PAID">Đã thanh toán</option>
                            <option value="UNPAID">Chưa thanh toán</option>
                        </select>

                        <button className="order-reset-btn" type="button" onClick={resetFilters}>
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
                        <span>Tìm thấy <strong>{filteredOrders.length}</strong> đơn hàng</span>
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
                                    <td colSpan="8" className="order-empty">Đang tải danh sách đơn hàng...</td>
                                </tr>
                            )}

                            {!loading && filteredOrders.map((order) => (
                                <tr key={order.id}>
                                    <td><strong>{order.code}</strong></td>
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
                                    <td className="order-amount">{formatCurrency(order.amount)}</td>
                                    <td>
                                            <span className={`order-payment ${order.payment === "PAID" ? "payment-paid" : "payment-unpaid"}`}>
                                                {PAYMENT_LABELS[order.payment] || "Chưa thanh toán"}
                                            </span>
                                    </td>
                                    <td>
                                            <span className={`order-status order-status-${getStatusClass(order.status)}`}>
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
                                            {canAdminCancel(order) && (
                                                <button
                                                    className="order-cancel-btn"
                                                    title="Hủy đơn trước khi bắt đầu"
                                                    type="button"
                                                    disabled={busyId === order.id}
                                                    onClick={() => cancelOrder(order)}
                                                >
                                                    <FontAwesomeIcon icon={faXmark} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {!loading && filteredOrders.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="order-empty">
                                        {error ? "Không tải được dữ liệu đơn hàng." : "Không tìm thấy đơn hàng phù hợp."}
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {selectedOrder && (
                    <div className="order-modal-overlay" onClick={() => setSelectedOrder(null)}>
                        <div className="order-modal" onClick={(event) => event.stopPropagation()}>
                            <div className="order-modal-header">
                                <h2>Chi tiết đơn hàng {selectedOrder.code}</h2>
                                <button type="button" onClick={() => setSelectedOrder(null)} aria-label="Đóng">
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>

                            <div className="order-detail">
                                <p><strong>Khách hàng:</strong> {selectedOrder.customer}</p>
                                <p><strong>Số điện thoại:</strong> {selectedOrder.phone}</p>
                                <p><strong>Dịch vụ:</strong> {selectedOrder.service}</p>
                                <p><strong>Nhà cung cấp:</strong> {selectedOrder.provider}</p>
                                <p><strong>Địa chỉ:</strong> {selectedOrder.address || "—"}</p>
                                <p><strong>Ngày tạo đơn:</strong> {formatDate(selectedOrder.createdAt)}</p>
                                <p><strong>Lịch thực hiện:</strong> {formatDate(selectedOrder.date)} {formatTime(selectedOrder.date)}</p>
                                <p><strong>Tổng tiền:</strong> {formatCurrency(selectedOrder.amount)}</p>
                                <p>
                                    <strong>Phương thức:</strong>{" "}
                                    {selectedOrder.paymentMethod === "CASH"
                                        ? "Tiền mặt khi hoàn tất"
                                        : selectedOrder.paymentMethod === "VNPAY"
                                            ? "VNPay"
                                            : selectedOrder.paymentMethod || "—"}
                                </p>
                                <p><strong>Thanh toán:</strong> {PAYMENT_LABELS[selectedOrder.payment] || "Chưa thanh toán"}</p>
                                <p><strong>Trạng thái đơn:</strong> {getStatusLabel(selectedOrder.status)}</p>
                                <p><strong>Ghi chú khách hàng:</strong> {selectedOrder.customerNote || "Không có"}</p>
                                <p><strong>Lý do hủy:</strong> {selectedOrder.cancelReason || "Không có"}</p>
                                <p><strong>Phiên bản đơn:</strong> {selectedOrder.version ?? "—"}</p>

                                {selectedOrder.cancellationNeedsRefundReview && (
                                    <div className="orders-message orders-message-error">
                                        Đơn đã hủy nhưng có khoản thanh toán thành công. Cần kiểm tra và xử lý refund riêng; trạng thái hủy đơn không có nghĩa là đã hoàn tiền.
                                    </div>
                                )}

                                {selectedOrder.items.length > 0 && (
                                    <>
                                        <p><strong>Snapshot dịch vụ tại thời điểm đặt:</strong></p>
                                        {selectedOrder.items.map((item, index) => (
                                            <p key={item.id || index}>
                                                {item.serviceName || item.packageName || "Dịch vụ"}
                                                {" — SL: "}{item.quantity || 1}
                                                {" — Đơn giá: "}{formatCurrency(item.unitPrice)}
                                                {" — Thành tiền: "}{formatCurrency(item.totalPrice)}
                                            </p>
                                        ))}
                                    </>
                                )}

                                {selectedOrder.paymentRecords.length > 0 && (
                                    <>
                                        <p><strong>Lịch sử thanh toán:</strong></p>
                                        {selectedOrder.paymentRecords.map((payment) => (
                                            <div key={payment.id}>
                                                <p>
                                                    {payment.provider || payment.method || "Thanh toán"}
                                                    {" — "}{formatCurrency(payment.amount)}
                                                    {" — "}{payment.status || "Chưa xác định"}
                                                </p>
                                                <p>
                                                    <small>
                                                        Mã giao dịch: {payment.transactionCode || payment.txnRef || "—"}
                                                        {" · "}Ngày thanh toán: {formatDate(payment.paidAt)}
                                                    </small>
                                                </p>
                                            </div>
                                        ))}
                                    </>
                                )}

                                {selectedOrder.statusHistory.length > 0 && (
                                    <>
                                        <p><strong>Timeline trạng thái:</strong></p>
                                        {selectedOrder.statusHistory.map((history, index) => (
                                            <div key={history.id || index}>
                                                <p>
                                                    <strong>
                                                        {getStatusLabel(history.oldStatus || "Mới")}
                                                        {" → "}
                                                        {getStatusLabel(history.newStatus)}
                                                    </strong>
                                                </p>
                                                <p>
                                                    {history.changedByName
                                                        ? `Người thực hiện: ${history.changedByName}`
                                                        : "Người thực hiện: Hệ thống"}
                                                    {history.createdAt
                                                        ? ` · ${formatDate(history.createdAt)} ${formatTime(history.createdAt)}`
                                                        : ""}
                                                </p>
                                                {history.note && <p>{history.note}</p>}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>

                            <div className="order-modal-footer">
                                {canAdminCancel(selectedOrder) && (
                                    <button
                                        className="order-cancel-btn"
                                        type="button"
                                        disabled={busyId === selectedOrder.id}
                                        onClick={() => cancelOrder(selectedOrder)}
                                    >
                                        Hủy đơn
                                    </button>
                                )}
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