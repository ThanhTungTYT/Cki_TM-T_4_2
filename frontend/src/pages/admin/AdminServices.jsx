
import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import "./AdminServices.css";

const API_URL = "/api/admin/services";

function getToken() {
    return localStorage.getItem("token") || "";
}

async function apiRequest(url, options = {}) {
    const token = getToken();

    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Lỗi HTTP ${response.status}`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

function AdminServices() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("Tất cả");
    const [categoryFilter, setCategoryFilter] = useState("Tất cả");
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);

    const emptyForm = {
        name: "",
        categoryId: "",
        partnerId: "",
        price: "",
        estimatedMinutes: "",
        status: "Chờ duyệt",
    };

    const [form, setForm] = useState(emptyForm);

    const fetchServices = async () => {
        try {
            setLoading(true);
            setError("");

            const data = await apiRequest(API_URL);
            setServices(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message || "Không thể tải danh sách dịch vụ.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
    }, []);

    const filteredServices = useMemo(() => {
        const search = keyword.trim().toLowerCase();

        return services.filter((service) => {
            const matchKeyword =
                (service.name || "").toLowerCase().includes(search) ||
                (service.provider || "").toLowerCase().includes(search);

            const matchStatus =
                statusFilter === "Tất cả" ||
                service.status === statusFilter;

            const matchCategory =
                categoryFilter === "Tất cả" ||
                service.category === categoryFilter;

            return matchKeyword && matchStatus && matchCategory;
        });
    }, [services, keyword, statusFilter, categoryFilter]);

    const activeCount = services.filter(
        (item) => item.status === "Đang hoạt động"
    ).length;

    const pendingCount = services.filter(
        (item) => item.status === "Chờ duyệt"
    ).length;

    const stoppedCount = services.filter(
        (item) => item.status === "Tạm ngừng"
    ).length;

    const formatPrice = (price) =>
        price == null ? "—" : Number(price).toLocaleString("vi-VN") + " đ";

    const openAddForm = () => {
        setEditingId(null);
        setForm(emptyForm);
        setShowForm(true);
    };

    const openEditForm = (service) => {
        setEditingId(service.id);
        setForm({
            name: service.name || "",
            categoryId: String(service.categoryId || ""),
            partnerId: String(service.partnerId || ""),
            price: String(service.price ?? ""),
            estimatedMinutes: String(service.estimatedMinutes ?? ""),
            status: service.status || "Chờ duyệt",
        });
        setShowForm(true);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (
            !form.name.trim() ||
            !form.categoryId ||
            !form.partnerId ||
            !form.price ||
            !form.estimatedMinutes
        ) {
            alert("Vui lòng nhập đầy đủ thông tin.");
            return;
        }

        if (
            Number(form.price) <= 0 ||
            Number(form.estimatedMinutes) <= 0
        ) {
            alert("Giá và thời lượng phải lớn hơn 0.");
            return;
        }

        const payload = {
            name: form.name.trim(),
            categoryId: Number(form.categoryId),
            partnerId: Number(form.partnerId),
            price: Number(form.price),
            estimatedMinutes: Number(form.estimatedMinutes),
            status: form.status,
        };

        try {
            setSaving(true);

            if (editingId !== null) {
                await apiRequest(`${API_URL}/${editingId}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });
                alert("Cập nhật dịch vụ thành công.");
            } else {
                await apiRequest(API_URL, {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                alert("Thêm dịch vụ thành công.");
            }

            setShowForm(false);
            setEditingId(null);
            setForm(emptyForm);
            await fetchServices();
        } catch (err) {
            alert("Không thể lưu dịch vụ: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const changeStatus = async (service) => {
        const nextStatus =
            service.status === "Chờ duyệt" ||
            service.status === "Tạm ngừng"
                ? "Đang hoạt động"
                : "Tạm ngừng";

        const actionText =
            nextStatus === "Đang hoạt động" ? "kích hoạt" : "tạm ngừng";

        if (
            !window.confirm(
                `Bạn có chắc muốn ${actionText} dịch vụ "${service.name}"?`
            )
        ) {
            return;
        }

        try {
            await apiRequest(`${API_URL}/${service.id}/status`, {
                method: "PUT",
                body: JSON.stringify({ status: nextStatus }),
            });

            await fetchServices();
        } catch (err) {
            alert("Không thể đổi trạng thái: " + err.message);
        }
    };

    const deleteService = async (service) => {
        if (
            !window.confirm(
                `Bạn có chắc muốn xóa dịch vụ "${service.name}" khỏi nhà cung cấp này?`
            )
        ) {
            return;
        }

        try {
            await apiRequest(`${API_URL}/${service.id}`, {
                method: "DELETE",
            });

            await fetchServices();
            alert("Đã xóa liên kết dịch vụ.");
        } catch (err) {
            alert("Không thể xóa dịch vụ: " + err.message);
        }
    };

    return (
        <AdminLayout>
            <div className="admin-services">
                <div className="services-heading">
                    <div>
                        <h1>Quản lý dịch vụ</h1>
                        <p>Quản lý danh sách dịch vụ vệ sinh trên CleanMate.</p>
                    </div>

                    <button className="service-add-btn" onClick={openAddForm}>
                        + Thêm dịch vụ
                    </button>
                </div>

                <div className="service-stats">
                    <div className="service-stat-card">
                        <span>Tổng dịch vụ</span>
                        <strong>{services.length}</strong>
                    </div>
                    <div className="service-stat-card">
                        <span>Đang hoạt động</span>
                        <strong>{activeCount}</strong>
                    </div>
                    <div className="service-stat-card">
                        <span>Chờ duyệt</span>
                        <strong>{pendingCount}</strong>
                    </div>
                    <div className="service-stat-card">
                        <span>Tạm ngừng</span>
                        <strong>{stoppedCount}</strong>
                    </div>
                </div>

                <div className="service-content">
                    <div className="service-toolbar">
                        <input
                            type="text"
                            placeholder="Tìm theo tên dịch vụ hoặc nhà cung cấp..."
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                        />

                        <select
                            value={categoryFilter}
                            onChange={(event) => setCategoryFilter(event.target.value)}
                        >
                            <option value="Tất cả">Tất cả danh mục</option>
                            {[...new Set(services.map((s) => s.category).filter(Boolean))]
                                .map((category) => (
                                    <option key={category} value={category}>
                                        {category}
                                    </option>
                                ))}
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                        >
                            <option value="Tất cả">Tất cả trạng thái</option>
                            <option value="Đang hoạt động">Đang hoạt động</option>
                            <option value="Chờ duyệt">Chờ duyệt</option>
                            <option value="Tạm ngừng">Tạm ngừng</option>
                        </select>
                    </div>

                    {error && (
                        <p role="alert" style={{ color: "red", padding: 12 }}>
                            {error}
                        </p>
                    )}

                    <div className="service-table-wrapper">
                        <table className="service-table">
                            <thead>
                            <tr>
                                <th>Dịch vụ</th>
                                <th>Danh mục</th>
                                <th>Nhà cung cấp</th>
                                <th>Giá</th>
                                <th>Thời lượng</th>
                                <th>Trạng thái</th>
                                <th>Thao tác</th>
                            </tr>
                            </thead>

                            <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan="7" className="service-empty">
                                        Đang tải danh sách dịch vụ...
                                    </td>
                                </tr>
                            )}

                            {!loading && !error &&
                                filteredServices.map((service) => (
                                    <tr key={service.id}>
                                        <td className="service-name">{service.name}</td>
                                        <td>{service.category}</td>
                                        <td>{service.provider}</td>
                                        <td>{formatPrice(service.price)}</td>
                                        <td>{service.duration || "—"}</td>
                                        <td>
                                                <span
                                                    className={`service-status ${
                                                        service.status === "Đang hoạt động"
                                                            ? "status-active"
                                                            : service.status === "Chờ duyệt"
                                                                ? "status-pending"
                                                                : "status-stopped"
                                                    }`}
                                                >
                                                    {service.status}
                                                </span>
                                        </td>
                                        <td>
                                            <div className="service-actions">
                                                <button
                                                    className="service-edit-btn"
                                                    onClick={() => openEditForm(service)}
                                                >
                                                    Sửa
                                                </button>
                                                <button
                                                    className="service-status-btn"
                                                    onClick={() => changeStatus(service)}
                                                >
                                                    {service.status === "Chờ duyệt"
                                                        ? "Duyệt"
                                                        : service.status === "Đang hoạt động"
                                                            ? "Tạm ngừng"
                                                            : "Kích hoạt"}
                                                </button>
                                                <button
                                                    className="service-delete-btn"
                                                    onClick={() => deleteService(service)}
                                                >
                                                    Xóa
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                            {!loading && !error && filteredServices.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="service-empty">
                                        Không tìm thấy dịch vụ phù hợp.
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>

                    <div className="service-table-footer">
                        Hiển thị {filteredServices.length} / {services.length} dịch vụ
                    </div>
                </div>

                {showForm && (
                    <div
                        className="service-modal-overlay"
                        onClick={() => setShowForm(false)}
                    >
                        <div
                            className="service-modal"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="service-modal-header">
                                <h2>
                                    {editingId !== null ? "Cập nhật dịch vụ" : "Thêm dịch vụ"}
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                >
                                    ×
                                </button>
                            </div>

                            <form onSubmit={handleSubmit}>
                                <p>
                                    Để lưu dịch vụ, bạn cần nhập ID danh mục và ID nhà
                                    cung cấp đang tồn tại trong database.
                                </p>

                                <label>Tên dịch vụ</label>
                                <input
                                    value={form.name}
                                    onChange={(event) =>
                                        setForm({ ...form, name: event.target.value })
                                    }
                                    placeholder="Nhập tên dịch vụ"
                                    required
                                />

                                <label>ID danh mục</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={form.categoryId}
                                    onChange={(event) =>
                                        setForm({ ...form, categoryId: event.target.value })
                                    }
                                    placeholder="Nhập categoryId"
                                    required
                                />

                                <label>ID nhà cung cấp</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={form.partnerId}
                                    onChange={(event) =>
                                        setForm({ ...form, partnerId: event.target.value })
                                    }
                                    placeholder="Nhập partnerId"
                                    required
                                    disabled={editingId !== null}
                                />

                                <label>Giá dịch vụ (VNĐ)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={form.price}
                                    onChange={(event) =>
                                        setForm({ ...form, price: event.target.value })
                                    }
                                    placeholder="Ví dụ: 250000"
                                    required
                                />

                                <label>Thời lượng (phút)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={form.estimatedMinutes}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            estimatedMinutes: event.target.value,
                                        })
                                    }
                                    placeholder="Ví dụ: 120"
                                    required
                                />

                                <label>Trạng thái</label>
                                <select
                                    value={form.status}
                                    onChange={(event) =>
                                        setForm({ ...form, status: event.target.value })
                                    }
                                >
                                    <option value="Chờ duyệt">Chờ duyệt</option>
                                    <option value="Đang hoạt động">Đang hoạt động</option>
                                    <option value="Tạm ngừng">Tạm ngừng</option>
                                </select>

                                <div className="service-modal-actions">
                                    <button
                                        type="button"
                                        className="service-cancel-btn"
                                        onClick={() => setShowForm(false)}
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        className="service-save-btn"
                                        disabled={saving}
                                    >
                                        {saving
                                            ? "Đang lưu..."
                                            : editingId !== null
                                                ? "Lưu thay đổi"
                                                : "Thêm dịch vụ"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

export default AdminServices;
