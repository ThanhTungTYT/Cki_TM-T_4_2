
import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = "http://localhost:8080/api/admin/statistics";

const PERIODS = [
    { label: "7 ngày", value: "7" },
    { label: "14 ngày", value: "14" },
    { label: "1 tháng", value: "30" },
    { label: "1 năm", value: "365" },
];

const COLORS = {
    COMPLETED: "#16a34a",
    PROCESSING: "#3b82f6",
    PENDING: "#f59e0b",
    CANCELLED: "#ef4444",
};

const money = (value) =>
    new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    }).format(Number(value || 0));

const number = (value) =>
    new Intl.NumberFormat("vi-VN").format(Number(value || 0));

const localDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const getToday = () => localDate(new Date());

const getDefaultStart = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days + 1);
    return localDate(date);
};

const getToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("accessToken");

export default function AdminReports() {
    const [period, setPeriod] = useState("7");
    const [fromDate, setFromDate] = useState(getDefaultStart(7));
    const [toDate, setToDate] = useState(getToday());
    const [customMode, setCustomMode] = useState(false);

    const [data, setData] = useState({
        totalServiceValue: 0,
        totalOrders: 0,
        completedOrders: 0,
        chartData: [],
        orderStats: [],
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

    const fetchStatistics = useCallback(async () => {
        const token = getToken();

        if (!token) {
            setError("Không tìm thấy token đăng nhập. Vui lòng đăng nhập lại bằng tài khoản quản trị.");
            setData({
                totalServiceValue: 0,
                totalOrders: 0,
                completedOrders: 0,
                chartData: [],
                orderStats: [],
            });
            return;
        }

        if (!fromDate || !toDate || fromDate > toDate) {
            setError("Vui lòng chọn khoảng ngày hợp lệ.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const params = new URLSearchParams();

            if (customMode) {
                params.set("fromDate", fromDate);
                params.set("toDate", toDate);
            } else {
                params.set("period", period);
            }

            const response = await fetch(`${API_URL}?${params.toString()}`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                },
            });

            if (response.status === 401 || response.status === 403) {
                throw new Error(
                    "Bạn không có quyền xem thống kê hoặc phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại bằng tài khoản ADMIN/STAFF được cấp quyền."
                );
            }

            if (!response.ok) {
                const message = await response.text();
                throw new Error(
                    message || `Không thể tải thống kê. Mã lỗi: ${response.status}`
                );
            }

            const result = await response.json();

            setData({
                totalServiceValue: Number(result.totalServiceValue || 0),
                totalOrders: Number(result.totalOrders || 0),
                completedOrders: Number(result.completedOrders || 0),
                chartData: Array.isArray(result.chartData)
                    ? result.chartData.map((item) => ({
                        label: item.label,
                        value: Number(item.value || 0),
                    }))
                    : [],
                orderStats: Array.isArray(result.orderStats)
                    ? result.orderStats.map((item) => ({
                        ...item,
                        count: Number(item.count || 0),
                        value: Number(item.value || 0),
                        color: item.color || COLORS[item.status] || "#64748b",
                    }))
                    : [],
            });
        } catch (err) {
            setError(err.message || "Đã xảy ra lỗi khi tải dữ liệu thống kê.");
        } finally {
            setLoading(false);
        }
    }, [period, fromDate, toDate, customMode]);

    useEffect(() => {
        fetchStatistics();
    }, [fetchStatistics, reloadKey]);

    const maxRevenue = useMemo(
        () =>
            Math.max(
                1,
                ...data.chartData.map((item) => Number(item.value || 0))
            ),
        [data.chartData]
    );

    const pieBackground = useMemo(() => {
        const total = data.orderStats.reduce(
            (sum, item) => sum + item.count,
            0
        );

        if (!total) return "#e5e7eb";

        let current = 0;

        const segments = data.orderStats.map((item) => {
            const start = current;
            current += (item.count / total) * 100;
            return `${item.color} ${start}% ${current}%`;
        });

        return `conic-gradient(${segments.join(", ")})`;
    }, [data.orderStats]);

    const statusTotal = data.orderStats.reduce(
        (sum, item) => sum + item.count,
        0
    );

    const selectPeriod = (value) => {
        const days = Number(value);
        setPeriod(value);
        setCustomMode(false);
        setFromDate(getDefaultStart(days));
        setToDate(getToday());
    };

    const applyCustomDate = () => {
        if (!fromDate || !toDate || fromDate > toDate) {
            setError("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");
            return;
        }

        setCustomMode(true);
        setReloadKey((current) => current + 1);
    };

    const cardStyle = {
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 20,
        minWidth: 0,
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
    };

    const buttonStyle = (active) => ({
        border: active ? "1px solid #2563eb" : "1px solid #dbe2ea",
        background: active ? "#2563eb" : "#ffffff",
        color: active ? "#ffffff" : "#334155",
        borderRadius: 8,
        padding: "9px 15px",
        cursor: "pointer",
        fontWeight: 600,
        fontSize: 13,
    });

    const inputStyle = {
        width: "100%",
        boxSizing: "border-box",
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: 14,
        background: "#ffffff",
        color: "#0f172a",
    };

    return (
        <div
            style={{
                padding: "24px",
                background: "#f5f7fb",
                minHeight: "100%",
                color: "#1e293b",
                fontFamily: "Arial, sans-serif",
                boxSizing: "border-box",
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 16,
                    flexWrap: "wrap",
                    marginBottom: 24,
                }}
            >
                <div>
                    <h1 style={{ margin: "0 0 8px", fontSize: 26, color: "#1e385c" }}>
                        Thống kê và báo cáo
                    </h1>
                    <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
                        Theo dõi đơn hàng, doanh thu dịch vụ và tỷ lệ trạng thái đơn.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setReloadKey((current) => current + 1)}
                    disabled={loading}
                    style={buttonStyle(false)}
                >
                    {loading ? "Đang tải..." : "Làm mới dữ liệu"}
                </button>
            </div>

            <section
                style={{
                    ...cardStyle,
                    marginBottom: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 18,
                }}
            >
                <div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                        Khoảng thời gian thống kê
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {PERIODS.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => selectPeriod(item.value)}
                                style={buttonStyle(
                                    !customMode && period === item.value
                                )}
                            >
                                {item.label}
                            </button>
                        ))}

                        <button
                            type="button"
                            onClick={() => setCustomMode(true)}
                            style={buttonStyle(customMode)}
                        >
                            Tùy chọn ngày
                        </button>
                    </div>
                </div>

                {customMode && (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                            gap: 14,
                            alignItems: "end",
                        }}
                    >
                        <label style={{ fontSize: 13, fontWeight: 600 }}>
                            Từ ngày
                            <input
                                type="date"
                                value={fromDate}
                                max={toDate || undefined}
                                onChange={(event) => setFromDate(event.target.value)}
                                style={{ ...inputStyle, marginTop: 7 }}
                            />
                        </label>

                        <label style={{ fontSize: 13, fontWeight: 600 }}>
                            Đến ngày
                            <input
                                type="date"
                                value={toDate}
                                min={fromDate || undefined}
                                max={getToday()}
                                onChange={(event) => setToDate(event.target.value)}
                                style={{ ...inputStyle, marginTop: 7 }}
                            />
                        </label>

                        <button
                            type="button"
                            onClick={applyCustomDate}
                            disabled={loading}
                            style={{
                                ...buttonStyle(true),
                                padding: 12,
                                height: 42,
                            }}
                        >
                            Áp dụng khoảng ngày
                        </button>
                    </div>
                )}

                <div style={{ fontSize: 12, color: "#64748b" }}>
                    {customMode
                        ? `Khoảng ngày: ${fromDate || "—"} đến ${toDate || "—"}`
                        : `Đang xem dữ liệu trong ${PERIODS.find((item) => item.value === period)?.label || period}`}
                </div>
            </section>

            {error && (
                <div
                    role="alert"
                    style={{
                        background: "#fef2f2",
                        color: "#b91c1c",
                        border: "1px solid #fecaca",
                        borderRadius: 10,
                        padding: 14,
                        marginBottom: 20,
                        fontSize: 14,
                        lineHeight: 1.5,
                    }}
                >
                    {error}
                    <div style={{ marginTop: 8 }}>
                        <button
                            type="button"
                            onClick={() => setReloadKey((current) => current + 1)}
                            style={buttonStyle(false)}
                        >
                            Thử lại
                        </button>
                    </div>
                </div>
            )}

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                    gap: 16,
                    marginBottom: 20,
                }}
            >
                <div style={cardStyle}>
                    <div style={{ color: "#64748b", fontSize: 13, marginBottom: 12 }}>
                        Giá trị đơn hoàn thành
                    </div>
                    <div
                        style={{
                            fontSize: 24,
                            fontWeight: 800,
                            color: "#15803d",
                            overflowWrap: "anywhere",
                        }}
                    >
                        {money(data.totalServiceValue)}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>
                        Tính theo ngày hoàn thành đơn
                    </div>
                </div>

                <div style={cardStyle}>
                    <div style={{ color: "#64748b", fontSize: 13, marginBottom: 12 }}>
                        Tổng đơn được tạo
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#2563eb" }}>
                        {number(data.totalOrders)}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>
                        Tính theo ngày tạo đơn
                    </div>
                </div>

                <div style={cardStyle}>
                    <div style={{ color: "#64748b", fontSize: 13, marginBottom: 12 }}>
                        Đơn hoàn thành trong kỳ
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#7c3aed" }}>
                        {number(data.completedOrders)}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>
                        Tính theo ngày hoàn thành đơn
                    </div>
                </div>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1.6fr) minmax(280px, 1fr)",
                    gap: 20,
                    alignItems: "start",
                }}
            >
                <section style={cardStyle}>
                    <h2 style={{ fontSize: 18, margin: "0 0 6px", color: "#1e385c" }}>
                        Biểu đồ giá trị đơn hoàn thành
                    </h2>
                    <p style={{ margin: "0 0 24px", color: "#64748b", fontSize: 13 }}>
                        Đơn vị: VNĐ. Mốc thời gian tự động thay đổi theo kỳ lọc.
                    </p>

                    {loading ? (
                        <div style={{ padding: 35, textAlign: "center", color: "#64748b" }}>
                            Đang tải biểu đồ...
                        </div>
                    ) : data.chartData.length === 0 ? (
                        <div style={{ padding: 35, textAlign: "center", color: "#64748b" }}>
                            Chưa có dữ liệu biểu đồ.
                        </div>
                    ) : (
                        <>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "flex-end",
                                    gap: data.chartData.length > 14 ? 5 : 10,
                                    height: 260,
                                    padding: "16px 4px 0",
                                    borderBottom: "1px solid #cbd5e1",
                                    overflowX: "auto",
                                }}
                            >
                                {data.chartData.map((item, index) => {
                                    const value = Number(item.value || 0);
                                    const height =
                                        value > 0 ? Math.max(4, (value / maxRevenue) * 210) : 2;

                                    return (
                                        <div
                                            key={`${item.label}-${index}`}
                                            title={`${item.label}: ${money(value)}`}
                                            style={{
                                                minWidth: data.chartData.length > 30 ? 15 : 24,
                                                flex: "1 0 0",
                                                height: "100%",
                                                display: "flex",
                                                flexDirection: "column",
                                                justifyContent: "flex-end",
                                                alignItems: "center",
                                                gap: 7,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: "100%",
                                                    maxWidth: 44,
                                                    height: `${height}px`,
                                                    minHeight: 2,
                                                    background:
                                                        value > 0
                                                            ? "linear-gradient(180deg, #60a5fa, #2563eb)"
                                                            : "#e2e8f0",
                                                    borderRadius: "5px 5px 0 0",
                                                    transition: "height 0.2s ease",
                                                }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            <div
                                style={{
                                    display: "flex",
                                    gap: data.chartData.length > 14 ? 5 : 10,
                                    padding: "9px 4px 0",
                                    overflowX: "auto",
                                }}
                            >
                                {data.chartData.map((item, index) => {
                                    const showLabel =
                                        data.chartData.length <= 14 ||
                                        index % Math.ceil(data.chartData.length / 10) === 0 ||
                                        index === data.chartData.length - 1;

                                    return (
                                        <div
                                            key={`${item.label}-label-${index}`}
                                            style={{
                                                minWidth: data.chartData.length > 30 ? 15 : 24,
                                                flex: "1 0 0",
                                                textAlign: "center",
                                                color: "#64748b",
                                                fontSize: 10,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {showLabel ? item.label : ""}
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ marginTop: 22 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                                    Chi tiết theo mốc thời gian
                                </div>
                                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                                    {data.chartData.map((item, index) => (
                                        <div
                                            key={`${item.label}-detail-${index}`}
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                gap: 12,
                                                padding: "9px 0",
                                                borderBottom: "1px solid #f1f5f9",
                                                fontSize: 13,
                                            }}
                                        >
                                            <span style={{ color: "#475569" }}>{item.label}</span>
                                            <strong style={{ textAlign: "right" }}>
                                                {money(item.value)}
                                            </strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </section>

                <section style={cardStyle}>
                    <h2 style={{ fontSize: 18, margin: "0 0 6px", color: "#1e385c" }}>
                        Tỷ lệ trạng thái đơn hàng
                    </h2>
                    <p style={{ margin: "0 0 24px", color: "#64748b", fontSize: 13 }}>
                        Phân loại theo trạng thái hiện tại của các đơn được tạo trong kỳ.
                    </p>

                    {loading ? (
                        <div style={{ padding: 35, textAlign: "center", color: "#64748b" }}>
                            Đang tải biểu đồ...
                        </div>
                    ) : (
                        <>
                            <div
                                style={{
                                    width: 200,
                                    maxWidth: "100%",
                                    aspectRatio: "1 / 1",
                                    borderRadius: "50%",
                                    margin: "0 auto 24px",
                                    background: pieBackground,
                                    position: "relative",
                                }}
                            >
                                <div
                                    style={{
                                        position: "absolute",
                                        inset: "25%",
                                        borderRadius: "50%",
                                        background: "#ffffff",
                                        display: "flex",
                                        flexDirection: "column",
                                        justifyContent: "center",
                                        alignItems: "center",
                                    }}
                                >
                                    <strong style={{ fontSize: 25, color: "#1e385c" }}>
                                        {number(statusTotal)}
                                    </strong>
                                    <span style={{ fontSize: 12, color: "#64748b" }}>
                    Đơn hàng
                  </span>
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                {data.orderStats.map((item) => (
                                    <div key={item.status || item.label}>
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                gap: 10,
                                                marginBottom: 7,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 8,
                                                    fontSize: 13,
                                                }}
                                            >
                        <span
                            style={{
                                width: 10,
                                height: 10,
                                borderRadius: 3,
                                background: item.color,
                                flexShrink: 0,
                            }}
                        />
                                                <span>{item.label}</span>
                                            </div>
                                            <strong style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                                                {number(item.count)} ({Number(item.value || 0).toLocaleString("vi-VN")}%)
                                            </strong>
                                        </div>

                                        <div
                                            style={{
                                                height: 7,
                                                borderRadius: 20,
                                                background: "#f1f5f9",
                                                overflow: "hidden",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: `${Math.max(0, Math.min(100, item.value))}%`,
                                                    height: "100%",
                                                    borderRadius: 20,
                                                    background: item.color,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {statusTotal === 0 && (
                                <p
                                    style={{
                                        textAlign: "center",
                                        color: "#64748b",
                                        fontSize: 13,
                                        marginTop: 20,
                                    }}
                                >
                                    Chưa có đơn hàng trong khoảng thời gian này.
                                </p>
                            )}
                        </>
                    )}
                </section>
            </div>

            <p
                style={{
                    color: "#64748b",
                    fontSize: 12,
                    lineHeight: 1.6,
                    marginTop: 20,
                }}
            >
                Lưu ý: Giá trị đơn hoàn thành được tính từ tổng tiền các đơn có trạng
                thái COMPLETED theo thời điểm hoàn thành. Đây là giá trị dịch vụ của
                đơn hàng, không mặc định là phần hoa hồng CleanMate nhận được.
            </p>
        </div>
    );
}
