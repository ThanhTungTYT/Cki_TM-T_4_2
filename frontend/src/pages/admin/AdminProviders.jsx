import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faMagnifyingGlass,
    faEye,
    faCheck,
    faXmark,
    faRotateLeft,
    faStore,
    faArrowsRotate,
} from "@fortawesome/free-solid-svg-icons";
import "./AdminProviders.css";

const API_URL = "http://localhost:8080/api/admin/providers";

const STATUS_LABELS = {
    ACTIVE: "Đang hoạt động",
    PENDING: "Chờ duyệt",
    LOCKED: "Đã đình chỉ",
    REJECTED: "Đã từ chối",
};

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
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    if (response.status === 204) return null;

    const text = await response.text();
    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { message: text };
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

function normalizeProvider(provider) {
    const partnerStatus = String(
        provider.partnerStatus || provider.databaseStatus || "PENDING"
    ).trim().toUpperCase();

    const accountStatus = String(provider.accountStatus || "UNKNOWN").trim().toUpperCase();
    const status = STATUS_LABELS[partnerStatus] || "Chưa xác định";

    return {
        ...provider,
        name: provider.name || "",
        email: provider.email || "",
        phone: provider.phone || "",
        address: provider.address || "",
        services: Number(provider.services) || 0,
        partnerStatus,
        databaseStatus: partnerStatus,
        accountStatus,
        effectiveStatus: provider.effectiveStatus || (partnerStatus === "ACTIVE" && accountStatus === "ACTIVE" ? "ACTIVE" : "INACTIVE"),
        status,
    };
}

