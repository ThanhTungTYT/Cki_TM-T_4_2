import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import "./AdminServices.css";

const API_URL = "/api/admin/services";

function getToken() {
    return (
        localStorage.getItem("token") ||
        localStorage.getItem("accessToken") ||
        sessionStorage.getItem("token") ||
        sessionStorage.getItem("accessToken") ||
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
                ...(options.body
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...(token
                    ? { Authorization: `Bearer ${token}` }
                    : {}),
                ...options.headers,
            },
        });
    } catch (error) {
        console.error("Không kết nối được API:", error);
        throw new Error(
            "Không kết nối được máy chủ. Hãy kiểm tra backend và cấu hình proxy."
        );
    }

    const responseText = await response.text();

    if (!response.ok) {
        console.error("API URL:", url);
        console.error("HTTP STATUS:", response.status);
        console.error("SERVER RESPONSE:", responseText);
        console.error("TOKEN EXISTS:", Boolean(token));

        let message = responseText;

        try {
            const parsed = JSON.parse(responseText);
            message =
                parsed.message ||
                parsed.error ||
                parsed.detail ||
                responseText;
        } catch {
            // Giữ nguyên nội dung phản hồi nếu không phải JSON.
        }

        if (response.status === 401) {
            throw new Error(
                message || "Phiên đăng nhập hết hạn hoặc token không hợp lệ."
            );
        }

        if (response.status === 403) {
            throw new Error(
                message ||
                "Máy chủ từ chối quyền truy cập. Hãy kiểm tra token và quyền ADMIN/STAFF."
            );
        }

        throw new Error(message || `Lỗi HTTP ${response.status}`);
    }

    if (response.status === 204 || !responseText) {
        return null;
    }

    try {
        return JSON.parse(responseText);
    } catch {
        throw new Error("Dữ liệu máy chủ trả về không đúng định dạng JSON.");
    }
}

const STATUS_OPTIONS = [
    "Chờ duyệt",
    "Đang hoạt động",
    "Tạm ngừng",
];

function normalizeStatus(status) {
    const value = String(status || "").trim().toUpperCase();

    if (
        ["ACTIVE", "ĐANG HOẠT ĐỘNG", "APPROVED"].includes(value)
    ) {
        return "Đang hoạt động";
    }

    if (
        ["PENDING", "PENDING_APPROVAL", "CHỜ DUYỆT"].includes(value)
    ) {
        return "Chờ duyệt";
    }

    if (
        [
            "INACTIVE",
            "SUSPENDED",
            "DISABLED",
            "TẠM NGỪNG",
            "LOCKED",
        ].includes(value)
    ) {
        return "Tạm ngừng";
    }

    return STATUS_OPTIONS.includes(status)
        ? status
        : "Chờ duyệt";
}

function getStatusClass(status) {
    const normalized = normalizeStatus(status);

    if (normalized === "Đang hoạt động") {
        return "status-active";
    }

    if (normalized === "Chờ duyệt") {
        return "status-pending";
    }

    return "status-stopped";
}

function getPartnerName(partner) {
    return (
        partner?.name ||
        partner?.businessName ||
        partner?.fullName ||
        partner?.user?.fullName ||
        `Nhà cung cấp #${partner?.id ?? ""}`
    );
}

