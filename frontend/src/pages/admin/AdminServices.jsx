import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import "./AdminServices.css";

const API_URL = "/api/admin/services";
const EMPTY_SERVICE = {
    name: "",
    slug: "",
    categoryId: "",
    description: "",
    thumbnailUrl: "",
    pricingType: "FIXED",
    basePrice: "",
    estimatedMinutes: "",
    displayOrder: "0",
};
const EMPTY_CATEGORY = {
    name: "",
    description: "",
    imageUrl: "",
    displayOrder: "0",
};

function getToken() {
    return (
        localStorage.getItem("token") ||
        localStorage.getItem("accessToken") ||
        sessionStorage.getItem("token") ||
        sessionStorage.getItem("accessToken") ||
        ""
    );
}

async function apiRequest(path, options = {}) {
    const token = getToken();
    let response;

    try {
        response = await fetch(`${API_URL}${path}`, {
            ...options,
            headers: {
                Accept: "application/json",
                ...(options.body ? { "Content-Type": "application/json" } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...options.headers,
            },
        });
    } catch {
        throw new Error("Không kết nối được máy chủ. Hãy kiểm tra backend và cấu hình proxy.");
    }

    const responseText = await response.text();
    let data = null;

    if (responseText) {
        try {
            data = JSON.parse(responseText);
        } catch {
            data = null;
        }
    }

    if (!response.ok) {
        const error = new Error(
            data?.message ||
            data?.detail ||
            data?.error ||
            responseText ||
            `Lỗi HTTP ${response.status}`
        );
        error.status = response.status;
        throw error;
    }

    if (responseText && data === null) {
        throw new Error("Dữ liệu máy chủ trả về không đúng định dạng JSON.");
    }

    return data;
}

function normalizeStatus(status) {
    return String(status || "").trim().toUpperCase() === "ACTIVE"
        ? "Đang hoạt động"
        : "Ngừng hoạt động";
}

function getStatusClass(status) {
    return normalizeStatus(status) === "Đang hoạt động"
        ? "status-active"
        : "status-stopped";
}

function formatPrice(price) {
    if (price === null || price === undefined || price === "") {
        return "Chưa thiết lập";
    }

    const number = Number(price);

    return Number.isFinite(number)
        ? `${number.toLocaleString("vi-VN")} đ`
        : "Chưa thiết lập";
}

function formatDuration(minutes) {
    if (minutes === null || minutes === undefined || minutes === "") {
        return "Chưa thiết lập";
    }

    const value = Number(minutes);

    if (!Number.isFinite(value) || value <= 0) {
        return "Chưa thiết lập";
    }

    if (value % 60 === 0) {
        return `${value / 60} giờ`;
    }

    if (value > 60) {
        return `${Math.floor(value / 60)} giờ ${value % 60} phút`;
    }

    return `${value} phút`;
}

export default function AdminServices() {
    const [activeTab, setActiveTab] = useState("services");
    const [services, setServices] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [serviceModal, setServiceModal] = useState(false);
    const [categoryModal, setCategoryModal] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [editingCategory, setEditingCategory] = useState(null);
    const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE);
    const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const [serviceData, categoryData] = await Promise.all([
                apiRequest(""),
                apiRequest("/categories"),
            ]);

            setServices(Array.isArray(serviceData) ? serviceData : []);
            setCategories(Array.isArray(categoryData) ? categoryData : []);
        } catch (err) {
            setError(err.message || "Không thể tải danh mục dịch vụ.");

            if (err.status === 401) {
                setError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredServices = useMemo(() => {
        const search = keyword.trim().toLocaleLowerCase("vi-VN");

        return services.filter((service) => {
            const matchesSearch =
                !search ||
                String(service.name || "").toLocaleLowerCase("vi-VN").includes(search) ||
                String(service.slug || "").toLocaleLowerCase("vi-VN").includes(search);

            const matchesStatus =
                statusFilter === "ALL" ||
                String(service.status).toUpperCase() === statusFilter;

            const matchesCategory =
                categoryFilter === "ALL" ||
                String(service.categoryId) === categoryFilter;

            return matchesSearch && matchesStatus && matchesCategory;
        });
    }, [services, keyword, statusFilter, categoryFilter]);

    const activeServices = services.filter(
        (item) => String(item.status).toUpperCase() === "ACTIVE"
    ).length;

    const inactiveServices = services.length - activeServices;

    const activeCategories = categories.filter(
        (item) => String(item.status).toUpperCase() === "ACTIVE"
    ).length;

    const openCreateService = () => {
        setEditingService(null);
        setServiceForm({
            ...EMPTY_SERVICE,
            categoryId: categories.find(
                (item) => item.status === "ACTIVE"
            )?.id?.toString() || "",
        });
        setError("");
        setServiceModal(true);
    };

    const openEditService = (service) => {
        setEditingService(service);
        setServiceForm({
            name: service.name || "",
            slug: service.slug || "",
            categoryId: service.categoryId?.toString() || "",
            description: service.description || "",
            thumbnailUrl: service.thumbnailUrl || "",
            pricingType: service.pricingType || "FIXED",
            basePrice: service.basePrice ?? "",
            estimatedMinutes: service.estimatedMinutes ?? "",
            displayOrder: service.displayOrder ?? 0,
        });
        setError("");
        setServiceModal(true);
    };

    const saveService = async (event) => {
        event.preventDefault();

        if (saving) {
            return;
        }

        if (!serviceForm.name.trim() || !serviceForm.categoryId) {
            setError("Vui lòng nhập tên dịch vụ và chọn danh mục.");
            return;
        }

        if (
            serviceForm.basePrice !== "" &&
            (
                !Number.isFinite(Number(serviceForm.basePrice)) ||
                Number(serviceForm.basePrice) < 0
            )
        ) {
            setError("Giá dịch vụ phải là số không âm.");
            return;
        }

        if (
            serviceForm.estimatedMinutes !== "" &&
            (
                !Number.isInteger(Number(serviceForm.estimatedMinutes)) ||
                Number(serviceForm.estimatedMinutes) <= 0
            )
        ) {
            setError("Thời lượng phải là số nguyên dương.");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const payload = {
                ...serviceForm,
                categoryId: Number(serviceForm.categoryId),
                basePrice: serviceForm.basePrice === ""
                    ? null
                    : Number(serviceForm.basePrice),
                estimatedMinutes: serviceForm.estimatedMinutes === ""
                    ? null
                    : Number(serviceForm.estimatedMinutes),
                displayOrder: Number(serviceForm.displayOrder) || 0,
            };

            await apiRequest(
                editingService ? `/${editingService.id}` : "",
                {
                    method: editingService ? "PUT" : "POST",
                    body: JSON.stringify(payload),
                }
            );

            setServiceModal(false);
            setNotice(
                editingService
                    ? "Đã cập nhật dịch vụ toàn sàn."
                    : "Đã tạo dịch vụ toàn sàn."
            );

            await loadData();
        } catch (err) {
            setError(err.message || "Không thể lưu dịch vụ.");
        } finally {
            setSaving(false);
        }
    };

    const toggleServiceStatus = async (service) => {
        const nextStatus =
            String(service.status).toUpperCase() === "ACTIVE"
                ? "INACTIVE"
                : "ACTIVE";

        const message = nextStatus === "INACTIVE"
            ? "Ngừng công bố dịch vụ này? Dữ liệu và lịch sử liên quan sẽ được giữ nguyên."
            : "Kích hoạt lại dịch vụ này?";

        if (!window.confirm(message)) {
            return;
        }

        setError("");
        setNotice("");

        try {
            await apiRequest(`/${service.id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status: nextStatus }),
            });

            setNotice(
                nextStatus === "ACTIVE"
                    ? "Đã kích hoạt dịch vụ."
                    : "Đã ngừng công bố dịch vụ."
            );

            await loadData();
        } catch (err) {
            setError(err.message || "Không thể thay đổi trạng thái dịch vụ.");
        }
    };

    const openCreateCategory = () => {
        setEditingCategory(null);
        setCategoryForm(EMPTY_CATEGORY);
        setError("");
        setCategoryModal(true);
    };

    const openEditCategory = (category) => {
        setEditingCategory(category);
        setCategoryForm({
            name: category.name || "",
            description: category.description || "",
            imageUrl: category.imageUrl || "",
            displayOrder: category.displayOrder ?? 0,
        });
        setError("");
        setCategoryModal(true);
    };

    const saveCategory = async (event) => {
        event.preventDefault();

        if (saving) {
            return;
        }

        if (!categoryForm.name.trim()) {
            setError("Vui lòng nhập tên danh mục.");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const payload = {
                ...categoryForm,
                displayOrder: Number(categoryForm.displayOrder) || 0,
            };

            await apiRequest(
                editingCategory
                    ? `/categories/${editingCategory.id}`
                    : "/categories",
                {
                    method: editingCategory ? "PUT" : "POST",
                    body: JSON.stringify(payload),
                }
            );

            setCategoryModal(false);
            setNotice(
                editingCategory
                    ? "Đã cập nhật danh mục."
                    : "Đã tạo danh mục."
            );

            await loadData();
        } catch (err) {
            setError(err.message || "Không thể lưu danh mục.");
        } finally {
            setSaving(false);
        }
    };

    const toggleCategoryStatus = async (category) => {
        const nextStatus =
            String(category.status).toUpperCase() === "ACTIVE"
                ? "INACTIVE"
                : "ACTIVE";

        const message = nextStatus === "INACTIVE"
            ? "Ngừng hoạt động danh mục? Các dịch vụ thuộc danh mục sẽ không còn hiển thị công khai, dữ liệu vẫn được giữ."
            : "Kích hoạt lại danh mục?";

        if (!window.confirm(message)) {
            return;
        }

        setError("");
        setNotice("");

        try {
            await apiRequest(`/categories/${category.id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status: nextStatus }),
            });

            setNotice(
                nextStatus === "ACTIVE"
                    ? "Đã kích hoạt danh mục."
                    : "Đã ngừng hoạt động danh mục."
            );

            await loadData();
        } catch (err) {
            setError(err.message || "Không thể thay đổi trạng thái danh mục.");
        }
    };

    return (
        <AdminLayout>
            <div className="admin-services">
                <div className="services-heading">
                    <div>
                        <h1>Danh mục dịch vụ toàn sàn</h1>
                        <p>
                            Quản lý dịch vụ và danh mục dùng chung. Giá chào bán
                            riêng của Provider được quản lý tại quy trình duyệt yêu cầu.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="service-add-btn"
                        onClick={loadData}
                        disabled={loading}
                    >
                        {loading ? "Đang tải..." : "Làm mới"}
                    </button>
                </div>

                <div className="service-stats">
                    <div className="service-stat-card">
                        <span>Tổng dịch vụ</span>
                        <strong>{services.length}</strong>
                    </div>

                    <div className="service-stat-card">
                        <span>Đang công bố</span>
                        <strong>{activeServices}</strong>
                    </div>

                    <div className="service-stat-card">
                        <span>Ngừng công bố</span>
                        <strong>{inactiveServices}</strong>
                    </div>

                    <div className="service-stat-card">
                        <span>Danh mục hoạt động</span>
                        <strong>{activeCategories}</strong>
                    </div>
                </div>

                <div className="service-content">
                    <div
                        style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            marginBottom: 18,
                            borderBottom: "1px solid #e2e8f0",
                            paddingBottom: 12,
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => setActiveTab("services")}
                            style={{
                                border: 0,
                                borderRadius: 8,
                                padding: "10px 15px",
                                fontWeight: 700,
                                cursor: "pointer",
                                color: activeTab === "services" ? "#fff" : "#334155",
                                background: activeTab === "services" ? "#15966f" : "#f1f5f9",
                            }}
                        >
                            Dịch vụ toàn sàn ({services.length})
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("categories")}
                            style={{
                                border: 0,
                                borderRadius: 8,
                                padding: "10px 15px",
                                fontWeight: 700,
                                cursor: "pointer",
                                color: activeTab === "categories" ? "#fff" : "#334155",
                                background: activeTab === "categories" ? "#15966f" : "#f1f5f9",
                            }}
                        >
                            Danh mục ({categories.length})
                        </button>
                    </div>

                    {notice && (
                        <div className="service-workflow-notice">
                            <strong>{notice}</strong>
                        </div>
                    )}

                    {error && (
                        <div className="service-error">
                            <p>{error}</p>
                            <button type="button" onClick={loadData}>
                                Tải lại
                            </button>
                        </div>
                    )}

                    {activeTab === "services" ? (
                        <>
                            <div className="service-toolbar">
                                <input
                                    type="text"
                                    placeholder="Tìm theo tên hoặc mã slug dịch vụ..."
                                    value={keyword}
                                    onChange={(event) => setKeyword(event.target.value)}
                                />

                                <select
                                    value={categoryFilter}
                                    onChange={(event) => setCategoryFilter(event.target.value)}
                                >
                                    <option value="ALL">Tất cả danh mục</option>
                                    {categories.map((category) => (
                                        <option key={category.id} value={String(category.id)}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={statusFilter}
                                    onChange={(event) => setStatusFilter(event.target.value)}
                                >
                                    <option value="ALL">Tất cả trạng thái</option>
                                    <option value="ACTIVE">Đang hoạt động</option>
                                    <option value="INACTIVE">Ngừng hoạt động</option>
                                </select>

                                <button
                                    type="button"
                                    className="service-add-btn"
                                    onClick={openCreateService}
                                >
                                    Thêm dịch vụ
                                </button>
                            </div>

                            <div className="service-workflow-notice">
                                <strong>Phân biệt danh mục toàn sàn và giá Provider</strong>
                                <p>
                                    Màn hình này quản lý thông tin gốc trong bảng services.
                                    Không thay đổi partner_services hoặc giá của Provider.
                                    Khi ngừng dịch vụ, hệ thống giữ nguyên dịch vụ, gói,
                                    booking và lịch sử liên quan.
                                </p>
                            </div>

                            <div className="service-table-wrapper">
                                <table className="service-table">
                                    <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Tên dịch vụ</th>
                                        <th>Danh mục</th>
                                        <th>Giá nền</th>
                                        <th>Thời lượng</th>
                                        <th>Provider đăng ký</th>
                                        <th>Gói dịch vụ</th>
                                        <th>Trạng thái</th>
                                        <th>Thao tác</th>
                                    </tr>
                                    </thead>

                                    <tbody>
                                    {loading && (
                                        <tr>
                                            <td colSpan="9" className="service-empty">
                                                Đang tải dữ liệu...
                                            </td>
                                        </tr>
                                    )}

                                    {!loading && filteredServices.map((service) => (
                                        <tr key={service.id}>
                                            <td>{service.id}</td>
                                            <td>
                                                <strong>{service.name || "—"}</strong>
                                                <small>{service.slug || ""}</small>
                                            </td>
                                            <td>{service.category || "—"}</td>
                                            <td>{formatPrice(service.basePrice)}</td>
                                            <td>{formatDuration(service.estimatedMinutes)}</td>
                                            <td>{service.partnerOfferCount ?? 0}</td>
                                            <td>{service.packageCount ?? 0}</td>
                                            <td>
                                                    <span className={`service-status ${getStatusClass(service.status)}`}>
                                                        {normalizeStatus(service.status)}
                                                    </span>
                                            </td>
                                            <td>
                                                <div className="service-actions">
                                                    <button
                                                        type="button"
                                                        className="service-edit-btn"
                                                        onClick={() => openEditService(service)}
                                                    >
                                                        Sửa
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="service-status-btn"
                                                        onClick={() => toggleServiceStatus(service)}
                                                    >
                                                        {String(service.status).toUpperCase() === "ACTIVE"
                                                            ? "Ngừng"
                                                            : "Kích hoạt"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {!loading && filteredServices.length === 0 && (
                                        <tr>
                                            <td colSpan="9" className="service-empty">
                                                Không có dịch vụ phù hợp.
                                            </td>
                                        </tr>
                                    )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="service-table-footer">
                                Hiển thị {filteredServices.length} / {services.length} dịch vụ
                            </div>
                        </>
                    ) : (
                        <>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 16,
                                    flexWrap: "wrap",
                                    marginBottom: 18,
                                }}
                            >
                                <div>
                                    <strong>Danh mục dịch vụ</strong>
                                    <p>
                                        Không xóa cứng danh mục để bảo toàn khóa ngoại và lịch sử.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="service-add-btn"
                                    onClick={openCreateCategory}
                                >
                                    Thêm danh mục
                                </button>
                            </div>

                            <div className="service-table-wrapper">
                                <table className="service-table">
                                    <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Tên danh mục</th>
                                        <th>Mô tả</th>
                                        <th>Số dịch vụ</th>
                                        <th>Thứ tự</th>
                                        <th>Trạng thái</th>
                                        <th>Thao tác</th>
                                    </tr>
                                    </thead>

                                    <tbody>
                                    {loading && (
                                        <tr>
                                            <td colSpan="7" className="service-empty">
                                                Đang tải dữ liệu...
                                            </td>
                                        </tr>
                                    )}

                                    {!loading && categories.map((category) => (
                                        <tr key={category.id}>
                                            <td>{category.id}</td>
                                            <td><strong>{category.name}</strong></td>
                                            <td>{category.description || "—"}</td>
                                            <td>{category.serviceCount ?? 0}</td>
                                            <td>{category.displayOrder ?? 0}</td>
                                            <td>
                                                    <span className={`service-status ${getStatusClass(category.status)}`}>
                                                        {normalizeStatus(category.status)}
                                                    </span>
                                            </td>
                                            <td>
                                                <div className="service-actions">
                                                    <button
                                                        type="button"
                                                        className="service-edit-btn"
                                                        onClick={() => openEditCategory(category)}
                                                    >
                                                        Sửa
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="service-status-btn"
                                                        onClick={() => toggleCategoryStatus(category)}
                                                    >
                                                        {String(category.status).toUpperCase() === "ACTIVE"
                                                            ? "Ngừng"
                                                            : "Kích hoạt"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {!loading && categories.length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="service-empty">
                                                Chưa có danh mục trong cơ sở dữ liệu.
                                            </td>
                                        </tr>
                                    )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {serviceModal && (
                <div
                    className="service-modal-overlay"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setServiceModal(false);
                        }
                    }}
                >
                    <div className="service-modal">
                        <div className="service-modal-header">
                            <h2>{editingService ? "Cập nhật dịch vụ" : "Thêm dịch vụ toàn sàn"}</h2>
                            <button type="button" onClick={() => setServiceModal(false)}>
                                ×
                            </button>
                        </div>

                        <form onSubmit={saveService}>
                            <label>Tên dịch vụ *</label>
                            <input
                                value={serviceForm.name}
                                onChange={(event) => setServiceForm({
                                    ...serviceForm,
                                    name: event.target.value,
                                })}
                                maxLength={150}
                                required
                            />

                            <label>Slug</label>
                            <input
                                value={serviceForm.slug}
                                onChange={(event) => setServiceForm({
                                    ...serviceForm,
                                    slug: event.target.value,
                                })}
                                placeholder="Để trống để tự tạo từ tên dịch vụ"
                                maxLength={150}
                            />

                            <label>Danh mục *</label>
                            <select
                                value={serviceForm.categoryId}
                                onChange={(event) => setServiceForm({
                                    ...serviceForm,
                                    categoryId: event.target.value,
                                })}
                                required
                            >
                                <option value="">Chọn danh mục</option>
                                {categories
                                    .filter((item) =>
                                        String(item.status).toUpperCase() === "ACTIVE" ||
                                        String(item.id) === String(serviceForm.categoryId)
                                    )
                                    .map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                            </select>

                            <label>Mô tả</label>
                            <textarea
                                value={serviceForm.description}
                                onChange={(event) => setServiceForm({
                                    ...serviceForm,
                                    description: event.target.value,
                                })}
                                rows={3}
                                maxLength={5000}
                            />

                            <label>URL ảnh đại diện</label>
                            <input
                                type="url"
                                value={serviceForm.thumbnailUrl}
                                onChange={(event) => setServiceForm({
                                    ...serviceForm,
                                    thumbnailUrl: event.target.value,
                                })}
                                maxLength={500}
                            />

                            <label>Loại giá</label>
                            <input value="Giá cố định (FIXED)" disabled />

                            <label>Giá nền (VNĐ)</label>
                            <input
                                type="number"
                                min="0"
                                step="1000"
                                value={serviceForm.basePrice}
                                onChange={(event) => setServiceForm({
                                    ...serviceForm,
                                    basePrice: event.target.value,
                                })}
                            />

                            <label>Thời lượng dự kiến (phút)</label>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={serviceForm.estimatedMinutes}
                                onChange={(event) => setServiceForm({
                                    ...serviceForm,
                                    estimatedMinutes: event.target.value,
                                })}
                            />

                            <label>Thứ tự hiển thị</label>
                            <input
                                type="number"
                                step="1"
                                value={serviceForm.displayOrder}
                                onChange={(event) => setServiceForm({
                                    ...serviceForm,
                                    displayOrder: event.target.value,
                                })}
                            />

                            <div className="service-modal-actions">
                                <button
                                    type="button"
                                    className="service-cancel-btn"
                                    onClick={() => setServiceModal(false)}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="service-save-btn"
                                    disabled={saving}
                                >
                                    {saving ? "Đang lưu..." : "Lưu dịch vụ"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {categoryModal && (
                <div
                    className="service-modal-overlay"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setCategoryModal(false);
                        }
                    }}
                >
                    <div className="service-modal">
                        <div className="service-modal-header">
                            <h2>{editingCategory ? "Cập nhật danh mục" : "Thêm danh mục"}</h2>
                            <button type="button" onClick={() => setCategoryModal(false)}>
                                ×
                            </button>
                        </div>

                        <form onSubmit={saveCategory}>
                            <label>Tên danh mục *</label>
                            <input
                                value={categoryForm.name}
                                onChange={(event) => setCategoryForm({
                                    ...categoryForm,
                                    name: event.target.value,
                                })}
                                maxLength={150}
                                required
                            />

                            <label>Mô tả</label>
                            <textarea
                                value={categoryForm.description}
                                onChange={(event) => setCategoryForm({
                                    ...categoryForm,
                                    description: event.target.value,
                                })}
                                rows={3}
                                maxLength={5000}
                            />

                            <label>URL hình ảnh</label>
                            <input
                                type="url"
                                value={categoryForm.imageUrl}
                                onChange={(event) => setCategoryForm({
                                    ...categoryForm,
                                    imageUrl: event.target.value,
                                })}
                                maxLength={500}
                            />

                            <label>Thứ tự hiển thị</label>
                            <input
                                type="number"
                                step="1"
                                value={categoryForm.displayOrder}
                                onChange={(event) => setCategoryForm({
                                    ...categoryForm,
                                    displayOrder: event.target.value,
                                })}
                            />

                            <div className="service-modal-actions">
                                <button
                                    type="button"
                                    className="service-cancel-btn"
                                    onClick={() => setCategoryModal(false)}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="service-save-btn"
                                    disabled={saving}
                                >
                                    {saving ? "Đang lưu..." : "Lưu danh mục"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}