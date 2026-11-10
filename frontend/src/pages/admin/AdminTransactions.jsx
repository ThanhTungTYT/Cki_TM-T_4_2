
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
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("token");

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

    if (["FAILED", "ERROR", "CANCELLED", "EXPIRED"].includes(value)) {
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

    if (["FAILED", "ERROR", "CANCELLED", "EXPIRED"].includes(value)) {
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
    const [reconciliation, setReconciliation] = useState(null);

    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [methodFilter, setMethodFilter] = useState("ALL");

    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [selectedProvider, setSelectedProvider] = useState(null);

    const [loading, setLoading] = useState(true);
    const [summaryLoading, setSummaryLoading] = useState(true);
    const [reconciliationLoading, setReconciliationLoading] = useState(true);

    const [error, setError] = useState("");
    const [reconciliationError, setReconciliationError] = useState("");

    const [retry, setRetry] = useState(0);

    const requestJson = async (url, signal) => {
        const token = getToken();

        if (!token) {
            throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        }

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
                (response.status === 401
                    ? "Phiên đăng nhập đã hết hạn."
                    : response.status === 403
                        ? "Tài khoản không có quyền xem dữ liệu tài chính."
                        : `Không thể tải dữ liệu. Mã lỗi: ${response.status}`)
            );
        }

        return body;
    };

    const loadTransactions = useCallback(async (signal) => {
        const body = await requestJson(
            `${API_URL}/admin/transactions`,
            signal
        );

        if (!Array.isArray(body)) {
            throw new Error("Dữ liệu giao dịch từ backend không đúng định dạng.");
        }

        setTransactions(body);
    }, []);

    const loadSummary = useCallback(async (signal) => {
        const params = new URLSearchParams();

        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);

        const query = params.toString();

        const url = `${API_URL}/admin/transactions/finance-summary${query ? `?${query}` : ""}`;

        const body = await requestJson(url, signal);

        setSummary(body);
    }, [fromDate, toDate]);

    const loadReconciliation = useCallback(async (signal) => {
        const params = new URLSearchParams();

        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);

        const query = params.toString();

        const url = `${API_URL}/admin/transactions/provider-reconciliation${query ? `?${query}` : ""}`;

        const body = await requestJson(url, signal);

        if (!body || !Array.isArray(body.providers)) {
            throw new Error("Dữ liệu đối soát Provider không đúng định dạng.");
        }

        setReconciliation(body);
    }, [fromDate, toDate]);

    useEffect(() => {
        const controller = new AbortController();

        async function loadData() {
            setLoading(true);
            setSummaryLoading(true);
            setReconciliationLoading(true);

            setError("");
            setReconciliationError("");

            const results = await Promise.allSettled([
                loadTransactions(controller.signal),
                loadSummary(controller.signal),
                loadReconciliation(controller.signal)
            ]);

            if (controller.signal.aborted) return;

            if (results[0].status === "rejected") {
                setError(
                    results[0].reason?.message ||
                    "Không thể tải danh sách giao dịch."
                );
            }

            if (results[1].status === "rejected") {
                setError(
                    results[1].reason?.message ||
                    "Không thể tải số liệu tổng hợp tài chính."
                );
            }

            if (results[2].status === "rejected") {
                setReconciliationError(
                    results[2].reason?.message ||
                    "Không thể tải dữ liệu đối soát Provider."
                );
            }

            setLoading(false);
            setSummaryLoading(false);
            setReconciliationLoading(false);
        }

        loadData();

        return () => controller.abort();
    }, [
        loadTransactions,
        loadSummary,
        loadReconciliation,
        retry
    ]);

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

    const providers = reconciliation?.providers || [];

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
                            phí sàn, hoàn tiền và đối soát Provider.
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
                    Hệ thống hiện chưa có sổ chi trả và chứng từ thanh toán cho Provider.
                </div>

                <section className="provider-reconciliation-section">
                    <div className="transactions-heading">
                        <div>
                            <h2>
                                <FontAwesomeIcon icon={faBuildingColumns} /> Đối soát Provider
                            </h2>
                            <p>
                                Tổng hợp giá trị dịch vụ từ các đơn đã hoàn thành
                                theo từng nhà cung cấp.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="transaction-view-btn"
                            onClick={refresh}
                            title="Làm mới dữ liệu"
                        >
                            <FontAwesomeIcon icon={faRotate} />
                        </button>
                    </div>

                    {reconciliationError && (
                        <div className="transactions-error" role="alert">
                            <span>{reconciliationError}</span>
                            <button type="button" onClick={refresh}>
                                <FontAwesomeIcon icon={faRotate} /> Thử lại
                            </button>
                        </div>
                    )}

                    <div className="transactions-stats">
                        <div className="transaction-stat-card">
                            <span>Số Provider có đơn hoàn thành</span>
                            <strong>
                                {reconciliationLoading
                                    ? "—"
                                    : reconciliation?.providerCount ?? 0}
                            </strong>
                        </div>

                        <div className="transaction-stat-card">
                            <span>Số đơn hoàn thành</span>
                            <strong>
                                {reconciliationLoading
                                    ? "—"
                                    : reconciliation?.completedBookingCount ?? 0}
                            </strong>
                        </div>

                        <div className="transaction-stat-card">
                            <span>Tổng giá trị dịch vụ</span>
                            <strong className="transaction-green">
                                {reconciliationLoading
                                    ? "—"
                                    : formatCurrency(reconciliation?.serviceValue)}
                            </strong>
                        </div>

                        <div className="transaction-stat-card">
                            <span>Hoàn tiền đã duyệt</span>
                            <strong className="transaction-orange">
                                {reconciliationLoading
                                    ? "—"
                                    : formatCurrency(reconciliation?.approvedRefundAmount)}
                            </strong>
                        </div>

                        <div className="transaction-stat-card">
                            <span>Hoàn tiền đã chuyển</span>
                            <strong className="transaction-red">
                                {reconciliationLoading
                                    ? "—"
                                    : formatCurrency(reconciliation?.transferredRefundAmount)}
                            </strong>
                        </div>
                    </div>

                    <div className="transaction-readonly-note">
                        {reconciliation?.notice ||
                            "Số liệu đối soát được tổng hợp từ các đơn hoàn thành và dữ liệu hoàn tiền."}
                        {" "}
                        Đây chưa phải sổ chi trả Provider. Không được xem số liệu này
                        là khoản tiền đã chuyển cho Provider.
                    </div>

                    <div className="transactions-table-wrapper">
                        <table className="transactions-table">
                            <thead>
                            <tr>
                                <th>Provider</th>
                                <th>Mã Provider</th>
                                <th>Số đơn hoàn thành</th>
                                <th>Giá trị dịch vụ</th>
                                <th>Phí sàn suy ra</th>
                                <th>Hoàn tiền đã duyệt</th>
                                <th>Giá trị tạm tính sau hoàn tiền</th>
                                <th>Chi tiết</th>
                            </tr>
                            </thead>

                            <tbody>
                            {reconciliationLoading && (
                                <tr>
                                    <td colSpan="8" className="transactions-empty">
                                        Đang tải dữ liệu đối soát...
                                    </td>
                                </tr>
                            )}

                            {!reconciliationLoading &&
                                !reconciliationError &&
                                providers.length === 0 && (
                                    <tr>
                                        <td colSpan="8" className="transactions-empty">
                                            Chưa có Provider có đơn hoàn thành trong khoảng thời gian này.
                                        </td>
                                    </tr>
                                )}

                            {!reconciliationLoading &&
                                providers.map((provider) => (
                                    <tr key={provider.partnerId}>
                                        <td>
                                            <strong>
                                                {provider.partnerName || "Chưa cập nhật"}
                                            </strong>
                                            <small>
                                                {provider.partnerStatus || ""}
                                            </small>
                                        </td>

                                        <td>#{provider.partnerId}</td>

                                        <td>
                                            {provider.completedBookingCount ?? 0}
                                        </td>

                                        <td>
                                            {formatCurrency(provider.serviceValue)}
                                        </td>

                                        <td>
                                            {formatCurrency(provider.derivedPlatformFee)}
                                        </td>

                                        <td>
                                            {formatCurrency(provider.approvedRefundAmount)}
                                        </td>

                                        <td>
                                            <strong>
                                                {formatCurrency(
                                                    provider.provisionalValueAfterApprovedRefunds
                                                )}
                                            </strong>
                                        </td>

                                        <td>
                                            <button
                                                type="button"
                                                className="transaction-view-btn"
                                                onClick={() => setSelectedProvider(provider)}
                                                aria-label="Xem chi tiết đối soát Provider"
                                            >
                                                <FontAwesomeIcon icon={faEye} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="transactions-list-section">
                    <div className="transactions-heading">
                        <div>
                            <h2>
                                <FontAwesomeIcon icon={faFileInvoiceDollar} /> Lịch sử giao dịch
                            </h2>
                            <p>
                                Tra cứu các khoản thanh toán khách hàng và trạng thái giao dịch.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="transaction-view-btn"
                            onClick={refresh}
                            title="Làm mới giao dịch"
                        >
                            <FontAwesomeIcon icon={faRotate} />
                        </button>
                    </div>

                    <div className="transactions-filter">
                        <div className="transactions-search">
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                            <input
                                type="text"
                                value={keyword}
                                onChange={(event) => setKeyword(event.target.value)}
                                placeholder="Tìm mã giao dịch, mã đơn, khách hàng, Provider..."
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
                            <option value="vnpay">VNPAY</option>
                            <option value="tiền mặt">Tiền mặt</option>
                            <option value="chuyển khoản ngân hàng">
                                Chuyển khoản ngân hàng
                            </option>
                            <option value="momo">MoMo</option>
                        </select>

                        <div className="transactions-date-filter">
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(event) => setFromDate(event.target.value)}
                                aria-label="Từ ngày"
                            />

                            <span>đến</span>

                            <input
                                type="date"
                                value={toDate}
                                min={fromDate || undefined}
                                onChange={(event) => setToDate(event.target.value)}
                                aria-label="Đến ngày"
                            />
                        </div>

                        <button
                            type="button"
                            className="transaction-reset-btn"
                            onClick={resetFilters}
                        >
                            Xóa bộ lọc
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
                                <th>Provider</th>
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

                                    <td>
                                        {item.bookingCode || `Đơn #${item.bookingId}`}
                                    </td>

                                    <td>
                                        <strong>{item.customerName || "Chưa cập nhật"}</strong>
                                        <small>{item.email || ""}</small>
                                    </td>

                                    <td>{item.partnerName || "Chưa cập nhật"}</td>

                                    <td>
                                        {methodLabel(item.paymentMethod, item.paymentProvider)}
                                    </td>

                                    <td>
                                        {formatDate(item.paidAt || item.createdAt || item.date)}
                                    </td>

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
                </section>

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
                                <strong>
                                    GD{String(selectedTransaction.id).padStart(4, "0")}
                                </strong>

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
                                <strong>
                                    {selectedTransaction.bookingStatus || "Chưa cập nhật"}
                                </strong>

                                <span>Khách hàng</span>
                                <strong>
                                    {selectedTransaction.customerName || "Chưa cập nhật"}
                                </strong>

                                <span>Email</span>
                                <strong>
                                    {selectedTransaction.email || "Chưa cập nhật"}
                                </strong>

                                <span>Số điện thoại</span>
                                <strong>
                                    {selectedTransaction.phone || "Chưa cập nhật"}
                                </strong>

                                <span>Provider</span>
                                <strong>
                                    {selectedTransaction.partnerName || "Chưa cập nhật"}
                                </strong>

                                <span>Phương thức</span>
                                <strong>
                                    {methodLabel(
                                        selectedTransaction.paymentMethod,
                                        selectedTransaction.paymentProvider
                                    )}
                                </strong>

                                <span>Số tiền giao dịch</span>
                                <strong>
                                    {formatCurrency(selectedTransaction.amount)}
                                </strong>

                                <span>Giá trị dịch vụ trong đơn</span>
                                <strong>
                                    {formatCurrency(selectedTransaction.bookingSubtotal)}
                                </strong>

                                <span>Giảm giá</span>
                                <strong>
                                    {formatCurrency(
                                        Number(selectedTransaction.discountAmount || 0) +
                                        Number(selectedTransaction.pointsDiscount || 0)
                                    )}
                                </strong>

                                <span>Tổng tiền đơn</span>
                                <strong>
                                    {formatCurrency(selectedTransaction.bookingTotal)}
                                </strong>

                                <span>Trạng thái thanh toán</span>
                                <strong>{statusLabel(selectedTransaction.status)}</strong>

                                <span>Trạng thái hoàn tiền</span>
                                <strong>
                                    {selectedTransaction.refundStatus || "Chưa có yêu cầu"}
                                </strong>

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

                {selectedProvider && (
                    <div
                        className="transaction-modal-overlay"
                        onClick={() => setSelectedProvider(null)}
                        role="presentation"
                    >
                        <section
                            className="transaction-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="provider-detail-title"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="transaction-modal-heading">
                                <h2 id="provider-detail-title">
                                    Chi tiết đối soát Provider
                                </h2>

                                <button
                                    type="button"
                                    onClick={() => setSelectedProvider(null)}
                                    aria-label="Đóng chi tiết"
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>

                            <div className="transaction-detail-grid">
                                <span>Provider</span>
                                <strong>{selectedProvider.partnerName || "Chưa cập nhật"}</strong>

                                <span>Mã Provider</span>
                                <strong>#{selectedProvider.partnerId}</strong>

                                <span>Trạng thái Provider</span>
                                <strong>{selectedProvider.partnerStatus || "Chưa cập nhật"}</strong>

                                <span>Số đơn hoàn thành</span>
                                <strong>{selectedProvider.completedBookingCount ?? 0}</strong>

                                <span>Tổng giá trị dịch vụ</span>
                                <strong>{formatCurrency(selectedProvider.serviceValue)}</strong>

                                <span>Phí sàn suy ra</span>
                                <strong>{formatCurrency(selectedProvider.derivedPlatformFee)}</strong>

                                <span>Hoàn tiền đã duyệt</span>
                                <strong>{formatCurrency(selectedProvider.approvedRefundAmount)}</strong>

                                <span>Hoàn tiền đã chuyển</span>
                                <strong>{formatCurrency(selectedProvider.transferredRefundAmount)}</strong>

                                <span>Giá trị tạm tính sau hoàn tiền</span>
                                <strong>
                                    {formatCurrency(
                                        selectedProvider.provisionalValueAfterApprovedRefunds
                                    )}
                                </strong>
                            </div>

                            <h3>Danh sách đơn hoàn thành</h3>

                            <div className="transactions-table-wrapper">
                                <table className="transactions-table">
                                    <thead>
                                    <tr>
                                        <th>Mã đơn</th>
                                        <th>Ngày hoàn thành</th>
                                        <th>Giá trị dịch vụ</th>
                                        <th>Tổng tiền đơn</th>
                                        <th>Phí sàn suy ra</th>
                                        <th>Hoàn tiền đã duyệt</th>
                                        <th>Trạng thái hoàn tiền</th>
                                    </tr>
                                    </thead>

                                    <tbody>
                                    {(selectedProvider.bookings || []).map((booking) => (
                                        <tr key={booking.bookingId}>
                                            <td>
                                                {booking.bookingCode ||
                                                    `Đơn #${booking.bookingId}`}
                                            </td>

                                            <td>{formatDate(booking.completedAt)}</td>

                                            <td>{formatCurrency(booking.serviceValue)}</td>

                                            <td>{formatCurrency(booking.bookingTotal)}</td>

                                            <td>
                                                {formatCurrency(booking.derivedPlatformFee)}
                                            </td>

                                            <td>
                                                {formatCurrency(booking.approvedRefundAmount)}
                                            </td>

                                            <td>
                                                {booking.refundStatus || "Không có"}
                                            </td>
                                        </tr>
                                    ))}

                                    {(!selectedProvider.bookings ||
                                        selectedProvider.bookings.length === 0) && (
                                        <tr>
                                            <td colSpan="7" className="transactions-empty">
                                                Không có đơn hàng.
                                            </td>
                                        </tr>
                                    )}
                                    </tbody>
                                </table>
                            </div>

                            <p className="transaction-readonly-note">
                                Dữ liệu này chỉ phục vụ đối soát tạm tính.
                                Chưa có xác nhận khoản chi trả thực tế cho Provider.
                            </p>
                        </section>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

export default AdminTransactions;
