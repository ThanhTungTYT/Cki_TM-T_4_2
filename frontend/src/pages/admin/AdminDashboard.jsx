
import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faClipboardList,
    faStore,
    faCreditCard,
    faChartColumn,
    faChartPie,
    faBell,
    faCalendarDays,
    faCheckCircle,
    faClock,
    faRotate,
    faMoneyBillWave,
    faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "./AdminLayout";
import "./AdminDashboard.css";

const formatMoney = (value) =>
    new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    }).format(Number(value) || 0);

const formatNumber = (value) =>
    new Intl.NumberFormat("vi-VN").format(Number(value) || 0);

function AdminDashboard() {
    const [period, setPeriod] = useState("7");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [appliedRange, setAppliedRange] = useState("7");
    const [appliedFromDate, setAppliedFromDate] = useState("");
    const [appliedToDate, setAppliedToDate] = useState("");

    const [chartData, setChartData] = useState([]);
    const [orderStats, setOrderStats] = useState([]);
    const [allTimeServiceValue, setAllTimeServiceValue] = useState(0);
    const [allTimeOrders, setAllTimeOrders] = useState(0);
    const [loadingStatistics, setLoadingStatistics] = useState(false);
    const [statisticsError, setStatisticsError] = useState("");

    const chartTotalRevenue = chartData.reduce(
        (sum, item) =>
            sum + (Number(item.revenue ?? item.value) || 0),
        0
    );

    const chartTotalOrders = chartData.reduce(
        (sum, item) => sum + (Number(item.orderCount) || 0),
        0
    );

    const maxRevenue = Math.max(
        1,
        ...chartData.map(
            (item) => Number(item.revenue ?? item.value) || 0
        )
    );

    const maxOrders = Math.max(
        1,
        ...chartData.map((item) => Number(item.orderCount) || 0)
    );

    const pieTotalOrders = orderStats.reduce(
        (sum, item) => sum + (Number(item.count) || 0),
        0
    );

    let accumulatedPercentage = 0;

    const pieBackground = orderStats
        .map((item) => {
            const percentage = Math.max(0, Number(item.value) || 0);

            if (percentage <= 0) return null;

            const start = accumulatedPercentage;
            accumulatedPercentage += percentage;

            return `${item.color || "#64748b"} ${start}% ${accumulatedPercentage}%`;
        })
        .filter(Boolean)
        .join(", ");

    useEffect(() => {
        const controller = new AbortController();

        async function fetchStatistics() {
            if (
                appliedRange === "custom" &&
                (
                    !appliedFromDate ||
                    !appliedToDate ||
                    appliedFromDate > appliedToDate
                )
            ) {
                setStatisticsError(
                    "Vui lòng chọn khoảng ngày bắt đầu và kết thúc hợp lệ."
                );
                setChartData([]);
                setOrderStats([]);
                setLoadingStatistics(false);
                return;
            }

            setLoadingStatistics(true);
            setStatisticsError("");

            try {
                const params = new URLSearchParams();

                if (appliedRange === "custom") {
                    params.set("fromDate", appliedFromDate);
                    params.set("toDate", appliedToDate);
                } else {
                    params.set("period", appliedRange);
                }

                const token =
                    localStorage.getItem("accessToken") ||
                    localStorage.getItem("token") ||
                    sessionStorage.getItem("accessToken") ||
                    sessionStorage.getItem("token");

                const response = await fetch(
                    `/api/admin/statistics?${params.toString()}`,
                    {
                        method: "GET",
                        signal: controller.signal,
                        headers: {
                            Accept: "application/json",
                            ...(token
                                ? { Authorization: `Bearer ${token}` }
                                : {}),
                        },
                    }
                );

                if (!response.ok) {
                    if (
                        response.status === 401 ||
                        response.status === 403
                    ) {
                        throw new Error(
                            "Bạn không có quyền xem thống kê hoặc phiên đăng nhập đã hết hạn."
                        );
                    }

                    throw new Error(
                        `Không lấy được dữ liệu thống kê (HTTP ${response.status}).`
                    );
                }

                const data = await response.json();

                setChartData(
                    Array.isArray(data.chartData) ? data.chartData : []
                );

                setOrderStats(
                    Array.isArray(data.orderStats) ? data.orderStats : []
                );

                setAllTimeServiceValue(
                    Number(data.allTimeServiceValue) || 0
                );

                setAllTimeOrders(
                    Number(data.allTimeOrders) || 0
                );
            } catch (error) {
                if (error.name === "AbortError") return;

                setStatisticsError(
                    error.message || "Không thể kết nối máy chủ thống kê."
                );

                setChartData([]);
                setOrderStats([]);
            } finally {
                if (!controller.signal.aborted) {
                    setLoadingStatistics(false);
                }
            }
        }

        fetchStatistics();

        return () => controller.abort();
    }, [appliedRange, appliedFromDate, appliedToDate]);

    const handlePeriodChange = (value) => {
        setPeriod(value);
        setFromDate("");
        setToDate("");
        setAppliedFromDate("");
        setAppliedToDate("");
        setStatisticsError("");
        setAppliedRange(value);
    };

    const handleApplyFilter = () => {
        if (!fromDate || !toDate) {
            setStatisticsError(
                "Bạn cần chọn cả ngày bắt đầu và ngày kết thúc."
            );
            return;
        }

        if (fromDate > toDate) {
            setStatisticsError(
                "Ngày bắt đầu không được sau ngày kết thúc."
            );
            return;
        }

        setAppliedFromDate(fromDate);
        setAppliedToDate(toDate);
        setStatisticsError("");
        setAppliedRange("custom");
    };

    const handleResetFilter = () => {
        setPeriod("7");
        setFromDate("");
        setToDate("");
        setAppliedFromDate("");
        setAppliedToDate("");
        setStatisticsError("");
        setAppliedRange("7");
    };

    return (
        <AdminLayout>
            <div className="admin-dashboard-content">
                <header className="admin-topbar">
                    <div>
                        <h1>Tổng quan hệ thống</h1>
                        <p>
                            Xin chào! Đây là tình hình hoạt động của CleanMate.
                        </p>
                    </div>

                    <button
                        className="admin-notification"
                        aria-label="Thông báo"
                        type="button"
                    >
                        <FontAwesomeIcon icon={faBell} />
                        <span />
                    </button>
                </header>

                <section className="admin-summary-grid">
                    <div className="admin-summary-card">
                        <div className="summary-card-top">
                            <span className="summary-icon blue">
                                <FontAwesomeIcon icon={faMoneyBillWave} />
                            </span>
                            <span className="summary-tag">
                                Toàn hệ thống
                            </span>
                        </div>
                        <p>Tổng giá trị đơn hoàn thành</p>
                        <h2>{formatMoney(allTimeServiceValue)}</h2>
                        <span className="summary-note">
                            Tính từ dữ liệu đơn hoàn thành
                        </span>
                    </div>

                    <div className="admin-summary-card">
                        <div className="summary-card-top">
                            <span className="summary-icon purple">
                                <FontAwesomeIcon icon={faCreditCard} />
                            </span>
                            <span className="summary-tag">
                                Chưa có dữ liệu
                            </span>
                        </div>
                        <p>Phí nền tảng</p>
                        <h2>—</h2>
                        <span className="summary-note">
                            Chưa có API tính phí nền tảng
                        </span>
                    </div>

                    <div className="admin-summary-card">
                        <div className="summary-card-top">
                            <span className="summary-icon orange">
                                <FontAwesomeIcon icon={faClipboardList} />
                            </span>
                            <span className="summary-tag">
                                Toàn hệ thống
                            </span>
                        </div>
                        <p>Tổng số đơn hàng</p>
                        <h2>{formatNumber(allTimeOrders)}</h2>
                        <span className="summary-note">
                            Tổng số đơn trong database
                        </span>
                    </div>

                    <div className="admin-summary-card">
                        <div className="summary-card-top">
                            <span className="summary-icon green">
                                <FontAwesomeIcon icon={faCheckCircle} />
                            </span>
                            <span className="summary-tag">
                                Theo bộ lọc
                            </span>
                        </div>
                        <p>Đơn hoàn thành trong biểu đồ</p>
                        <h2>{formatNumber(
                            orderStats.find(
                                (item) => item.status === "COMPLETED"
                            )?.count || 0
                        )}</h2>
                        <span className="summary-note">
                            Trong khoảng thời gian đang chọn
                        </span>
                    </div>
                </section>

                {statisticsError && (
                    <div className="statistics-message" role="alert">
                        <FontAwesomeIcon icon={faTriangleExclamation} />
                        {" "}{statisticsError}
                    </div>
                )}

                <section className="admin-chart-grid">
                    <div className="admin-panel revenue-panel">
                        <div className="admin-panel-heading">
                            <div>
                                <h2>Thống kê doanh thu và đơn hàng</h2>
                                <p>
                                    Biểu đồ theo thời gian đã chọn (CN10)
                                </p>
                            </div>
                            <span className="panel-icon">
                                <FontAwesomeIcon icon={faChartColumn} />
                            </span>
                        </div>

                        <div className="chart-filter">
                            <label>
                                <span>Khoảng thời gian</span>
                                <select
                                    value={period}
                                    onChange={(event) =>
                                        handlePeriodChange(event.target.value)
                                    }
                                >
                                    <option value="7">7 ngày gần nhất</option>
                                    <option value="14">14 ngày gần nhất</option>
                                    <option value="30">1 tháng gần nhất</option>
                                    <option value="365">1 năm gần nhất</option>
                                </select>
                            </label>

                            <label>
                                <span>Từ ngày</span>
                                <input
                                    type="date"
                                    value={fromDate}
                                    max={toDate || undefined}
                                    onChange={(event) =>
                                        setFromDate(event.target.value)
                                    }
                                />
                            </label>

                            <label>
                                <span>Đến ngày</span>
                                <input
                                    type="date"
                                    value={toDate}
                                    min={fromDate || undefined}
                                    onChange={(event) =>
                                        setToDate(event.target.value)
                                    }
                                />
                            </label>

                            <button
                                className="apply-filter-btn"
                                type="button"
                                onClick={handleApplyFilter}
                                disabled={loadingStatistics}
                            >
                                <FontAwesomeIcon icon={faCalendarDays} />
                                {" "}Áp dụng
                            </button>

                            <button
                                className="apply-filter-btn"
                                type="button"
                                onClick={handleResetFilter}
                                disabled={loadingStatistics}
                            >
                                Đặt lại
                            </button>
                        </div>

                        <div className="revenue-total">
                            <div>
                                <span>Doanh thu trong biểu đồ</span>
                                <strong>{formatMoney(chartTotalRevenue)}</strong>
                            </div>

                            <div>
                                <span>Số đơn được tạo trong biểu đồ</span>
                                <strong>{formatNumber(chartTotalOrders)}</strong>
                            </div>

                            {loadingStatistics && (
                                <p className="statistics-message">
                                    Đang tải dữ liệu...
                                </p>
                            )}
                        </div>

                        <div className="chart-legend" style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "16px",
                            marginBottom: "12px",
                            fontSize: "12px",
                            color: "#718096"
                        }}>
                            <span style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px"
                            }}>
                                <i style={{
                                    width: "10px",
                                    height: "10px",
                                    borderRadius: "3px",
                                    background: "#2563eb"
                                }} />
                                Doanh thu
                            </span>
                            <span style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px"
                            }}>
                                <i style={{
                                    width: "10px",
                                    height: "10px",
                                    borderRadius: "3px",
                                    background: "#16a34a"
                                }} />
                                Số đơn
                            </span>
                        </div>

                        <div className="bar-chart">
                            <div className="chart-y-axis">
                                <span>100%</span>
                                <span>75%</span>
                                <span>50%</span>
                                <span>25%</span>
                                <span>0%</span>
                            </div>

                            <div className="bar-chart-content">
                                <div className="chart-grid-lines">
                                    <i />
                                    <i />
                                    <i />
                                    <i />
                                    <i />
                                </div>

                                <div className="bar-list">
                                    {chartData.map((item, index) => {
                                        const revenue = Number(
                                            item.revenue ?? item.value
                                        ) || 0;
                                        const orderCount =
                                            Number(item.orderCount) || 0;

                                        const revenueHeight =
                                            revenue > 0
                                                ? Math.max(
                                                    2,
                                                    (revenue / maxRevenue) * 100
                                                )
                                                : 0;

                                        const orderHeight =
                                            orderCount > 0
                                                ? Math.max(
                                                    2,
                                                    (orderCount / maxOrders) * 100
                                                )
                                                : 0;

                                        return (
                                            <div
                                                className="bar-column"
                                                key={`${item.label}-${index}`}
                                                title={`${item.label} | Doanh thu: ${formatMoney(revenue)} | Số đơn: ${orderCount}`}
                                            >
                                                <div className="bar-value">
                                                    {formatNumber(orderCount)} đơn
                                                </div>

                                                <div style={{
                                                    display: "flex",
                                                    alignItems: "flex-end",
                                                    justifyContent: "center",
                                                    gap: "4px",
                                                    width: "100%",
                                                    flex: 1,
                                                    minHeight: 0
                                                }}>
                                                    <div
                                                        className="bar-track"
                                                        style={{
                                                            width: "min(38%, 28px)",
                                                            height: "100%",
                                                            flex: "none"
                                                        }}
                                                    >
                                                        <div
                                                            className="bar"
                                                            style={{
                                                                height: `${revenueHeight}%`,
                                                                background: "linear-gradient(180deg, #4e8cff 0%, #2563eb 100%)"
                                                            }}
                                                        />
                                                    </div>

                                                    <div
                                                        className="bar-track"
                                                        style={{
                                                            width: "min(38%, 28px)",
                                                            height: "100%",
                                                            flex: "none"
                                                        }}
                                                    >
                                                        <div
                                                            className="bar"
                                                            style={{
                                                                height: `${orderHeight}%`,
                                                                background: "linear-gradient(180deg, #4ade80 0%, #16a34a 100%)"
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                <span className="bar-label">
                                                    {item.label}
                                                </span>

                                                <span style={{
                                                    fontSize: "9px",
                                                    color: "#64748b",
                                                    textAlign: "center",
                                                    lineHeight: 1.4,
                                                    maxWidth: "100%",
                                                    overflowWrap: "anywhere"
                                                }}>
                                                    {formatMoney(revenue)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {!loadingStatistics &&
                            !statisticsError &&
                            chartData.length === 0 && (
                                <p className="statistics-message">
                                    Không có dữ liệu trong khoảng thời gian này.
                                </p>
                            )}
                    </div>

                    <div className="admin-panel order-panel">
                        <div className="admin-panel-heading">
                            <div>
                                <h2>Thống kê đơn hàng</h2>
                                <p>Tỷ lệ đơn hàng theo trạng thái (CN11)</p>
                            </div>
                            <span className="panel-icon">
                                <FontAwesomeIcon icon={faChartPie} />
                            </span>
                        </div>

                        <div className="pie-chart-wrap">
                            <div
                                className="pie-chart"
                                style={{
                                    background: pieTotalOrders > 0
                                        ? `conic-gradient(${pieBackground})`
                                        : "#e5e7eb",
                                }}
                                role="img"
                                aria-label="Biểu đồ tròn tỷ lệ đơn hàng theo trạng thái"
                            >
                                <div className="pie-chart-center">
                                    <span>Tổng đơn</span>
                                    <strong>{formatNumber(pieTotalOrders)}</strong>
                                </div>
                            </div>
                        </div>

                        <div className="order-legend">
                            {orderStats.map((item) => (
                                <div
                                    className="order-legend-row"
                                    key={item.status || item.label}
                                >
                                    <div className="order-legend-name">
                                        <i style={{
                                            backgroundColor: item.color || "#64748b"
                                        }} />
                                        <span>{item.label}</span>
                                    </div>

                                    <strong>{formatNumber(item.count)}</strong>
                                    <span className="order-percent">
                                        {Number(item.value) || 0}%
                                    </span>
                                </div>
                            ))}

                            {orderStats.length === 0 && (
                                <p className="statistics-message">
                                    Chưa có dữ liệu trạng thái đơn hàng.
                                </p>
                            )}
                        </div>

                        <div className="order-panel-footer">
                            <span>
                                <FontAwesomeIcon icon={faRotate} />
                                {" "}Dữ liệu từ database theo khoảng thời gian đã chọn
                            </span>
                        </div>
                    </div>
                </section>

                <section className="admin-bottom-grid">
                    <div className="admin-panel">
                        <div className="admin-panel-heading">
                            <div>
                                <h2>Hoạt động cần kiểm tra</h2>
                                <p>Lối tắt hỗ trợ quản trị</p>
                            </div>
                        </div>

                        <div className="activity-list">
                            <div className="activity-item">
                                <span className="activity-icon green">
                                    <FontAwesomeIcon icon={faCheckCircle} />
                                </span>
                                <div>
                                    <strong>Đơn hàng hoàn thành</strong>
                                    <p>
                                        Kiểm tra đơn đã hoàn tất và lịch sử đơn hàng.
                                    </p>
                                    <small>
                                        Dữ liệu chi tiết trong Quản lý đơn hàng
                                    </small>
                                </div>
                            </div>

                            <div className="activity-item">
                                <span className="activity-icon orange">
                                    <FontAwesomeIcon icon={faClock} />
                                </span>
                                <div>
                                    <strong>Đơn hàng cần xử lý</strong>
                                    <p>
                                        Kiểm tra các đơn đang chờ xác nhận hoặc xử lý.
                                    </p>
                                    <small>
                                        Dữ liệu chi tiết trong Quản lý đơn hàng
                                    </small>
                                </div>
                            </div>

                            <div className="activity-item">
                                <span className="activity-icon blue">
                                    <FontAwesomeIcon icon={faStore} />
                                </span>
                                <div>
                                    <strong>Hồ sơ nhà cung cấp</strong>
                                    <p>
                                        Kiểm tra các hồ sơ nhà cung cấp đang chờ duyệt.
                                    </p>
                                    <small>
                                        Dữ liệu chi tiết trong trang Nhà cung cấp
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="admin-panel">
                        <div className="admin-panel-heading">
                            <div>
                                <h2>Thông tin thống kê</h2>
                                <p>Ý nghĩa các chỉ số đang hiển thị</p>
                            </div>
                        </div>

                        <div className="pending-list">
                            <div className="pending-item">
                                <div>
                                    <strong>Doanh thu</strong>
                                    <span>
                                        Tổng giá trị các đơn hoàn thành trong kỳ
                                    </span>
                                </div>
                            </div>

                            <div className="pending-item">
                                <div>
                                    <strong>Số đơn hàng</strong>
                                    <span>
                                        Đếm theo ngày tạo đơn trong kỳ
                                    </span>
                                </div>
                            </div>

                            <div className="pending-item">
                                <div>
                                    <strong>Trạng thái đơn</strong>
                                    <span>
                                        Phân loại theo trạng thái hiện tại của đơn
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <footer className="admin-footer">
                    CleanMate Admin Panel
                </footer>
            </div>
        </AdminLayout>
    );
}

export default AdminDashboard;
