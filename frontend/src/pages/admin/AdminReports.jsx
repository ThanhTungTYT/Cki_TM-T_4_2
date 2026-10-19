import { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import AdminLayout from "./AdminLayout";
import {
    faChartPie,
    faMoneyBillWave,
    faClipboardList,
    faCheckCircle,
    faUsers,
    faRotateLeft,
} from "@fortawesome/free-solid-svg-icons";
import "./AdminReports.css";

const mockOrders = [
    { id: "CM001", date: "2026-10-01", amount: 500000, status: "Hoàn thành", service: "Vệ sinh nhà ở", customer: "Nguyễn Văn An" },
    { id: "CM002", date: "2026-10-03", amount: 800000, status: "Hoàn thành", service: "Vệ sinh văn phòng", customer: "Trần Thị Bình" },
    { id: "CM003", date: "2026-10-05", amount: 350000, status: "Đang thực hiện", service: "Vệ sinh sofa", customer: "Lê Minh Tuấn" },
    { id: "CM004", date: "2026-10-07", amount: 250000, status: "Hoàn thành", service: "Vệ sinh máy lạnh", customer: "Phạm Ngọc Hà" },
    { id: "CM005", date: "2026-10-09", amount: 1200000, status: "Đã hủy", service: "Tổng vệ sinh nhà", customer: "Đỗ Hoàng Nam" },
    { id: "CM006", date: "2026-10-11", amount: 650000, status: "Hoàn thành", service: "Vệ sinh nhà ở", customer: "Vũ Minh Đức" },
    { id: "CM007", date: "2026-10-13", amount: 900000, status: "Hoàn thành", service: "Vệ sinh văn phòng", customer: "Nguyễn Thị Mai" },
    { id: "CM008", date: "2026-10-15", amount: 400000, status: "Đang thực hiện", service: "Vệ sinh sofa", customer: "Phạm Quốc Bảo" },
    { id: "CM009", date: "2026-10-17", amount: 300000, status: "Hoàn thành", service: "Vệ sinh máy lạnh", customer: "Trần Minh Khang" },
    { id: "CM010", date: "2026-10-19", amount: 750000, status: "Hoàn thành", service: "Vệ sinh nhà ở", customer: "Lê Ngọc Trâm" },
];

const formatCurrency = (value) =>
    value.toLocaleString("vi-VN") + " đ";

function AdminReports() {
    const [period, setPeriod] = useState("7");
    const [fromDate, setFromDate] = useState("2026-10-13");
    const [toDate, setToDate] = useState("2026-10-19");
    const [appliedFrom, setAppliedFrom] = useState("2026-10-13");
    const [appliedTo, setAppliedTo] = useState("2026-10-19");

    const reportOrders = useMemo(() => {
        return mockOrders.filter(
            (order) =>
                order.date >= appliedFrom &&
                order.date <= appliedTo
        );
    }, [appliedFrom, appliedTo]);

    const completedOrders = reportOrders.filter(
        (order) => order.status === "Hoàn thành"
    );

    const revenue = completedOrders.reduce(
        (sum, order) => sum + order.amount,
        0
    );

    const completionRate = reportOrders.length
        ? Math.round((completedOrders.length / reportOrders.length) * 100)
        : 0;

    const serviceStats = Object.values(
        reportOrders.reduce((result, order) => {
            if (!result[order.service]) {
                result[order.service] = {
                    name: order.service,
                    orders: 0,
                    revenue: 0,
                };
            }

            result[order.service].orders += 1;

            if (order.status === "Hoàn thành") {
                result[order.service].revenue += order.amount;
            }

            return result;
        }, {})
    ).sort((a, b) => b.orders - a.orders);

    const dailyStats = Object.values(
        completedOrders.reduce((result, order) => {
            if (!result[order.date]) {
                result[order.date] = {
                    date: order.date,
                    revenue: 0,
                    orders: 0,
                };
            }

            result[order.date].revenue += order.amount;
            result[order.date].orders += 1;

            return result;
        }, {})
    ).sort((a, b) => a.date.localeCompare(b.date));

    const maxRevenue = Math.max(
        ...dailyStats.map((item) => item.revenue),
        1
    );

    const applyPeriod = (value) => {
        setPeriod(value);

        const end = new Date("2026-10-19T12:00:00");
        const start = new Date(end);

        if (value === "7") {
            start.setDate(end.getDate() - 6);
        } else if (value === "30") {
            start.setDate(end.getDate() - 29);
        } else {
            start.setDate(end.getDate() - 364);
        }

        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        };

        const startValue = formatDate(start);
        const endValue = formatDate(end);

        setFromDate(startValue);
        setToDate(endValue);
        setAppliedFrom(startValue);
        setAppliedTo(endValue);
    };

    const applyCustomDate = () => {
        if (!fromDate || !toDate) {
            alert("Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.");
            return;
        }

        if (fromDate > toDate) {
            alert("Ngày bắt đầu không được sau ngày kết thúc.");
            return;
        }

        setAppliedFrom(fromDate);
        setAppliedTo(toDate);
        setPeriod("custom");
    };

    const resetReport = () => {
        applyPeriod("7");
    };

    return (
        <AdminLayout>
            <div className="admin-reports-page">
            <div className="reports-heading">
                <div>
                    <h1>Thống kê & báo cáo</h1>
                    <p>Theo dõi hiệu quả kinh doanh của nền tảng CleanMate.</p>
                </div>

                <div className="reports-heading-icon">
                    <FontAwesomeIcon icon={faChartPie} />
                </div>
            </div>

            <div className="reports-filter-panel">
                <div className="reports-period-options">
                    <button
                        className={period === "7" ? "selected" : ""}
                        onClick={() => applyPeriod("7")}
                    >
                        7 ngày
                    </button>

                    <button
                        className={period === "30" ? "selected" : ""}
                        onClick={() => applyPeriod("30")}
                    >
                        30 ngày
                    </button>

                    <button
                        className={period === "365" ? "selected" : ""}
                        onClick={() => applyPeriod("365")}
                    >
                        1 năm
                    </button>
                </div>

                <div className="reports-date-inputs">
                    <label>
                        Từ ngày
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                        />
                    </label>

                    <label>
                        Đến ngày
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                        />
                    </label>

                    <button
                        className="reports-apply-btn"
                        onClick={applyCustomDate}
                    >
                        Áp dụng
                    </button>

                    <button
                        className="reports-reset-btn"
                        onClick={resetReport}
                        title="Đặt lại bộ lọc"
                    >
                        <FontAwesomeIcon icon={faRotateLeft} />
                    </button>
                </div>

                <p className="reports-date-caption">
                    Dữ liệu từ {appliedFrom} đến {appliedTo}
                </p>
            </div>

            <div className="reports-stat-grid">
                <div className="report-stat-card">
                    <div className="report-stat-icon revenue-icon">
                        <FontAwesomeIcon icon={faMoneyBillWave} />
                    </div>
                    <span>Doanh thu hoàn thành</span>
                    <strong>{formatCurrency(revenue)}</strong>
                    <small>Chỉ tính đơn đã hoàn thành</small>
                </div>

                <div className="report-stat-card">
                    <div className="report-stat-icon orders-icon">
                        <FontAwesomeIcon icon={faClipboardList} />
                    </div>
                    <span>Tổng đơn hàng</span>
                    <strong>{reportOrders.length}</strong>
                    <small>Trong khoảng thời gian chọn</small>
                </div>

                <div className="report-stat-card">
                    <div className="report-stat-icon completed-icon">
                        <FontAwesomeIcon icon={faCheckCircle} />
                    </div>
                    <span>Đơn hoàn thành</span>
                    <strong>{completedOrders.length}</strong>
                    <small>Tỷ lệ {completionRate}%</small>
                </div>

                <div className="report-stat-card">
                    <div className="report-stat-icon customers-icon">
                        <FontAwesomeIcon icon={faUsers} />
                    </div>
                    <span>Khách hàng có đơn</span>
                    <strong>
                        {new Set(reportOrders.map((order) => order.customer)).size}
                    </strong>
                    <small>Khách hàng trong dữ liệu mẫu</small>
                </div>
            </div>

            <div className="reports-chart-card">
                <div className="reports-section-heading">
                    <div>
                        <h2>Doanh thu theo ngày</h2>
                        <p>Chỉ tính đơn hàng đã hoàn thành.</p>
                    </div>
                    <span className="reports-chart-unit">Đơn vị: VNĐ</span>
                </div>

                {dailyStats.length === 0 ? (
                    <div className="reports-no-data">
                        Không có đơn hoàn thành trong khoảng thời gian này.
                    </div>
                ) : (
                    <div className="reports-bar-chart">
                        {dailyStats.map((item) => (
                            <div className="reports-bar-column" key={item.date}>
                                <span className="reports-bar-value">
                                    {item.revenue.toLocaleString("vi-VN")}
                                </span>

                                <div className="reports-bar-track">
                                    <div
                                        className="reports-bar"
                                        style={{
                                            height: `${Math.max(
                                                (item.revenue / maxRevenue) * 100,
                                                3
                                            )}%`,
                                        }}
                                        title={formatCurrency(item.revenue)}
                                    />
                                </div>

                                <span className="reports-bar-label">
                                    {item.date.slice(8, 10)}/
                                    {item.date.slice(5, 7)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="reports-table-card">
                <div className="reports-section-heading">
                    <div>
                        <h2>Hiệu quả theo dịch vụ</h2>
                        <p>So sánh số đơn và doanh thu giữa các dịch vụ.</p>
                    </div>
                </div>

                <div className="reports-table-wrapper">
                    <table className="reports-table">
                        <thead>
                        <tr>
                            <th>STT</th>
                            <th>Tên dịch vụ</th>
                            <th>Số đơn</th>
                            <th>Doanh thu hoàn thành</th>
                            <th>Tỷ trọng số đơn</th>
                        </tr>
                        </thead>

                        <tbody>
                        {serviceStats.map((service, index) => (
                            <tr key={service.name}>
                                <td>{index + 1}</td>
                                <td><strong>{service.name}</strong></td>
                                <td>{service.orders}</td>
                                <td className="report-service-revenue">
                                    {formatCurrency(service.revenue)}
                                </td>
                                <td>
                                    <div className="report-share">
                                        <div className="report-share-track">
                                            <div
                                                className="report-share-fill"
                                                style={{
                                                    width: `${
                                                        reportOrders.length
                                                            ? (service.orders / reportOrders.length) * 100
                                                            : 0
                                                    }%`,
                                                }}
                                            />
                                        </div>
                                        <span>
                                                {reportOrders.length
                                                    ? Math.round(
                                                        (service.orders / reportOrders.length) * 100
                                                    )
                                                    : 0}%
                                            </span>
                                    </div>
                                </td>
                            </tr>
                        ))}

                        {serviceStats.length === 0 && (
                            <tr>
                                <td colSpan="5" className="reports-no-data">
                                    Không có dữ liệu trong khoảng thời gian này.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
            </div>
        </AdminLayout>
    );
}

export default AdminReports;
