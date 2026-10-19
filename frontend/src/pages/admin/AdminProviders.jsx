
import { useState } from "react";
import AdminLayout from "./AdminLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faMagnifyingGlass,
    faEye,
    faCheck,
    faXmark,
    faRotateLeft,
    faStore,
} from "@fortawesome/free-solid-svg-icons";
import "./AdminProviders.css";

const initialProviders = [
    {
        id: 1,
        name: "Công ty vệ sinh Minh Tâm",
        email: "minhtam@gmail.com",
        phone: "0901234567",
        address: "Quận 1, TP. Hồ Chí Minh",
        services: 8,
        status: "Đang hoạt động",
    },
    {
        id: 2,
        name: "Dịch vụ sạch An Phát",
        email: "anphat@gmail.com",
        phone: "0912345678",
        address: "Quận 3, TP. Hồ Chí Minh",
        services: 5,
        status: "Chờ duyệt",
    },
    {
        id: 3,
        name: "Vệ sinh nhà cửa Hoàng Gia",
        email: "hoanggia@gmail.com",
        phone: "0923456789",
        address: "Thủ Đức, TP. Hồ Chí Minh",
        services: 12,
        status: "Đang hoạt động",
    },
    {
        id: 4,
        name: "Dịch vụ vệ sinh Thành Công",
        email: "thanhcong@gmail.com",
        phone: "0934567890",
        address: "Quận 7, TP. Hồ Chí Minh",
        services: 3,
        status: "Đã khóa",
    },
];

