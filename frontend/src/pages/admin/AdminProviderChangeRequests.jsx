import { useCallback, useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { adminProviderChangeRequestApi } from "../../services/providerApi";
import "./AdminProviderChangeRequests.css";

const STATUS_OPTIONS = [
    { value: "", label: "Tất cả trạng thái" },
    { value: "PENDING_REVIEW", label: "Chờ duyệt" },
    { value: "NEEDS_INFORMATION", label: "Cần bổ sung thông tin" },
    { value: "APPROVED", label: "Đã phê duyệt" },
    { value: "REJECTED", label: "Đã từ chối" },
    { value: "WITHDRAWN", label: "Đã rút yêu cầu" },
];

const STATUS_CONFIG = {
    PENDING_REVIEW: {
        label: "Chờ duyệt",
        className: "badge-warning",
    },
    NEEDS_INFORMATION: {
        label: "Cần bổ sung thông tin",
        className: "badge-info",
    },
    APPROVED: {
        label: "Đã phê duyệt",
        className: "badge-success",
    },
    REJECTED: {
        label: "Đã từ chối",
        className: "badge-danger",
    },
    WITHDRAWN: {
        label: "Đã rút yêu cầu",
        className: "badge-secondary",
    },
};

const TYPE_LABELS = {
    LOCATION_UPDATE: "Thay đổi vị trí / Tọa độ",
    PROFILE_UPDATE: "Thay đổi thông tin doanh nghiệp",
    SERVICE_REGISTER: "Đăng ký dịch vụ mới",
    SERVICE_UPDATE: "Điều chỉnh giá dịch vụ",
    SERVICE_PAUSE: "Tạm dừng dịch vụ",
    SERVICE_RETIRE: "Ngừng cung cấp dịch vụ",
};

const FIELD_LABELS = {
    address: "Địa chỉ hoạt động",
    latitude: "Vĩ độ",
    longitude: "Kinh độ",
    businessName: "Tên doanh nghiệp",
    description: "Mô tả doanh nghiệp",
    taxCode: "Mã số thuế",
    serviceId: "Mã dịch vụ",
    price: "Giá dịch vụ",
    basePrice: "Giá nền",
    status: "Trạng thái",
    name: "Tên dịch vụ",
    categoryId: "Danh mục",
    categoryName: "Tên danh mục",
    serviceName: "Tên dịch vụ",
    packageId: "Mã gói dịch vụ",
    packageName: "Tên gói dịch vụ",
};

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("vi-VN");
}

function parseSnapshot(snapshot) {
    if (!snapshot) return {};

    if (typeof snapshot === "object" && !Array.isArray(snapshot)) {
        return snapshot;
    }

    const text = String(snapshot).trim();

    if (!text) return {};

    try {
        const parsed = JSON.parse(text);

        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed;
        }
    } catch {
        // Tiếp tục thử định dạng key=value.
    }

    const result = {};

    text.replace(/^\{|\}$/g, "").split(";").forEach((item) => {
        const separator = item.indexOf("=");

        if (separator < 1) return;

        const key = item.substring(0, separator).trim();
        const value = item.substring(separator + 1).trim();

        if (key) result[key] = value;
    });

    return result;
}

function displayValue(value) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    if (typeof value === "object") {
        return JSON.stringify(value);
    }

    return String(value);
}

function StatusBadge({ status }) {
    const normalized = String(status || "").toUpperCase();

    const config = STATUS_CONFIG[normalized] || {
        label: status || "Không xác định",
        className: "badge-secondary",
    };

    return (
        <span className={`badge ${config.className}`}>
            {config.label}
        </span>
    );
}

