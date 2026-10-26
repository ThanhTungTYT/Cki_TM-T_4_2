import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faMagnifyingGlass,
    faRotate,
    faEye,
    faXmark,
    faClipboardList,
    faCheck,
    faClock,
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "./AdminLayout";

const API_URL = "http://localhost:8080/api/reports";

const STATUS_LABELS = {
    OPEN: "Mới tiếp nhận",
    IN_PROGRESS: "Đang xử lý",
    RESOLVED: "Đã giải quyết",
    REJECTED: "Đã từ chối",
};

const STATUS_COLORS = {
    OPEN: { background: "#fff3d6", color: "#946200" },
    IN_PROGRESS: { background: "#dbeafe", color: "#1d4ed8" },
    RESOLVED: { background: "#dcfce7", color: "#166534" },
    REJECTED: { background: "#fee2e2", color: "#b91c1c" },
};

function getToken() {
    return (
        sessionStorage.getItem("accessToken") ||
        localStorage.getItem("accessToken") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("token")
    );
}

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

    if (!response.ok) {
        let message = `Yêu cầu thất bại (HTTP ${response.status}).`;

        try {
            const data = await response.json();
            message = data.message || data.detail || data.error || message;
        } catch {
            try {
                const text = await response.text();
                if (text) message = text;
            } catch {
                // Giữ thông báo lỗi mặc định.
            }
        }

        throw new Error(message);
    }

    if (response.status === 204) return null;
    return response.json();
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString("vi-VN");
}

