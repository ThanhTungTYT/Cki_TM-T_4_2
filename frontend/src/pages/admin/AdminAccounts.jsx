import { useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import "./AdminAccounts.css";

const initialAccounts = [
    {
        id: 1,
        name: "Nguyễn Minh Anh",
        email: "minhanh@gmail.com",
        phone: "0901234567",
        role: "Customer",
        status: "active",
        joinedAt: "10/10/2026",
    },
    {
        id: 2,
        name: "Trần Quốc Bảo",
        email: "quocbao@gmail.com",
        phone: "0912345678",
        role: "Provider",
        status: "active",
        joinedAt: "08/10/2026",
    },
    {
        id: 3,
        name: "Lê Thu Hà",
        email: "thuha@gmail.com",
        phone: "0923456789",
        role: "Cleaner",
        status: "locked",
        joinedAt: "05/10/2026",
    },
    {
        id: 4,
        name: "Phạm Hoàng Nam",
        email: "hoangnam@gmail.com",
        phone: "0934567890",
        role: "Staff",
        status: "active",
        joinedAt: "01/10/2026",
    },
    {
        id: 5,
        name: "Võ Ngọc Linh",
        email: "ngoclinh@gmail.com",
        phone: "0945678901",
        role: "Customer",
        status: "active",
        joinedAt: "28/09/2026",
    },
    {
        id: 6,
        name: "Đặng Thành Đạt",
        email: "thanhdat@gmail.com",
        phone: "0956789012",
        role: "Provider",
        status: "locked",
        joinedAt: "25/09/2026",
    },
    {
        id: 7,
        name: "Nguyễn Hải Yến",
        email: "haiyen@gmail.com",
        phone: "0967890123",
        role: "Customer",
        status: "active",
        joinedAt: "20/09/2026",
    },
    {
        id: 8,
        name: "Bùi Đức Huy",
        email: "duchuy@gmail.com",
        phone: "0978901234",
        role: "Admin",
        status: "active",
        joinedAt: "15/09/2026",
    },
];

const roleLabels = {
    Customer: "Khách hàng",
    Cleaner: "Nhân viên vệ sinh",
    Provider: "Nhà cung cấp",
    Staff: "Nhân viên",
    Admin: "Quản trị viên",
};

export default function AdminAccounts() {
    const [accounts, setAccounts] = useState(initialAccounts);
    const [keyword, setKeyword] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [selectedAccount, setSelectedAccount] = useState(null);

    const totalAccounts = accounts.length;
    const activeAccounts = accounts.filter(
        (account) => account.status === "active"
    ).length;
    const lockedAccounts = accounts.filter(
        (account) => account.status === "locked"
    ).length;

    const filteredAccounts = useMemo(() => {
        const search = keyword.trim().toLowerCase();

        return accounts.filter((account) => {
            const matchesKeyword =
                account.name.toLowerCase().includes(search) ||
                account.email.toLowerCase().includes(search) ||
                account.phone.includes(search);

            const matchesRole =
                roleFilter === "all" || account.role === roleFilter;

            const matchesStatus =
                statusFilter === "all" || account.status === statusFilter;

            return matchesKeyword && matchesRole && matchesStatus;
        });
    }, [accounts, keyword, roleFilter, statusFilter]);

    function toggleAccountStatus(id) {
        const account = accounts.find((item) => item.id === id);
        if (!account) return;

        const isLocked = account.status === "locked";
        const action = isLocked ? "mở khóa" : "khóa";

        if (!window.confirm(`Bạn có chắc muốn ${action} tài khoản này?`)) {
            return;
        }

        setAccounts((currentAccounts) =>
            currentAccounts.map((item) =>
                item.id === id
                    ? {
                        ...item,
                        status: item.status === "active" ? "locked" : "active",
                    }
                    : item
            )
        );

        setSelectedAccount((current) =>
            current && current.id === id
                ? {
                    ...current,
                    status: current.status === "active" ? "locked" : "active",
                }
                : current
        );
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
                    <p className="accounts-breadcrumb">Admin / Quản lý tài khoản</p>
                    <h1>Quản lý tài khoản</h1>
                    <p className="accounts-subtitle">
                        Theo dõi thông tin, vai trò và trạng thái tài khoản CleanMate.
                    </p>
                </div>

                <span className="accounts-demo-label">DỮ LIỆU MẪU</span>
            </div>

            <section className="accounts-stats">
                <article className="accounts-stat-card">
                    <div className="accounts-stat-icon total-icon">♙</div>
                    <div>
                        <p>Tổng tài khoản</p>
                        <strong>{totalAccounts}</strong>
                        <span>Tất cả tài khoản</span>
                    </div>
                </article>

                <article className="accounts-stat-card">
                    <div className="accounts-stat-icon active-icon">✓</div>
                    <div>
                        <p>Đang hoạt động</p>
                        <strong>{activeAccounts}</strong>
                        <span>Tài khoản hoạt động</span>
                    </div>
                </article>

                <article className="accounts-stat-card">
                    <div className="accounts-stat-icon locked-icon">⊘</div>
                    <div>
                        <p>Đã khóa</p>
                        <strong>{lockedAccounts}</strong>
                        <span>Tài khoản bị khóa</span>
                    </div>
                </article>
            </section>

            <section className="accounts-list-card">
                <div className="accounts-list-heading">
                    <div>
                        <h2>Danh sách tài khoản</h2>
                        <p>Tra cứu và quản lý quyền truy cập của người dùng.</p>
                    </div>
                    <span className="accounts-result-count">
            {filteredAccounts.length} kết quả
          </span>
                </div>

                <div className="accounts-filters">
                    <div className="accounts-search">
                        <span>⌕</span>
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
                        <option value="Cleaner">Nhân viên vệ sinh</option>
                        <option value="Provider">Nhà cung cấp</option>
                        <option value="Staff">Nhân viên</option>
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

                    <button
                        type="button"
                        className="accounts-reset-btn"
                        onClick={resetFilters}
                    >
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
                        {filteredAccounts.length > 0 ? (
                            filteredAccounts.map((account) => (
                                <tr key={account.id}>
                                    <td>
                                        <div className="account-identity">
                                            <div className="account-avatar">
                                                {account.name.charAt(0)}
                                            </div>
                                            <div className="account-identity-info">
                                                <strong>{account.name}</strong>
                                                <span>{account.email}</span>
                                            </div>
                                        </div>
                                    </td>

                                    <td>{account.phone}</td>

                                    <td>
                      <span className={`account-role role-${account.role.toLowerCase()}`}>
                        {roleLabels[account.role]}
                      </span>
                                    </td>

                                    <td>{account.joinedAt}</td>

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
                                                onClick={() => setSelectedAccount(account)}
                                            >
                                                Chi tiết
                                            </button>

                                            <button
                                                type="button"
                                                className={
                                                    account.status === "active"
                                                        ? "account-lock-btn"
                                                        : "account-unlock-btn"
                                                }
                                                disabled={account.role === "Admin"}
                                                title={
                                                    account.role === "Admin"
                                                        ? "Không khóa tài khoản Admin mẫu"
                                                        : ""
                                                }
                                                onClick={() => toggleAccountStatus(account.id)}
                                            >
                                                {account.status === "active" ? "Khóa" : "Mở khóa"}
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
                                        <strong>Không tìm thấy tài khoản</strong>
                                        <p>Thử thay đổi từ khóa hoặc điều kiện lọc.</p>
                                        <button type="button" onClick={resetFilters}>
                                            Xóa bộ lọc
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>

                <div className="accounts-table-footer">
          <span>
            Đang hiển thị {filteredAccounts.length} / {totalAccounts} tài khoản
          </span>
                    <span>Dữ liệu minh họa trên trình duyệt</span>
                </div>
            </section>

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
                                <h2 id="account-modal-title">Chi tiết tài khoản</h2>
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
                                {selectedAccount.name.charAt(0)}
                            </div>
                            <h3>{selectedAccount.name}</h3>
                            <span>{roleLabels[selectedAccount.role]}</span>
                        </div>

                        <div className="account-modal-details">
                            <div>
                                <span>Email</span>
                                <strong>{selectedAccount.email}</strong>
                            </div>
                            <div>
                                <span>Số điện thoại</span>
                                <strong>{selectedAccount.phone}</strong>
                            </div>
                            <div>
                                <span>Ngày tham gia</span>
                                <strong>{selectedAccount.joinedAt}</strong>
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
                                onClick={() => setSelectedAccount(null)}
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
                                disabled={selectedAccount.role === "Admin"}
                                onClick={() => toggleAccountStatus(selectedAccount.id)}
                            >
                                {selectedAccount.status === "active"
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
