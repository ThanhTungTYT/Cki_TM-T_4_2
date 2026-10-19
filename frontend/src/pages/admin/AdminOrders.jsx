import { useState } from "react";
import AdminLayout from "./AdminLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faMagnifyingGlass,
    faEye,
    faRotateLeft,
    faXmark,
    faCheck,
    faTruck,
} from "@fortawesome/free-solid-svg-icons";
import "./AdminOrders.css";

const initialOrders = [
    {
        id: "CM001",
        customer: "Nguyễn Văn An",
        phone: "0901234567",
        service: "Vệ sinh nhà ở",
        provider: "Công ty vệ sinh Minh Tâm",
        date: "2026-10-18",
        time: "08:00",
        amount: 500000,
        payment: "Đã thanh toán",
        status: "Chờ xác nhận",
    },
    {
        id: "CM002",
        customer: "Trần Thị Bình",
        phone: "0912345678",
        service: "Vệ sinh văn phòng",
        provider: "Dịch vụ sạch An Phát",
        date: "2026-10-19",
        time: "09:30",
        amount: 800000,
        payment: "Đã thanh toán",
        status: "Đã xác nhận",
    },
    {
        id: "CM003",
        customer: "Lê Minh Tuấn",
        phone: "0923456789",
        service: "Vệ sinh sofa",
        provider: "Vệ sinh nhà cửa Hoàng Gia",
        date: "2026-10-20",
        time: "14:00",
        amount: 350000,
        payment: "Chưa thanh toán",
        status: "Đang thực hiện",
    },
    {
        id: "CM004",
        customer: "Phạm Ngọc Hà",
        phone: "0934567890",
        service: "Vệ sinh máy lạnh",
        provider: "Công ty vệ sinh Minh Tâm",
        date: "2026-10-17",
        time: "10:00",
        amount: 250000,
        payment: "Đã thanh toán",
        status: "Hoàn thành",
    },
    {
        id: "CM005",
        customer: "Đỗ Hoàng Nam",
        phone: "0945678901",
        service: "Tổng vệ sinh nhà",
        provider: "Dịch vụ sạch An Phát",
        date: "2026-10-16",
        time: "13:30",
        amount: 1200000,
        payment: "Đã thanh toán",
        status: "Đã hủy",
    },
];

const formatCurrency = (amount) =>
    amount.toLocaleString("vi-VN") + " đ";

