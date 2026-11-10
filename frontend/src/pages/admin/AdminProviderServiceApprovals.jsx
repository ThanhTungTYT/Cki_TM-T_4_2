
import { useCallback, useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faRotate,
    faCheck,
    faXmark,
    faEye,
    faClipboardCheck
} from "@fortawesome/free-solid-svg-icons";
import "./AdminProviderServiceApprovals.css";

const API = "/api/admin/provider-service-approvals";

function getToken() {
    return (
        localStorage.getItem("accessToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("accessToken") ||
        sessionStorage.getItem("token") ||
        ""
    );
}

async function apiRequest(url, options = {}) {
    const token = getToken();

    let response;

    try {
        response = await fetch(url, {
            ...options,
            headers: {
                Accept: "application/json",
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...options.headers
            }
        });
    } catch {
        throw new Error("Không kết nối được Backend. Hãy kiểm tra máy chủ.");
    }

    const raw = await response.text();
    let data = null;

    if (raw) {
        try {
            data = JSON.parse(raw);
        } catch {
            data = { message: raw };
        }
    }

    if (!response.ok) {
        throw new Error(
            data?.message ||
            data?.detail ||
            data?.error ||
            `Yêu cầu thất bại (HTTP ${response.status}).`
        );
    }

    return data;
}

const money = value => {
    if (value === null || value === undefined || value === "") {
        return "Chưa thiết lập";
    }

    return `${Number(value).toLocaleString("vi-VN")} đ`;
};

const dateTime = value => {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleString("vi-VN");
};

const statusLabels = {
    PENDING: "Chờ duyệt",
    ACTIVE: "Đang hoạt động",
    REJECTED: "Đã từ chối",
    INACTIVE: "Ngừng hoạt động",
    PAUSED: "Tạm ngừng"
};

export default function AdminProviderServiceApprovals() {
    const [items, setItems] = useState([]);
    const [status, setStatus] = useState("PENDING");
    const [keyword, setKeyword] = useState("");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [selected, setSelected] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [rejectReason, setRejectReason] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const params = new URLSearchParams({
                status,
                keyword: search
            });

            const data = await apiRequest(`${API}?${params.toString()}`);
            setItems(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e.message || "Không thể tải danh sách dịch vụ Provider.");
        } finally {
            setLoading(false);
        }
    }, [status, search]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const approve = async item => {
        const confirmed = window.confirm(
            `Bạn xác nhận phê duyệt dịch vụ "${item.serviceName}" của Provider "${item.providerName}"?`
        );

        if (!confirmed) return;

        setBusyId(item.id);
        setError("");
        setNotice("");

        try {
            await apiRequest(`${API}/${item.id}/approve`, {
                method: "POST",
                body: JSON.stringify({
                    reason: "Admin đã kiểm tra và phê duyệt dịch vụ."
                })
            });

            setNotice(`Đã phê duyệt dịch vụ "${item.serviceName}".`);
            setSelected(null);
            await loadData();
        } catch (e) {
            setError(e.message);
        } finally {
            setBusyId(null);
        }
    };

    const openReject = item => {
        setRejectTarget(item);
        setRejectReason("");
        setError("");
        setNotice("");
    };

    const reject = async event => {
        event.preventDefault();

        if (!rejectTarget || !rejectReason.trim()) {
            setError("Vui lòng nhập lý do từ chối.");
            return;
        }

        setBusyId(rejectTarget.id);
        setError("");

        try {
            await apiRequest(`${API}/${rejectTarget.id}/reject`, {
                method: "POST",
                body: JSON.stringify({
                    reason: rejectReason.trim()
                })
            });

            setNotice(`Đã từ chối dịch vụ "${rejectTarget.serviceName}".`);
            setRejectTarget(null);
            setRejectReason("");
            setSelected(null);
            await loadData();
        } catch (e) {
            setError(e.message);
        } finally {
            setBusyId(null);
        }
    };

    const pendingCount = items.filter(
        item => item.status === "PENDING"
    ).length;

    return (
        <AdminLayout>
            <div className="provider-service-approval-page">
                <div className="psa-heading">
                    <div>
                        <span className="psa-eyebrow">QUẢN LÝ NHÀ CUNG CẤP</span>
                        <h1>
                            <FontAwesomeIcon icon={faClipboardCheck} />
                            Duyệt dịch vụ Provider
                        </h1>
                        <p>
                            Kiểm tra thông tin, giá và trạng thái dịch vụ trước khi cho phép Provider cung cấp.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="psa-refresh"
                        onClick={loadData}
                        disabled={loading}
                    >
                        <FontAwesomeIcon icon={faRotate} />
                        Làm mới
                    </button>
                </div>

                {error && (
                    <div className="psa-alert psa-error">
                        {error}
                    </div>
                )}

                {notice && (
                    <div className="psa-alert psa-success">
                        {notice}
                    </div>
                )}

                <div className="psa-summary">
                    <div>
                        <span>Số bản ghi đang hiển thị</span>
                        <strong>{items.length}</strong>
                    </div>
                    <div>
                        <span>Chờ duyệt trong danh sách</span>
                        <strong>{pendingCount}</strong>
                    </div>
                </div>

                <section className="psa-panel">
                    <div className="psa-filters">
                        <label>
                            Trạng thái
                            <select
                                value={status}
                                onChange={e => setStatus(e.target.value)}
                            >
                                <option value="PENDING">Chờ duyệt</option>
                                <option value="ACTIVE">Đang hoạt động</option>
                                <option value="REJECTED">Đã từ chối</option>
                                <option value="INACTIVE">Ngừng hoạt động</option>
                                <option value="PAUSED">Tạm ngừng</option>
                                <option value="ALL">Tất cả</option>
                            </select>
                        </label>

                        <label className="psa-search">
                            Tìm kiếm
                            <input
                                value={keyword}
                                onChange={e => setKeyword(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === "Enter") {
                                        setSearch(keyword.trim());
                                    }
                                }}
                                placeholder="Tên dịch vụ, Provider, email, số điện thoại..."
                            />
                        </label>

                        <button
                            type="button"
                            onClick={() => setSearch(keyword.trim())}
                        >
                            Tìm kiếm
                        </button>
                    </div>

                    <div className="psa-table-wrap">
                        <table className="psa-table">
                            <thead>
                            <tr>
                                <th>Dịch vụ</th>
                                <th>Provider</th>
                                <th>Danh mục</th>
                                <th>Giá đăng ký</th>
                                <th>Thời lượng</th>
                                <th>Ngày gửi</th>
                                <th>Trạng thái</th>
                                <th>Thao tác</th>
                            </tr>
                            </thead>

                            <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="psa-empty">
                                        Đang tải dữ liệu...
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="psa-empty">
                                        Không có dịch vụ phù hợp.
                                    </td>
                                </tr>
                            ) : items.map(item => (
                                <tr key={item.id}>
                                    <td>
                                        <div className="psa-service-cell">
                                            {item.thumbnailUrl ? (
                                                <img
                                                    src={item.thumbnailUrl}
                                                    alt={item.serviceName}
                                                    onError={e => {
                                                        e.currentTarget.style.display = "none";
                                                    }}
                                                />
                                            ) : (
                                                <div className="psa-image-placeholder">
                                                    <FontAwesomeIcon icon={faClipboardCheck} />
                                                </div>
                                            )}
                                            <div>
                                                <strong>{item.serviceName}</strong>
                                                <small>ID dịch vụ: {item.serviceId}</small>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <strong>{item.providerName || "—"}</strong>
                                        <small>{item.providerEmail || "—"}</small>
                                        <small>{item.providerPhone || "—"}</small>
                                    </td>
                                    <td>{item.categoryName || "—"}</td>
                                    <td>{money(item.price)}</td>
                                    <td>
                                        {item.estimatedMinutes
                                            ? `${item.estimatedMinutes} phút`
                                            : "—"}
                                    </td>
                                    <td>{dateTime(item.createdAt)}</td>
                                    <td>
                                            <span className={`psa-status ${String(item.status).toLowerCase()}`}>
                                                {statusLabels[item.status] || item.status}
                                            </span>
                                    </td>
                                    <td>
                                        <div className="psa-actions">
                                            <button
                                                type="button"
                                                title="Xem chi tiết"
                                                onClick={() => setSelected(item)}
                                            >
                                                <FontAwesomeIcon icon={faEye} />
                                            </button>

                                            {item.status === "PENDING" && (
                                                <>
                                                    <button
                                                        type="button"
                                                        title="Duyệt"
                                                        className="psa-approve"
                                                        disabled={busyId === item.id}
                                                        onClick={() => approve(item)}
                                                    >
                                                        <FontAwesomeIcon icon={faCheck} />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        title="Từ chối"
                                                        className="psa-reject"
                                                        disabled={busyId === item.id}
                                                        onClick={() => openReject(item)}
                                                    >
                                                        <FontAwesomeIcon icon={faXmark} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {selected && (
                    <div
                        className="psa-modal-backdrop"
                        onClick={() => setSelected(null)}
                    >
                        <div
                            className="psa-modal"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="psa-modal-heading">
                                <h2>Chi tiết dịch vụ</h2>
                                <button
                                    type="button"
                                    onClick={() => setSelected(null)}
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>

                            {selected.thumbnailUrl && (
                                <img
                                    className="psa-detail-image"
                                    src={selected.thumbnailUrl}
                                    alt={selected.serviceName}
                                />
                            )}

                            <div className="psa-detail-grid">
                                <div>
                                    <span>Tên dịch vụ</span>
                                    <strong>{selected.serviceName}</strong>
                                </div>
                                <div>
                                    <span>Provider</span>
                                    <strong>{selected.providerName}</strong>
                                </div>
                                <div>
                                    <span>Email</span>
                                    <strong>{selected.providerEmail || "—"}</strong>
                                </div>
                                <div>
                                    <span>Số điện thoại</span>
                                    <strong>{selected.providerPhone || "—"}</strong>
                                </div>
                                <div>
                                    <span>Danh mục</span>
                                    <strong>{selected.categoryName || "—"}</strong>
                                </div>
                                <div>
                                    <span>Giá Provider đề xuất</span>
                                    <strong>{money(selected.price)}</strong>
                                </div>
                                <div>
                                    <span>Giá cơ sở trên sàn</span>
                                    <strong>{money(selected.basePrice)}</strong>
                                </div>
                                <div>
                                    <span>Thời lượng</span>
                                    <strong>
                                        {selected.estimatedMinutes
                                            ? `${selected.estimatedMinutes} phút`
                                            : "—"}
                                    </strong>
                                </div>
                                <div>
                                    <span>Ngày gửi</span>
                                    <strong>{dateTime(selected.createdAt)}</strong>
                                </div>
                                <div>
                                    <span>Trạng thái</span>
                                    <strong>{statusLabels[selected.status] || selected.status}</strong>
                                </div>
                            </div>

                            <div className="psa-description">
                                <span>Mô tả dịch vụ</span>
                                <p>{selected.description || "Chưa có mô tả."}</p>
                            </div>

                            {selected.status === "PENDING" && (
                                <div className="psa-modal-actions">
                                    <button
                                        type="button"
                                        className="psa-button-approve"
                                        disabled={busyId === selected.id}
                                        onClick={() => approve(selected)}
                                    >
                                        <FontAwesomeIcon icon={faCheck} />
                                        Phê duyệt
                                    </button>
                                    <button
                                        type="button"
                                        className="psa-button-reject"
                                        onClick={() => openReject(selected)}
                                    >
                                        <FontAwesomeIcon icon={faXmark} />
                                        Từ chối
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {rejectTarget && (
                    <div
                        className="psa-modal-backdrop"
                        onClick={() => setRejectTarget(null)}
                    >
                        <form
                            className="psa-modal psa-reject-modal"
                            onSubmit={reject}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="psa-modal-heading">
                                <h2>Từ chối dịch vụ</h2>
                                <button
                                    type="button"
                                    onClick={() => setRejectTarget(null)}
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>

                            <p>
                                Dịch vụ: <strong>{rejectTarget.serviceName}</strong>
                            </p>

                            <label>
                                Lý do từ chối
                                <textarea
                                    rows="5"
                                    maxLength="1000"
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    placeholder="Nhập lý do cụ thể để Provider biết và chỉnh sửa..."
                                    required
                                />
                            </label>

                            <div className="psa-modal-actions">
                                <button
                                    type="button"
                                    className="psa-cancel"
                                    onClick={() => setRejectTarget(null)}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="psa-button-reject"
                                    disabled={busyId === rejectTarget.id}
                                >
                                    {busyId === rejectTarget.id
                                        ? "Đang xử lý..."
                                        : "Xác nhận từ chối"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
