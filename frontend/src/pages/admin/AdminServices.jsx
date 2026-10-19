import { useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import "./AdminServices.css";

const initialServices = [
    {
        id: 1,
        name: "Vệ sinh nhà ở",
        category: "Vệ sinh nhà",
        provider: "Clean Home",
        price: 250000,
        duration: "2 giờ",
        status: "Đang hoạt động",
    },
    {
        id: 2,
        name: "Vệ sinh văn phòng",
        category: "Vệ sinh văn phòng",
        provider: "Green Clean",
        price: 500000,
        duration: "3 giờ",
        status: "Đang hoạt động",
    },
    {
        id: 3,
        name: "Vệ sinh sofa",
        category: "Vệ sinh nội thất",
        provider: "Fresh House",
        price: 350000,
        duration: "2 giờ",
        status: "Tạm ngừng",
    },
    {
        id: 4,
        name: "Tổng vệ sinh nhà",
        category: "Vệ sinh nhà",
        provider: "Clean Home",
        price: 800000,
        duration: "4 giờ",
        status: "Chờ duyệt",
    },
];

function AdminServices() {
    const [services, setServices] = useState(initialServices);
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("Tất cả");
    const [categoryFilter, setCategoryFilter] = useState("Tất cả");
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const emptyForm = {
        name: "",
        category: "Vệ sinh nhà",
        provider: "",
        price: "",
        duration: "",
        status: "Chờ duyệt",
    };

    const [form, setForm] = useState(emptyForm);

    const filteredServices = useMemo(() => {
        const search = keyword.trim().toLowerCase();

        return services.filter((service) => {
            const matchKeyword =
                service.name.toLowerCase().includes(search) ||
                service.provider.toLowerCase().includes(search);

            const matchStatus =
                statusFilter === "Tất cả" || service.status === statusFilter;

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
        Number(price).toLocaleString("vi-VN") + " đ";

    const openAddForm = () => {
        setEditingId(null);
        setForm(emptyForm);
        setShowForm(true);
    };

    const openEditForm = (service) => {
        setEditingId(service.id);
        setForm({
            ...service,
            price: String(service.price),
        });
        setShowForm(true);
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        if (
            !form.name.trim() ||
            !form.provider.trim() ||
            !form.price ||
            !form.duration.trim()
        ) {
            alert("Vui lòng nhập đầy đủ thông tin dịch vụ.");
            return;
        }

        if (Number(form.price) <= 0) {
            alert("Giá dịch vụ phải lớn hơn 0.");
            return;
        }

        const serviceData = {
            ...form,
            price: Number(form.price),
        };

        if (editingId !== null) {
            setServices((prev) =>
                prev.map((item) =>
                    item.id === editingId
                        ? { ...serviceData, id: editingId }
                        : item
                )
            );
            alert("Cập nhật dịch vụ thành công!");
        } else {
            setServices((prev) => [
                ...prev,
                {
                    ...serviceData,
                    id: Date.now(),
                },
            ]);
            alert("Thêm dịch vụ thành công!");
        }

        setShowForm(false);
        setForm(emptyForm);
        setEditingId(null);
    };

    const changeStatus = (service) => {
        let nextStatus;

        if (service.status === "Chờ duyệt") {
            nextStatus = "Đang hoạt động";
        } else if (service.status === "Đang hoạt động") {
            nextStatus = "Tạm ngừng";
        } else {
            nextStatus = "Đang hoạt động";
        }

        const actionText =
            nextStatus === "Đang hoạt động"
                ? "kích hoạt"
                : "tạm ngừng";

        if (
            window.confirm(
                `Bạn có chắc muốn ${actionText} dịch vụ "${service.name}"?`
            )
        ) {
            setServices((prev) =>
                prev.map((item) =>
                    item.id === service.id
                        ? { ...item, status: nextStatus }
                        : item
                )
            );
        }
    };

    const deleteService = (service) => {
        if (
            window.confirm(
                `Bạn có chắc muốn xóa dịch vụ "${service.name}" không?`
            )
        ) {
            setServices((prev) =>
                prev.filter((item) => item.id !== service.id)
            );
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
                        <option value="Vệ sinh nhà">Vệ sinh nhà</option>
                        <option value="Vệ sinh văn phòng">Vệ sinh văn phòng</option>
                        <option value="Vệ sinh nội thất">Vệ sinh nội thất</option>
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
                        {filteredServices.map((service) => (
                            <tr key={service.id}>
                                <td className="service-name">{service.name}</td>
                                <td>{service.category}</td>
                                <td>{service.provider}</td>
                                <td>{formatPrice(service.price)}</td>
                                <td>{service.duration}</td>
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

                        {filteredServices.length === 0 && (
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
                            <label>Tên dịch vụ</label>
                            <input
                                value={form.name}
                                onChange={(event) =>
                                    setForm({ ...form, name: event.target.value })
                                }
                                placeholder="Nhập tên dịch vụ"
                                required
                            />

                            <label>Danh mục</label>
                            <select
                                value={form.category}
                                onChange={(event) =>
                                    setForm({ ...form, category: event.target.value })
                                }
                            >
                                <option value="Vệ sinh nhà">Vệ sinh nhà</option>
                                <option value="Vệ sinh văn phòng">
                                    Vệ sinh văn phòng
                                </option>
                                <option value="Vệ sinh nội thất">
                                    Vệ sinh nội thất
                                </option>
                            </select>

                            <label>Nhà cung cấp</label>
                            <input
                                value={form.provider}
                                onChange={(event) =>
                                    setForm({ ...form, provider: event.target.value })
                                }
                                placeholder="Nhập tên nhà cung cấp"
                                required
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

                            <label>Thời lượng</label>
                            <input
                                value={form.duration}
                                onChange={(event) =>
                                    setForm({ ...form, duration: event.target.value })
                                }
                                placeholder="Ví dụ: 2 giờ"
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
                                <button type="submit" className="service-save-btn">
                                    {editingId !== null ? "Lưu thay đổi" : "Thêm dịch vụ"}
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