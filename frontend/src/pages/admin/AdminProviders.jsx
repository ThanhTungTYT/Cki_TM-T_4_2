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
    LOCKED: "Đã khóa",
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

    if (response.status === 204) {
        return null;
    }

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
    const rawStatus = String(
        provider.databaseStatus || provider.status || "PENDING"
    )
        .trim()
        .toUpperCase();

    let databaseStatus;

    if (["ACTIVE", "ĐANG HOẠT ĐỘNG"].includes(rawStatus)) {
        databaseStatus = "ACTIVE";
    } else if (["PENDING", "CHỜ DUYỆT"].includes(rawStatus)) {
        databaseStatus = "PENDING";
    } else {
        databaseStatus = "LOCKED";
    }

    return {
        ...provider,
        name: provider.name || "",
        email: provider.email || "",
        phone: provider.phone || "",
        address: provider.address || "",
        services: Number(provider.services) || 0,
        databaseStatus,
        status: STATUS_LABELS[databaseStatus],
    };
}

function AdminProviders() {
    const [providers, setProviders] = useState([]);
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("Tất cả");
    const [selectedProvider, setSelectedProvider] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const loadProviders = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const data = await apiRequest(API_URL);

            setProviders(
                Array.isArray(data) ? data.map(normalizeProvider) : []
            );
        } catch (err) {
            setProviders([]);
            setError(
                err.message ||
                "Không thể tải danh sách nhà cung cấp từ backend."
            );
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
                provider.phone.toLowerCase().includes(search);

            const matchStatus =
                statusFilter === "Tất cả" ||
                provider.status === statusFilter;

            return matchKeyword && matchStatus;
        });
    }, [providers, keyword, statusFilter]);

    const activeCount = providers.filter(
        (provider) => provider.databaseStatus === "ACTIVE"
    ).length;

    const pendingCount = providers.filter(
        (provider) => provider.databaseStatus === "PENDING"
    ).length;

    const lockedCount = providers.filter(
        (provider) => provider.databaseStatus === "LOCKED"
    ).length;

    const updateStatus = async (provider, nextStatus, confirmMessage) => {
        if (busyId !== null) {
            return;
        }

        if (!window.confirm(confirmMessage)) {
            return;
        }

        setBusyId(provider.id);
        setError("");
        setNotice("");

        try {
            const result = await apiRequest(
                `${API_URL}/${provider.id}/status`,
                {
                    method: "PUT",
                    body: JSON.stringify({ status: nextStatus }),
                }
            );

            const updated = normalizeProvider(result);

            setProviders((current) =>
                current.map((item) =>
                    item.id === provider.id ? updated : item
                )
            );

            setSelectedProvider((current) =>
                current?.id === provider.id ? updated : current
            );

            setNotice(
                result?.message || "Cập nhật nhà cung cấp thành công."
            );
        } catch (err) {
            setError(
                err.message ||
                "Không thể cập nhật trạng thái nhà cung cấp."
            );
        } finally {
            setBusyId(null);
        }
    };

    const approveProvider = (provider) =>
        updateStatus(
            provider,
            "ACTIVE",
            `Bạn có chắc muốn duyệt nhà cung cấp "${provider.name}"?`
        );

    const rejectProvider = (provider) =>
        updateStatus(
            provider,
            "LOCKED",
            `Bạn có chắc muốn khóa nhà cung cấp "${provider.name}"?`
        );

    const toggleStatus = (provider) => {
        if (provider.databaseStatus === "LOCKED") {
            return updateStatus(
                provider,
                "ACTIVE",
                `Bạn có chắc muốn mở khóa "${provider.name}"?`
            );
        }

        return updateStatus(
            provider,
            "LOCKED",
            `Bạn có chắc muốn khóa nhà cung cấp "${provider.name}"?`
        );
    };

    const resetFilters = () => {
        setKeyword("");
        setStatusFilter("Tất cả");
        setError("");
        setNotice("");
    };

    const formatRating = (rating) => {
        if (rating === null || rating === undefined || rating === "") {
            return "Chưa có đánh giá";
        }

        const number = Number(rating);

        return Number.isFinite(number) ? number.toFixed(1) + "/5" : "—";
    };

    return (
        <AdminLayout>
            <div className="providers-page">
                <div className="providers-heading">
                    <div>
                        <h1>Quản lý nhà cung cấp</h1>
                        <p>
                            Theo dõi, xét duyệt và quản lý các đơn vị vệ sinh.
                        </p>
                    </div>

                    <div className="providers-heading-icon">
                        <FontAwesomeIcon icon={faStore} />
                    </div>
                </div>

                {error && (
                    <div
                        role="alert"
                        style={{
                            padding: 14,
                            marginBottom: 16,
                            borderRadius: 8,
                            background: "#ffe7e9",
                            color: "#b42332",
                        }}
                    >
                        {error}
                    </div>
                )}

                {notice && (
                    <div
                        role="status"
                        style={{
                            padding: 14,
                            marginBottom: 16,
                            borderRadius: 8,
                            background: "#e3f8ed",
                            color: "#168654",
                        }}
                    >
                        {notice}
                    </div>
                )}

                <div className="providers-stats">
                    <div className="provider-stat-card">
                        <span>Tổng nhà cung cấp</span>
                        <strong>{providers.length}</strong>
                    </div>

                    <div className="provider-stat-card">
                        <span>Đang hoạt động</span>
                        <strong className="provider-green">
                            {activeCount}
                        </strong>
                    </div>

                    <div className="provider-stat-card">
                        <span>Chờ duyệt</span>
                        <strong className="provider-orange">
                            {pendingCount}
                        </strong>
                    </div>

                    <div className="provider-stat-card">
                        <span>Đã khóa</span>
                        <strong className="provider-red">
                            {lockedCount}
                        </strong>
                    </div>
                </div>

                <div className="providers-content">
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            flexWrap: "wrap",
                            marginBottom: 22,
                        }}
                    >
                        <h2 style={{ margin: 0 }}>
                            Danh sách nhà cung cấp
                        </h2>

                        <button
                            className="provider-reset-btn"
                            type="button"
                            onClick={loadProviders}
                            disabled={loading}
                        >
                            <FontAwesomeIcon icon={faArrowsRotate} />
                            Tải lại
                        </button>
                    </div>

                    <div className="providers-filters">
                        <div className="provider-search">
                            <FontAwesomeIcon icon={faMagnifyingGlass} />

                            <input
                                type="text"
                                placeholder="Tìm tên, email hoặc số điện thoại..."
                                value={keyword}
                                onChange={(event) =>
                                    setKeyword(event.target.value)
                                }
                            />
                        </div>

                        <select
                            value={statusFilter}
                            onChange={(event) =>
                                setStatusFilter(event.target.value)
                            }
                        >
                            <option value="Tất cả">Tất cả trạng thái</option>
                            <option value="Đang hoạt động">
                                Đang hoạt động
                            </option>
                            <option value="Chờ duyệt">Chờ duyệt</option>
                            <option value="Đã khóa">Đã khóa</option>
                        </select>

                        <button
                            className="provider-reset-btn"
                            type="button"
                            onClick={resetFilters}
                        >
                            <FontAwesomeIcon icon={faRotateLeft} />
                            Đặt lại
                        </button>
                    </div>

                    <div className="providers-table-wrapper">
                        <table className="providers-table">
                            <thead>
                            <tr>
                                <th>Nhà cung cấp</th>
                                <th>Liên hệ</th>
                                <th>Thông tin</th>
                                <th>Số dịch vụ</th>
                                <th>Trạng thái</th>
                                <th>Thao tác</th>
                            </tr>
                            </thead>

                            <tbody>
                            {loading && (
                                <tr>
                                    <td
                                        colSpan="6"
                                        className="provider-empty"
                                    >
                                        Đang tải dữ liệu nhà cung cấp...
                                    </td>
                                </tr>
                            )}

                            {!loading &&
                                filteredProviders.map((provider) => (
                                    <tr key={provider.id}>
                                        <td>
                                            <strong>{provider.name}</strong>
                                            <small>
                                                Mã NCC: NCC
                                                {String(provider.id).padStart(
                                                    3,
                                                    "0"
                                                )}
                                            </small>
                                        </td>

                                        <td>
                                            <span>{provider.email}</span>
                                            <small>
                                                {provider.phone ||
                                                    "Chưa có số điện thoại"}
                                            </small>
                                        </td>

                                        <td>
                                            {provider.address ||
                                                "Chưa có mô tả"}
                                        </td>

                                        <td>{provider.services}</td>

                                        <td>
                                                <span
                                                    className={`provider-status ${
                                                        provider.databaseStatus ===
                                                        "ACTIVE"
                                                            ? "status-active"
                                                            : provider.databaseStatus ===
                                                            "PENDING"
                                                                ? "status-pending"
                                                                : "status-locked"
                                                    }`}
                                                >
                                                    {provider.status}
                                                </span>
                                        </td>

                                        <td>
                                            <div className="provider-actions">
                                                <button
                                                    className="provider-view-btn"
                                                    title="Xem chi tiết"
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedProvider(
                                                            provider
                                                        )
                                                    }
                                                >
                                                    <FontAwesomeIcon
                                                        icon={faEye}
                                                    />
                                                </button>

                                                {provider.databaseStatus ===
                                                "PENDING" ? (
                                                    <>
                                                        <button
                                                            className="provider-approve-btn"
                                                            title="Duyệt nhà cung cấp"
                                                            type="button"
                                                            disabled={
                                                                busyId !==
                                                                null
                                                            }
                                                            onClick={() =>
                                                                approveProvider(
                                                                    provider
                                                                )
                                                            }
                                                        >
                                                            <FontAwesomeIcon
                                                                icon={faCheck}
                                                            />
                                                        </button>

                                                        <button
                                                            className="provider-reject-btn"
                                                            title="Từ chối/khóa"
                                                            type="button"
                                                            disabled={
                                                                busyId !==
                                                                null
                                                            }
                                                            onClick={() =>
                                                                rejectProvider(
                                                                    provider
                                                                )
                                                            }
                                                        >
                                                            <FontAwesomeIcon
                                                                icon={faXmark}
                                                            />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        className={
                                                            provider.databaseStatus ===
                                                            "LOCKED"
                                                                ? "provider-approve-btn"
                                                                : "provider-reject-btn"
                                                        }
                                                        title={
                                                            provider.databaseStatus ===
                                                            "LOCKED"
                                                                ? "Mở khóa"
                                                                : "Khóa nhà cung cấp"
                                                        }
                                                        type="button"
                                                        disabled={
                                                            busyId !== null
                                                        }
                                                        onClick={() =>
                                                            toggleStatus(
                                                                provider
                                                            )
                                                        }
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={
                                                                provider.databaseStatus ===
                                                                "LOCKED"
                                                                    ? faCheck
                                                                    : faXmark
                                                            }
                                                        />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                            {!loading &&
                                filteredProviders.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan="6"
                                            className="provider-empty"
                                        >
                                            {error
                                                ? "Không tải được dữ liệu nhà cung cấp."
                                                : "Không tìm thấy nhà cung cấp phù hợp."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {selectedProvider && (
                    <div
                        className="provider-modal-overlay"
                        onClick={() => setSelectedProvider(null)}
                    >
                        <div
                            className="provider-modal"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="provider-modal-header">
                                <h2>Chi tiết nhà cung cấp</h2>

                                <button
                                    type="button"
                                    aria-label="Đóng"
                                    onClick={() =>
                                        setSelectedProvider(null)
                                    }
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>

                            <div className="provider-detail">
                                <p>
                                    <strong>Mã nhà cung cấp:</strong>{" "}
                                    NCC
                                    {String(selectedProvider.id).padStart(
                                        3,
                                        "0"
                                    )}
                                </p>

                                <p>
                                    <strong>Tên đơn vị:</strong>{" "}
                                    {selectedProvider.name || "—"}
                                </p>

                                <p>
                                    <strong>Email:</strong>{" "}
                                    {selectedProvider.email || "—"}
                                </p>

                                <p>
                                    <strong>Số điện thoại:</strong>{" "}
                                    {selectedProvider.phone || "—"}
                                </p>

                                <p>
                                    <strong>Mô tả:</strong>{" "}
                                    {selectedProvider.description ||
                                        selectedProvider.address ||
                                        "Chưa có mô tả"}
                                </p>

                                <p>
                                    <strong>Mã số thuế:</strong>{" "}
                                    {selectedProvider.taxCode || "—"}
                                </p>

                                <p>
                                    <strong>Số dịch vụ:</strong>{" "}
                                    {selectedProvider.services}
                                </p>

                                <p>
                                    <strong>Ngày đăng ký:</strong>{" "}
                                    {selectedProvider.joinedAt || "—"}
                                </p>

                                <p>
                                    <strong>Đánh giá trung bình:</strong>{" "}
                                    {formatRating(
                                        selectedProvider.ratingAverage
                                    )}
                                </p>

                                <p>
                                    <strong>Đơn hoàn thành:</strong>{" "}
                                    {selectedProvider.totalCompletedJobs ?? 0}
                                </p>

                                <p>
                                    <strong>Trạng thái:</strong>{" "}
                                    {selectedProvider.status}
                                </p>
                            </div>

                            <button
                                className="provider-close-btn"
                                type="button"
                                onClick={() => setSelectedProvider(null)}
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

export default AdminProviders;