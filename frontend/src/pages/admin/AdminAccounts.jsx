
import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import "./AdminAccounts.css";

const API_URL = "http://localhost:8080/api/admin/accounts";

const roleLabels = {
    Customer: "Khách hàng",
    Cleaner: "Nhân viên vệ sinh",
    Provider: "Nhà cung cấp",
    Staff: "Nhân viên",
    Admin: "Quản trị viên",
};

function getToken() {
    return (
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("accessToken") ||
        sessionStorage.getItem("accessToken")
    );
}

// Chuẩn hóa trạng thái từ backend về active / locked.
function normalizeStatus(status) {
    return String(status || "").toUpperCase() === "LOCKED"
        ? "locked"
        : "active";
}

// Chuẩn hóa vai trò để khớp với giao diện hiện tại.
function normalizeRole(role) {
    const value = String(role || "").toUpperCase();

    const roles = {
        CUSTOMER: "Customer",
        CLEANER: "Cleaner",
        PROVIDER: "Provider",
        STAFF: "Staff",
        ADMIN: "Admin",
    };

    return roles[value] || role || "Customer";
}

// Đọc thông báo lỗi từ backend.
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

export default function AdminAccounts() {
    const [accounts, setAccounts] = useState([]);
    const [keyword, setKeyword] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [selectedAccount, setSelectedAccount] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [updatingId, setUpdatingId] = useState(null);

    // =========================
    // 1. TẢI DANH SÁCH TÀI KHOẢN
    // =========================
    useEffect(() => {
        const controller = new AbortController();

        async function loadAccounts() {
            setLoading(true);
            setError("");

            try {
                const token = getToken();

                const response = await fetch(API_URL, {
                    method: "GET",
                    signal: controller.signal,
                    headers: {
                        Accept: "application/json",
                        ...(token
                            ? { Authorization: `Bearer ${token}` }
                            : {}),
                    },
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error("Bạn cần đăng nhập lại.");
                    }

                    if (response.status === 403) {
                        throw new Error(
                            "Bạn không có quyền quản lý tài khoản."
                        );
                    }

                    if (response.status === 404) {
                        throw new Error(
                            "Không tìm thấy API quản lý tài khoản. Kiểm tra backend."
                        );
                    }

                    throw new Error(await getErrorMessage(response));
                }

                const data = await response.json();

                if (!Array.isArray(data)) {
                    throw new Error(
                        "Dữ liệu tài khoản từ backend không đúng định dạng."
                    );
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
                if (err.name !== "AbortError") {
                    setError(
                        err.message || "Không thể tải danh sách tài khoản."
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        loadAccounts();

        return () => controller.abort();
    }, []);

    // =========================
    // 2. THỐNG KÊ TÀI KHOẢN
    // =========================
    const totalAccounts = accounts.length;

    const activeAccounts = accounts.filter(
        (account) => account.status === "active"
    ).length;

    const lockedAccounts = accounts.filter(
        (account) => account.status === "locked"
    ).length;

    // =========================
    // 3. TÌM KIẾM VÀ LỌC
    // =========================
    const filteredAccounts = useMemo(() => {
        const search = keyword.trim().toLowerCase();

        return accounts.filter((account) => {
            const matchesKeyword =
                account.name.toLowerCase().includes(search) ||
                account.email.toLowerCase().includes(search) ||
                account.phone.toLowerCase().includes(search);

            const matchesRole =
                roleFilter === "all" || account.role === roleFilter;

            const matchesStatus =
                statusFilter === "all" || account.status === statusFilter;

            return matchesKeyword && matchesRole && matchesStatus;
        });
    }, [accounts, keyword, roleFilter, statusFilter]);

    // =========================
    // 4. KHÓA / MỞ KHÓA TÀI KHOẢN
    // =========================
    async function toggleAccountStatus(id) {
        const account = accounts.find((item) => item.id === id);

        if (!account || updatingId !== null) {
            return;
        }

        // Không cho khóa tài khoản Admin.
        if (account.role === "Admin") {
            alert("Không thể thay đổi trạng thái tài khoản quản trị viên.");
            return;
        }

        const nextStatus =
            account.status === "active" ? "LOCKED" : "ACTIVE";

        const action =
            nextStatus === "LOCKED" ? "khóa" : "mở khóa";

        const confirmed = window.confirm(
            `Bạn có chắc muốn ${action} tài khoản "${account.name}"?`
        );

        if (!confirmed) {
            return;
        }

        setUpdatingId(id);
        setError("");

        try {
            const token = getToken();

            const response = await fetch(`${API_URL}/${id}/status`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    ...(token
                        ? { Authorization: `Bearer ${token}` }
                        : {}),
                },
                body: JSON.stringify({
                    status: nextStatus,
                }),
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error("Phiên đăng nhập hết hạn. Hãy đăng nhập lại.");
                }

                if (response.status === 403) {
                    throw new Error(
                        "Bạn không có quyền thay đổi trạng thái tài khoản."
                    );
                }

                throw new Error(await getErrorMessage(response));
            }

            const data = await response.json();

            // Backend có thể trả về { account: {...} }.
            const responseAccount = data.account || data;

            // Chuẩn hóa dữ liệu trả về từ backend.
            const updatedAccount = {
                ...account,
                ...responseAccount,
                role: normalizeRole(
                    responseAccount.role ?? account.role
                ),
                status: normalizeStatus(
                    responseAccount.status ?? nextStatus
                ),
            };

            // Cập nhật danh sách sau khi backend xác nhận thành công.
            setAccounts((currentAccounts) =>
                currentAccounts.map((item) =>
                    item.id === id ? updatedAccount : item
                )
            );

            // Cập nhật cả cửa sổ chi tiết nếu đang mở.
            setSelectedAccount((current) =>
                current?.id === id ? updatedAccount : current
            );
        } catch (err) {
            setError(
                err.message || "Không thể cập nhật trạng thái tài khoản."
            );
        } finally {
            setUpdatingId(null);
        }
    }

    // =========================
    // 5. ĐẶT LẠI BỘ LỌC
    // =========================
    function resetFilters() {
        setKeyword("");
        setRoleFilter("all");
        setStatusFilter("all");
    }

    // =========================
    // 6. GIAO DIỆN
    // =========================
    return (
        <AdminLayout>
            <div className="admin-accounts-page">
                <div className="accounts-page-heading">
                    <div>
                        <p className="accounts-breadcrumb">
                            Admin / Quản lý tài khoản
                        </p>

                        <h1>Quản lý tài khoản</h1>

                        <p className="accounts-subtitle">
                            Theo dõi thông tin, vai trò và trạng thái tài khoản
                            CleanMate.
                        </p>
                    </div>

                    <span className="accounts-demo-label">
                        DỮ LIỆU THỰC
                    </span>
                </div>

                {/* Thông báo lỗi */}
                {error && (
                    <div
                        className="accounts-error"
                        role="alert"
                    >
                        <span>{error}</span>

                        <button
                            type="button"
                            onClick={() => setError("")}
                            aria-label="Đóng thông báo lỗi"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* Thống kê */}
                <section className="accounts-stats">
                    <article className="accounts-stat-card">
                        <div className="accounts-stat-icon total-icon">
                            ♙
                        </div>

                        <div>
                            <p>Tổng tài khoản</p>
                            <strong>{totalAccounts}</strong>
                            <span>Tất cả tài khoản</span>
                        </div>
                    </article>

                    <article className="accounts-stat-card">
                        <div className="accounts-stat-icon active-icon">
                            ✓
                        </div>

                        <div>
                            <p>Đang hoạt động</p>
                            <strong>{activeAccounts}</strong>
                            <span>Tài khoản hoạt động</span>
                        </div>
                    </article>

                    <article className="accounts-stat-card">
                        <div className="accounts-stat-icon locked-icon">
                            ⊘
                        </div>

                        <div>
                            <p>Đã khóa</p>
                            <strong>{lockedAccounts}</strong>
                            <span>Tài khoản bị khóa</span>
                        </div>
                    </article>
                </section>

                {/* Danh sách tài khoản */}
                <section className="accounts-list-card">
                    <div className="accounts-list-heading">
                        <div>
                            <h2>Danh sách tài khoản</h2>
                            <p>
                                Tra cứu và quản lý quyền truy cập của người dùng.
                            </p>
                        </div>

                        <span className="accounts-result-count">
                            {loading
                                ? "Đang tải..."
                                : `${filteredAccounts.length} kết quả`}
                        </span>
                    </div>

                    {/* Bộ lọc */}
                    <div className="accounts-filters">
                        <div className="accounts-search">
                            <span>⌕</span>

                            <input
                                type="text"
                                value={keyword}
                                onChange={(event) =>
                                    setKeyword(event.target.value)
                                }
                                placeholder="Tìm theo tên, email, số điện thoại..."
                                aria-label="Tìm kiếm tài khoản"
                            />
                        </div>

                        <select
                            value={roleFilter}
                            onChange={(event) =>
                                setRoleFilter(event.target.value)
                            }
                            aria-label="Lọc theo vai trò"
                        >
                            <option value="all">Tất cả vai trò</option>
                            <option value="Customer">Khách hàng</option>
                            <option value="Cleaner">Nhân viên vệ sinh</option>
                            <option value="Provider">Nhà cung cấp</option>
                            <option value="Staff">Nhân viên</option>
                            <option value="Admin">Quản trị viên</option>
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(event) =>
                                setStatusFilter(event.target.value)
                            }
                            aria-label="Lọc theo trạng thái"
                        >
                            <option value="all">Tất cả trạng thái</option>
                            <option value="active">Đang hoạt động</option>
                            <option value="locked">Đã khóa</option>
                        </select>

                        <button
                            type="button"
                            className="accounts-reset-btn"
                            onClick={resetFilters}
                        >
                            Đặt lại
                        </button>
                    </div>

                    {/* Bảng tài khoản */}
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
                                            <strong>
                                                Đang tải danh sách tài khoản...
                                            </strong>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredAccounts.length > 0 ? (
                                filteredAccounts.map((account) => (
                                    <tr key={account.id}>
                                        <td>
                                            <div className="account-identity">
                                                <div className="account-avatar">
                                                    {account.name
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </div>

                                                <div className="account-identity-info">
                                                    <strong>
                                                        {account.name}
                                                    </strong>
                                                    <span>
                                                            {account.email}
                                                        </span>
                                                </div>
                                            </div>
                                        </td>

                                        <td>
                                            {account.phone || "Chưa cập nhật"}
                                        </td>

                                        <td>
                                                <span
                                                    className={`account-role role-${String(
                                                        account.role
                                                    ).toLowerCase()}`}
                                                >
                                                    {roleLabels[account.role] ||
                                                        account.role}
                                                </span>
                                        </td>

                                        <td>
                                            {account.joinedAt || "—"}
                                        </td>

                                        <td>
                                                <span
                                                    className={`account-status ${
                                                        account.status === "active"
                                                            ? "status-active"
                                                            : "status-locked"
                                                    }`}
                                                >
                                                    <span className="status-dot" />

                                                    {account.status === "active"
                                                        ? "Hoạt động"
                                                        : "Đã khóa"}
                                                </span>
                                        </td>

                                        <td>
                                            <div className="account-actions">
                                                <button
                                                    type="button"
                                                    className="account-detail-btn"
                                                    onClick={() =>
                                                        setSelectedAccount(
                                                            account
                                                        )
                                                    }
                                                >
                                                    Chi tiết
                                                </button>

                                                <button
                                                    type="button"
                                                    className={
                                                        account.status ===
                                                        "active"
                                                            ? "account-lock-btn"
                                                            : "account-unlock-btn"
                                                    }
                                                    disabled={
                                                        account.role ===
                                                        "Admin" ||
                                                        updatingId !== null
                                                    }
                                                    title={
                                                        account.role ===
                                                        "Admin"
                                                            ? "Không thể khóa tài khoản Admin"
                                                            : ""
                                                    }
                                                    onClick={() =>
                                                        toggleAccountStatus(
                                                            account.id
                                                        )
                                                    }
                                                >
                                                    {updatingId ===
                                                    account.id
                                                        ? "Đang xử lý..."
                                                        : account.status ===
                                                        "active"
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
                                            <span>⌕</span>

                                            <strong>
                                                {error
                                                    ? "Không tải được tài khoản"
                                                    : "Không tìm thấy tài khoản"}
                                            </strong>

                                            <p>
                                                {error
                                                    ? "Kiểm tra backend và kết nối API rồi tải lại trang."
                                                    : "Thử thay đổi từ khóa hoặc điều kiện lọc."}
                                            </p>

                                            {!error && (
                                                <button
                                                    type="button"
                                                    onClick={resetFilters}
                                                >
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
                            Đang hiển thị {filteredAccounts.length} /{" "}
                            {totalAccounts} tài khoản
                        </span>

                        <span>Dữ liệu từ hệ thống</span>
                    </div>
                </section>

                {/* Modal chi tiết tài khoản */}
                {selectedAccount && (
                    <div
                        className="account-modal-overlay"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                                setSelectedAccount(null);
                            }
                        }}
                    >
                        <section
                            className="account-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="account-modal-title"
                        >
                            <div className="account-modal-header">
                                <div>
                                    <p>THÔNG TIN NGƯỜI DÙNG</p>
                                    <h2 id="account-modal-title">
                                        Chi tiết tài khoản
                                    </h2>
                                </div>

                                <button
                                    type="button"
                                    className="account-modal-close"
                                    onClick={() =>
                                        setSelectedAccount(null)
                                    }
                                    aria-label="Đóng"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="account-modal-profile">
                                <div className="account-modal-avatar">
                                    {selectedAccount.name
                                        .charAt(0)
                                        .toUpperCase()}
                                </div>

                                <h3>{selectedAccount.name}</h3>

                                <span>
                                    {roleLabels[selectedAccount.role] ||
                                        selectedAccount.role}
                                </span>
                            </div>

                            <div className="account-modal-details">
                                <div>
                                    <span>Email</span>
                                    <strong>
                                        {selectedAccount.email || "Chưa cập nhật"}
                                    </strong>
                                </div>

                                <div>
                                    <span>Số điện thoại</span>
                                    <strong>
                                        {selectedAccount.phone ||
                                            "Chưa cập nhật"}
                                    </strong>
                                </div>

                                <div>
                                    <span>Ngày tham gia</span>
                                    <strong>
                                        {selectedAccount.joinedAt || "—"}
                                    </strong>
                                </div>

                                <div>
                                    <span>Trạng thái</span>
                                    <strong>
                                        {selectedAccount.status === "active"
                                            ? "Đang hoạt động"
                                            : "Đã khóa"}
                                    </strong>
                                </div>
                            </div>

                            <div className="account-modal-footer">
                                <button
                                    type="button"
                                    className="account-modal-cancel"
                                    onClick={() =>
                                        setSelectedAccount(null)
                                    }
                                >
                                    Đóng
                                </button>

                                <button
                                    type="button"
                                    className={
                                        selectedAccount.status === "active"
                                            ? "account-modal-lock"
                                            : "account-modal-unlock"
                                    }
                                    disabled={
                                        selectedAccount.role === "Admin" ||
                                        updatingId !== null
                                    }
                                    onClick={() =>
                                        toggleAccountStatus(
                                            selectedAccount.id
                                        )
                                    }
                                >
                                    {updatingId === selectedAccount.id
                                        ? "Đang xử lý..."
                                        : selectedAccount.status === "active"
                                            ? "Khóa tài khoản"
                                            : "Mở khóa tài khoản"}
                                </button>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