function AdminProviders() {
    const [providers, setProviders] = useState(initialProviders);
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("Tất cả");
    const [selectedProvider, setSelectedProvider] = useState(null);

    const filteredProviders = providers.filter((provider) => {
        const search = keyword.toLowerCase();

        const matchKeyword =
            provider.name.toLowerCase().includes(search) ||
            provider.email.toLowerCase().includes(search) ||
            provider.phone.includes(search);

        const matchStatus =
            statusFilter === "Tất cả" ||
            provider.status === statusFilter;

        return matchKeyword && matchStatus;
    });

    const approveProvider = (id) => {
        setProviders((prev) =>
            prev.map((provider) =>
                provider.id === id
                    ? { ...provider, status: "Đang hoạt động" }
                    : provider
            )
        );
    };

    const rejectProvider = (id) => {
        if (!window.confirm("Bạn có chắc muốn từ chối nhà cung cấp này?")) {
            return;
        }

        setProviders((prev) =>
            prev.map((provider) =>
                provider.id === id
                    ? { ...provider, status: "Đã khóa" }
                    : provider
            )
        );
    };

    const toggleStatus = (id) => {
        setProviders((prev) =>
            prev.map((provider) => {
                if (provider.id !== id) return provider;

                return {
                    ...provider,
                    status:
                        provider.status === "Đã khóa"
                            ? "Đang hoạt động"
                            : "Đã khóa",
                };
            })
        );
    };

    const resetFilters = () => {
        setKeyword("");
        setStatusFilter("Tất cả");
    };

    const activeCount = providers.filter(
        (p) => p.status === "Đang hoạt động"
    ).length;

    const pendingCount = providers.filter(
        (p) => p.status === "Chờ duyệt"
    ).length;

    const lockedCount = providers.filter(
        (p) => p.status === "Đã khóa"
    ).length;

    return (
        <AdminLayout>
            <div className="providers-page">
            <div className="providers-heading">
                <div>
                    <h1>Quản lý nhà cung cấp</h1>
                    <p>Theo dõi, xét duyệt và quản lý các đơn vị vệ sinh.</p>
                </div>

                <div className="providers-heading-icon">
                    <FontAwesomeIcon icon={faStore} />
                </div>
            </div>

            <div className="providers-stats">
                <div className="provider-stat-card">
                    <span>Tổng nhà cung cấp</span>
                    <strong>{providers.length}</strong>
                </div>

                <div className="provider-stat-card">
                    <span>Đang hoạt động</span>
                    <strong className="provider-green">{activeCount}</strong>
                </div>

                <div className="provider-stat-card">
                    <span>Chờ duyệt</span>
                    <strong className="provider-orange">{pendingCount}</strong>
                </div>

                <div className="provider-stat-card">
                    <span>Đã khóa</span>
                    <strong className="provider-red">{lockedCount}</strong>
                </div>
            </div>

            <div className="providers-content">
                <h2>Danh sách nhà cung cấp</h2>

                <div className="providers-filters">
                    <div className="provider-search">
                        <FontAwesomeIcon icon={faMagnifyingGlass} />
                        <input
                            type="text"
                            placeholder="Tìm tên, email hoặc số điện thoại..."
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="Tất cả">Tất cả trạng thái</option>
                        <option value="Đang hoạt động">Đang hoạt động</option>
                        <option value="Chờ duyệt">Chờ duyệt</option>
                        <option value="Đã khóa">Đã khóa</option>
                    </select>

                    <button
                        className="provider-reset-btn"
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
                            <th>Địa chỉ</th>
                            <th>Số dịch vụ</th>
                            <th>Trạng thái</th>
                            <th>Thao tác</th>
                        </tr>
                        </thead>

                        <tbody>
                        {filteredProviders.map((provider) => (
                            <tr key={provider.id}>
                                <td>
                                    <strong>{provider.name}</strong>
                                    <small>Mã NCC: NCC{String(provider.id).padStart(3, "0")}</small>
                                </td>

                                <td>
                                    <span>{provider.email}</span>
                                    <small>{provider.phone}</small>
                                </td>

                                <td>{provider.address}</td>

                                <td>{provider.services}</td>

                                <td>
                                        <span
                                            className={`provider-status ${
                                                provider.status === "Đang hoạt động"
                                                    ? "status-active"
                                                    : provider.status === "Chờ duyệt"
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
                                            onClick={() =>
                                                setSelectedProvider(provider)
                                            }
                                        >
                                            <FontAwesomeIcon icon={faEye} />
                                        </button>

                                        {provider.status === "Chờ duyệt" ? (
                                            <>
                                                <button
                                                    className="provider-approve-btn"
                                                    title="Duyệt nhà cung cấp"
                                                    onClick={() =>
                                                        approveProvider(provider.id)
                                                    }
                                                >
                                                    <FontAwesomeIcon icon={faCheck} />
                                                </button>

                                                <button
                                                    className="provider-reject-btn"
                                                    title="Từ chối nhà cung cấp"
                                                    onClick={() =>
                                                        rejectProvider(provider.id)
                                                    }
                                                >
                                                    <FontAwesomeIcon icon={faXmark} />
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                className={
                                                    provider.status === "Đã khóa"
                                                        ? "provider-approve-btn"
                                                        : "provider-reject-btn"
                                                }
                                                title={
                                                    provider.status === "Đã khóa"
                                                        ? "Mở khóa"
                                                        : "Khóa nhà cung cấp"
                                                }
                                                onClick={() =>
                                                    toggleStatus(provider.id)
                                                }
                                            >
                                                <FontAwesomeIcon
                                                    icon={
                                                        provider.status === "Đã khóa"
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

                        {filteredProviders.length === 0 && (
                            <tr>
                                <td colSpan="6" className="provider-empty">
                                    Không tìm thấy nhà cung cấp phù hợp.
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
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="provider-modal-header">
                            <h2>Chi tiết nhà cung cấp</h2>
                            <button onClick={() => setSelectedProvider(null)}>
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </div>

                        <div className="provider-detail">
                            <p>
                                <strong>Mã nhà cung cấp:</strong>{" "}
                                NCC{String(selectedProvider.id).padStart(3, "0")}
                            </p>
                            <p>
                                <strong>Tên đơn vị:</strong>{" "}
                                {selectedProvider.name}
                            </p>
                            <p>
                                <strong>Email:</strong> {selectedProvider.email}
                            </p>
                            <p>
                                <strong>Số điện thoại:</strong>{" "}
                                {selectedProvider.phone}
                            </p>
                            <p>
                                <strong>Địa chỉ:</strong>{" "}
                                {selectedProvider.address}
                            </p>
                            <p>
                                <strong>Số dịch vụ:</strong>{" "}
                                {selectedProvider.services}
                            </p>
                            <p>
                                <strong>Trạng thái:</strong>{" "}
                                {selectedProvider.status}
                            </p>
                        </div>

                        <button
                            className="provider-close-btn"
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