function AdminComplaintManagement() {
    const [reports, setReports] = useState([]);
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [selectedReport, setSelectedReport] = useState(null);
    const [nextStatus, setNextStatus] = useState("IN_PROGRESS");
    const [resolution, setResolution] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const loadReports = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const data = await apiRequest(`${API_URL}/admin`);
            setReports(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(
                err.message ||
                "Không thể tải danh sách khiếu nại. Hãy kiểm tra backend và quyền tài khoản."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadReports();
    }, [loadReports]);

    const filteredReports = useMemo(() => {
        const search = keyword.trim().toLowerCase();

        return reports.filter((report) => {
            const matchesStatus =
                statusFilter === "ALL" || report.status === statusFilter;

            const searchable = [
                report.subject,
                report.category,
                report.reporterName,
                report.reporterEmail,
                report.bookingCode,
                report.reportedName,
                report.description,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return matchesStatus && (!search || searchable.includes(search));
        });
    }, [reports, keyword, statusFilter]);

    const stats = useMemo(
        () => ({
            total: reports.length,
            open: reports.filter((report) => report.status === "OPEN").length,
            processing: reports.filter(
                (report) => report.status === "IN_PROGRESS"
            ).length,
            finished: reports.filter((report) =>
                ["RESOLVED", "REJECTED"].includes(report.status)
            ).length,
        }),
        [reports]
    );

    const openDetail = (report) => {
        setSelectedReport(report);
        setNextStatus(
            report.status === "OPEN" ? "IN_PROGRESS" : report.status
        );
        setResolution(report.resolution || "");
        setError("");
        setNotice("");
    };

    const saveStatus = async (event) => {
        event.preventDefault();

        if (!selectedReport) return;

        if (
            ["RESOLVED", "REJECTED"].includes(nextStatus) &&
            !resolution.trim()
        ) {
            setError("Vui lòng nhập kết quả xử lý trước khi đóng khiếu nại.");
            return;
        }

        if (
            ["RESOLVED", "REJECTED"].includes(selectedReport.status)
        ) {
            setError("Khiếu nại đã kết thúc xử lý, không thể cập nhật.");
            return;
        }

        setSubmitting(true);
        setError("");
        setNotice("");

        try {
            const updated = await apiRequest(
                `${API_URL}/${selectedReport.id}/status`,
                {
                    method: "PUT",
                    body: JSON.stringify({
                        status: nextStatus,
                        resolution: resolution.trim(),
                    }),
                }
            );

            setReports((current) =>
                current.map((report) =>
                    report.id === updated.id ? updated : report
                )
            );

            setSelectedReport(updated);
            setNextStatus(updated.status);
            setResolution(updated.resolution || "");
            setNotice("Đã cập nhật trạng thái khiếu nại.");
        } catch (err) {
            setError(
                err.message || "Không thể cập nhật trạng thái khiếu nại."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const isTerminal = selectedReport
        ? ["RESOLVED", "REJECTED"].includes(selectedReport.status)
        : false;

    return (
        <AdminLayout>
            <div style={{ padding: 24, color: "#1f2937" }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 16,
                        flexWrap: "wrap",
                        marginBottom: 24,
                    }}
                >
                    <div>
                        <h1 style={{ margin: "0 0 8px", fontSize: 28 }}>
                            Quản lý khiếu nại
                        </h1>
                        <p style={{ margin: 0, color: "#64748b" }}>
                            Tiếp nhận, theo dõi và cập nhật kết quả xử lý báo cáo.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={loadReports}
                        disabled={loading}
                        style={buttonStyle("#2563eb")}
                    >
                        <FontAwesomeIcon icon={faRotate} /> Làm mới
                    </button>
                </div>

                {error && (
                    <div style={messageStyle("#fee2e2", "#991b1b")}>
                        {error}
                    </div>
                )}

                {notice && (
                    <div style={messageStyle("#dcfce7", "#166534")}>
                        {notice}
                    </div>
                )}

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 16,
                        marginBottom: 24,
                    }}
                >
                    <StatCard
                        icon={faClipboardList}
                        label="Tổng khiếu nại"
                        value={stats.total}
                    />
                    <StatCard
                        icon={faClock}
                        label="Mới tiếp nhận"
                        value={stats.open}
                    />
                    <StatCard
                        icon={faRotate}
                        label="Đang xử lý"
                        value={stats.processing}
                    />
                    <StatCard
                        icon={faCheck}
                        label="Đã kết thúc"
                        value={stats.finished}
                    />
                </div>

                <section
                    style={{
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 14,
                        padding: 20,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                            marginBottom: 18,
                        }}
                    >
                        <h2 style={{ fontSize: 19, margin: 0 }}>
                            Danh sách báo cáo
                        </h2>
                        <span style={{ color: "#64748b" }}>
                            {filteredReports.length} kết quả
                        </span>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            gap: 12,
                            flexWrap: "wrap",
                            marginBottom: 20,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                flex: "1 1 280px",
                                border: "1px solid #cbd5e1",
                                borderRadius: 9,
                                padding: "0 12px",
                                minHeight: 42,
                            }}
                        >
                            <FontAwesomeIcon
                                icon={faMagnifyingGlass}
                                color="#64748b"
                            />
                            <input
                                value={keyword}
                                onChange={(event) =>
                                    setKeyword(event.target.value)
                                }
                                placeholder="Tìm tiêu đề, khách hàng, mã đơn..."
                                style={inputStyle}
                            />
                        </div>

                        <select
                            value={statusFilter}
                            onChange={(event) =>
                                setStatusFilter(event.target.value)
                            }
                            style={{
                                ...inputStyle,
                                flex: "0 1 220px",
                                border: "1px solid #cbd5e1",
                                borderRadius: 9,
                                padding: "10px 12px",
                            }}
                        >
                            <option value="ALL">Tất cả trạng thái</option>
                            {Object.entries(STATUS_LABELS).map(
                                ([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                )
                            )}
                        </select>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                        <table
                            style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                minWidth: 900,
                            }}
                        >
                            <thead>
                            <tr>
                                {[
                                    "Tiêu đề",
                                    "Người gửi",
                                    "Mã đơn",
                                    "Ngày gửi",
                                    "Trạng thái",
                                    "Thao tác",
                                ].map((heading) => (
                                    <th
                                        key={heading}
                                        style={thStyle}
                                    >
                                        {heading}
                                    </th>
                                ))}
                            </tr>
                            </thead>

                            <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={6} style={emptyStyle}>
                                        Đang tải danh sách khiếu nại...
                                    </td>
                                </tr>
                            )}

                            {!loading &&
                                filteredReports.map((report) => (
                                    <tr key={report.id}>
                                        <td style={tdStyle}>
                                            <strong>
                                                {report.subject || "Không có tiêu đề"}
                                            </strong>
                                            <div style={mutedStyle}>
                                                {report.category || "Chưa phân loại"}
                                            </div>
                                        </td>

                                        <td style={tdStyle}>
                                            <div>
                                                {report.reporterName || "Không rõ"}
                                            </div>
                                            <div style={mutedStyle}>
                                                {report.reporterEmail || ""}
                                            </div>
                                        </td>

                                        <td style={tdStyle}>
                                            {report.bookingCode || "—"}
                                        </td>

                                        <td style={tdStyle}>
                                            {formatDate(report.createdAt)}
                                        </td>

                                        <td style={tdStyle}>
                                                <span
                                                    style={{
                                                        ...STATUS_COLORS[report.status],
                                                        display: "inline-block",
                                                        borderRadius: 20,
                                                        padding: "5px 10px",
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {STATUS_LABELS[report.status] ||
                                                        report.status ||
                                                        "Không rõ"}
                                                </span>
                                        </td>

                                        <td style={tdStyle}>
                                            <button
                                                type="button"
                                                onClick={() => openDetail(report)}
                                                style={buttonStyle("#eff6ff", "#1d4ed8")}
                                            >
                                                <FontAwesomeIcon icon={faEye} />
                                                Xem / xử lý
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                            {!loading && filteredReports.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={emptyStyle}>
                                        Không tìm thấy báo cáo phù hợp.
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {selectedReport && (
                    <div
                        onClick={() => setSelectedReport(null)}
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 1000,
                            background: "rgba(15, 23, 42, 0.55)",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            padding: 16,
                        }}
                    >
                        <section
                            onClick={(event) => event.stopPropagation()}
                            style={{
                                width: "min(760px, 100%)",
                                maxHeight: "90vh",
                                overflowY: "auto",
                                background: "#fff",
                                borderRadius: 16,
                                padding: 24,
                                boxShadow: "0 20px 60px rgba(0,0,0,.2)",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    marginBottom: 20,
                                }}
                            >
                                <h2 style={{ margin: 0 }}>
                                    Chi tiết khiếu nại #{selectedReport.id}
                                </h2>
                                <button
                                    type="button"
                                    aria-label="Đóng"
                                    onClick={() => setSelectedReport(null)}
                                    style={buttonStyle("#f1f5f9", "#334155")}
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>

                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                    gap: 12,
                                    marginBottom: 20,
                                }}
                            >
                                <Detail label="Tiêu đề" value={selectedReport.subject} />
                                <Detail label="Danh mục" value={selectedReport.category} />
                                <Detail label="Người gửi" value={selectedReport.reporterName} />
                                <Detail label="Email" value={selectedReport.reporterEmail} />
                                <Detail label="Mã đơn hàng" value={selectedReport.bookingCode} />
                                <Detail label="Đối tượng được báo cáo" value={selectedReport.reportedName} />
                                <Detail label="Vai trò đối tượng" value={selectedReport.reportedRole} />
                                <Detail label="Ngày gửi" value={formatDate(selectedReport.createdAt)} />
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                <strong>Mô tả nội dung</strong>
                                <p
                                    style={{
                                        whiteSpace: "pre-wrap",
                                        lineHeight: 1.6,
                                        background: "#f8fafc",
                                        borderRadius: 10,
                                        padding: 14,
                                        marginTop: 8,
                                    }}
                                >
                                    {selectedReport.description || "Không có mô tả."}
                                </p>
                            </div>

                            {selectedReport.evidenceUrl && (
                                <p style={{ marginBottom: 20 }}>
                                    <strong>Minh chứng: </strong>
                                    <a
                                        href={selectedReport.evidenceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Mở minh chứng
                                    </a>
                                </p>
                            )}

                            {selectedReport.resolution && (
                                <div style={{ marginBottom: 20 }}>
                                    <strong>Kết quả xử lý trước đó</strong>
                                    <p style={{ whiteSpace: "pre-wrap" }}>
                                        {selectedReport.resolution}
                                    </p>
                                </div>
                            )}

                            <form onSubmit={saveStatus}>
                                <label
                                    style={{
                                        display: "block",
                                        fontWeight: 600,
                                        marginBottom: 8,
                                    }}
                                >
                                    Trạng thái xử lý
                                </label>

                                <select
                                    value={nextStatus}
                                    onChange={(event) =>
                                        setNextStatus(event.target.value)
                                    }
                                    disabled={isTerminal || submitting}
                                    style={{
                                        ...inputStyle,
                                        border: "1px solid #cbd5e1",
                                        borderRadius: 9,
                                        padding: 12,
                                        marginBottom: 16,
                                    }}
                                >
                                    {Object.entries(STATUS_LABELS).map(
                                        ([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        )
                                    )}
                                </select>

                                <label
                                    style={{
                                        display: "block",
                                        fontWeight: 600,
                                        marginBottom: 8,
                                    }}
                                >
                                    Kết quả / ghi chú xử lý
                                </label>

                                <textarea
                                    value={resolution}
                                    onChange={(event) =>
                                        setResolution(event.target.value)
                                    }
                                    disabled={isTerminal || submitting}
                                    rows={4}
                                    placeholder="Nhập kết quả xử lý hoặc lý do từ chối..."
                                    style={{
                                        ...inputStyle,
                                        border: "1px solid #cbd5e1",
                                        borderRadius: 9,
                                        padding: 12,
                                        resize: "vertical",
                                        marginBottom: 16,
                                    }}
                                />

                                {error && (
                                    <div style={messageStyle("#fee2e2", "#991b1b")}>
                                        {error}
                                    </div>
                                )}

                                {isTerminal && (
                                    <p style={{ color: "#64748b" }}>
                                        Báo cáo đã kết thúc xử lý nên không thể cập nhật thêm.
                                    </p>
                                )}

                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "flex-end",
                                        gap: 10,
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setSelectedReport(null)}
                                        style={buttonStyle("#f1f5f9", "#334155")}
                                    >
                                        Đóng
                                    </button>

                                    {!isTerminal && (
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            style={buttonStyle("#2563eb")}
                                        >
                                            {submitting
                                                ? "Đang lưu..."
                                                : "Lưu cập nhật"}
                                        </button>
                                    )}
                                </div>
                            </form>
                        </section>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function StatCard({ icon, label, value }) {
    return (
        <div
            style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: 20,
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    color: "#64748b",
                }}
            >
                <span>{label}</span>
                <FontAwesomeIcon icon={icon} />
            </div>
            <strong
                style={{
                    display: "block",
                    marginTop: 12,
                    fontSize: 28,
                    color: "#0f172a",
                }}
            >
                {value}
            </strong>
        </div>
    );
}

function Detail({ label, value }) {
    return (
        <div
            style={{
                background: "#f8fafc",
                padding: 12,
                borderRadius: 9,
                minWidth: 0,
            }}
        >
            <div style={{ color: "#64748b", fontSize: 12, marginBottom: 5 }}>
                {label}
            </div>
            <div style={{ overflowWrap: "anywhere", fontWeight: 500 }}>
                {value || "—"}
            </div>
        </div>
    );
}

function buttonStyle(background, color = "#fff") {
    return {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        border: "none",
        borderRadius: 8,
        padding: "10px 14px",
        background,
        color,
        fontWeight: 600,
        cursor: "pointer",
    };
}

function messageStyle(background, color) {
    return {
        background,
        color,
        borderRadius: 9,
        padding: 12,
        marginBottom: 16,
    };
}

const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    font: "inherit",
    background: "#fff",
};

const thStyle = {
    textAlign: "left",
    padding: "13px 12px",
    background: "#f8fafc",
    color: "#475569",
    fontSize: 13,
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
};

const tdStyle = {
    padding: "14px 12px",
    borderBottom: "1px solid #e2e8f0",
    verticalAlign: "top",
    fontSize: 14,
};

const mutedStyle = {
    color: "#64748b",
    fontSize: 12,
    marginTop: 5,
};

const emptyStyle = {
    padding: 28,
    textAlign: "center",
    color: "#64748b",
};

export default AdminComplaintManagement;