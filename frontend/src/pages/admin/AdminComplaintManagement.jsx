
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
    faTriangleExclamation,
    faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "./AdminLayout";
import "./AdminComplaintManagement.css";

const API_URL = "http://localhost:8080/api/reports";

const STATUS_LABELS = {
    OPEN: "Mới tiếp nhận",
    IN_PROGRESS: "Đang xử lý",
    RESOLVED: "Đã giải quyết",
    REJECTED: "Đã từ chối",
};

const STATUS_CLASSES = {
    OPEN: "complaint-status complaint-status-open",
    IN_PROGRESS: "complaint-status complaint-status-progress",
    RESOLVED: "complaint-status complaint-status-resolved",
    REJECTED: "complaint-status complaint-status-rejected",
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
            ...(options.body
                ? { "Content-Type": "application/json" }
                : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    if (!response.ok) {
        let message = `Yêu cầu thất bại (HTTP ${response.status}).`;

        try {
            const data = await response.json();
            message =
                data.message ||
                data.detail ||
                data.error ||
                message;
        } catch {
            try {
                const text = await response.text();
                if (text) message = text;
            } catch {
                message = `Yêu cầu thất bại (HTTP ${response.status}).`;
            }
        }

        throw new Error(message);
    }

    if (response.status === 204) return null;

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
        return null;
    }

    return response.json();
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getReportStatus(report) {
    return report?.status || "OPEN";
}

function getReportTitle(report) {
    return report?.subject || "Không có tiêu đề";
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
        setNotice("");

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
                statusFilter === "ALL" ||
                getReportStatus(report) === statusFilter;

            const searchable = [
                report.subject,
                report.category,
                report.reporterName,
                report.reporterEmail,
                report.bookingCode,
                report.reportedName,
                report.description,
                report.id,
            ]
                .filter((value) => value !== null && value !== undefined)
                .join(" ")
                .toLowerCase();

            return (
                matchesStatus &&
                (!search || searchable.includes(search))
            );
        });
    }, [reports, keyword, statusFilter]);

    const stats = useMemo(
        () => ({
            total: reports.length,
            open: reports.filter(
                (report) => getReportStatus(report) === "OPEN"
            ).length,
            processing: reports.filter(
                (report) => getReportStatus(report) === "IN_PROGRESS"
            ).length,
            finished: reports.filter((report) =>
                ["RESOLVED", "REJECTED"].includes(
                    getReportStatus(report)
                )
            ).length,
        }),
        [reports]
    );

    const openDetail = (report) => {
        setSelectedReport(report);
        setNextStatus(
            getReportStatus(report) === "OPEN"
                ? "IN_PROGRESS"
                : getReportStatus(report)
        );
        setResolution(report.resolution || "");
        setError("");
        setNotice("");
    };

    const closeDetail = () => {
        if (submitting) return;

        setSelectedReport(null);
        setError("");
        setNotice("");
    };

    const saveStatus = async (event) => {
        event.preventDefault();

        if (!selectedReport || submitting) return;

        if (
            ["RESOLVED", "REJECTED"].includes(nextStatus) &&
            !resolution.trim()
        ) {
            setError(
                "Vui lòng nhập kết quả xử lý trước khi kết thúc khiếu nại."
            );
            return;
        }

        if (
            ["RESOLVED", "REJECTED"].includes(
                getReportStatus(selectedReport)
            )
        ) {
            setError(
                "Khiếu nại đã kết thúc xử lý nên không thể cập nhật thêm."
            );
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

            const updatedReport =
                updated && updated.id !== undefined
                    ? updated
                    : {
                        ...selectedReport,
                        status: nextStatus,
                        resolution: resolution.trim(),
                    };

            setReports((current) =>
                current.map((report) =>
                    report.id === updatedReport.id
                        ? updatedReport
                        : report
                )
            );

            setSelectedReport(updatedReport);
            setNextStatus(getReportStatus(updatedReport));
            setResolution(updatedReport.resolution || "");
            setNotice("Đã cập nhật trạng thái khiếu nại.");
        } catch (err) {
            setError(
                err.message ||
                "Không thể cập nhật trạng thái khiếu nại."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const isTerminal = selectedReport
        ? ["RESOLVED", "REJECTED"].includes(
            getReportStatus(selectedReport)
        )
        : false;

    return (
        <AdminLayout>
            <div className="admin-complaint-page">
                <div className="complaint-page-header">
                    <div className="complaint-page-heading">
                        <div>
                            <h1>Quản lý khiếu nại</h1>
                            <p>
                                Tiếp nhận, theo dõi và xử lý phản ánh từ
                                khách hàng.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="complaint-btn complaint-btn-primary"
                        onClick={loadReports}
                        disabled={loading}
                    >
                        <FontAwesomeIcon
                            icon={faRotate}
                            className={loading ? "complaint-spin" : ""}
                        />
                        {loading ? "Đang tải..." : "Làm mới"}
                    </button>
                </div>

                {error && !selectedReport && (
                    <div className="complaint-alert complaint-alert-error">
                        <FontAwesomeIcon icon={faTriangleExclamation} />
                        <span>{error}</span>
                    </div>
                )}

                {notice && !selectedReport && (
                    <div className="complaint-alert complaint-alert-success">
                        <FontAwesomeIcon icon={faCheck} />
                        <span>{notice}</span>
                    </div>
                )}

                <div className="complaint-stats-grid">
                    <StatCard
                        icon={faClipboardList}
                        label="Tổng khiếu nại"
                        value={stats.total}
                        variant="blue"
                    />

                    <StatCard
                        icon={faClock}
                        label="Mới tiếp nhận"
                        value={stats.open}
                        variant="orange"
                    />

                    <StatCard
                        icon={faRotate}
                        label="Đang xử lý"
                        value={stats.processing}
                        variant="purple"
                    />

                    <StatCard
                        icon={faCheck}
                        label="Đã kết thúc"
                        value={stats.finished}
                        variant="green"
                    />
                </div>

                <section className="complaint-panel">
                    <div className="complaint-panel-header">
                        <div>
                            <h2>Danh sách khiếu nại</h2>
                            <p>
                                Theo dõi nội dung và trạng thái từng báo cáo.
                            </p>
                        </div>

                        <span className="complaint-result-count">
                            {filteredReports.length} kết quả
                        </span>
                    </div>

                    <div className="complaint-toolbar">
                        <div className="complaint-search">
                            <FontAwesomeIcon
                                icon={faMagnifyingGlass}
                            />

                            <input
                                type="text"
                                value={keyword}
                                onChange={(event) =>
                                    setKeyword(event.target.value)
                                }
                                placeholder="Tìm tiêu đề, khách hàng, mã đơn..."
                            />

                            {keyword && (
                                <button
                                    type="button"
                                    className="complaint-clear-search"
                                    aria-label="Xóa từ khóa"
                                    onClick={() => setKeyword("")}
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            )}
                        </div>

                        <select
                            className="complaint-filter"
                            value={statusFilter}
                            onChange={(event) =>
                                setStatusFilter(event.target.value)
                            }
                        >
                            <option value="ALL">
                                Tất cả trạng thái
                            </option>

                            {Object.entries(STATUS_LABELS).map(
                                ([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                )
                            )}
                        </select>
                    </div>

                    <div className="complaint-table-wrapper">
                        <table className="complaint-table">
                            <thead>
                            <tr>
                                <th>Tiêu đề khiếu nại</th>
                                <th>Người gửi</th>
                                <th>Mã đơn</th>
                                <th>Ngày gửi</th>
                                <th>Trạng thái</th>
                                <th className="complaint-action-column">
                                    Thao tác
                                </th>
                            </tr>
                            </thead>

                            <tbody>
                            {loading && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="complaint-empty"
                                    >
                                            <span className="complaint-loading">
                                                <FontAwesomeIcon
                                                    icon={faRotate}
                                                    className="complaint-spin"
                                                />
                                            </span>
                                        Đang tải danh sách khiếu nại...
                                    </td>
                                </tr>
                            )}

                            {!loading &&
                                filteredReports.map((report) => {
                                    const status = getReportStatus(report);

                                    return (
                                        <tr key={report.id}>
                                            <td>
                                                <div className="complaint-subject">
                                                    {getReportTitle(report)}
                                                </div>

                                                <div className="complaint-subtitle">
                                                    {report.category ||
                                                        "Chưa phân loại"}
                                                </div>
                                            </td>

                                            <td>
                                                <div className="complaint-reporter">
                                                    {report.reporterName ||
                                                        "Không rõ"}
                                                </div>

                                                <div className="complaint-subtitle">
                                                    {report.reporterEmail ||
                                                        "Chưa có email"}
                                                </div>
                                            </td>

                                            <td>
                                                    <span className="complaint-booking-code">
                                                        {report.bookingCode ||
                                                            "—"}
                                                    </span>
                                            </td>

                                            <td className="complaint-date">
                                                {formatDate(
                                                    report.createdAt
                                                )}
                                            </td>

                                            <td>
                                                    <span
                                                        className={
                                                            STATUS_CLASSES[
                                                                status
                                                                ] ||
                                                            "complaint-status"
                                                        }
                                                    >
                                                        <span className="complaint-status-dot" />
                                                        {STATUS_LABELS[status] ||
                                                            status}
                                                    </span>
                                            </td>

                                            <td>
                                                <button
                                                    type="button"
                                                    className="complaint-btn complaint-btn-view"
                                                    onClick={() =>
                                                        openDetail(report)
                                                    }
                                                >
                                                    <FontAwesomeIcon
                                                        icon={faEye}
                                                    />
                                                    Xem / xử lý
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}

                            {!loading &&
                                filteredReports.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="complaint-empty"
                                        >
                                            <div className="complaint-empty-icon">
                                                <FontAwesomeIcon
                                                    icon={
                                                        faClipboardList
                                                    }
                                                />
                                            </div>

                                            <strong>
                                                Không tìm thấy khiếu nại
                                            </strong>

                                            <p>
                                                Thử đổi từ khóa tìm kiếm
                                                hoặc bộ lọc trạng thái.
                                            </p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="complaint-table-footer">
                        <span>
                            Đang hiển thị {filteredReports.length} /{" "}
                            {reports.length} khiếu nại
                        </span>
                    </div>
                </section>

                {selectedReport && (
                    <div
                        className="admin-complaint-modal"
                        onClick={closeDetail}
                    >
                        <section
                            className="complaint-modal-content"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="complaint-modal-header">
                                <div className="complaint-modal-title">
                                    <div className="complaint-modal-icon">
                                        <FontAwesomeIcon
                                            icon={faClipboardList}
                                        />
                                    </div>

                                    <div>
                                        <h2>Chi tiết khiếu nại</h2>
                                        <p>
                                            Mã khiếu nại #{selectedReport.id}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="complaint-modal-close"
                                    aria-label="Đóng"
                                    onClick={closeDetail}
                                    disabled={submitting}
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>

                            {error && (
                                <div className="complaint-alert complaint-alert-error">
                                    <FontAwesomeIcon
                                        icon={faTriangleExclamation}
                                    />
                                    <span>{error}</span>
                                </div>
                            )}

                            {notice && (
                                <div className="complaint-alert complaint-alert-success">
                                    <FontAwesomeIcon icon={faCheck} />
                                    <span>{notice}</span>
                                </div>
                            )}

                            <div className="complaint-detail-grid">
                                <Detail
                                    label="Tiêu đề"
                                    value={selectedReport.subject}
                                />

                                <Detail
                                    label="Danh mục"
                                    value={selectedReport.category}
                                />

                                <Detail
                                    label="Người gửi"
                                    value={selectedReport.reporterName}
                                />

                                <Detail
                                    label="Email người gửi"
                                    value={selectedReport.reporterEmail}
                                />

                                <Detail
                                    label="Mã đơn hàng"
                                    value={selectedReport.bookingCode}
                                />

                                <Detail
                                    label="Đối tượng được báo cáo"
                                    value={selectedReport.reportedName}
                                />

                                <Detail
                                    label="Vai trò đối tượng"
                                    value={selectedReport.reportedRole}
                                />

                                <Detail
                                    label="Ngày gửi"
                                    value={formatDate(
                                        selectedReport.createdAt
                                    )}
                                />
                            </div>

                            <div className="complaint-description-section">
                                <h3>Nội dung khiếu nại</h3>

                                <div className="complaint-description">
                                    {selectedReport.description ||
                                        "Không có mô tả nội dung."}
                                </div>
                            </div>

                            {selectedReport.evidenceUrl && (
                                <div className="complaint-evidence">
                                    <div>
                                        <strong>Minh chứng đính kèm</strong>
                                        <p>
                                            Mở liên kết để xem minh chứng
                                            người gửi cung cấp.
                                        </p>
                                    </div>

                                    <a
                                        href={selectedReport.evidenceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="complaint-evidence-link"
                                    >
                                        Xem minh chứng
                                        <FontAwesomeIcon
                                            icon={faArrowRight}
                                        />
                                    </a>
                                </div>
                            )}

                            {selectedReport.resolution && (
                                <div className="complaint-previous-resolution">
                                    <h3>Kết quả xử lý trước đó</h3>
                                    <p>
                                        {selectedReport.resolution}
                                    </p>
                                </div>
                            )}

                            <form
                                className="complaint-resolution-form"
                                onSubmit={saveStatus}
                            >
                                <div className="complaint-form-field">
                                    <label htmlFor="complaint-status">
                                        Trạng thái xử lý
                                    </label>

                                    <select
                                        id="complaint-status"
                                        value={nextStatus}
                                        onChange={(event) =>
                                            setNextStatus(
                                                event.target.value
                                            )
                                        }
                                        disabled={
                                            isTerminal || submitting
                                        }
                                    >
                                        {Object.entries(
                                            STATUS_LABELS
                                        ).map(([value, label]) => (
                                            <option
                                                key={value}
                                                value={value}
                                            >
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="complaint-form-field">
                                    <label htmlFor="complaint-resolution">
                                        Kết quả / ghi chú xử lý
                                    </label>

                                    <textarea
                                        id="complaint-resolution"
                                        value={resolution}
                                        onChange={(event) =>
                                            setResolution(
                                                event.target.value
                                            )
                                        }
                                        disabled={
                                            isTerminal || submitting
                                        }
                                        rows={4}
                                        placeholder="Nhập kết quả xử lý hoặc lý do từ chối..."
                                    />
                                </div>

                                {isTerminal && (
                                    <div className="complaint-terminal-note">
                                        <FontAwesomeIcon icon={faCheck} />
                                        Khiếu nại đã kết thúc xử lý và không
                                        thể cập nhật thêm.
                                    </div>
                                )}

                                <div className="complaint-modal-actions">
                                    <button
                                        type="button"
                                        className="complaint-btn complaint-btn-secondary"
                                        onClick={closeDetail}
                                        disabled={submitting}
                                    >
                                        Đóng
                                    </button>

                                    {!isTerminal && (
                                        <button
                                            type="submit"
                                            className="complaint-btn complaint-btn-primary"
                                            disabled={submitting}
                                        >
                                            {submitting ? (
                                                <>
                                                    <FontAwesomeIcon
                                                        icon={faRotate}
                                                        className="complaint-spin"
                                                    />
                                                    Đang lưu...
                                                </>
                                            ) : (
                                                <>
                                                    <FontAwesomeIcon
                                                        icon={faCheck}
                                                    />
                                                    Lưu cập nhật
                                                </>
                                            )}
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

function StatCard({ icon, label, value, variant }) {
    return (
        <div className={`complaint-stat-card complaint-stat-${variant}`}>
            <div className="complaint-stat-top">
                <span>{label}</span>

                <div className="complaint-stat-icon">
                    <FontAwesomeIcon icon={icon} />
                </div>
            </div>

            <strong className="complaint-stat-value">
                {value}
            </strong>

            <span className="complaint-stat-caption">
                Theo dữ liệu hệ thống
            </span>
        </div>
    );
}

function Detail({ label, value }) {
    return (
        <div className="complaint-detail-item">
            <span className="complaint-detail-label">
                {label}
            </span>

            <strong className="complaint-detail-value">
                {value || "—"}
            </strong>
        </div>
    );
}

export default AdminComplaintManagement;
