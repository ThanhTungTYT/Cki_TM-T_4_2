
import { useState } from "react";
import AdminLayout from "./AdminLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faMagnifyingGlass,
    faEye,
    faRotateLeft,
    faXmark,
    faCreditCard,
    faCheck,
    faRotate,
} from "@fortawesome/free-solid-svg-icons";
import "./AdminTransactions.css";

const initialTransactions = [
    {
        id: "GD001",
        orderId: "CM001",
        customer: "Nguyễn Văn An",
        email: "an@gmail.com",
        method: "Chuyển khoản ngân hàng",
        date: "2026-10-18",
        amount: 500000,
        status: "Thành công",
        reference: "FT261018001",
    },
    {
        id: "GD002",
        orderId: "CM002",
        customer: "Trần Thị Bình",
        email: "binh@gmail.com",
        method: "Ví điện tử",
        date: "2026-10-19",
        amount: 800000,
        status: "Thành công",
        reference: "FT261019002",
    },
    {
        id: "GD003",
        orderId: "CM003",
        customer: "Lê Minh Tuấn",
        email: "tuan@gmail.com",
        method: "Chuyển khoản ngân hàng",
        date: "2026-10-19",
        amount: 350000,
        status: "Chờ xác nhận",
        reference: "FT261019003",
    },
    {
        id: "GD004",
        orderId: "CM004",
        customer: "Phạm Ngọc Hà",
        email: "ha@gmail.com",
        method: "Tiền mặt",
        date: "2026-10-17",
        amount: 250000,
        status: "Thất bại",
        reference: "FT261017004",
    },
    {
        id: "GD005",
        orderId: "CM005",
        customer: "Đỗ Hoàng Nam",
        email: "nam@gmail.com",
        method: "Chuyển khoản ngân hàng",
        date: "2026-10-16",
        amount: 1200000,
        status: "Đã hoàn tiền",
        reference: "FT261016005",
    },
];

const formatCurrency = (amount) =>
    amount.toLocaleString("vi-VN") + " đ";