function AdminProviderChangeRequests() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const [selectedRequest, setSelectedRequest] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [actionType, setActionType] = useState("");
    const [actionReason, setActionReason] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [modalError, setModalError] = useState("");

    const loadRequests = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const data = await adminProviderChangeRequestApi.list(statusFilter);
            setRequests(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message || "Không thể tải danh sách yêu cầu.");
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const openDetail = async (request) => {
        setSelectedRequest(request);
        setActionType("");
        setActionReason("");
        setModalError("");
        setDetailLoading(true);

        try {
            const detail = await adminProviderChangeRequestApi.get(request.id);
            setSelectedRequest(detail);
        } catch (err) {
            setModalError(err.message || "Không thể tải chi tiết yêu cầu.");
        } finally {
            setDetailLoading(false);
        }
    };

    const closeModal = () => {
        if (submitting) return;

        setSelectedRequest(null);
        setActionType("");
        setActionReason("");
        setModalError("");
    };

    const closeModalAfterSuccess = () => {
        setSelectedRequest(null);
        setActionType("");
        setActionReason("");
        setModalError("");
    };

    const submitRequestInfo = async () => {
        if (!actionReason.trim()) {
            setModalError("Vui lòng ghi rõ thông tin hoặc tài liệu cần Provider bổ sung.");
            return;
        }

        if (actionReason.trim().length < 5) {
            setModalError("Nội dung yêu cầu bổ sung quá ngắn.");
            return;
        }

        setSubmitting(true);
        setModalError("");

        try {
            const requestId = selectedRequest.id;

            await adminProviderChangeRequestApi.requestInfo(
                requestId,
                actionReason.trim()
            );

            setMessage(
                `Đã yêu cầu Provider bổ sung thông tin cho yêu cầu #${requestId}.`
            );

            closeModalAfterSuccess();
            await loadRequests();
        } catch (err) {
            setModalError(err.message || "Không thể yêu cầu bổ sung thông tin.");
        } finally {
            setSubmitting(false);
        }
    };

    const submitReject = async () => {
        if (!actionReason.trim()) {
            setModalError("Vui lòng nhập lý do từ chối.");
            return;
        }

        if (actionReason.trim().length < 5) {
            setModalError("Lý do từ chối phải có ít nhất 5 ký tự.");
            return;
        }

        setSubmitting(true);
        setModalError("");

        try {
            const requestId = selectedRequest.id;

            await adminProviderChangeRequestApi.reject(
                requestId,
                actionReason.trim()
            );

            setMessage(`Đã từ chối yêu cầu #${requestId}.`);

            closeModalAfterSuccess();
            await loadRequests();
        } catch (err) {
            setModalError(err.message || "Không thể từ chối yêu cầu.");
        } finally {
            setSubmitting(false);
        }
    };

    const submitApprove = async () => {
        const confirmed = window.confirm(
            `Bạn có chắc chắn muốn phê duyệt yêu cầu #${selectedRequest.id}? Dữ liệu đề xuất sẽ được áp dụng vào hồ sơ Provider.`
        );

        if (!confirmed) return;

        setSubmitting(true);
        setModalError("");

        try {
            const requestId = selectedRequest.id;

            await adminProviderChangeRequestApi.approve(requestId);

            setMessage(`Đã phê duyệt yêu cầu #${requestId} thành công.`);

            closeModalAfterSuccess();
            await loadRequests();
        } catch (err) {
            setModalError(err.message || "Không thể phê duyệt yêu cầu.");
        } finally {
            setSubmitting(false);
        }
    };

    const renderSnapshotTable = (oldSnapshot, proposedSnapshot) => {
        const oldValues = parseSnapshot(oldSnapshot);
        const newValues = parseSnapshot(proposedSnapshot);

        const keys = Array.from(
            new Set([
                ...Object.keys(oldValues),
                ...Object.keys(newValues),
            ])
        );

        if (keys.length === 0) {
            return (
                <div className="provider-snapshot-empty">
                    Không có dữ liệu snapshot để so sánh.
                </div>
            );
        }

        return (
            <div className="provider-snapshot-table-wrap">
                <table className="admin-table">
                    <thead>
                    <tr>
                        <th>Thông tin</th>
                        <th>Dữ liệu hiện tại</th>
                        <th>Dữ liệu đề xuất</th>
                    </tr>
                    </thead>
                    <tbody>
                    {keys.map((key) => (
                        <tr key={key}>
                            <td>
                                <strong>{FIELD_LABELS[key] || key}</strong>
                            </td>
                            <td className="provider-old-value">
                                {displayValue(oldValues[key])}
                            </td>
                            <td className="provider-new-value">
                                {displayValue(newValues[key])}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const pendingCount = requests.filter(
        (item) => item.status === "PENDING_REVIEW"
    ).length;

    const needInfoCount = requests.filter(
        (item) => item.status === "NEEDS_INFORMATION"
    ).length;

    const approvedCount = requests.filter(
        (item) => item.status === "APPROVED"
    ).length;

    return (
        <AdminLayout>
            <div className="admin-provider-change-page">
                <header className="admin-header">
                    <div>
                        <h1>Xét duyệt yêu cầu từ Provider</h1>
                        <p>
                            Kiểm tra và xử lý các đề xuất thay đổi hồ sơ,
                            vị trí và dịch vụ của doanh nghiệp.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="admin-btn admin-btn-outline"
                        onClick={loadRequests}
                        disabled={loading}
                    >
                        {loading ? "Đang tải..." : "Làm mới"}
                    </button>
                </header>

                {message && (
                    <div className="provider-alert provider-alert-success">
                        {message}
                    </div>
                )}

                {error && (
                    <div className="provider-alert provider-alert-error">
                        {error}
                    </div>
                )}

                <section className="provider-summary-grid">
                    <div className="admin-card provider-summary-card">
                        <span className="provider-summary-label">
                            Tổng yêu cầu
                        </span>
                        <strong>{requests.length}</strong>
                    </div>

                    <div className="admin-card provider-summary-card">
                        <span className="provider-summary-label warning">
                            Đang chờ duyệt
                        </span>
                        <strong>{pendingCount}</strong>
                    </div>

                    <div className="admin-card provider-summary-card">
                        <span className="provider-summary-label info">
                            Cần bổ sung thông tin
                        </span>
                        <strong>{needInfoCount}</strong>
                    </div>

                    <div className="admin-card provider-summary-card">
                        <span className="provider-summary-label success">
                            Đã phê duyệt
                        </span>
                        <strong>{approvedCount}</strong>
                    </div>
                </section>

                <section className="admin-card provider-filter-card">
                    <label htmlFor="provider-request-status">
                        Trạng thái:
                    </label>

                    <select
                        id="provider-request-status"
                        className="admin-select"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                    >
                        {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </section>

                <section className="admin-card provider-request-table-card">
                    {loading ? (
                        <div className="provider-table-state">
                            Đang tải danh sách yêu cầu...
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="provider-table-state">
                            Không có yêu cầu nào phù hợp.
                        </div>
                    ) : (
                        <div className="provider-main-table-wrap">
                            <table className="admin-table">
                                <thead>
                                <tr>
                                    <th>Mã yêu cầu</th>
                                    <th>Doanh nghiệp</th>
                                    <th>Loại yêu cầu</th>
                                    <th>Lý do</th>
                                    <th>Ngày gửi</th>
                                    <th>Trạng thái</th>
                                    <th>Người xử lý</th>
                                    <th>Thao tác</th>
                                </tr>
                                </thead>
                                <tbody>
                                {requests.map((request) => (
                                    <tr key={request.id}>
                                        <td>
                                            <strong>#{request.id}</strong>
                                        </td>
                                        <td>
                                            <strong>
                                                {request.businessName || "—"}
                                            </strong>
                                            <small className="provider-table-subtext">
                                                Provider #{request.partnerId ?? "—"}
                                            </small>
                                        </td>
                                        <td>
                                            {TYPE_LABELS[request.requestType] ||
                                                request.requestType ||
                                                "—"}
                                        </td>
                                        <td className="provider-reason-cell">
                                            {request.reason || "—"}
                                        </td>
                                        <td>{formatDate(request.createdAt)}</td>
                                        <td>
                                            <StatusBadge status={request.status} />
                                        </td>
                                        <td>
                                            {request.reviewedBy || "—"}
                                            {request.reviewedAt && (
                                                <small className="provider-table-subtext">
                                                    {formatDate(request.reviewedAt)}
                                                </small>
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="admin-btn admin-btn-sm"
                                                onClick={() => openDetail(request)}
                                            >
                                                Xem chi tiết
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {selectedRequest && (
                    <div
                        className="provider-modal-backdrop"
                        onClick={(event) => {
                            if (event.target === event.currentTarget) {
                                closeModal();
                            }
                        }}
                    >
                        <div className="provider-modal">
                            <div className="provider-modal-header">
                                <div>
                                    <h2>
                                        Chi tiết yêu cầu #{selectedRequest.id}
                                    </h2>
                                    <p>
                                        {selectedRequest.businessName || "Doanh nghiệp"}
                                        {" · "}
                                        {TYPE_LABELS[selectedRequest.requestType] ||
                                            selectedRequest.requestType}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="provider-modal-close"
                                    onClick={closeModal}
                                    disabled={submitting}
                                    aria-label="Đóng"
                                >
                                    ×
                                </button>
                            </div>

                            {detailLoading ? (
                                <div className="provider-modal-loading">
                                    Đang tải chi tiết...
                                </div>
                            ) : (
                                <>
                                    {modalError && (
                                        <div className="provider-alert provider-alert-error">
                                            {modalError}
                                        </div>
                                    )}

                                    <div className="provider-detail-meta">
                                        <StatusBadge status={selectedRequest.status} />
                                        <span>
                                            Ngày gửi: {formatDate(selectedRequest.createdAt)}
                                        </span>
                                    </div>

                                    <section className="provider-detail-section">
                                        <h3>Lý do Provider gửi yêu cầu</h3>
                                        <div className="provider-detail-content">
                                            {selectedRequest.reason || "Không có nội dung."}
                                        </div>
                                    </section>

                                    <section className="provider-detail-section">
                                        <h3>So sánh thông tin trước và sau</h3>
                                        {renderSnapshotTable(
                                            selectedRequest.oldSnapshot,
                                            selectedRequest.proposedSnapshot
                                        )}
                                    </section>

                                    {selectedRequest.evidenceUrl && (
                                        <section className="provider-detail-section">
                                            <h3>Bằng chứng đính kèm</h3>
                                            <a
                                                href={selectedRequest.evidenceUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Mở tài liệu / hình ảnh đính kèm
                                            </a>
                                        </section>
                                    )}

                                    {selectedRequest.rejectReason && (
                                        <section className="provider-previous-note">
                                            <strong>Ghi chú xử lý trước đó</strong>
                                            <p>{selectedRequest.rejectReason}</p>
                                        </section>
                                    )}

                                    {selectedRequest.reviewedBy && (
                                        <div className="provider-reviewed-info">
                                            Người xử lý: {selectedRequest.reviewedBy}
                                            {" · "}
                                            {formatDate(selectedRequest.reviewedAt)}
                                        </div>
                                    )}

                                    {selectedRequest.status === "PENDING_REVIEW" ? (
                                        <>
                                            {actionType && (
                                                <div className="provider-action-reason">
                                                    <label>
                                                        {actionType === "REJECT"
                                                            ? "Lý do từ chối *"
                                                            : "Thông tin cần Provider bổ sung *"}
                                                    </label>

                                                    <textarea
                                                        value={actionReason}
                                                        onChange={(event) =>
                                                            setActionReason(event.target.value)
                                                        }
                                                        rows={4}
                                                        maxLength={2000}
                                                        placeholder={
                                                            actionType === "REJECT"
                                                                ? "Nêu rõ lý do từ chối yêu cầu..."
                                                                : "Nêu rõ giấy tờ, thông tin hoặc nội dung cần bổ sung..."
                                                        }
                                                    />
                                                </div>
                                            )}

                                            <div className="provider-modal-actions">
                                                <button
                                                    type="button"
                                                    className="admin-btn admin-btn-ghost"
                                                    onClick={closeModal}
                                                    disabled={submitting}
                                                >
                                                    Đóng
                                                </button>

                                                <button
                                                    type="button"
                                                    className="admin-btn admin-btn-outline"
                                                    onClick={() => {
                                                        setActionType("REQUEST_INFO");
                                                        setActionReason("");
                                                        setModalError("");
                                                    }}
                                                    disabled={submitting}
                                                >
                                                    Yêu cầu bổ sung
                                                </button>

                                                <button
                                                    type="button"
                                                    className="admin-btn admin-btn-danger"
                                                    onClick={() => {
                                                        if (actionType === "REJECT") {
                                                            submitReject();
                                                        } else {
                                                            setActionType("REJECT");
                                                            setActionReason("");
                                                            setModalError("");
                                                        }
                                                    }}
                                                    disabled={submitting}
                                                >
                                                    {submitting && actionType === "REJECT"
                                                        ? "Đang xử lý..."
                                                        : actionType === "REJECT"
                                                            ? "Xác nhận từ chối"
                                                            : "Từ chối"}
                                                </button>

                                                {actionType === "REQUEST_INFO" && (
                                                    <button
                                                        type="button"
                                                        className="admin-btn admin-btn-outline"
                                                        onClick={submitRequestInfo}
                                                        disabled={submitting}
                                                    >
                                                        {submitting
                                                            ? "Đang gửi..."
                                                            : "Gửi yêu cầu bổ sung"}
                                                    </button>
                                                )}

                                                {!actionType && (
                                                    <button
                                                        type="button"
                                                        className="admin-btn admin-btn-success"
                                                        onClick={submitApprove}
                                                        disabled={submitting}
                                                    >
                                                        {submitting
                                                            ? "Đang duyệt..."
                                                            : "Phê duyệt"}
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="provider-modal-actions provider-modal-actions-end">
                                            <button
                                                type="button"
                                                className="admin-btn admin-btn-ghost"
                                                onClick={closeModal}
                                            >
                                                Đóng
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

export default AdminProviderChangeRequests;