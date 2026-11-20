import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faUsers,
    faUserCheck,
    faUserLock,
    faMagnifyingGlass,
    faPlus,
    faRotate,
    faPenToSquare,
    faEye,
    faLock,
    faLockOpen
} from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "./AdminLayout";
import "./AdminAccounts.css";

const API_URL = "http://localhost:8080/api/admin/accounts";

const roleLabels = {
    Customer: "Khách hàng",
    Cleaner: "Nhân viên vệ sinh",
    Provider: "Nhà cung cấp",
    Staff: "Nhân viên vận hành",
    Admin: "Quản trị viên",
};

const ROLE_API_VALUES = {
    Customer: "CUSTOMER",
    Cleaner: "CLEANER",
    Provider: "PROVIDER",
    Staff: "STAFF",
    Admin: "ADMIN",
};

const LOCK_REASON_PRESETS = [
    "Vi phạm điều khoản sử dụng hệ thống",
    "Nghi ngờ gian lận / truy cập bất thường",
    "Nhận nhiều khiếu nại từ khách hàng",
    "Khóa theo yêu cầu của chủ tài khoản",
];

const UNLOCK_REASON_PRESETS = [
    "Đã xác minh thông tin, khôi phục quyền truy cập",
    "Đã xử lý xong khiếu nại liên quan",
    "Mở khóa theo yêu cầu xác thực của người dùng",
];

function getToken() {
    return (
        sessionStorage.getItem("accessToken") ||
        localStorage.getItem("accessToken") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("token")
    );
}

function normalizeStatus(status) {
    return String(status || "").toUpperCase() === "LOCKED"
        ? "locked"
        : "active";
}

function normalizeRole(role) {
    const value = String(role || "")
        .trim()
        .toUpperCase()
        .replace(/^ROLE_/, "");

    const roles = {
        CUSTOMER: "Customer",
        CLEANER: "Cleaner",
        EMPLOYEE: "Cleaner",
        PROVIDER: "Provider",
        PARTNER: "Provider",
        STAFF: "Staff",
        ADMIN: "Admin",
    };

    return roles[value] || role || "Customer";
}

async function getErrorMessage(response) {
    try {
        const data = await response.json();
        return (
            data.message ||
            data.detail ||
            data.error ||
            `Có lỗi xảy ra (HTTP ${response.status}).`
        );
    } catch {
        return `Có lỗi xảy ra (HTTP ${response.status}).`;
    }
}

const EMPTY_FORM = {
    name: "",
    email: "",
    phone: "",
    role: "STAFF",
    password: "",
};

