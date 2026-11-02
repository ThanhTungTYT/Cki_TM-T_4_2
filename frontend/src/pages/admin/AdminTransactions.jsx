
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faMagnifyingGlass,
    faEye,
    faXmark,
    faCreditCard,
    faRotate,
    faWallet,
    faFileInvoiceDollar,
    faBuildingColumns
} from "@fortawesome/free-solid-svg-icons";
import "./AdminTransactions.css";

const API_URL = "http://localhost:8080/api";

const getToken = () =>
    sessionStorage.getItem("accessToken") ||
    localStorage.getItem("accessToken");

const formatCurrency = (value) =>
    `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const formatDate = (value) => {
    if (!value) return "Chưa cập nhật";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Chưa cập nhật";

    return date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
};

const statusLabel = (status) => {
    const value = String(status || "").toUpperCase();

    if (["SUCCESS", "PAID", "SUCCESSFUL", "SUCCEEDED"].includes(value)) {
        return "Thành công";
    }

    if (["PENDING", "PROCESSING"].includes(value)) {
        return "Đang chờ";
    }

    if (["FAILED", "ERROR"].includes(value)) {
        return "Thất bại";
    }

    if (["REFUNDED", "FULLY_REFUNDED"].includes(value)) {
        return "Đã hoàn tiền";
    }

    if (value === "PARTIALLY_REFUNDED") {
        return "Hoàn tiền một phần";
    }

    return status || "Chưa xác định";
};

const statusClass = (status) => {
    const value = String(status || "").toUpperCase();

    if (["SUCCESS", "PAID", "SUCCESSFUL", "SUCCEEDED"].includes(value)) {
        return "success";
    }

    if (["PENDING", "PROCESSING"].includes(value)) {
        return "pending";
    }

    if (["FAILED", "ERROR"].includes(value)) {
        return "failed";
    }

    if (["REFUNDED", "FULLY_REFUNDED", "PARTIALLY_REFUNDED"].includes(value)) {
        return "refunded";
    }

    return "unknown";
};

const methodLabel = (method, provider) => {
    const value = `${method || ""} ${provider || ""}`.toUpperCase();

    if (value.includes("VNPAY")) return "VNPAY";
    if (value.includes("CASH")) return "Tiền mặt";
    if (value.includes("BANK")) return "Chuyển khoản ngân hàng";
    if (value.includes("MOMO")) return "MoMo";

    return method || provider || "Chưa cập nhật";
};

function AdminTransactions() {
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState(null);
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [methodFilter, setMethodFilter] = useState("ALL");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [summaryLoading, setSummaryLoading] = useState(true);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);

    const loadTransactions = useCallback(async (signal) => {
        const token = getToken();

        if (!token) {
            throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        }

        const response = await fetch(`${API_URL}/admin/transactions`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`
            },
            signal
        });

        const body = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(
                body?.message ||
                body?.detail ||
                (response.status === 401
                    ? "Phiên đăng nhập đã hết hạn."
                    : response.status === 403
                        ? "Tài khoản không có quyền xem giao dịch."
                        : "Không thể tải danh sách giao dịch.")
            );
        }

        if (!Array.isArray(body)) {
            throw new Error("Dữ liệu giao dịch từ backend không đúng định dạng.");
        }

        setTransactions(body);
    }, []);

    const loadSummary = useCallback(async (signal) => {
        const token = getToken();

        if (!token) {
            throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        }

        const params = new URLSearchParams();

        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);

        const query = params.toString();
        const url = `${API_URL}/admin/transactions/finance-summary${query ? `?${query}` : ""}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`
            },
            signal
        });

        const body = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(
                body?.message ||
                body?.detail ||
                "Không thể tải số liệu tổng hợp tài chính."
            );
        }

        setSummary(body);
    }, [fromDate, toDate]);

    useEffect(() => {
        const controller = new AbortController();

        async function loadData() {
            setLoading(true);
            setSummaryLoading(true);
            setError("");

            try {
                await Promise.all([
                    loadTransactions(controller.signal),
                    loadSummary(controller.signal)
                ]);
            } catch (err) {
                if (err.name !== "AbortError") {
                    setError(err.message || "Không thể tải dữ liệu tài chính.");
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                    setSummaryLoading(false);
                }
            }
        }

        loadData();

        return () => controller.abort();
    }, [loadTransactions, loadSummary, retry]);

    const filteredTransactions = useMemo(() => {
        const search = keyword.trim().toLowerCase();

        return transactions.filter((item) => {
            const status = String(item.status || "").toUpperCase();
            const method = methodLabel(item.paymentMethod, item.paymentProvider);
            const date = item.createdAt || item.date;
            const dateOnly = date ? String(date).slice(0, 10) : "";

            const matchKeyword =
                !search ||
                String(item.id ?? "").toLowerCase().includes(search) ||
                String(item.bookingId ?? "").toLowerCase().includes(search) ||
                String(item.bookingCode ?? "").toLowerCase().includes(search) ||
                String(item.customerName ?? "").toLowerCase().includes(search) ||
                String(item.email ?? "").toLowerCase().includes(search) ||
                String(item.partnerName ?? "").toLowerCase().includes(search) ||
                String(item.reference ?? "").toLowerCase().includes(search) ||
                String(item.txnRef ?? "").toLowerCase().includes(search);

            const matchStatus =
                statusFilter === "ALL" ||
                (statusFilter === "SUCCESS" &&
                    ["SUCCESS", "PAID", "SUCCESSFUL", "SUCCEEDED"].includes(status)) ||
                (statusFilter === "PENDING" &&
                    ["PENDING", "PROCESSING"].includes(status)) ||
                (statusFilter === "FAILED" &&
                    ["FAILED", "ERROR", "CANCELLED", "EXPIRED"].includes(status)) ||
                (statusFilter === "REFUNDED" &&
                    ["REFUNDED", "FULLY_REFUNDED", "PARTIALLY_REFUNDED"].includes(status));

            const matchMethod =
                methodFilter === "ALL" ||
                method.toLowerCase() === methodFilter.toLowerCase();

            const matchFromDate = !fromDate || dateOnly >= fromDate;
            const matchToDate = !toDate || dateOnly <= toDate;

            return matchKeyword &&
                matchStatus &&
                matchMethod &&
                matchFromDate &&
                matchToDate;
        });
    }, [
        transactions,
        keyword,
        statusFilter,
        methodFilter,
        fromDate,
        toDate
    ]);

    const successfulTransactions = transactions.filter((item) =>
        ["SUCCESS", "PAID", "SUCCESSFUL", "SUCCEEDED"].includes(
            String(item.status || "").toUpperCase()
        )
    );

    const pendingCount = transactions.filter((item) =>
        ["PENDING", "PROCESSING"].includes(
            String(item.status || "").toUpperCase()
        )
    ).length;

    const failedCount = transactions.filter((item) =>
        ["FAILED", "ERROR", "CANCELLED", "EXPIRED"].includes(
            String(item.status || "").toUpperCase()
        )
    ).length;

    const resetFilters = () => {
        setKeyword("");
        setStatusFilter("ALL");
        setMethodFilter("ALL");
        setFromDate("");
        setToDate("");
    };

    const refresh = () => {
        setRetry(value => value + 1);
    };

    return (
        <AdminLayout>
            <div className="admin-transactions-page">
                <div className="transactions-heading">
                    <div>
                        <h1>Tài chính và giao dịch</h1>
                        <p>
                            Theo dõi tiền khách thanh toán, đơn hoàn thành,
                            phí sàn và yêu cầu hoàn tiền.
                        </p>
                    </div>

                    <div className="transactions-heading-icon">
                        <FontAwesomeIcon icon={faCreditCard} />
                    </div>
                </div>

                {error && (
                    <div className="transactions-error" role="alert">
                        <span>{error}</span>
                        <button type="button" onClick={refresh}>
                            <FontAwesomeIcon icon={faRotate} /> Thử lại
                        </button>
                    </div>
                )}

                <div className="transactions-stats">
                    <div className="transaction-stat-card">
                        <span>Tiền khách đã thanh toán thành công</span>
                        <strong className="transaction-green">
                            {summaryLoading
                                ? "—"
                                : formatCurrency(summary?.customerCollected)}
                        </strong>
                    </div>

                    <div className="transaction-stat-card">
                        <span>Giá trị đơn đã hoàn thành</span>
                        <strong>
                            {summaryLoading
                                ? "—"
                                : formatCurrency(summary?.completedBookingTotal)}
                        </strong>
                    </div>

                    <div className="transaction-stat-card">
                        <span>Phí sàn suy ra từ snapshot</span>
                        <strong className="transaction-revenue">
                            {summaryLoading
                                ? "—"
                                : formatCurrency(summary?.derivedPlatformFee)}
                        </strong>
                    </div>

                    <div className="transaction-stat-card">
                        <span>Yêu cầu hoàn tiền đang chờ</span>
                        <strong className="transaction-orange">
                            {summaryLoading
                                ? "—"
                                : formatCurrency(summary?.pendingRefundAmount)}
                        </strong>
                    </div>

                    <div className="transaction-stat-card">
                        <span>Hoàn tiền đã duyệt</span>
                        <strong className="transaction-red">
                            {summaryLoading
                                ? "—"
                                : formatCurrency(summary?.approvedRefundAmount)}
                        </strong>
                    </div>
                </div>

                <div className="transaction-readonly-note">
                    {summary?.financeNotice ||
                        "Số liệu tài chính được tổng hợp từ giao dịch, đơn hàng và yêu cầu hoàn tiền đã lưu."}
                    {" "}
                    Hoàn tiền đã duyệt không đồng nghĩa tiền đã được chuyển.
                    Hệ thống hiện chưa có sổ chi trả và chứng từ thanh toán cho Nhà cung cấp.
                </div>

                <div className="transactions-filter">
                    <div className="transactions-search">
                        <FontAwesomeIcon icon={faMagnifyingGlass} />
                        <input
                            type="text"
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            placeholder="Tìm mã giao dịch, mã đơn, khách hàng, Nhà cung cấp..."
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                    >
                        <option value="ALL">Tất cả trạng thái</option>
                        <option value="SUCCESS">Thành công</option>
                        <option value="PENDING">Đang chờ</option>
                        <option value="FAILED">Thất bại</option>
                        <option value="REFUNDED">Đã hoàn tiền</option>
                    </select>

                    <select
                        value={methodFilter}
                        onChange={(event) => setMethodFilter(event.target.value)}
                    >
                        <option value="ALL">Tất cả phương thức</option>
                        <option value="VNPAY">VNPAY</option>
                        <option value="Tiền mặt">Tiền mặt</option>
                        <option value="Chuyển khoản ngân hàng">
                            Chuyển khoản ngân hàng
                        </option>
                        <option value="MoMo">MoMo</option>
                    </select>

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

                    <button type="button" onClick={resetFilters}>
                        Xóa lọc
                    </button>
                </div>

                <div className="transactions-result-summary">
                    <span>
                        Tổng giao dịch: <strong>{loading ? "—" : transactions.length}</strong>
                    </span>
                    <span>
                        Thành công: <strong>{loading ? "—" : successfulTransactions.length}</strong>
                    </span>
                    <span>
                        Đang chờ: <strong>{loading ? "—" : pendingCount}</strong>
                    </span>
                    <span>
                        Thất bại: <strong>{loading ? "—" : failedCount}</strong>
                    </span>
                </div>

                <div className="transactions-table-wrapper">
                    <table className="transactions-table">
                        <thead>
                        <tr>
                            <th>Mã giao dịch</th>
                            <th>Mã đơn hàng</th>
                            <th>Khách hàng</th>
                            <th>Nhà cung cấp</th>
                            <th>Phương thức</th>
                            <th>Thời gian</th>
                            <th>Số tiền</th>
                            <th>Trạng thái</th>
                            <th>Chi tiết</th>
                        </tr>
                        </thead>

                        <tbody>
                        {loading && (
                            <tr>
                                <td colSpan="9" className="transactions-empty">
                                    Đang tải giao dịch...
                                </td>
                            </tr>
                        )}

                        {!loading && !error && filteredTransactions.length === 0 && (
                            <tr>
                                <td colSpan="9" className="transactions-empty">
                                    Không có giao dịch phù hợp.
                                </td>
                            </tr>
                        )}

                        {!loading && filteredTransactions.map((item) => (
                            <tr key={item.id}>
                                <td>GD{String(item.id).padStart(4, "0")}</td>
                                <td>{item.bookingCode || `Đơn #${item.bookingId}`}</td>
                                <td>
                                    <strong>{item.customerName || "Chưa cập nhật"}</strong>
                                    <small>{item.email || ""}</small>
                                </td>
                                <td>{item.partnerName || "Chưa cập nhật"}</td>
                                <td>
                                    {methodLabel(item.paymentMethod, item.paymentProvider)}
                                </td>
                                <td>{formatDate(item.paidAt || item.createdAt || item.date)}</td>
                                <td>{formatCurrency(item.amount)}</td>
                                <td>
                                    <span className={`transaction-status ${statusClass(item.status)}`}>
                                        {statusLabel(item.status)}
                                    </span>
                                </td>
                                <td>
                                    <button
                                        type="button"
                                        className="transaction-view-btn"
                                        onClick={() => setSelectedTransaction(item)}
                                        aria-label="Xem chi tiết giao dịch"
                                    >
                                        <FontAwesomeIcon icon={faEye} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                {!loading && (
                    <div className="transactions-result-count">
                        Hiển thị {filteredTransactions.length} / {transactions.length} giao dịch
                    </div>
                )}

                {selectedTransaction && (
                    <div
                        className="transaction-modal-overlay"
                        onClick={() => setSelectedTransaction(null)}
                        role="presentation"
                    >
                        <section
                            className="transaction-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="transaction-detail-title"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="transaction-modal-heading">
                                <h2 id="transaction-detail-title">Chi tiết giao dịch</h2>
                                <button
                                    type="button"
                                    onClick={() => setSelectedTransaction(null)}
                                    aria-label="Đóng chi tiết"
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>

                            <div className="transaction-detail-grid">
                                <span>Mã giao dịch</span>
                                <strong>GD{String(selectedTransaction.id).padStart(4, "0")}</strong>

                                <span>Mã tham chiếu</span>
                                <strong>
                                    {selectedTransaction.reference ||
                                        selectedTransaction.txnRef ||
                                        "Chưa có"}
                                </strong>

                                <span>Mã đơn hàng</span>
                                <strong>
                                    {selectedTransaction.bookingCode ||
                                        `Đơn #${selectedTransaction.bookingId}`}
                                </strong>

                                <span>Trạng thái đơn hàng</span>
                                <strong>{selectedTransaction.bookingStatus || "Chưa cập nhật"}</strong>

                                <span>Khách hàng</span>
                                <strong>{selectedTransaction.customerName || "Chưa cập nhật"}</strong>

                                <span>Email</span>
                                <strong>{selectedTransaction.email || "Chưa cập nhật"}</strong>

                                <span>Số điện thoại</span>
                                <strong>{selectedTransaction.phone || "Chưa cập nhật"}</strong>

                                <span>Nhà cung cấp</span>
                                <strong>{selectedTransaction.partnerName || "Chưa cập nhật"}</strong>

                                <span>Phương thức</span>
                                <strong>
                                    {methodLabel(
                                        selectedTransaction.paymentMethod,
                                        selectedTransaction.paymentProvider
                                    )}
                                </strong>

                                <span>Số tiền giao dịch</span>
                                <strong>{formatCurrency(selectedTransaction.amount)}</strong>

                                <span>Giá trị dịch vụ trong đơn</span>
                                <strong>{formatCurrency(selectedTransaction.bookingSubtotal)}</strong>

                                <span>Giảm giá</span>
                                <strong>
                                    {formatCurrency(
                                        Number(selectedTransaction.discountAmount || 0) +
                                        Number(selectedTransaction.pointsDiscount || 0)
                                    )}
                                </strong>

                                <span>Tổng tiền đơn</span>
                                <strong>{formatCurrency(selectedTransaction.bookingTotal)}</strong>

                                <span>Trạng thái thanh toán</span>
                                <strong>{statusLabel(selectedTransaction.status)}</strong>

                                <span>Trạng thái hoàn tiền</span>
                                <strong>{selectedTransaction.refundStatus || "Chưa có yêu cầu"}</strong>

                                <span>Số tiền hoàn đã duyệt</span>
                                <strong>
                                    {formatCurrency(selectedTransaction.approvedRefundAmount)}
                                </strong>

                                <span>Thời gian tạo giao dịch</span>
                                <strong>{formatDate(selectedTransaction.createdAt)}</strong>

                                <span>Thời gian thanh toán</span>
                                <strong>{formatDate(selectedTransaction.paidAt)}</strong>
                            </div>

                            <p className="transaction-readonly-note">
                                Đây là màn hình tra cứu. Không sửa trực tiếp giao dịch gốc.
                                Quyết định hoàn tiền được thực hiện tại Quản lý hoàn tiền.
                                Trạng thái duyệt hoàn tiền không xác nhận việc đã chuyển khoản.
                            </p>
                        </section>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

export default AdminTransactions;