function AdminProviders() {
    const [providers, setProviders] = useState([]);
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("Tất cả");
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const loadProviders = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const data = await apiRequest(API_URL);
            setProviders(Array.isArray(data) ? data.map(normalizeProvider) : []);
        } catch (err) {
            setProviders([]);
            setError(err.message || "Không thể tải danh sách nhà cung cấp từ backend.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProviders();
    }, [loadProviders]);

    const filteredProviders = useMemo(() => {
        const search = keyword.trim().toLowerCase();

        return providers.filter((provider) => {
            const matchKeyword =
                provider.name.toLowerCase().includes(search) ||
                provider.email.toLowerCase().includes(search) ||
                provider.phone.toLowerCase().includes(search) ||
                provider.address.toLowerCase().includes(search) ||
                String(provider.id).includes(search);

            const matchStatus = statusFilter === "Tất cả" || provider.status === statusFilter;

            return matchKeyword && matchStatus;
        });
    }, [providers, keyword, statusFilter]);

    const activeCount = providers.filter((provider) => provider.partnerStatus === "ACTIVE").length;
    const pendingCount = providers.filter((provider) => provider.partnerStatus === "PENDING").length;
    const lockedCount = providers.filter((provider) => provider.partnerStatus === "LOCKED").length;
    const rejectedCount = providers.filter((provider) => provider.partnerStatus === "REJECTED").length;

    const loadHistory = async (providerId) => {
        setHistoryLoading(true);
        try {
            const history = await apiRequest(`${API_URL}/${providerId}/history`);
            setSelectedProvider((current) => current?.id === providerId
                ? { ...current, history: Array.isArray(history) ? history : [] }
                : current);
        } catch (err) {
            setError(err.message || "Không thể tải lịch sử nhà cung cấp.");
        } finally {
            setHistoryLoading(false);
        }
    };

    const openProvider = async (provider) => {
        setSelectedProvider({ ...provider, history: [] });
        try {
            const detail = await apiRequest(`${API_URL}/${provider.id}`);
            setSelectedProvider({ ...normalizeProvider(detail), history: [] });
            const history = await apiRequest(`${API_URL}/${provider.id}/history`);
            setSelectedProvider((current) => current?.id === provider.id
                ? { ...current, history: Array.isArray(history) ? history : [] }
                : current);
        } catch (err) {
            setError(err.message || "Không thể tải chi tiết nhà cung cấp.");
        }
    };

    const updateStatus = async (provider, nextStatus) => {
        if (busyId !== null) return;

        const action = nextStatus === "LOCKED" ? "đình chỉ" : "kích hoạt lại";
        const reason = window.prompt(`Nhập lý do ${action} nhà cung cấp "${provider.name}":`);

        if (reason === null) return;

        if (!reason.trim()) {
            setError("Vui lòng nhập lý do thay đổi trạng thái nhà cung cấp.");
            return;
        }

        if (!window.confirm(`Xác nhận ${action} nhà cung cấp "${provider.name}"?`)) return;

        setBusyId(provider.id);
        setError("");
        setNotice("");

        try {
            const result = await apiRequest(`${API_URL}/${provider.id}/status`, {
                method: "PUT",
                body: JSON.stringify({ status: nextStatus, reason: reason.trim() }),
            });

            const updated = normalizeProvider(result);

            setProviders((current) => current.map((item) => item.id === provider.id ? updated : item));
            setSelectedProvider((current) => current?.id === provider.id ? { ...updated, history: current.history || [] } : current);
            setNotice(result?.message || "Cập nhật nhà cung cấp thành công.");

            if (selectedProvider?.id === provider.id) await loadHistory(provider.id);
        } catch (err) {
            setError(err.message || "Không thể cập nhật trạng thái nhà cung cấp.");
        } finally {
            setBusyId(null);
        }
    };

    const approveProvider = async (provider) => {
        if (busyId !== null) return;

        const reason = window.prompt(`Nhập ghi chú/lý do duyệt hồ sơ "${provider.name}":`);

        if (reason === null) return;

        if (!reason.trim()) {
            setError("Vui lòng nhập lý do duyệt hồ sơ.");
            return;
        }

        if (!window.confirm(`Xác nhận duyệt hồ sơ nhà cung cấp "${provider.name}"?`)) return;

        setBusyId(provider.id);
        setError("");
        setNotice("");

        try {
            const result = await apiRequest(`${API_URL}/${provider.id}/approve`, {
                method: "POST",
                body: JSON.stringify({ reason: reason.trim() }),
            });

            const updated = normalizeProvider(result);

            setProviders((current) => current.map((item) => item.id === provider.id ? updated : item));
            setSelectedProvider((current) => current?.id === provider.id ? { ...updated, history: current.history || [] } : current);
            setNotice(result?.message || "Đã phê duyệt hồ sơ nhà cung cấp.");

            if (selectedProvider?.id === provider.id) await loadHistory(provider.id);
        } catch (err) {
            setError(err.message || "Không thể phê duyệt hồ sơ nhà cung cấp.");
        } finally {
            setBusyId(null);
        }
    };

    const rejectProvider = async (provider) => {
        if (busyId !== null) return;

        const reason = window.prompt(`Nhập lý do từ chối hồ sơ "${provider.name}":`);

        if (reason === null) return;

        if (!reason.trim()) {
            setError("Vui lòng nhập lý do từ chối hồ sơ.");
            return;
        }

        if (!window.confirm(`Xác nhận từ chối hồ sơ "${provider.name}"?`)) return;

        setBusyId(provider.id);
        setError("");
        setNotice("");

        try {
            const result = await apiRequest(`${API_URL}/${provider.id}/reject`, {
                method: "POST",
                body: JSON.stringify({ reason: reason.trim() }),
            });

            const updated = normalizeProvider(result);

            setProviders((current) => current.map((item) => item.id === provider.id ? updated : item));
            setSelectedProvider((current) => current?.id === provider.id ? { ...updated, history: current.history || [] } : current);
            setNotice(result?.message || "Đã từ chối hồ sơ nhà cung cấp.");

            if (selectedProvider?.id === provider.id) await loadHistory(provider.id);
        } catch (err) {
            setError(err.message || "Không thể từ chối hồ sơ nhà cung cấp.");
        } finally {
            setBusyId(null);
        }
    };

    const toggleStatus = (provider) => {
        if (provider.partnerStatus === "LOCKED") return updateStatus(provider, "ACTIVE");
        if (provider.partnerStatus === "ACTIVE") return updateStatus(provider, "LOCKED");
    };

    const resetFilters = () => {
        setKeyword("");
        setStatusFilter("Tất cả");
        setError("");
        setNotice("");
    };

    const formatRating = (rating) => {
        if (rating === null || rating === undefined || rating === "") return "Chưa có đánh giá";
        const number = Number(rating);
        return Number.isFinite(number) ? `${number.toFixed(1)}/5` : "—";
    };

    const statusClass = (status) => {
        if (status === "ACTIVE") return "status-active";
        if (status === "PENDING") return "status-pending";
        return "status-locked";
    };

    return (
        <AdminLayout>
            <div className="providers-page">
                <div className="providers-heading">
                    <div>
                        <h1>Quản lý nhà cung cấp</h1>
                        <p>Theo dõi, xét duyệt và giám sát năng lực hoạt động của các đơn vị vệ sinh.</p>
                    </div>
                    <div className="providers-heading-icon"><FontAwesomeIcon icon={faStore} /></div>
                </div>

                {error && <div role="alert" style={{ padding: 14, marginBottom: 16, borderRadius: 8, background: "#ffe7e9", color: "#b42332" }}>{error}</div>}
                {notice && <div role="status" style={{ padding: 14, marginBottom: 16, borderRadius: 8, background: "#e3f8ed", color: "#168654" }}>{notice}</div>}

                <div className="providers-stats">
                    <div className="provider-stat-card"><span>Tổng nhà cung cấp</span><strong>{providers.length}</strong></div>
                    <div className="provider-stat-card"><span>Đang hoạt động</span><strong className="provider-green">{activeCount}</strong></div>
                    <div className="provider-stat-card"><span>Chờ duyệt</span><strong className="provider-orange">{pendingCount}</strong></div>
                    <div className="provider-stat-card"><span>Đình chỉ / Từ chối</span><strong className="provider-red">{lockedCount + rejectedCount}</strong></div>
                </div>

                <div className="providers-content">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
                        <div>
                            <h2 style={{ margin: 0 }}>Danh sách nhà cung cấp</h2>
                            <p style={{ margin: "7px 0 0", color: "#718096", fontSize: 13 }}>Trạng thái doanh nghiệp và trạng thái tài khoản được quản lý độc lập.</p>
                        </div>
                        <button className="provider-reset-btn" type="button" onClick={loadProviders} disabled={loading}>
                            <FontAwesomeIcon icon={faArrowsRotate} /> Tải lại
                        </button>
                    </div>

                    <div className="providers-filters">
                        <div className="provider-search">
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                            <input type="text" placeholder="Tìm tên, email, số điện thoại hoặc mã NCC..." value={keyword} onChange={(event) => setKeyword(event.target.value)} />
                        </div>
                        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                            <option value="Tất cả">Tất cả trạng thái</option>
                            <option value="Đang hoạt động">Đang hoạt động</option>
                            <option value="Chờ duyệt">Chờ duyệt</option>
                            <option value="Đã đình chỉ">Đã đình chỉ</option>
                            <option value="Đã từ chối">Đã từ chối</option>
                        </select>
                        <button className="provider-reset-btn" type="button" onClick={resetFilters}><FontAwesomeIcon icon={faRotateLeft} /> Đặt lại</button>
                    </div>

                    <div className="providers-table-wrapper">
                        <table className="providers-table">
                            <thead>
                            <tr>
                                <th>Nhà cung cấp</th>
                                <th>Liên hệ</th>
                                <th>Thông tin</th>
                                <th>Số dịch vụ</th>
                                <th>Trạng thái doanh nghiệp</th>
                                <th>Thao tác</th>
                            </tr>
                            </thead>
                            <tbody>
                            {loading && <tr><td colSpan="6" className="provider-empty">Đang tải dữ liệu nhà cung cấp...</td></tr>}

                            {!loading && filteredProviders.map((provider) => (
                                <tr key={provider.id}>
                                    <td>
                                        <strong>{provider.name}</strong>
                                        <small>Mã NCC: NCC{String(provider.id).padStart(3, "0")}</small>
                                    </td>
                                    <td>
                                        <span>{provider.email}</span>
                                        <small>{provider.phone || "Chưa có số điện thoại"}</small>
                                    </td>
                                    <td>{provider.address || "Chưa cập nhật địa chỉ"}</td>
                                    <td>{provider.services}</td>
                                    <td>
                                        <span className={`provider-status ${statusClass(provider.partnerStatus)}`}>{provider.status}</span>
                                        {provider.accountStatus !== "ACTIVE" && <small style={{ color: "#b42332", display: "block", marginTop: 5 }}>Tài khoản: {provider.accountStatus === "LOCKED" ? "Đã khóa" : "Chưa xác định"}</small>}
                                    </td>
                                    <td>
                                        <div className="provider-actions">
                                            <button className="provider-view-btn" title="Xem chi tiết" type="button" onClick={() => openProvider(provider)}>
                                                <FontAwesomeIcon icon={faEye} />
                                            </button>

                                            {provider.partnerStatus === "PENDING" && <>
                                                <button className="provider-approve-btn" title="Duyệt nhà cung cấp" type="button" disabled={busyId !== null} onClick={() => approveProvider(provider)}>
                                                    <FontAwesomeIcon icon={faCheck} />
                                                </button>
                                                <button className="provider-reject-btn" title="Từ chối hồ sơ" type="button" disabled={busyId !== null} onClick={() => rejectProvider(provider)}>
                                                    <FontAwesomeIcon icon={faXmark} />
                                                </button>
                                            </>}

                                            {provider.partnerStatus === "ACTIVE" && <button className="provider-reject-btn" title="Đình chỉ nhà cung cấp" type="button" disabled={busyId !== null} onClick={() => toggleStatus(provider)}>
                                                <FontAwesomeIcon icon={faXmark} />
                                            </button>}

                                            {provider.partnerStatus === "LOCKED" && <button className="provider-approve-btn" title="Kích hoạt lại nhà cung cấp" type="button" disabled={busyId !== null} onClick={() => toggleStatus(provider)}>
                                                <FontAwesomeIcon icon={faCheck} />
                                            </button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {!loading && filteredProviders.length === 0 && <tr><td colSpan="6" className="provider-empty">{error ? "Không tải được dữ liệu nhà cung cấp." : "Không tìm thấy nhà cung cấp phù hợp."}</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                {selectedProvider && (
                    <div className="provider-modal-overlay" onClick={() => setSelectedProvider(null)}>
                        <div className="provider-modal" onClick={(event) => event.stopPropagation()}>
                            <div className="provider-modal-header">
                                <h2>Chi tiết nhà cung cấp</h2>
                                <button type="button" aria-label="Đóng" onClick={() => setSelectedProvider(null)}>
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>

                            <div className="provider-detail">
                                <p><strong>Mã nhà cung cấp:</strong> NCC{String(selectedProvider.id).padStart(3, "0")}</p>
                                <p><strong>Tên đơn vị:</strong> {selectedProvider.name || "—"}</p>
                                <p><strong>Email:</strong> {selectedProvider.email || "—"}</p>
                                <p><strong>Số điện thoại:</strong> {selectedProvider.phone || "—"}</p>
                                <p><strong>Mô tả:</strong> {selectedProvider.description || "Chưa có mô tả"}</p>
                                <p><strong>Mã số thuế:</strong> {selectedProvider.taxCode || "—"}</p>
                                <p><strong>Địa chỉ:</strong> {selectedProvider.address || "—"}</p>
                                <p><strong>Latitude:</strong> {selectedProvider.latitude ?? "Chưa cập nhật"}</p>
                                <p><strong>Longitude:</strong> {selectedProvider.longitude ?? "Chưa cập nhật"}</p>
                                <p><strong>Phiên bản hồ sơ:</strong> {selectedProvider.version ?? 1}</p>
                                <p><strong>Số dịch vụ liên kết:</strong> {selectedProvider.services}</p>
                                <p><strong>Ngày đăng ký:</strong> {selectedProvider.joinedAt || "—"}</p>
                                <p><strong>Đánh giá trung bình:</strong> {formatRating(selectedProvider.ratingAverage)}</p>
                                <p><strong>Đơn hoàn thành:</strong> {selectedProvider.totalCompletedJobs ?? 0}</p>
                                <p><strong>Trạng thái doanh nghiệp:</strong> {STATUS_LABELS[selectedProvider.partnerStatus] || "Chưa xác định"}</p>
                                <p><strong>Trạng thái tài khoản:</strong> {selectedProvider.accountStatus === "ACTIVE" ? "Đang hoạt động" : selectedProvider.accountStatus === "LOCKED" ? "Đã khóa" : "Chưa xác định"}</p>
                                <p><strong>Khả năng hoạt động thực tế:</strong> {selectedProvider.effectiveStatus === "ACTIVE" ? "Được phép hoạt động" : "Không nhận đơn mới"}</p>
                            </div>

                            <div style={{ marginTop: 22 }}>
                                <h3 style={{ margin: "0 0 12px", color: "#1e293b", fontSize: 16 }}>Lịch sử xét duyệt và trạng thái</h3>
                                {historyLoading ? <p>Đang tải lịch sử...</p> : selectedProvider.history?.length ? (
                                    <div style={{ display: "grid", gap: 10, maxHeight: 260, overflowY: "auto" }}>
                                        {selectedProvider.history.map((item) => (
                                            <div key={item.id} style={{ border: "1px solid #e8edf5", borderRadius: 10, padding: 12 }}>
                                                <strong>{item.oldStatus} → {item.newStatus} ({item.actionType})</strong>
                                                <p style={{ margin: "7px 0" }}>{item.reason}</p>
                                                <small>{item.changedBy} · {item.changedAt}</small>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p>Chưa có lịch sử thay đổi trạng thái.</p>}
                            </div>

                            <button className="provider-close-btn" type="button" onClick={() => setSelectedProvider(null)}>Đóng</button>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

export default AdminProviders;