function AdminTransactions() {
    const [transactions, setTransactions] = useState(initialTransactions);
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("Tất cả");
    const [methodFilter, setMethodFilter] = useState("Tất cả");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    const filteredTransactions = transactions.filter((item) => {
        const search = keyword.trim().toLowerCase();

        const matchKeyword =
            item.id.toLowerCase().includes(search) ||
            item.orderId.toLowerCase().includes(search) ||
            item.customer.toLowerCase().includes(search) ||
            item.email.toLowerCase().includes(search) ||
            item.reference.toLowerCase().includes(search);

        const matchStatus =
            statusFilter === "Tất cả" || item.status === statusFilter;

        const matchMethod =
            methodFilter === "Tất cả" || item.method === methodFilter;

        const matchFromDate = !fromDate || item.date >= fromDate;
        const matchToDate = !toDate || item.date <= toDate;

        return (
            matchKeyword &&
            matchStatus &&
            matchMethod &&
            matchFromDate &&
            matchToDate
        );
    });

    const successfulTransactions = transactions.filter(
        (item) => item.status === "Thành công"
    );

    const totalSuccessful = successfulTransactions.reduce(
        (sum, item) => sum + item.amount,
        0
    );

    const pendingCount = transactions.filter(
        (item) => item.status === "Chờ xác nhận"
    ).length;

    const failedCount = transactions.filter(
        (item) => item.status === "Thất bại"
    ).length;

    const refundCount = transactions.filter(
        (item) => item.status === "Đã hoàn tiền"
    ).length;

    const updateStatus = (id, newStatus) => {
        const messages = {
            "Thành công": "Xác nhận giao dịch này thành công?",
            "Thất bại": "Bạn có chắc muốn đánh dấu giao dịch thất bại?",
            "Đã hoàn tiền":
                "Xác nhận đã hoàn tiền cho giao dịch này? Hãy kiểm tra việc hoàn tiền thực tế trước khi xác nhận.",
        };

        if (
            messages[newStatus] &&
            !window.confirm(messages[newStatus])
        ) {
            return;
        }

        setTransactions((prev) =>
            prev.map((item) =>
                item.id === id
                    ? { ...item, status: newStatus }
                    : item
            )
        );

        setSelectedTransaction((prev) =>
            prev && prev.id === id
                ? { ...prev, status: newStatus }
                : prev
        );
    };

    const resetFilters = () => {
        setKeyword("");
        setStatusFilter("Tất cả");
        setMethodFilter("Tất cả");
        setFromDate("");
        setToDate("");
    };

    return (
        <AdminLayout>
            <div className="admin-transactions-page">
            <div className="transactions-heading">
                <div>
                    <h1>Quản lý giao dịch</h1>
                    <p>Theo dõi thanh toán, trạng thái giao dịch và hoàn tiền.</p>
                </div>

                <div className="transactions-heading-icon">
                    <FontAwesomeIcon icon={faCreditCard} />
                </div>
            </div>

            <div className="transactions-stats">
                <div className="transaction-stat-card">
                    <span>Tổng giao dịch</span>
                    <strong>{transactions.length}</strong>
                </div>

                <div className="transaction-stat-card">
                    <span>Thanh toán thành công</span>
                    <strong className="transaction-green">
                        {successfulTransactions.length}
                    </strong>
                </div>

                <div className="transaction-stat-card">
                    <span>Chờ xác nhận</span>
                    <strong className="transaction-orange">
                        {pendingCount}
                    </strong>
                </div>

                <div className="transaction-stat-card">
                    <span>Thất bại</span>
                    <strong className="transaction-red">
                        {failedCount}
                    </strong>
                </div>

                <div className="transaction-stat-card">
                    <span>Tổng tiền thành công</span>
                    <strong className="transaction-revenue">
                        {formatCurrency(totalSuccessful)}
                    </strong>
                </div>
            </div>

            <div className="transactions-content">
                <h2>Danh sách giao dịch</h2>

                <div className="transactions-filters">
                    <div className="transaction-search">
                        <FontAwesomeIcon icon={faMagnifyingGlass} />
                        <input
                            type="text"
                            placeholder="Tìm mã giao dịch, mã đơn, khách hàng..."
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="Tất cả">Tất cả trạng thái</option>
                        <option value="Thành công">Thành công</option>
                        <option value="Chờ xác nhận">Chờ xác nhận</option>
                        <option value="Thất bại">Thất bại</option>
                        <option value="Đã hoàn tiền">Đã hoàn tiền</option>
                    </select>

                    <select
                        value={methodFilter}
                        onChange={(e) => setMethodFilter(e.target.value)}
                    >
                        <option value="Tất cả">Tất cả phương thức</option>
                        <option value="Chuyển khoản ngân hàng">
                            Chuyển khoản ngân hàng
                        </option>
                        <option value="Ví điện tử">Ví điện tử</option>
                        <option value="Tiền mặt">Tiền mặt</option>
                    </select>

                    <button
                        className="transaction-reset-btn"
                        onClick={resetFilters}
                    >
                        <FontAwesomeIcon icon={faRotateLeft} />
                        Đặt lại
                    </button>
                </div>

                <div className="transactions-date-filters">
                    <label>
                        Từ ngày
                        <input
                            type="date"
                            value={fromDate}
                            max={toDate || undefined}
                            onChange={(e) => setFromDate(e.target.value)}
                        />
                    </label>

                    <label>
                        Đến ngày
                        <input
                            type="date"
                            value={toDate}
                            min={fromDate || undefined}
                            onChange={(e) => setToDate(e.target.value)}
                        />
                    </label>

                    <span>
                        Tìm thấy <strong>{filteredTransactions.length}</strong> giao dịch
                    </span>
                </div>

                <div className="transactions-table-wrapper">
                    <table className="transactions-table">
                        <thead>
                        <tr>
                            <th>Mã giao dịch</th>
                            <th>Mã đơn hàng</th>
                            <th>Khách hàng</th>
                            <th>Phương thức</th>
                            <th>Ngày giao dịch</th>
                            <th>Số tiền</th>
                            <th>Trạng thái</th>
                            <th>Thao tác</th>
                        </tr>
                        </thead>

                        <tbody>
                        {filteredTransactions.map((item) => (
                            <tr key={item.id}>
                                <td>
                                    <strong>{item.id}</strong>
                                    <small>{item.reference}</small>
                                </td>

                                <td>{item.orderId}</td>

                                <td>
                                    <strong>{item.customer}</strong>
                                    <small>{item.email}</small>
                                </td>

                                <td>{item.method}</td>

                                <td>{item.date}</td>

                                <td className="transaction-amount">
                                    {formatCurrency(item.amount)}
                                </td>

                                <td>
                                        <span
                                            className={`transaction-status transaction-status-${{
                                                "Thành công": "success",
                                                "Chờ xác nhận": "pending",
                                                "Thất bại": "failed",
                                                "Đã hoàn tiền": "refunded",
                                            }[item.status]}`}
                                        >
                                            {item.status}
                                        </span>
                                </td>

                                <td>
                                    <div className="transaction-actions">
                                        <button
                                            className="transaction-view-btn"
                                            title="Xem chi tiết"
                                            onClick={() =>
                                                setSelectedTransaction(item)
                                            }
                                        >
                                            <FontAwesomeIcon icon={faEye} />
                                        </button>

                                        {item.status === "Chờ xác nhận" && (
                                            <>
                                                <button
                                                    className="transaction-success-btn"
                                                    title="Xác nhận thành công"
                                                    onClick={() =>
                                                        updateStatus(
                                                            item.id,
                                                            "Thành công"
                                                        )
                                                    }
                                                >
                                                    <FontAwesomeIcon icon={faCheck} />
                                                </button>

                                                <button
                                                    className="transaction-fail-btn"
                                                    title="Đánh dấu thất bại"
                                                    onClick={() =>
                                                        updateStatus(
                                                            item.id,
                                                            "Thất bại"
                                                        )
                                                    }
                                                >
                                                    <FontAwesomeIcon icon={faXmark} />
                                                </button>
                                            </>
                                        )}

                                        {item.status === "Thành công" && (
                                            <button
                                                className="transaction-refund-btn"
                                                title="Đánh dấu đã hoàn tiền"
                                                onClick={() =>
                                                    updateStatus(
                                                        item.id,
                                                        "Đã hoàn tiền"
                                                    )
                                                }
                                            >
                                                <FontAwesomeIcon icon={faRotate} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}

                        {filteredTransactions.length === 0 && (
                            <tr>
                                <td colSpan="8" className="transaction-empty">
                                    Không tìm thấy giao dịch phù hợp.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedTransaction && (
                <div
                    className="transaction-modal-overlay"
                    onClick={() => setSelectedTransaction(null)}
                >
                    <div
                        className="transaction-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="transaction-modal-header">
                            <h2>Chi tiết giao dịch</h2>
                            <button onClick={() => setSelectedTransaction(null)}>
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </div>

                        <div className="transaction-detail">
                            <p><strong>Mã giao dịch:</strong> {selectedTransaction.id}</p>
                            <p><strong>Mã đơn hàng:</strong> {selectedTransaction.orderId}</p>
                            <p><strong>Khách hàng:</strong> {selectedTransaction.customer}</p>
                            <p><strong>Email:</strong> {selectedTransaction.email}</p>
                            <p><strong>Mã tham chiếu:</strong> {selectedTransaction.reference}</p>
                            <p><strong>Phương thức:</strong> {selectedTransaction.method}</p>
                            <p><strong>Ngày giao dịch:</strong> {selectedTransaction.date}</p>
                            <p><strong>Số tiền:</strong> {formatCurrency(selectedTransaction.amount)}</p>
                            <p><strong>Trạng thái:</strong> {selectedTransaction.status}</p>
                        </div>

                        <div className="transaction-modal-footer">
                            {selectedTransaction.status === "Chờ xác nhận" && (
                                <>
                                    <button
                                        className="transaction-fail-btn"
                                        onClick={() =>
                                            updateStatus(
                                                selectedTransaction.id,
                                                "Thất bại"
                                            )
                                        }
                                    >
                                        Đánh dấu thất bại
                                    </button>

                                    <button
                                        className="transaction-success-btn"
                                        onClick={() =>
                                            updateStatus(
                                                selectedTransaction.id,
                                                "Thành công"
                                            )
                                        }
                                    >
                                        Xác nhận thành công
                                    </button>
                                </>
                            )}

                            {selectedTransaction.status === "Thành công" && (
                                <button
                                    className="transaction-refund-btn"
                                    onClick={() =>
                                        updateStatus(
                                            selectedTransaction.id,
                                            "Đã hoàn tiền"
                                        )
                                    }
                                >
                                    Đánh dấu đã hoàn tiền
                                </button>
                            )}

                            <button
                                className="transaction-modal-close"
                                onClick={() => setSelectedTransaction(null)}
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

export default AdminTransactions;