function AdminOrders() {
    const [orders, setOrders] = useState(initialOrders);
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("Tất cả");
    const [paymentFilter, setPaymentFilter] = useState("Tất cả");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [selectedOrder, setSelectedOrder] = useState(null);

    const filteredOrders = orders.filter((order) => {
        const search = keyword.trim().toLowerCase();

        const matchKeyword =
            order.id.toLowerCase().includes(search) ||
            order.customer.toLowerCase().includes(search) ||
            order.phone.includes(search) ||
            order.service.toLowerCase().includes(search);

        const matchStatus =
            statusFilter === "Tất cả" ||
            order.status === statusFilter;

        const matchPayment =
            paymentFilter === "Tất cả" ||
            order.payment === paymentFilter;

        const matchFromDate = !fromDate || order.date >= fromDate;
        const matchToDate = !toDate || order.date <= toDate;

        return (
            matchKeyword &&
            matchStatus &&
            matchPayment &&
            matchFromDate &&
            matchToDate
        );
    });

    const changeStatus = (id, newStatus) => {
        const messages = {
            "Đã xác nhận": "Xác nhận đơn hàng này?",
            "Đang thực hiện": "Chuyển đơn hàng sang đang thực hiện?",
            "Hoàn thành": "Xác nhận đơn hàng đã hoàn thành?",
            "Đã hủy": "Bạn có chắc muốn hủy đơn hàng này?",
        };

        if (
            messages[newStatus] &&
            !window.confirm(messages[newStatus])
        ) {
            return;
        }

        setOrders((prev) =>
            prev.map((order) =>
                order.id === id
                    ? { ...order, status: newStatus }
                    : order
            )
        );

        setSelectedOrder((prev) =>
            prev && prev.id === id
                ? { ...prev, status: newStatus }
                : prev
        );
    };

    const resetFilters = () => {
        setKeyword("");
        setStatusFilter("Tất cả");
        setPaymentFilter("Tất cả");
        setFromDate("");
        setToDate("");
    };

    const totalRevenue = orders
        .filter((order) => order.status === "Hoàn thành")
        .reduce((sum, order) => sum + order.amount, 0);

    const pendingCount = orders.filter(
        (order) => order.status === "Chờ xác nhận"
    ).length;

    const processingCount = orders.filter(
        (order) =>
            order.status === "Đã xác nhận" ||
            order.status === "Đang thực hiện"
    ).length;

    const completedCount = orders.filter(
        (order) => order.status === "Hoàn thành"
    ).length;

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

            <div className="orders-stats">
                <div className="order-stat-card">
                    <span>Tổng đơn hàng</span>
                    <strong>{orders.length}</strong>
                </div>

                <div className="order-stat-card">
                    <span>Chờ xác nhận</span>
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
                    <span>Doanh thu hoàn thành</span>
                    <strong className="order-revenue">
                        {formatCurrency(totalRevenue)}
                    </strong>
                </div>
            </div>

            <div className="orders-content">
                <h2>Danh sách đơn hàng</h2>

                <div className="orders-filters">
                    <div className="order-search">
                        <FontAwesomeIcon icon={faMagnifyingGlass} />
                        <input
                            type="text"
                            placeholder="Tìm mã đơn, khách hàng, SĐT, dịch vụ..."
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="Tất cả">Tất cả trạng thái</option>
                        <option value="Chờ xác nhận">Chờ xác nhận</option>
                        <option value="Đã xác nhận">Đã xác nhận</option>
                        <option value="Đang thực hiện">Đang thực hiện</option>
                        <option value="Hoàn thành">Hoàn thành</option>
                        <option value="Đã hủy">Đã hủy</option>
                    </select>

                    <select
                        value={paymentFilter}
                        onChange={(e) => setPaymentFilter(e.target.value)}
                    >
                        <option value="Tất cả">Tất cả thanh toán</option>
                        <option value="Đã thanh toán">Đã thanh toán</option>
                        <option value="Chưa thanh toán">Chưa thanh toán</option>
                    </select>

                    <button
                        className="order-reset-btn"
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
                            <th>Ngày đặt</th>
                            <th>Tổng tiền</th>
                            <th>Thanh toán</th>
                            <th>Trạng thái</th>
                            <th>Thao tác</th>
                        </tr>
                        </thead>

                        <tbody>
                        {filteredOrders.map((order) => (
                            <tr key={order.id}>
                                <td>
                                    <strong>{order.id}</strong>
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
                                    {order.date}
                                    <small>{order.time}</small>
                                </td>

                                <td className="order-amount">
                                    {formatCurrency(order.amount)}
                                </td>

                                <td>
                                        <span
                                            className={`order-payment ${
                                                order.payment === "Đã thanh toán"
                                                    ? "payment-paid"
                                                    : "payment-unpaid"
                                            }`}
                                        >
                                            {order.payment}
                                        </span>
                                </td>

                                <td>
                                        <span
                                            className={`order-status order-status-${{
                                                "Chờ xác nhận": "pending",
                                                "Đã xác nhận": "confirmed",
                                                "Đang thực hiện": "processing",
                                                "Hoàn thành": "completed",
                                                "Đã hủy": "cancelled",
                                            }[order.status]}`}
                                        >
                                            {order.status}
                                        </span>
                                </td>

                                <td>
                                    <div className="order-actions">
                                        <button
                                            className="order-view-btn"
                                            title="Xem chi tiết"
                                            onClick={() =>
                                                setSelectedOrder(order)
                                            }
                                        >
                                            <FontAwesomeIcon icon={faEye} />
                                        </button>

                                        {order.status === "Chờ xác nhận" && (
                                            <button
                                                className="order-approve-btn"
                                                title="Xác nhận đơn"
                                                onClick={() =>
                                                    changeStatus(
                                                        order.id,
                                                        "Đã xác nhận"
                                                    )
                                                }
                                            >
                                                <FontAwesomeIcon icon={faCheck} />
                                            </button>
                                        )}

                                        {order.status === "Đã xác nhận" && (
                                            <button
                                                className="order-approve-btn"
                                                title="Bắt đầu thực hiện"
                                                onClick={() =>
                                                    changeStatus(
                                                        order.id,
                                                        "Đang thực hiện"
                                                    )
                                                }
                                            >
                                                <FontAwesomeIcon icon={faTruck} />
                                            </button>
                                        )}

                                        {order.status === "Đang thực hiện" && (
                                            <button
                                                className="order-approve-btn"
                                                title="Hoàn thành đơn"
                                                onClick={() =>
                                                    changeStatus(
                                                        order.id,
                                                        "Hoàn thành"
                                                    )
                                                }
                                            >
                                                <FontAwesomeIcon icon={faCheck} />
                                            </button>
                                        )}

                                        {!["Hoàn thành", "Đã hủy"].includes(
                                            order.status
                                        ) && (
                                            <button
                                                className="order-cancel-btn"
                                                title="Hủy đơn"
                                                onClick={() =>
                                                    changeStatus(
                                                        order.id,
                                                        "Đã hủy"
                                                    )
                                                }
                                            >
                                                <FontAwesomeIcon icon={faXmark} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}

                        {filteredOrders.length === 0 && (
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
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="order-modal-header">
                            <h2>Chi tiết đơn hàng {selectedOrder.id}</h2>
                            <button onClick={() => setSelectedOrder(null)}>
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </div>

                        <div className="order-detail">
                            <p><strong>Khách hàng:</strong> {selectedOrder.customer}</p>
                            <p><strong>Số điện thoại:</strong> {selectedOrder.phone}</p>
                            <p><strong>Dịch vụ:</strong> {selectedOrder.service}</p>
                            <p><strong>Nhà cung cấp:</strong> {selectedOrder.provider}</p>
                            <p><strong>Ngày đặt:</strong> {selectedOrder.date}</p>
                            <p><strong>Giờ đặt:</strong> {selectedOrder.time}</p>
                            <p><strong>Tổng tiền:</strong> {formatCurrency(selectedOrder.amount)}</p>
                            <p><strong>Thanh toán:</strong> {selectedOrder.payment}</p>
                            <p><strong>Trạng thái:</strong> {selectedOrder.status}</p>
                        </div>

                        <div className="order-modal-footer">
                            {!["Hoàn thành", "Đã hủy"].includes(selectedOrder.status) && (
                                <button
                                    className="order-cancel-btn"
                                    onClick={() =>
                                        changeStatus(selectedOrder.id, "Đã hủy")
                                    }
                                >
                                    Hủy đơn
                                </button>
                            )}

                            <button
                                className="order-modal-close"
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