function AdminServices() {
    const [services, setServices] = useState([]);
    const [categories, setCategories] = useState([]);
    const [partners, setPartners] = useState([]);

    const [loading, setLoading] = useState(true);
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [error, setError] = useState("");
    const [optionsError, setOptionsError] = useState("");

    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("Tất cả");
    const [categoryFilter, setCategoryFilter] = useState("Tất cả");

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [changingStatusId, setChangingStatusId] = useState(null);

    const emptyForm = {
        name: "",
        categoryId: "",
        partnerId: "",
        price: "",
        estimatedMinutes: "",
        status: "Chờ duyệt",
    };

    const [form, setForm] = useState({ ...emptyForm });

    const fetchServices = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const data = await apiRequest(API_URL);
            const list = Array.isArray(data)
                ? data
                : Array.isArray(data?.content)
                    ? data.content
                    : [];

            setServices(
                list.map((service) => ({
                    ...service,
                    status: normalizeStatus(service.status),
                    category:
                        service.category ||
                        service.categoryName ||
                        service.category?.name ||
                        "",
                    provider:
                        service.provider ||
                        service.partnerName ||
                        service.businessName ||
                        service.partner?.name ||
                        "",
                    duration:
                        service.duration ??
                        service.estimatedMinutes ??
                        null,
                }))
            );
        } catch (err) {
            setError(err.message || "Không thể tải danh sách dịch vụ.");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchOptions = useCallback(async () => {
        try {
            setOptionsLoading(true);
            setOptionsError("");

            const data = await apiRequest(`${API_URL}/options`);

setCategories(
    Array.isArray(data?.categories)
        ? data.categories
        : []
);

setPartners(
    Array.isArray(data?.partners)
        ? data.partners
        : []
);
} catch (err) {
    setOptionsError(
        "Không tải được danh mục hoặc nhà cung cấp: " +
        err.message
    );
} finally {
    setOptionsLoading(false);
}
}, []);

useEffect(() => {
    fetchServices();
    fetchOptions();
}, [fetchServices, fetchOptions]);

const filteredServices = useMemo(() => {
    const search = keyword.trim().toLowerCase();

    return services.filter((service) => {
        const name = String(service.name || "").toLowerCase();
        const provider = String(service.provider || "").toLowerCase();
        const category =
            typeof service.category === "string"
                ? service.category
                : service.category?.name || "";

        const matchKeyword =
            name.includes(search) ||
            provider.toLowerCase().includes(search);

        const matchStatus =
            statusFilter === "Tất cả" ||
            normalizeStatus(service.status) === statusFilter;

        const matchCategory =
            categoryFilter === "Tất cả" ||
            category === categoryFilter;

        return matchKeyword && matchStatus && matchCategory;
    });
}, [services, keyword, statusFilter, categoryFilter]);

const activeCount = services.filter(
    (item) => normalizeStatus(item.status) === "Đang hoạt động"
).length;

const pendingCount = services.filter(
    (item) => normalizeStatus(item.status) === "Chờ duyệt"
).length;

const stoppedCount = services.filter(
    (item) => normalizeStatus(item.status) === "Tạm ngừng"
).length;

const formatPrice = (price) => {
    if (price === null || price === undefined || price === "") {
        return "—";
    }

    const number = Number(price);

    return Number.isFinite(number)
        ? number.toLocaleString("vi-VN") + " đ"
        : "—";
};

const openAddForm = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowForm(true);
};

const openEditForm = (service) => {
    setEditingId(service.id);

    setForm({
        name: service.name || "",
        categoryId: String(
            service.categoryId ?? service.category?.id ?? ""
        ),
        partnerId: String(
            service.partnerId ?? service.partner?.id ?? ""
        ),
        price: String(service.price ?? ""),
        estimatedMinutes: String(
            service.estimatedMinutes ?? service.duration ?? ""
        ),
        status: normalizeStatus(service.status),
    });

    setShowForm(true);
};

const closeForm = () => {
    if (saving) {
        return;
    }

    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
};

const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
        alert("Vui lòng nhập tên dịch vụ.");
        return;
    }

    if (!form.categoryId || !form.partnerId) {
        alert("Vui lòng chọn danh mục và nhà cung cấp.");
        return;
    }

    if (
        form.price === "" ||
        !Number.isFinite(Number(form.price)) ||
        Number(form.price) <= 0
    ) {
        alert("Giá dịch vụ phải lớn hơn 0.");
        return;
    }

    if (
        form.estimatedMinutes === "" ||
        !Number.isFinite(Number(form.estimatedMinutes)) ||
        Number(form.estimatedMinutes) <= 0
    ) {
        alert("Thời lượng dịch vụ phải lớn hơn 0.");
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
        setForm({ ...emptyForm });

        await fetchServices();
    } catch (err) {
        alert("Không thể lưu dịch vụ: " + err.message);
    } finally {
        setSaving(false);
    }
};