export default function AdminAccounts() {
    const [accounts, setAccounts] = useState([]);
    const [keyword, setKeyword] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const [selectedAccount, setSelectedAccount] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [updatingId, setUpdatingId] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Create / Edit modal state
    const [formModal, setFormModal] = useState(null); // { mode: 'create' | 'edit', account?: obj }
    const [formValues, setFormValues] = useState(EMPTY_FORM);
    const [showFormPwd, setShowFormPwd] = useState(false);
    const [formSaving, setFormSaving] = useState(false);
    const [formError, setFormError] = useState("");

    // Lock / Unlock modal state
    const [statusModal, setStatusModal] = useState(null); // { account, nextStatus }
    const [statusReason, setStatusReason] = useState("");
    const [statusError, setStatusError] = useState("");

    const loadAccounts = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const token = getToken();
            const response = await fetch(API_URL, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });

            if (!response.ok) {
                if (response.status === 401) throw new Error("Bạn cần đăng nhập lại.");
                if (response.status === 403) throw new Error("Bạn không có quyền quản lý tài khoản.");
                if (response.status === 404) throw new Error("Không tìm thấy API quản lý tài khoản. Kiểm tra backend.");
                throw new Error(await getErrorMessage(response));
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error("Dữ liệu tài khoản từ backend không đúng định dạng.");
            }

            const normalizedAccounts = data.map((account) => ({
                ...account,
                role: normalizeRole(account.role),
                status: normalizeStatus(account.status),
                name: account.name || "",
                email: account.email || "",
                phone: account.phone || "",
                joinedAt: account.joinedAt || "",
            }));

            setAccounts(normalizedAccounts);
        } catch (err) {
            setError(err.message || "Không thể tải danh sách tài khoản.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAccounts();
    }, [loadAccounts]);

    useEffect(() => {
        setPage(1);
    }, [keyword, roleFilter, statusFilter, pageSize]);

    const totalAccounts = accounts.length;
    const activeAccounts = accounts.filter((a) => a.status === "active").length;
    const lockedAccounts = accounts.filter((a) => a.status === "locked").length;

    const roleCounts = useMemo(() => {
        const counts = { Customer: 0, Provider: 0, Cleaner: 0, Staff: 0, Admin: 0 };
        accounts.forEach((a) => {
            if (counts[a.role] !== undefined) counts[a.role] += 1;
        });
        return counts;
    }, [accounts]);

    const filteredAccounts = useMemo(() => {
        const search = keyword.trim().toLowerCase();
        return accounts.filter((account) => {
            const matchesKeyword =
                !search ||
                account.name.toLowerCase().includes(search) ||
                account.email.toLowerCase().includes(search) ||
                account.phone.toLowerCase().includes(search);

            const matchesRole = roleFilter === "all" || account.role === roleFilter;
            const matchesStatus = statusFilter === "all" || account.status === statusFilter;

            return matchesKeyword && matchesRole && matchesStatus;
        });
    }, [accounts, keyword, roleFilter, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pagedAccounts = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredAccounts.slice(start, start + pageSize);
    }, [filteredAccounts, currentPage, pageSize]);

    async function loadAccountHistory(id) {
        setHistoryLoading(true);
        try {
            const token = getToken();
            const response = await fetch(`${API_URL}/${id}/history`, {
                headers: {
                    Accept: "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });

            if (!response.ok) throw new Error(await getErrorMessage(response));
            const history = await response.json();

            setSelectedAccount((current) =>
                current?.id === id
                    ? { ...current, statusHistory: Array.isArray(history) ? history : [] }
                    : current
            );
        } catch (err) {
            setError(err.message || "Không thể tải lịch sử trạng thái tài khoản.");
        } finally {
            setHistoryLoading(false);
        }
    }

    async function openAccountDetails(account) {
        setSelectedAccount({ ...account, statusHistory: [] });
        await loadAccountHistory(account.id);
    }

    function openCreateModal() {
        setFormValues(EMPTY_FORM);
        setShowFormPwd(false);
        setFormError("");
        setFormModal({ mode: "create" });
    }

    function openEditModal(account) {
        setFormValues({
            name: account.name || "",
            email: account.email || "",
            phone: account.phone || "",
            role: ROLE_API_VALUES[account.role] || "CUSTOMER",
            password: "",
        });
        setShowFormPwd(false);
        setFormError("");
        setFormModal({ mode: "edit", account });
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        if (formSaving || !formModal) return;

        const name = formValues.name.trim();
        const email = formValues.email.trim();
        const phone = formValues.phone.trim();
        const password = formValues.password;

        if (!name) {
            setFormError("Vui lòng nhập họ và tên.");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setFormError("Email không hợp lệ.");
            return;
        }
        if (phone && !/^(0|\+84)[0-9]{9,10}$/.test(phone)) {
            setFormError("Số điện thoại cần theo định dạng 0xxxxxxxxx hoặc +84xxxxxxxxx.");
            return;
        }
        if (formModal.mode === "create" && password.length < 8) {
            setFormError("Mật khẩu phải có ít nhất 8 ký tự.");
            return;
        }
        if (formModal.mode === "edit" && password && password.length < 8) {
            setFormError("Mật khẩu mới phải có ít nhất 8 ký tự.");
            return;
        }

        setFormSaving(true);
        setFormError("");
        setError("");
        setSuccess("");

        try {
            const token = getToken();
            const isCreate = formModal.mode === "create";
            const url = isCreate ? API_URL : `${API_URL}/${formModal.account.id}`;
            const payload = {
                name,
                email,
                phone,
                ...(isCreate || formModal.account.role !== "Admin" ? { role: formValues.role } : {}),
                ...(password ? { password } : {}),
            };

            const response = await fetch(url, {
                method: isCreate ? "POST" : "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error(await getErrorMessage(response));
            const data = await response.json();
            const returned = data.account || data;
            const normalized = {
                ...returned,
                role: normalizeRole(returned.role),
                status: normalizeStatus(returned.status),
                name: returned.name || name,
                email: returned.email || email,
                phone: returned.phone || "",
                joinedAt: returned.joinedAt || formModal.account?.joinedAt || "",
            };

            if (isCreate) {
                setAccounts((prev) => [normalized, ...prev]);
                setSuccess(`Đã tạo tài khoản "${normalized.name}" (${roleLabels[normalized.role] || normalized.role}) thành công.`);
            } else {
                setAccounts((prev) => prev.map((item) => (item.id === normalized.id ? normalized : item)));
                setSelectedAccount((cur) =>
                    cur?.id === normalized.id ? { ...cur, ...normalized } : cur
                );
                setSuccess(`Đã cập nhật thông tin tài khoản "${normalized.name}" thành công.`);
            }
            setFormModal(null);
        } catch (err) {
            setFormError(err.message || "Không thể lưu thông tin tài khoản.");
        } finally {
            setFormSaving(false);
        }
    }

    function openStatusModal(account) {
        if (!account || updatingId !== null) return;
        if (account.role === "Admin") {
            setError("Không thể thay đổi trạng thái tài khoản quản trị viên.");
            return;
        }
        const nextStatus = account.status === "active" ? "LOCKED" : "ACTIVE";
        setStatusReason("");
        setStatusError("");
        setStatusModal({ account, nextStatus });
    }

    async function confirmStatusChange(event) {
        event.preventDefault();
        if (!statusModal || updatingId !== null) return;

        const { account, nextStatus } = statusModal;
        const reason = statusReason.trim();
        if (!reason) {
            setStatusError("Vui lòng nhập lý do thay đổi trạng thái tài khoản.");
            return;
        }

        setUpdatingId(account.id);
        setStatusError("");
        setError("");
        setSuccess("");

        try {
            const token = getToken();
            const response = await fetch(`${API_URL}/${account.id}/status`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ status: nextStatus, reason }),
            });

            if (!response.ok) {
                if (response.status === 401) throw new Error("Phiên đăng nhập hết hạn. Hãy đăng nhập lại.");
                if (response.status === 403) throw new Error("Bạn không có quyền thay đổi trạng thái tài khoản.");
                throw new Error(await getErrorMessage(response));
            }

            const data = await response.json();
            const responseAccount = data.account || data;
            const updatedAccount = {
                ...account,
                ...responseAccount,
                role: normalizeRole(responseAccount.role ?? account.role),
                status: normalizeStatus(responseAccount.status ?? nextStatus),
            };

            setAccounts((prev) =>
                prev.map((item) => (item.id === account.id ? updatedAccount : item))
            );
            setSelectedAccount((cur) =>
                cur?.id === account.id
                    ? { ...updatedAccount, statusHistory: cur.statusHistory || [] }
                    : cur
            );
            if (selectedAccount?.id === account.id) {
                await loadAccountHistory(account.id);
            }
            setSuccess(
                nextStatus === "LOCKED"
                    ? `Đã khóa tài khoản "${account.name}".`
                    : `Đã mở khóa tài khoản "${account.name}".`
            );
            setStatusModal(null);
        } catch (err) {
            setStatusError(err.message || "Không thể cập nhật trạng thái tài khoản.");
        } finally {
            setUpdatingId(null);
        }
    }

    function resetFilters() {
        setKeyword("");
        setRoleFilter("all");
        setStatusFilter("all");
    }

    return (
        <AdminLayout>
            <div className="admin-accounts-page">
                <div className="accounts-page-heading">
                    <div>
                        <h1>Quản lý tài khoản</h1>
                        <p className="accounts-subtitle">
                            Tra cứu, tạo mới, cập nhật thông tin và kiểm soát trạng thái truy cập toàn hệ thống CleanMate.
                        </p>
                    </div>

                    <div className="accounts-header-actions">
                        <button
                            type="button"
                            className="accounts-refresh-btn"
                            onClick={loadAccounts}
                            disabled={loading}
                        >
                            <FontAwesomeIcon icon={faRotate} spin={loading} />
                            <span>Làm mới</span>
                        </button>

                        <button
                            type="button"
                            className="accounts-create-btn"
                            onClick={openCreateModal}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            <span>Tạo tài khoản</span>
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="accounts-error" role="alert">
                        <span>{error}</span>
                        <button type="button" onClick={() => setError("")} aria-label="Đóng thông báo lỗi">
                            ×
                        </button>
                    </div>
                )}

                {success && (
                    <div className="accounts-success" role="status">
                        <span>✓ {success}</span>
                        <button type="button" onClick={() => setSuccess("")} aria-label="Đóng thông báo">
                            ×
                        </button>
                    </div>
                )}

                <section className="accounts-stats">
                    <article className="accounts-stat-card">
                        <div className="accounts-stat-icon total-icon">
                            <FontAwesomeIcon icon={faUsers} />
                        </div>
                        <div>
                            <p>Tổng tài khoản</p>
                            <strong>{totalAccounts}</strong>
                            <span>Tất cả vai trò trên hệ thống</span>
                        </div>
                    </article>

                    <article className="accounts-stat-card">
                        <div className="accounts-stat-icon active-icon">
                            <FontAwesomeIcon icon={faUserCheck} />
                        </div>
                        <div>
                            <p>Đang hoạt động</p>
                            <strong>{activeAccounts}</strong>
                            <span>Tài khoản được phép đăng nhập</span>
                        </div>
                    </article>

                    <article className="accounts-stat-card">
                        <div className="accounts-stat-icon locked-icon">
                            <FontAwesomeIcon icon={faUserLock} />
                        </div>
                        <div>
                            <p>Đã khóa</p>
                            <strong>{lockedAccounts}</strong>
                            <span>Tài khoản bị tạm khóa</span>
                        </div>
                    </article>
                </section>

                <div className="accounts-role-pills" aria-label="Lọc nhanh theo vai trò">
                    {[
                        { key: "all", label: "Tất cả", count: totalAccounts },
                        { key: "Customer", label: "Khách hàng", count: roleCounts.Customer },
                        { key: "Provider", label: "Nhà cung cấp", count: roleCounts.Provider },
                        { key: "Cleaner", label: "Nhân viên vệ sinh", count: roleCounts.Cleaner },
                        { key: "Staff", label: "Nhân viên vận hành", count: roleCounts.Staff },
                        { key: "Admin", label: "Quản trị viên", count: roleCounts.Admin },
                    ].map((pill) => (
                        <button
                            key={pill.key}
                            type="button"
                            className={`accounts-role-pill ${roleFilter === pill.key ? "active" : ""}`}
                            onClick={() => setRoleFilter(pill.key)}
                        >
                            {pill.label} <span>{pill.count}</span>
                        </button>
                    ))}
                </div>

                <section className="accounts-list-card">
                    <div className="accounts-list-heading">
                        <div>
                            <h2>Danh sách tài khoản</h2>
                            <p>Tra cứu, chỉnh sửa thông tin và quản lý quyền truy cập của người dùng.</p>
                        </div>

                        <span className="accounts-result-count">
                            {loading ? "Đang tải..." : `${filteredAccounts.length} kết quả`}
                        </span>
                    </div>

                    <div className="accounts-filters">
                        <div className="accounts-search">
                            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ color: "#94a3b8" }} />
                            <input
                                type="text"
                                value={keyword}
                                onChange={(event) => setKeyword(event.target.value)}
                                placeholder="Tìm theo tên, email, số điện thoại..."
                                aria-label="Tìm kiếm tài khoản"
                            />
                        </div>

                        <select
                            value={roleFilter}
                            onChange={(event) => setRoleFilter(event.target.value)}
                            aria-label="Lọc theo vai trò"
                        >
                            <option value="all">Tất cả vai trò</option>
                            <option value="Customer">Khách hàng</option>
                            <option value="Provider">Nhà cung cấp</option>
                            <option value="Cleaner">Nhân viên vệ sinh</option>
                            <option value="Staff">Nhân viên vận hành</option>
                            <option value="Admin">Quản trị viên</option>
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                            aria-label="Lọc theo trạng thái"
                        >
                            <option value="all">Tất cả trạng thái</option>
                            <option value="active">Đang hoạt động</option>
                            <option value="locked">Đã khóa</option>
                        </select>

                        <button type="button" className="accounts-reset-btn" onClick={resetFilters}>
                            Đặt lại
                        </button>
                    </div>

                    <div className="accounts-table-wrapper">
                        <table className="accounts-table">
                            <thead>
                                <tr>
                                    <th>TÀI KHOẢN</th>
                                    <th>SỐ ĐIỆN THOẠI</th>
                                    <th>VAI TRÒ</th>
                                    <th>NGÀY THAM GIA</th>
                                    <th>TRẠNG THÁI</th>
                                    <th>THAO TÁC</th>
                                </tr>
                            </thead>

                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="6">
                                            <div className="accounts-empty">
                                                <strong>Đang tải danh sách tài khoản...</strong>
                                            </div>
                                        </td>
                                    </tr>
                                ) : pagedAccounts.length > 0 ? (
                                    pagedAccounts.map((account) => (
                                        <tr key={account.id}>
                                            <td>
                                                <div className="account-user-cell">
                                                    <div className="account-avatar">
                                                        {(account.name || account.email || "U").charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <strong>{account.name}</strong>
                                                        <span>{account.email}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            <td>{account.phone || "Chưa cập nhật"}</td>

                                            <td>
                                                <span className={`account-role role-${String(account.role).toLowerCase()}`}>
                                                    {roleLabels[account.role] || account.role}
                                                </span>
                                            </td>

                                            <td>{account.joinedAt || "—"}</td>

                                            <td>
                                                <span
                                                    className={`account-status ${
                                                        account.status === "active" ? "status-active" : "status-locked"
                                                    }`}
                                                >
                                                    <span className="status-dot" />
                                                    {account.status === "active" ? "Hoạt động" : "Đã khóa"}
                                                </span>
                                            </td>

                                            <td>
                                                <div className="account-actions">
                                                    <button
                                                        type="button"
                                                        className="account-detail-btn"
                                                        onClick={() => openAccountDetails(account)}
                                                        title="Xem chi tiết & lịch sử"
                                                    >
                                                        <FontAwesomeIcon icon={faEye} /> Chi tiết
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="account-edit-btn"
                                                        onClick={() => openEditModal(account)}
                                                        title="Chỉnh sửa thông tin hoặc đặt lại mật khẩu"
                                                    >
                                                        <FontAwesomeIcon icon={faPenToSquare} /> Sửa
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className={
                                                            account.status === "active"
                                                                ? "account-lock-btn"
                                                                : "account-unlock-btn"
                                                        }
                                                        disabled={account.role === "Admin" || updatingId !== null}
                                                        title={account.role === "Admin" ? "Không thể khóa tài khoản Admin" : ""}
                                                        onClick={() => openStatusModal(account)}
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={account.status === "active" ? faLock : faLockOpen}
                                                        />{" "}
                                                        {updatingId === account.id
                                                            ? "Đang xử lý..."
                                                            : account.status === "active"
                                                                ? "Khóa"
                                                                : "Mở khóa"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6">
                                            <div className="accounts-empty">
                                                <strong>
                                                    {error ? "Không tải được tài khoản" : "Không tìm thấy tài khoản"}
                                                </strong>
                                                <p>
                                                    {error
                                                        ? "Kiểm tra backend và kết nối API rồi tải lại trang."
                                                        : "Thử thay đổi từ khóa hoặc điều kiện lọc."}
                                                </p>
                                                {!error && (
                                                    <button type="button" onClick={resetFilters}>
                                                        Xóa bộ lọc
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="accounts-table-footer">
                        <span>
                            Hiển thị {pagedAccounts.length} / {filteredAccounts.length} kết quả (Tổng {totalAccounts} tài khoản)
                        </span>

                        <div className="accounts-pagination">
                            <select
                                value={pageSize}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                aria-label="Số dòng mỗi trang"
                            >
                                <option value={10}>10 / trang</option>
                                <option value={20}>20 / trang</option>
                                <option value={50}>50 / trang</option>
                            </select>

                            <button
                                type="button"
                                className="accounts-page-btn"
                                disabled={currentPage <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                ← Trước
                            </button>

                            <span style={{ fontSize: 12, fontWeight: 700 }}>
                                Trang {currentPage} / {totalPages}
                            </span>

                            <button
                                type="button"
                                className="accounts-page-btn"
                                disabled={currentPage >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Sau →
                            </button>
                        </div>
                    </div>
                </section>

                {/* DETAIL MODAL */}
                {selectedAccount && (
                    <div
                        className="account-modal-overlay"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) setSelectedAccount(null);
                        }}
                    >
                        <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
                            <div className="account-modal-header">
                                <div>
                                    <p>THÔNG TIN NGƯỜI DÙNG</p>
                                    <h2 id="account-modal-title">Chi tiết tài khoản #{selectedAccount.id}</h2>
                                </div>
                                <button
                                    type="button"
                                    className="account-modal-close"
                                    onClick={() => setSelectedAccount(null)}
                                    aria-label="Đóng"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="account-modal-profile">
                                <div className="account-modal-avatar">
                                    {(selectedAccount.name || "U").charAt(0).toUpperCase()}
                                </div>
                                <h3>{selectedAccount.name}</h3>
                                <span>{roleLabels[selectedAccount.role] || selectedAccount.role}</span>
                            </div>

                            <div className="account-modal-details">
                                <div>
                                    <span>Email</span>
                                    <strong>{selectedAccount.email || "Chưa cập nhật"}</strong>
                                </div>
                                <div>
                                    <span>Số điện thoại</span>
                                    <strong>{selectedAccount.phone || "Chưa cập nhật"}</strong>
                                </div>
                                <div>
                                    <span>Ngày tham gia</span>
                                    <strong>{selectedAccount.joinedAt || "—"}</strong>
                                </div>
                                <div>
                                    <span>Trạng thái &amp; Xác thực</span>
                                    <strong>
                                        {selectedAccount.status === "active" ? "Đang hoạt động" : "Đã khóa"}
                                        {" · "}
                                        {selectedAccount.emailVerified ? "Email đã xác thực" : "Chưa xác thực"}
                                    </strong>
                                </div>
                            </div>

                            <div className="account-modal-details" style={{ marginTop: 18 }}>
                                <div style={{ gridColumn: "1 / -1" }}>
                                    <span>Lịch sử khóa / mở khóa</span>
                                    {historyLoading ? (
                                        <strong>Đang tải lịch sử...</strong>
                                    ) : selectedAccount.statusHistory?.length ? (
                                        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                                            {selectedAccount.statusHistory.map((item) => (
                                                <div
                                                    key={item.id}
                                                    style={{
                                                        padding: 12,
                                                        border: "1px solid #e5ece9",
                                                        borderRadius: 10,
                                                    }}
                                                >
                                                    <strong>
                                                        {item.oldStatus === "ACTIVE" ? "Hoạt động" : "Đã khóa"}
                                                        {" → "}
                                                        {item.newStatus === "ACTIVE" ? "Hoạt động" : "Đã khóa"}
                                                    </strong>
                                                    <p style={{ margin: "6px 0" }}>{item.reason}</p>
                                                    <small>
                                                        {item.changedBy} · {item.changedAt}
                                                    </small>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <strong>Chưa có lịch sử thay đổi trạng thái.</strong>
                                    )}
                                </div>
                            </div>

                            <div className="account-modal-footer">
                                <button
                                    type="button"
                                    className="account-modal-cancel"
                                    onClick={() => setSelectedAccount(null)}
                                >
                                    Đóng
                                </button>
                                <button
                                    type="button"
                                    className="account-modal-primary"
                                    onClick={() => openEditModal(selectedAccount)}
                                >
                                    Chỉnh sửa
                                </button>
                                <button
                                    type="button"
                                    className={
                                        selectedAccount.status === "active"
                                            ? "account-modal-lock"
                                            : "account-modal-unlock"
                                    }
                                    disabled={selectedAccount.role === "Admin" || updatingId !== null}
                                    onClick={() => openStatusModal(selectedAccount)}
                                >
                                    {selectedAccount.status === "active" ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                                </button>
                            </div>
                        </section>
                    </div>
                )}

                {/* CREATE / EDIT MODAL */}
                {formModal && (
                    <div
                        className="account-modal-overlay"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget && !formSaving) setFormModal(null);
                        }}
                    >
                        <section className="account-modal" role="dialog" aria-modal="true">
                            <div className="account-modal-header">
                                <div>
                                    <p>{formModal.mode === "create" ? "THÊM MỚI NGƯỜI DÙNG" : `CHỈNH SỬA #${formModal.account.id}`}</p>
                                    <h2>{formModal.mode === "create" ? "Tạo tài khoản mới" : "Cập nhật thông tin tài khoản"}</h2>
                                </div>
                                <button
                                    type="button"
                                    className="account-modal-close"
                                    onClick={() => !formSaving && setFormModal(null)}
                                    aria-label="Đóng"
                                >
                                    ×
                                </button>
                            </div>

                            {formError && (
                                <div className="accounts-error" role="alert" style={{ marginBottom: 14 }}>
                                    <span>{formError}</span>
                                </div>
                            )}

                            <form onSubmit={handleFormSubmit}>
                                <div className="account-modal-form">
                                    <div className="account-form-field full">
                                        <label>Họ và tên *</label>
                                        <input
                                            type="text"
                                            value={formValues.name}
                                            onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                                            placeholder="VD: Nguyễn Minh Anh"
                                            maxLength={100}
                                            required
                                        />
                                    </div>

                                    <div className="account-form-field">
                                        <label>Email đăng nhập *</label>
                                        <input
                                            type="email"
                                            value={formValues.email}
                                            onChange={(e) => setFormValues({ ...formValues, email: e.target.value })}
                                            placeholder="staff@cleanmate.vn"
                                            maxLength={150}
                                            required
                                        />
                                    </div>

                                    <div className="account-form-field">
                                        <label>Số điện thoại</label>
                                        <input
                                            type="tel"
                                            value={formValues.phone}
                                            onChange={(e) => setFormValues({ ...formValues, phone: e.target.value })}
                                            placeholder="0901234567"
                                            maxLength={20}
                                        />
                                    </div>

                                    <div className="account-form-field">
                                        <label>Vai trò *</label>
                                        <select
                                            value={formValues.role}
                                            disabled={formModal.mode === "edit" && formModal.account?.role === "Admin"}
                                            onChange={(e) => setFormValues({ ...formValues, role: e.target.value })}
                                        >
                                            <option value="STAFF">Nhân viên vận hành (Staff)</option>
                                            <option value="CUSTOMER">Khách hàng (Customer)</option>
                                            <option value="PROVIDER">Nhà cung cấp (Partner)</option>
                                            <option value="CLEANER">Nhân viên vệ sinh (Cleaner)</option>
                                            {formModal.mode === "edit" && formModal.account?.role === "Admin" && (
                                                <option value="ADMIN">Quản trị viên (Admin)</option>
                                            )}
                                        </select>
                                        {formModal.mode === "edit" && formModal.account?.role === "Admin" && (
                                            <small>Không thể thay đổi vai trò của tài khoản Admin.</small>
                                        )}
                                    </div>

                                    <div className="account-form-field">
                                        <label>
                                            {formModal.mode === "create"
                                                ? "Mật khẩu khởi tạo (≥ 8 ký tự) *"
                                                : "Đặt lại mật khẩu (tùy chọn)"}
                                        </label>
                                        <div className="account-pwd-wrap">
                                            <input
                                                type={showFormPwd ? "text" : "password"}
                                                value={formValues.password}
                                                onChange={(e) => setFormValues({ ...formValues, password: e.target.value })}
                                                placeholder={
                                                    formModal.mode === "create"
                                                        ? "Tối thiểu 8 ký tự"
                                                        : "Để trống nếu không đổi"
                                                }
                                                required={formModal.mode === "create"}
                                            />
                                            <button
                                                type="button"
                                                className="account-pwd-toggle"
                                                onClick={() => setShowFormPwd((v) => !v)}
                                            >
                                                {showFormPwd ? "Ẩn" : "Hiện"}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="account-modal-footer">
                                    <button
                                        type="button"
                                        className="account-modal-cancel"
                                        disabled={formSaving}
                                        onClick={() => setFormModal(null)}
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        className="account-modal-primary"
                                        disabled={formSaving}
                                    >
                                        {formSaving
                                            ? "Đang lưu..."
                                            : formModal.mode === "create"
                                                ? "Tạo tài khoản"
                                                : "Lưu thay đổi"}
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>
                )}

                {/* LOCK / UNLOCK REASON MODAL */}
                {statusModal && (
                    <div
                        className="account-modal-overlay"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget && updatingId === null) setStatusModal(null);
                        }}
                    >
                        <section className="account-modal" role="dialog" aria-modal="true">
                            <div className="account-modal-header">
                                <div>
                                    <p>KIỂM SOÁT TRUY CẬP</p>
                                    <h2>
                                        {statusModal.nextStatus === "LOCKED"
                                            ? "Khóa tài khoản"
                                            : "Mở khóa tài khoản"}
                                    </h2>
                                </div>
                                <button
                                    type="button"
                                    className="account-modal-close"
                                    onClick={() => updatingId === null && setStatusModal(null)}
                                    aria-label="Đóng"
                                >
                                    ×
                                </button>
                            </div>

                            <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "#334155", lineHeight: 1.5 }}>
                                Tài khoản: <strong>{statusModal.account.name}</strong> ({statusModal.account.email}) —{" "}
                                <strong>{roleLabels[statusModal.account.role] || statusModal.account.role}</strong>
                            </p>

                            {statusError && (
                                <div className="accounts-error" role="alert" style={{ marginBottom: 12 }}>
                                    <span>{statusError}</span>
                                </div>
                            )}

                            <form onSubmit={confirmStatusChange}>
                                <div className="account-reason-presets">
                                    {(statusModal.nextStatus === "LOCKED"
                                        ? LOCK_REASON_PRESETS
                                        : UNLOCK_REASON_PRESETS
                                    ).map((preset) => (
                                        <button
                                            key={preset}
                                            type="button"
                                            className="account-reason-chip"
                                            onClick={() => {
                                                setStatusReason(preset);
                                                setStatusError("");
                                            }}
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                </div>

                                <div className="account-form-field full">
                                    <label>Lý do thực hiện (lưu vào lịch sử &amp; Audit Log) *</label>
                                    <textarea
                                        rows={3}
                                        value={statusReason}
                                        onChange={(e) => {
                                            setStatusReason(e.target.value);
                                            setStatusError("");
                                        }}
                                        maxLength={2000}
                                        placeholder="Nhập lý do cụ thể..."
                                        required
                                    />
                                </div>

                                <div className="account-modal-footer">
                                    <button
                                        type="button"
                                        className="account-modal-cancel"
                                        disabled={updatingId !== null}
                                        onClick={() => setStatusModal(null)}
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        className={
                                            statusModal.nextStatus === "LOCKED"
                                                ? "account-modal-lock"
                                                : "account-modal-unlock"
                                        }
                                        disabled={updatingId !== null || !statusReason.trim()}
                                    >
                                        {updatingId !== null
                                            ? "Đang xử lý..."
                                            : statusModal.nextStatus === "LOCKED"
                                                ? "Xác nhận khóa"
                                                : "Xác nhận mở khóa"}
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
