
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
    faPaperPlane,
    faComments
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "./AdminLayout";
import { downloadReportEvidence } from "../../services/api";
import "./AdminComplaintManagement.css";

const API_URL = "http://localhost:8080/api/reports";

const STATUS_LABELS = {
    OPEN: "Mới tiếp nhận",
    IN_PROGRESS: "Đang xử lý",
    PROVIDER_RESPONDED: "Nhà cung cấp đã phản hồi",
    RESOLVED: "Đã giải quyết",
    REJECTED: "Đã từ chối"
};

const STATUS_OPTIONS = {
    IN_PROGRESS: "Đang xử lý",
    RESOLVED: "Đã giải quyết",
    REJECTED: "Đã từ chối"
};

const STATUS_CLASSES = {
    OPEN: "complaint-status complaint-status-open",
    IN_PROGRESS: "complaint-status complaint-status-progress",
    PROVIDER_RESPONDED: "complaint-status complaint-status-progress",
    RESOLVED: "complaint-status complaint-status-resolved",
    REJECTED: "complaint-status complaint-status-rejected"
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

    if (!token) {
        throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }

    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            Authorization: `Bearer ${token}`,
            ...options.headers
        }
    });

    if (!response.ok) {
        let message = `Yêu cầu thất bại (HTTP ${response.status}).`;

        try {
            const data = await response.json();
            message = data.message || data.detail || data.error || message;
        } catch {
            message = `Yêu cầu thất bại (HTTP ${response.status}).`;
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
        minute: "2-digit"
    });
}

function getReportStatus(report) {
    return String(report?.status || "OPEN").toUpperCase();
}

function getReportTitle(report) {
    return report?.subject || "Không có tiêu đề";
}

function isTerminalStatus(status) {
    return ["RESOLVED", "REJECTED"].includes(status);
}

function getResponseAuthorRole(role) {
    const value = String(role || "").toUpperCase();

    const roles = {
        ADMIN: "Quản trị viên",
        ROLE_ADMIN: "Quản trị viên",
        STAFF: "Nhân viên hỗ trợ",
        ROLE_STAFF: "Nhân viên hỗ trợ",
        PROVIDER: "Nhà cung cấp",
        CUSTOMER: "Khách hàng",
        CLEANER: "Nhân viên vệ sinh"
    };

    return roles[value] || role || "Người tham gia";
}