const changeStatus = async (service) => {
    const currentStatus = normalizeStatus(service.status);

    const nextStatus =
        currentStatus === "Đang hoạt động"
            ? "Tạm ngừng"
            : "Đang hoạt động";

    const actionText =
        nextStatus === "Đang hoạt động"
            ? "kích hoạt"
            : "tạm ngừng";

    if (
        !window.confirm(
            `Bạn có chắc muốn ${actionText} dịch vụ "${service.name}"?`
        )
    ) {
        return;
    }

    try {
        setChangingStatusId(service.id);

        await apiRequest(`${API_URL}/${service.id}/status`, {
            method: "PUT",
            body: JSON.stringify({ status: nextStatus }),
        });

        await fetchServices();
    } catch (err) {
        alert("Không thể đổi trạng thái: " + err.message);
    } finally {
        setChangingStatusId(null);
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
        setDeletingId(service.id);

        await apiRequest(`${API_URL}/${service.id}`, {
            method: "DELETE",
        });

        await fetchServices();
        alert("Đã xóa liên kết dịch vụ.");
    } catch (err) {
        alert("Không thể xóa dịch vụ: " + err.message);
    } finally {
        setDeletingId(null);
    }
};

return (
    <AdminLayout>
        <div className="admin-services">
            <div className="services-heading">
                <div>
                    <h1>Quản lý dịch vụ</h1>
                    <p>
                        Quản lý danh sách dịch vụ vệ sinh trên CleanMate.
                    </p>
                </div>

                <button
                    type="button"
                    className="service-add-btn"
                    onClick={openAddForm}
                >
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
                        onChange={(event) =>
                            setKeyword(event.target.value)
                        }
                    />

                    <select
                        value={categoryFilter}
                        onChange={(event) =>
                            setCategoryFilter(event.target.value)
                        }
                    >
                        <option value="Tất cả">Tất cả danh mục</option>

                        {[
                            ...new Set(
                                services
                                    .map((service) =>
                                        typeof service.category === "string"
                                            ? service.category
                                            : service.category?.name || ""
                                    )
                                    .filter(Boolean)
                            ),
                        ].map((category) => (
                            <option key={category} value={category}>
                                {category}
                            </option>
                        ))}
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(event) =>
                            setStatusFilter(event.target.value)
                        }
                    >
                        <option value="Tất cả">Tất cả trạng thái</option>

                        {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                                {status}
                            </option>
                        ))}
                    </select>
                </div>

                {error && (
                    <div className="service-error">
                        <p>{error}</p>
                        <button type="button" onClick={fetchServices}>
                            Thử tải lại
                        </button>
                    </div>
                )}

                {optionsError && (
                    <div className="service-error">
                        <p>{optionsError}</p>
                        <button type="button" onClick={fetchOptions}>
                            Tải lại danh mục và nhà cung cấp
                        </button>
                    </div>
                )}

                <div className="service-table-wrapper">
                    <table className="service-table">
                        <thead>
                        <tr>
                            <th>ID</th>
                            <th>Tên dịch vụ</th>
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
                                <td colSpan="8" className="service-empty">
                                    Đang tải danh sách dịch vụ...
                                </td>
                            </tr>
                        )}

                        {!loading &&
                            !error &&
                            filteredServices.map((service) => {
                                const status = normalizeStatus(
                                    service.status
                                );

                                return (
                                    <tr key={service.id}>
                                        <td>{service.id}</td>
                                        <td>{service.name || "—"}</td>
                                        <td>
                                            {typeof service.category === "string"
                                                ? service.category || "—"
                                                : service.category?.name || "—"}
                                        </td>
                                        <td>{service.provider || "—"}</td>
                                        <td>{formatPrice(service.price)}</td>
                                        <td>
                                            {service.duration
                                                ? `${service.duration} phút`
                                                : "—"}
                                        </td>
                                        <td>
                                                    <span
                                                        className={`service-status ${getStatusClass(status)}`}
                                                    >
                                                        {status}
                                                    </span>
                                        </td>
                                        <td>
                                            <div className="service-actions">
                                                <button
                                                    type="button"
                                                    className="service-edit-btn"
                                                    onClick={() =>
                                                        openEditForm(service)
                                                    }
                                                >
                                                    Sửa
                                                </button>

                                                <button
                                                    type="button"
                                                    className="service-status-btn"
                                                    disabled={
                                                        changingStatusId === service.id
                                                    }
                                                    onClick={() =>
                                                        changeStatus(service)
                                                    }
                                                >
                                                    {changingStatusId === service.id
                                                        ? "Đang xử lý..."
                                                        : status === "Đang hoạt động"
                                                            ? "Tạm ngừng"
                                                            : "Kích hoạt"}
                                                </button>

                                                <button
                                                    type="button"
                                                    className="service-delete-btn"
                                                    disabled={
                                                        deletingId === service.id
                                                    }
                                                    onClick={() =>
                                                        deleteService(service)
                                                    }
                                                >
                                                    {deletingId === service.id
                                                        ? "Đang xóa..."
                                                        : "Xóa"}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                        {!loading &&
                            !error &&
                            filteredServices.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="service-empty">
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
                    onClick={closeForm}
                >
                    <div
                        className="service-modal"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="service-modal-header">
                            <h2>
                                {editingId !== null
                                    ? "Cập nhật dịch vụ"
                                    : "Thêm dịch vụ"}
                            </h2>

                            <button
                                type="button"
                                onClick={closeForm}
                                disabled={saving}
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <label htmlFor="service-name">
                                Tên dịch vụ
                            </label>
                            <input
                                id="service-name"
                                value={form.name}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        name: event.target.value,
                                    })
                                }
                                placeholder="Nhập tên dịch vụ"
                                required
                            />

                            <label htmlFor="service-category">
                                Danh mục dịch vụ
                            </label>
                            <select
                                id="service-category"
                                value={form.categoryId}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        categoryId: event.target.value,
                                    })
                                }
                                required
                                disabled={optionsLoading}
                            >
                                <option value="">
                                    {optionsLoading
                                        ? "Đang tải danh mục..."
                                        : "Chọn danh mục"}
                                </option>

                                {categories.map((category) => (
                                    <option
                                        key={category.id}
                                        value={category.id}
                                    >
                                        {category.name}
                                    </option>
                                ))}
                            </select>

                            <label htmlFor="service-partner">
                                Nhà cung cấp
                            </label>
                            <select
                                id="service-partner"
                                value={form.partnerId}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        partnerId: event.target.value,
                                    })
                                }
                                required
                                disabled={optionsLoading}
                            >
                                <option value="">
                                    {optionsLoading
                                        ? "Đang tải nhà cung cấp..."
                                        : "Chọn nhà cung cấp"}
                                </option>

                                {partners.map((partner) => (
                                    <option
                                        key={partner.id}
                                        value={partner.id}
                                    >
                                        {getPartnerName(partner)}
                                        {partner.status
                                            ? ` (${partner.status})`
                                            : ""}
                                    </option>
                                ))}
                            </select>

                            {!optionsLoading && categories.length === 0 && (
                                <p>
                                    Chưa có danh mục để lựa chọn. Hãy kiểm tra
                                    dữ liệu danh mục trong database.
                                </p>
                            )}

                            {!optionsLoading && partners.length === 0 && (
                                <p>
                                    Chưa có nhà cung cấp để lựa chọn. Hãy kiểm
                                    tra dữ liệu nhà cung cấp trong database.
                                </p>
                            )}

                            <label htmlFor="service-price">
                                Giá dịch vụ (VNĐ)
                            </label>
                            <input
                                id="service-price"
                                type="number"
                                min="1"
                                step="1000"
                                value={form.price}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        price: event.target.value,
                                    })
                                }
                                placeholder="Ví dụ: 250000"
                                required
                            />

                            <label htmlFor="service-duration">
                                Thời lượng (phút)
                            </label>
                            <input
                                id="service-duration"
                                type="number"
                                min="1"
                                step="1"
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

                            <label htmlFor="service-status">
                                Trạng thái
                            </label>
                            <select
                                id="service-status"
                                value={form.status}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        status: event.target.value,
                                    })
                                }
                            >
                                {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </select>

                            <div className="service-modal-actions">
                                <button
                                    type="button"
                                    className="service-cancel-btn"
                                    onClick={closeForm}
                                    disabled={saving}
                                >
                                    Hủy
                                </button>

                                <button
                                    type="submit"
                                    className="service-save-btn"
                                    disabled={
                                        saving ||
                                        optionsLoading ||
                                        categories.length === 0 ||
                                        partners.length === 0
                                    }
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