function AdminComplaintManagement() {
    const [reports, setReports] = useState([]);
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [selectedReport, setSelectedReport] = useState(null);
    const [responses, setResponses] = useState([]);
    const [responseContent, setResponseContent] = useState("");
    const [responsesLoading, setResponsesLoading] = useState(false);
    const [responseError, setResponseError] = useState("");
    const [nextStatus, setNextStatus] = useState("IN_PROGRESS");
    const [resolution, setResolution] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [sendingResponse, setSendingResponse] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const handleEvidenceDownload = async reportId => {
        try {
            await downloadReportEvidence(`/api/reports/${reportId}/evidence`, `bang-chung-khieu-nai-${reportId}`);
        } catch (downloadError) {
            setError(downloadError.message || "Không thể tải tệp bằng chứng.");
        }
    };

    const loadReports = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);

        setError("");

        try {
            const data = await apiRequest(`${API_URL}/admin`);
            const list = Array.isArray(data) ? data : [];

            setReports(list);

            return list;
        } catch (err) {
            setError(
                err.message ||
                "Không thể tải danh sách khiếu nại. Hãy kiểm tra backend và quyền tài khoản."
            );

            throw err;
        } finally {
            if (showLoading) setLoading(false);
        }
    }, []);

    const loadResponses = useCallback(async (reportId) => {
        if (!reportId) return;

        setResponsesLoading(true);
        setResponseError("");

        try {
            const data = await apiRequest(`${API_URL}/${reportId}/responses`);
            setResponses(Array.isArray(data) ? data : []);
        } catch (err) {
            setResponses([]);
            setResponseError(
                err.message || "Không thể tải lịch sử phản hồi của khiếu nại."
            );
        } finally {
            setResponsesLoading(false);
        }
    }, []);

    useEffect(() => {
        loadReports().catch(() => {});
    }, [loadReports]);

    const filteredReports = useMemo(() => {
        const search = keyword.trim().toLowerCase();

        return reports.filter((report) => {
            const status = getReportStatus(report);

            const matchesStatus =
                statusFilter === "ALL" || status === statusFilter;

            const searchable = [
                report.subject,
                report.category,
                report.reporterName,
                report.reporterEmail,
                report.bookingCode,
                report.reportedName,
                report.description,
                report.id
            ]
                .filter((value) => value !== null && value !== undefined)
                .join(" ")
                .toLowerCase();

            return matchesStatus && (!search || searchable.includes(search));
        });
    }, [reports, keyword, statusFilter]);

    const stats = useMemo(() => ({
        total: reports.length,
        open: reports.filter(
            (report) => getReportStatus(report) === "OPEN"
        ).length,
        processing: reports.filter(
            (report) => [
                "IN_PROGRESS",
                "PROVIDER_RESPONDED"
            ].includes(getReportStatus(report))
        ).length,
        finished: reports.filter(
            (report) => isTerminalStatus(getReportStatus(report))
        ).length
    }), [reports]);

    const openDetail = (report) => {
        const status = getReportStatus(report);

        setSelectedReport(report);
        setNextStatus(
            status === "OPEN" || status === "PROVIDER_RESPONDED"
                ? "IN_PROGRESS"
                : status
        );
        setResolution(report.resolution || "");
        setResponses([]);
        setResponseContent("");
        setResponseError("");
        setError("");
        setNotice("");

        loadResponses(report.id);
    };

    const closeDetail = () => {
        if (submitting || sendingResponse) return;

        setSelectedReport(null);
        setResponses([]);
        setResponseContent("");
        setResponseError("");
        setError("");
        setNotice("");
    };

    const saveStatus = async (event) => {
        event.preventDefault();

        if (!selectedReport || submitting) return;

        if (isTerminal) {
            setError("Khiếu nại đã kết thúc xử lý, không thể cập nhật thêm.");
            return;
        }

        if (!Object.keys(STATUS_OPTIONS).includes(nextStatus)) {
            setError("Trạng thái xử lý không hợp lệ.");
            return;
        }

        if (
            ["RESOLVED", "REJECTED"].includes(nextStatus) &&
            !resolution.trim()
        ) {
            setError(
                "Vui lòng nhập kết quả xử lý trước khi kết thúc khiếu nại."
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
                        resolution: resolution.trim()
                    })
                }
            );

            const updatedReport =
                updated && updated.id !== undefined
                    ? updated
                    : {
                        ...selectedReport,
                        status: nextStatus,
                        resolution: resolution.trim()
                    };

            setReports((current) =>
                current.map((report) =>
                    report.id === updatedReport.id
                        ? { ...report, ...updatedReport }
                        : report
                )
            );

            setSelectedReport((current) =>
                current ? { ...current, ...updatedReport } : current
            );

            setNextStatus(getReportStatus(updatedReport));
            setResolution(updatedReport.resolution || "");

            await loadResponses(updatedReport.id);

            setNotice("Đã cập nhật trạng thái khiếu nại.");
        } catch (err) {
            setError(
                err.message || "Không thể cập nhật trạng thái khiếu nại."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const sendResponse = async (event) => {
        event.preventDefault();

        if (!selectedReport || sendingResponse) return;

        if (isTerminal) {
            setError(
                "Khiếu nại đã kết thúc xử lý nên không thể gửi phản hồi mới."
            );
            return;
        }

        const content = responseContent.trim();

        if (!content) {
            setError("Vui lòng nhập nội dung phản hồi.");
            return;
        }

        if (content.length > 10000) {
            setError("Nội dung phản hồi không được vượt quá 10000 ký tự.");
            return;
        }

        setSendingResponse(true);
        setError("");
        setNotice("");

        try {
            await apiRequest(
                `${API_URL}/${selectedReport.id}/responses`,
                {
                    method: "POST",
                    body: JSON.stringify({ content })
                }
            );

            setResponseContent("");

            await loadResponses(selectedReport.id);
            await loadReports(false);

            setNotice(
                "Đã gửi phản hồi. Nội dung được lưu vào lịch sử trao đổi."
            );
        } catch (err) {
            setError(err.message || "Không thể gửi phản hồi.");
        } finally {
            setSendingResponse(false);
        }
    };

    const isTerminal = selectedReport
        ? isTerminalStatus(getReportStatus(selectedReport))
        : false;

    return (
        <AdminLayout>
            <div className="admin-complaint-page">
                <div className="complaint-page-header">
                    <div className="complaint-page-heading">
                        <div>
                            <h1>Quản lý khiếu nại</h1>
                            <p>
                                Tiếp nhận, theo dõi và xử lý phản ánh từ khách hàng.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="complaint-btn complaint-btn-primary"
                        onClick={() => loadReports()}
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
                            <p>Theo dõi nội dung và trạng thái từng báo cáo.</p>
                        </div>
                        <span className="complaint-result-count">
                            {filteredReports.length} kết quả
                        </span>
                    </div>

                    <div className="complaint-toolbar">
                        <div className="complaint-search">
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                            <input
                                type="text"
                                value={keyword}
                                onChange={(event) => setKeyword(event.target.value)}
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
                            onChange={(event) => setStatusFilter(event.target.value)}
                        >
                            <option value="ALL">Tất cả trạng thái</option>
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
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
                                <th className="complaint-action-column">Thao tác</th>
                            </tr>
                            </thead>
                            <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={6} className="complaint-empty">
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

                            {!loading && filteredReports.map((report) => {
                                const status = getReportStatus(report);

                                return (
                                    <tr key={report.id}>
                                        <td>
                                            <div className="complaint-subject">
                                                {getReportTitle(report)}
                                            </div>
                                            <div className="complaint-subtitle">
                                                {report.category || "Chưa phân loại"}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="complaint-reporter">
                                                {report.reporterName || "Không rõ"}
                                            </div>
                                            <div className="complaint-subtitle">
                                                {report.reporterEmail || "Chưa có email"}
                                            </div>
                                        </td>
                                        <td>
                                                <span className="complaint-booking-code">
                                                    {report.bookingCode || "—"}
                                                </span>
                                        </td>
                                        <td className="complaint-date">
                                            {formatDate(report.createdAt)}
                                        </td>
                                        <td>
                                                <span
                                                    className={
                                                        STATUS_CLASSES[status] ||
                                                        "complaint-status"
                                                    }
                                                >
                                                    <span className="complaint-status-dot" />
                                                    {STATUS_LABELS[status] || status}
                                                </span>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="complaint-btn complaint-btn-view"
                                                onClick={() => openDetail(report)}
                                            >
                                                <FontAwesomeIcon icon={faEye} />
                                                Xem / xử lý
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {!loading && filteredReports.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="complaint-empty">
                                        <div className="complaint-empty-icon">
                                            <FontAwesomeIcon icon={faClipboardList} />
                                        </div>
                                        <strong>Không tìm thấy khiếu nại</strong>
                                        <p>
                                            Thử đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.
                                        </p>
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>

                    <div className="complaint-table-footer">
                        <span>
                            Đang hiển thị {filteredReports.length} / {reports.length} khiếu nại
                        </span>
                    </div>
                </section>

                {selectedReport && (
                    <div className="admin-complaint-modal" onClick={closeDetail}>
                        <section
                            className="complaint-modal-content"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="complaint-modal-header">
                                <div className="complaint-modal-title">
                                    <div className="complaint-modal-icon">
                                        <FontAwesomeIcon icon={faClipboardList} />
                                    </div>
                                    <div>
                                        <h2>Chi tiết khiếu nại</h2>
                                        <p>Mã khiếu nại #{selectedReport.id}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="complaint-modal-close"
                                    aria-label="Đóng"
                                    onClick={closeDetail}
                                    disabled={submitting || sendingResponse}
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>

                            {error && (
                                <div className="complaint-alert complaint-alert-error">
                                    <FontAwesomeIcon icon={faTriangleExclamation} />
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
                                    value={formatDate(selectedReport.createdAt)}
                                />
                                <Detail
                                    label="Người phụ trách"
                                    value={selectedReport.handledBy}
                                />
                                <Detail
                                    label="SLA phản hồi đầu tiên"
                                    value={selectedReport.firstRespondedAt
                                        ? `Đã phản hồi lúc ${formatDate(selectedReport.firstRespondedAt)}`
                                        : selectedReport.responseDueAt
                                            ? `${selectedReport.responseOverdue ? "Quá hạn" : "Hạn phản hồi"}: ${formatDate(selectedReport.responseDueAt)} (${selectedReport.responseSlaHours || 24} giờ)`
                                            : "Chưa có dữ liệu"}
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
                                            Mở liên kết để xem minh chứng người gửi cung cấp.
                                        </p>
                                    </div>
                                    {selectedReport.evidenceUrl.startsWith("/api/reports/") ? (
                                        <button type="button" onClick={() => handleEvidenceDownload(selectedReport.id)} className="complaint-evidence-link">
                                            Tải minh chứng <FontAwesomeIcon icon={faArrowRight} />
                                        </button>
                                    ) : (
                                        <a href={selectedReport.evidenceUrl} target="_blank" rel="noreferrer" className="complaint-evidence-link">
                                            Xem minh chứng <FontAwesomeIcon icon={faArrowRight} />
                                        </a>
                                    )}
                                </div>
                            )}

                            <section className="complaint-conversation">
                                <div className="complaint-conversation-heading">
                                    <div>
                                        <h3>
                                            <FontAwesomeIcon icon={faComments} />
                                            Lịch sử trao đổi
                                        </h3>
                                        <p>
                                            Các phản hồi được lưu riêng và giữ lại trong lịch sử khiếu nại.
                                        </p>
                                    </div>
                                    <span>{responses.length} phản hồi</span>
                                </div>

                                {responseError && (
                                    <div className="complaint-alert complaint-alert-error">
                                        <FontAwesomeIcon icon={faTriangleExclamation} />
                                        <span>{responseError}</span>
                                        <button
                                            type="button"
                                            onClick={() => loadResponses(selectedReport.id)}
                                        >
                                            Thử lại
                                        </button>
                                    </div>
                                )}

                                {responsesLoading && (
                                    <div className="complaint-response-empty">
                                        <FontAwesomeIcon
                                            icon={faRotate}
                                            className="complaint-spin"
                                        />
                                        Đang tải lịch sử trao đổi...
                                    </div>
                                )}

                                {!responsesLoading &&
                                    !responseError &&
                                    responses.length === 0 && (
                                        <div className="complaint-response-empty">
                                            Chưa có phản hồi nào cho khiếu nại này.
                                        </div>
                                    )}

                                {!responsesLoading && responses.length > 0 && (
                                    <div className="complaint-response-list">
                                        {responses.map((response) => (
                                            <article
                                                className="complaint-response-item"
                                                key={response.id}
                                            >
                                                <div className="complaint-response-top">
                                                    <div>
                                                        <strong>
                                                            {response.responderName ||
                                                                response.authorName ||
                                                                "Tài khoản hệ thống"}
                                                        </strong>
                                                        <span>
                                                            {getResponseAuthorRole(
                                                                response.responderRole ||
                                                                response.authorRole
                                                            )}
                                                        </span>
                                                    </div>
                                                    <time>
                                                        {formatDate(response.createdAt)}
                                                    </time>
                                                </div>
                                                <p>{response.content}</p>
                                                {(response.attachmentUrl ||
                                                    response.evidenceUrl) && (
                                                    <a
                                                        href={
                                                            response.attachmentUrl ||
                                                            response.evidenceUrl
                                                        }
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        Xem tệp đính kèm
                                                    </a>
                                                )}
                                            </article>
                                        ))}
                                    </div>
                                )}

                                <form
                                    className="complaint-response-form"
                                    onSubmit={sendResponse}
                                >
                                    <label htmlFor="complaint-response">
                                        Gửi phản hồi
                                    </label>
                                    <textarea
                                        id="complaint-response"
                                        rows={3}
                                        maxLength={10000}
                                        value={responseContent}
                                        onChange={(event) =>
                                            setResponseContent(event.target.value)
                                        }
                                        placeholder="Nhập nội dung phản hồi cho khiếu nại..."
                                        disabled={sendingResponse || isTerminal}
                                    />
                                    <div className="complaint-response-actions">
                                        <span>
                                            {isTerminal
                                                ? "Khiếu nại đã kết thúc, không thể gửi phản hồi mới."
                                                : "Phản hồi sẽ được lưu vào lịch sử trao đổi."}
                                        </span>
                                        <button
                                            type="submit"
                                            className="complaint-btn complaint-btn-primary"
                                            disabled={
                                                sendingResponse ||
                                                isTerminal ||
                                                !responseContent.trim()
                                            }
                                        >
                                            <FontAwesomeIcon
                                                icon={
                                                    sendingResponse
                                                        ? faRotate
                                                        : faPaperPlane
                                                }
                                                className={
                                                    sendingResponse
                                                        ? "complaint-spin"
                                                        : ""
                                                }
                                            />
                                            {sendingResponse
                                                ? "Đang gửi..."
                                                : "Gửi phản hồi"}
                                        </button>
                                    </div>
                                </form>
                            </section>

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
                                            setNextStatus(event.target.value)
                                        }
                                        disabled={isTerminal || submitting}
                                    >
                                        {Object.entries(STATUS_OPTIONS).map(
                                            ([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            )
                                        )}
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
                                            setResolution(event.target.value)
                                        }
                                        disabled={isTerminal || submitting}
                                        rows={4}
                                        maxLength={10000}
                                        placeholder="Nhập kết quả xử lý hoặc lý do từ chối..."
                                    />
                                </div>

                                {isTerminal && (
                                    <div className="complaint-terminal-note">
                                        <FontAwesomeIcon icon={faCheck} />
                                        Khiếu nại đã kết thúc xử lý. Không thể thay đổi trạng thái hoặc gửi phản hồi mới; bạn vẫn có thể xem lịch sử trao đổi.
                                    </div>
                                )}

                                <div className="complaint-modal-actions">
                                    <button
                                        type="button"
                                        className="complaint-btn complaint-btn-secondary"
                                        onClick={closeDetail}
                                        disabled={submitting || sendingResponse}
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
                                                    <FontAwesomeIcon icon={faCheck} />
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
            <strong className="complaint-stat-value">{value}</strong>
            <span className="complaint-stat-caption">
                Theo dữ liệu hệ thống
            </span>
        </div>
    );
}

function Detail({ label, value }) {
    return (
        <div className="complaint-detail-item">
            <span className="complaint-detail-label">{label}</span>
            <strong className="complaint-detail-value">
                {value || "—"}
            </strong>
        </div>
    );
}

export default AdminComplaintManagement;
