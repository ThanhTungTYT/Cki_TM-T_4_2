
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import "./AdminPromotions.css";

const API_URL = "http://localhost:8080/api/admin";

const EMPTY_PROMOTION = {
    name: "",
    code: "",
    description: "",
    discountType: "PERCENT",
    discountValue: "",
    maxDiscount: "",
    minBookingValue: "0",
    startAt: "",
    endAt: "",
    usageLimit: "",
    sponsor: "PLATFORM",
    combinableWithPoints: false,
    serviceIdsText: "",
};

const DEFAULT_POLICY = {
    earnAmountStep: "10000",
    earnPoints: "1",
    pointValue: "100",
    maxRedeemPercent: "20",
    minRedeemPoints: "100",
    maxRedeemPoints: "5000",
    expiryMonths: "12",
    enabled: false,
    allowCombineWithPromotion: false,
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
        throw new Error("Không kết nối được máy chủ. Hãy kiểm tra backend.");
    }

    const raw = await response.text();
    let data = null;

    if (raw) {
        try {
            data = JSON.parse(raw);
        } catch {
            data = null;
        }
    }

    if (!response.ok) {
        const error = new Error(
            data?.message ||
            data?.detail ||
            data?.error ||
            raw ||
            `Lỗi HTTP ${response.status}`
        );
        error.status = response.status;
        throw error;
    }

    return data;
}

function money(value) {
    return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

function dateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleString("vi-VN");
}

function toDateTimeInput(value) {
    if (!value) return "";
    return String(value).slice(0, 16);
}

function statusLabel(status) {
    return {
        DRAFT: "Bản nháp",
        ACTIVE: "Đang hoạt động",
        INACTIVE: "Đã ngừng",
        EXPIRED: "Hết hạn",
    }[String(status || "").toUpperCase()] || status || "—";
}

export default function AdminPromotions() {
    const [activeTab, setActiveTab] = useState("promotions");
    const [promotions, setPromotions] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [policy, setPolicy] = useState(DEFAULT_POLICY);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [keyword, setKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [modalOpen, setModalOpen] = useState(false);
    const [editingPromotion, setEditingPromotion] = useState(null);
    const [form, setForm] = useState(EMPTY_PROMOTION);
    const [adjustingAccount, setAdjustingAccount] = useState(null);
    const [adjustment, setAdjustment] = useState({
        points: "",
        reason: "",
    });

    const loadPromotions = useCallback(async () => {
        const data = await apiRequest("/promotions");
        setPromotions(Array.isArray(data) ? data : []);
    }, []);

    const loadRewards = useCallback(async () => {
        const [policyData, accountData] = await Promise.all([
            apiRequest("/rewards/policy"),
            apiRequest("/rewards/accounts"),
        ]);

        setPolicy({
            earnAmountStep: String(
                policyData?.earnAmountStep ?? DEFAULT_POLICY.earnAmountStep
            ),
            earnPoints: String(
                policyData?.earnPoints ?? DEFAULT_POLICY.earnPoints
            ),
            pointValue: String(
                policyData?.pointValue ?? DEFAULT_POLICY.pointValue
            ),
            maxRedeemPercent: String(
                policyData?.maxRedeemPercent ?? DEFAULT_POLICY.maxRedeemPercent
            ),
            minRedeemPoints: String(
                policyData?.minRedeemPoints ?? DEFAULT_POLICY.minRedeemPoints
            ),
            maxRedeemPoints: String(
                policyData?.maxRedeemPoints ?? DEFAULT_POLICY.maxRedeemPoints
            ),
            expiryMonths: String(
                policyData?.expiryMonths ?? DEFAULT_POLICY.expiryMonths
            ),
            enabled: Boolean(policyData?.enabled),
            allowCombineWithPromotion: Boolean(
                policyData?.allowCombineWithPromotion
            ),
        });

        setAccounts(Array.isArray(accountData) ? accountData : []);
    }, []);

    const loadAll = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            await Promise.all([loadPromotions(), loadRewards()]);
        } catch (err) {
            setError(
                err.message || "Không thể tải dữ liệu ưu đãi và điểm thưởng."
            );
        } finally {
            setLoading(false);
        }
    }, [loadPromotions, loadRewards]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const filteredPromotions = useMemo(() => {
        const search = keyword.trim().toLocaleLowerCase("vi-VN");

        return promotions.filter((item) => {
            const matchesSearch =
                !search ||
                String(item.name || "")
                    .toLocaleLowerCase("vi-VN")
                    .includes(search) ||
                String(item.code || "")
                    .toLocaleLowerCase("vi-VN")
                    .includes(search);

            const matchesStatus =
                statusFilter === "ALL" || item.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [promotions, keyword, statusFilter]);

    const openCreate = () => {
        setEditingPromotion(null);
        setForm({
            ...EMPTY_PROMOTION,
            startAt: new Date(Date.now() + 60000).toISOString().slice(0, 16),
            endAt: new Date(Date.now() + 30 * 86400000)
                .toISOString()
                .slice(0, 16),
        });
        setError("");
        setModalOpen(true);
    };

    const openEdit = (promotion) => {
        setEditingPromotion(promotion);

        setForm({
            name: promotion.name || "",
            code: promotion.code || "",
            description: promotion.description || "",
            discountType: promotion.discountType || "PERCENT",
            discountValue: String(promotion.discountValue ?? ""),
            maxDiscount:
                promotion.maxDiscount == null
                    ? ""
                    : String(promotion.maxDiscount),
            minBookingValue: String(promotion.minBookingValue ?? 0),
            startAt: toDateTimeInput(promotion.startAt),
            endAt: toDateTimeInput(promotion.endAt),
            usageLimit:
                promotion.usageLimit == null
                    ? ""
                    : String(promotion.usageLimit),
            sponsor: promotion.sponsor || "PLATFORM",
            combinableWithPoints: Boolean(promotion.combinableWithPoints),
            serviceIdsText: (promotion.serviceIds || []).join(", "),
        });

        setError("");
        setModalOpen(true);
    };

    const savePromotion = async (event) => {
        event.preventDefault();

        if (saving) return;

        const value = Number(form.discountValue);

        if (
            !form.name.trim() ||
            !form.code.trim() ||
            !form.startAt ||
            !form.endAt
        ) {
            setError("Vui lòng nhập tên, mã và thời hạn chương trình.");
            return;
        }

        if (!Number.isFinite(value) || value <= 0) {
            setError("Giá trị giảm phải lớn hơn 0.");
            return;
        }

        if (new Date(form.endAt) <= new Date(form.startAt)) {
            setError("Thời gian kết thúc phải sau thời gian bắt đầu.");
            return;
        }

        const serviceIds = form.serviceIdsText.trim()
            ? [
                ...new Set(
                    form.serviceIdsText
                        .split(",")
                        .map((value) => Number(value.trim()))
                        .filter(Number.isInteger)
                ),
            ]
            : [];

        if (form.serviceIdsText.trim() && serviceIds.length === 0) {
            setError("Danh sách ID dịch vụ không hợp lệ.");
            return;
        }

        const payload = {
            name: form.name.trim(),
            code: form.code.trim().toUpperCase(),
            description: form.description.trim(),
            discountType: form.discountType,
            discountValue: value,
            maxDiscount:
                form.maxDiscount === "" ? null : Number(form.maxDiscount),
            minBookingValue:
                form.minBookingValue === "" ? 0 : Number(form.minBookingValue),
            startAt: form.startAt,
            endAt: form.endAt,
            usageLimit:
                form.usageLimit === "" ? null : Number(form.usageLimit),
            sponsor: form.sponsor,
            combinableWithPoints: form.combinableWithPoints,
            serviceIds,
        };

        setSaving(true);
        setError("");
        setNotice("");

        try {
            await apiRequest(
                editingPromotion
                    ? `/promotions/${editingPromotion.id}`
                    : "/promotions",
                {
                    method: editingPromotion ? "PUT" : "POST",
                    body: JSON.stringify(payload),
                }
            );

            setModalOpen(false);
            setNotice(
                editingPromotion
                    ? "Đã cập nhật chương trình khuyến mãi."
                    : "Đã tạo chương trình khuyến mãi ở trạng thái bản nháp."
            );

            await loadPromotions();
        } catch (err) {
            setError(err.message || "Không thể lưu chương trình khuyến mãi.");
        } finally {
            setSaving(false);
        }
    };

    const changeStatus = async (promotion) => {
        const nextStatus =
            promotion.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

        if (
            !window.confirm(
                nextStatus === "ACTIVE"
                    ? "Kích hoạt chương trình này?"
                    : "Ngừng chương trình này?"
            )
        ) {
            return;
        }

        setError("");
        setNotice("");

        try {
            await apiRequest(`/promotions/${promotion.id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status: nextStatus }),
            });

            setNotice(
                nextStatus === "ACTIVE"
                    ? "Đã kích hoạt chương trình."
                    : "Đã ngừng chương trình."
            );

            await loadPromotions();
        } catch (err) {
            setError(err.message || "Không thể thay đổi trạng thái chương trình.");
        }
    };

    const savePolicy = async (event) => {
        event.preventDefault();

        if (saving) return;

        const payload = {
            earnAmountStep: Number(policy.earnAmountStep),
            earnPoints: Number(policy.earnPoints),
            pointValue: Number(policy.pointValue),
            maxRedeemPercent: Number(policy.maxRedeemPercent),
            minRedeemPoints: Number(policy.minRedeemPoints),
            maxRedeemPoints: Number(policy.maxRedeemPoints),
            expiryMonths: Number(policy.expiryMonths),
            enabled: Boolean(policy.enabled),
            allowCombineWithPromotion: Boolean(
                policy.allowCombineWithPromotion
            ),
        };

        if (
            Object.values(payload).some(
                (value) =>
                    typeof value === "number" && !Number.isFinite(value)
            )
        ) {
            setError("Vui lòng nhập các thông số điểm thưởng hợp lệ.");
            return;
        }

        setSaving(true);
        setError("");
        setNotice("");

        try {
            await apiRequest("/rewards/policy", {
                method: "PUT",
                body: JSON.stringify(payload),
            });

            setNotice("Đã lưu chính sách điểm thưởng.");
            await loadRewards();
        } catch (err) {
            setError(err.message || "Không thể lưu chính sách điểm thưởng.");
        } finally {
            setSaving(false);
        }
    };

    const saveAdjustment = async (event) => {
        event.preventDefault();

        if (!adjustingAccount || saving) return;

        const points = Number(adjustment.points);

        if (
            !Number.isInteger(points) ||
            points === 0 ||
            !adjustment.reason.trim()
        ) {
            setError("Nhập số điểm nguyên khác 0 và lý do điều chỉnh.");
            return;
        }

        setSaving(true);
        setError("");

        try {
            await apiRequest(
                `/rewards/accounts/${adjustingAccount.userId}/adjustments`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        points,
                        reason: adjustment.reason.trim(),
                    }),
                }
            );

            setAdjustingAccount(null);
            setAdjustment({ points: "", reason: "" });
            setNotice("Đã ghi nhận điều chỉnh điểm và lưu lịch sử.");

            await loadRewards();
        } catch (err) {
            setError(err.message || "Không thể điều chỉnh điểm thưởng.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <AdminLayout>
            <div className="admin-promotions-page">
                <div className="promotion-heading">
                    <div>
                        <h1>Ưu đãi & điểm thưởng</h1>
                        <p>
                            Quản lý voucher, chương trình giảm giá và chính sách
                            khách hàng thân thiết.
                        </p>
                    </div>

                    <button
                        className="promotion-primary-btn"
                        type="button"
                        onClick={openCreate}
                    >
                        + Tạo khuyến mãi
                    </button>
                </div>

                {error && (
                    <div className="promotion-alert error">{error}</div>
                )}

                {notice && (
                    <div className="promotion-alert success">{notice}</div>
                )}

                <div className="promotion-tabs">
                    <button
                        type="button"
                        className={activeTab === "promotions" ? "active" : ""}
                        onClick={() => setActiveTab("promotions")}
                    >
                        Chương trình khuyến mãi
                    </button>

                    <button
                        type="button"
                        className={activeTab === "rewards" ? "active" : ""}
                        onClick={() => setActiveTab("rewards")}
                    >
                        Chính sách điểm thưởng
                    </button>
                </div>

                {activeTab === "promotions" && (
                    <section className="promotion-panel">
                        <div className="promotion-toolbar">
                            <input
                                value={keyword}
                                onChange={(event) =>
                                    setKeyword(event.target.value)
                                }
                                placeholder="Tìm tên hoặc mã voucher..."
                            />

                            <select
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(event.target.value)
                                }
                            >
                                <option value="ALL">Tất cả trạng thái</option>
                                <option value="DRAFT">Bản nháp</option>
                                <option value="ACTIVE">Đang hoạt động</option>
                                <option value="INACTIVE">Đã ngừng</option>
                            </select>

                            <button
                                type="button"
                                onClick={loadAll}
                                disabled={loading}
                            >
                                Làm mới
                            </button>
                        </div>

                        <div className="promotion-table-wrap">
                            <table className="promotion-table">
                                <thead>
                                <tr>
                                    <th>Chương trình</th>
                                    <th>Mã</th>
                                    <th>Mức giảm</th>
                                    <th>Thời hạn</th>
                                    <th>Lượt dùng</th>
                                    <th>Trạng thái</th>
                                    <th>Thao tác</th>
                                </tr>
                                </thead>

                                <tbody>
                                {loading && (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="promotion-empty"
                                        >
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                )}

                                {!loading &&
                                    filteredPromotions.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <strong>{item.name}</strong>
                                                <small>
                                                    {item.sponsor === "PLATFORM"
                                                        ? "Sàn tài trợ"
                                                        : item.sponsor === "PROVIDER"
                                                            ? "Nhà cung cấp tài trợ"
                                                            : "Đồng tài trợ"}
                                                </small>
                                            </td>

                                            <td>
                                                    <span className="promotion-code">
                                                        {item.code}
                                                    </span>
                                            </td>

                                            <td>
                                                {item.discountType === "PERCENT"
                                                    ? `${item.discountValue}%`
                                                    : money(item.discountValue)}
                                                {item.maxDiscount != null && (
                                                    <small>
                                                        Tối đa {money(item.maxDiscount)}
                                                    </small>
                                                )}
                                            </td>

                                            <td>
                                                {dateTime(item.startAt)}
                                                <small>
                                                    đến {dateTime(item.endAt)}
                                                </small>
                                            </td>

                                            <td>
                                                {item.usageCount || 0} /{" "}
                                                {item.usageLimit ?? "Không giới hạn"}
                                            </td>

                                            <td>
                                                    <span
                                                        className={`promotion-status ${String(
                                                            item.status
                                                        ).toLowerCase()}`}
                                                    >
                                                        {statusLabel(item.status)}
                                                    </span>
                                            </td>

                                            <td className="promotion-actions">
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(item)}
                                                >
                                                    Sửa
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => changeStatus(item)}
                                                >
                                                    {item.status === "ACTIVE"
                                                        ? "Ngừng"
                                                        : "Kích hoạt"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                {!loading &&
                                    filteredPromotions.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="promotion-empty"
                                            >
                                                Chưa có chương trình phù hợp.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <p className="promotion-footnote">
                            Chương trình mới được tạo ở trạng thái bản nháp.
                            Việc áp dụng voucher vào booking cần hoàn tất kết nối
                            Checkout và thanh toán ở phần tiếp theo.
                        </p>
                    </section>
                )}

                {activeTab === "rewards" && (
                    <div className="reward-layout">
                        <form
                            className="promotion-panel reward-policy-form"
                            onSubmit={savePolicy}
                        >
                            <div className="promotion-section-heading">
                                <div>
                                    <h2>Chính sách tích và đổi điểm</h2>
                                    <p>
                                        Quy đổi cố định: 1.000đ tích 1 Ccoin;
                                        1.000 Ccoin giảm 1.000đ. Có thể cấu hình
                                        thời hạn điểm và kết hợp khuyến mãi.
                                    </p>
                                </div>
                            </div>

                            <label className="promotion-toggle">
                                <input
                                    type="checkbox"
                                    disabled
                                    checked={policy.enabled}
                                    onChange={(event) =>
                                        setPolicy((current) => ({
                                            ...current,
                                            enabled: event.target.checked,
                                        }))
                                    }
                                />
                                Kích hoạt chương trình điểm thưởng
                            </label>

                            <div className="reward-fields">
                                <label>
                                    Số tiền chi tiêu để tích điểm
                                    <input
                                        type="number"
                                        min="1"
                                        readOnly
                                        value={policy.earnAmountStep}
                                        onChange={(event) =>
                                            setPolicy((current) => ({
                                                ...current,
                                                earnAmountStep: event.target.value,
                                            }))
                                        }
                                    />
                                </label>

                                <label>
                                    Số điểm nhận được
                                    <input
                                        type="number"
                                        min="1"
                                        readOnly
                                        value={policy.earnPoints}
                                        onChange={(event) =>
                                            setPolicy((current) => ({
                                                ...current,
                                                earnPoints: event.target.value,
                                            }))
                                        }
                                    />
                                </label>

                                <label>
                                    Giá trị quy đổi mỗi điểm (VND)
                                    <input
                                        type="number"
                                        min="1"
                                        readOnly
                                        value={policy.pointValue}
                                        onChange={(event) =>
                                            setPolicy((current) => ({
                                                ...current,
                                                pointValue: event.target.value,
                                            }))
                                        }
                                    />
                                </label>

                                <label>
                                    Tỷ lệ đơn tối đa được thanh toán bằng điểm (%)
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        readOnly
                                        value={policy.maxRedeemPercent}
                                        onChange={(event) =>
                                            setPolicy((current) => ({
                                                ...current,
                                                maxRedeemPercent: event.target.value,
                                            }))
                                        }
                                    />
                                </label>

                                <label>
                                    Số điểm tối thiểu mỗi lần đổi
                                    <input
                                        type="number"
                                        min="0"
                                        readOnly
                                        value={policy.minRedeemPoints}
                                        onChange={(event) =>
                                            setPolicy((current) => ({
                                                ...current,
                                                minRedeemPoints: event.target.value,
                                            }))
                                        }
                                    />
                                </label>

                                <label>
                                    Số điểm tối đa mỗi lần đổi
                                    <input
                                        type="number"
                                        min="0"
                                        readOnly
                                        value={policy.maxRedeemPoints}
                                        onChange={(event) =>
                                            setPolicy((current) => ({
                                                ...current,
                                                maxRedeemPoints: event.target.value,
                                            }))
                                        }
                                    />
                                </label>

                                <label>
                                    Thời hạn điểm (tháng, 0 = không hết hạn)
                                    <input
                                        type="number"
                                        min="0"
                                        max="120"
                                        value={policy.expiryMonths}
                                        onChange={(event) =>
                                            setPolicy((current) => ({
                                                ...current,
                                                expiryMonths: event.target.value,
                                            }))
                                        }
                                    />
                                </label>
                            </div>

                            <label className="promotion-toggle">
                                <input
                                    type="checkbox"
                                    checked={policy.allowCombineWithPromotion}
                                    onChange={(event) =>
                                        setPolicy((current) => ({
                                            ...current,
                                            allowCombineWithPromotion:
                                            event.target.checked,
                                        }))
                                    }
                                />
                                Cho phép kết hợp điểm với voucher nếu voucher cũng cho phép
                            </label>

                            <button
                                className="promotion-primary-btn"
                                type="submit"
                                disabled={saving}
                            >
                                {saving ? "Đang lưu..." : "Lưu chính sách"}
                            </button>

                            <p className="promotion-footnote">
                                Phần này lưu cấu hình chính sách và hỗ trợ điều
                                chỉnh điểm thủ công. Luồng tự động tích/đổi điểm
                                tại booking sẽ được nối ở phần tích hợp Checkout
                                và BookingStateEngine.
                            </p>
                        </form>

                        <section className="promotion-panel reward-accounts-panel">
                            <div className="promotion-section-heading">
                                <div>
                                    <h2>Tài khoản điểm thưởng</h2>
                                    <p>
                                        Số dư và tổng điểm ghi nhận của khách hàng.
                                    </p>
                                </div>
                            </div>

                            <div className="promotion-table-wrap">
                                <table className="promotion-table reward-table">
                                    <thead>
                                    <tr>
                                        <th>Khách hàng</th>
                                        <th>Số dư</th>
                                        <th>Đã tích</th>
                                        <th>Đã đổi/điều chỉnh trừ</th>
                                        <th></th>
                                    </tr>
                                    </thead>

                                    <tbody>
                                    {accounts.map((account) => (
                                        <tr key={account.id}>
                                            <td>
                                                <strong>{account.fullName}</strong>
                                                <small>{account.email}</small>
                                            </td>
                                            <td>{account.balance} điểm</td>
                                            <td>{account.totalEarned} điểm</td>
                                            <td>{account.totalRedeemed} điểm</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAdjustingAccount(account);
                                                        setAdjustment({
                                                            points: "",
                                                            reason: "",
                                                        });
                                                    }}
                                                >
                                                    Điều chỉnh
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    {!loading && accounts.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="promotion-empty"
                                            >
                                                Chưa có tài khoản điểm thưởng.
                                            </td>
                                        </tr>
                                    )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                )}

                {modalOpen && (
                    <div
                        className="promotion-modal-backdrop"
                        onClick={() => !saving && setModalOpen(false)}
                    >
                        <form
                            className="promotion-modal"
                            onSubmit={savePromotion}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="promotion-modal-heading">
                                <div>
                                    <h2>
                                        {editingPromotion
                                            ? "Cập nhật khuyến mãi"
                                            : "Tạo chương trình khuyến mãi"}
                                    </h2>
                                    <p>
                                        Thiết lập điều kiện và phạm vi áp dụng voucher.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                >
                                    ×
                                </button>
                            </div>

                            <div className="promotion-form-grid">
                                <label>
                                    Tên chương trình
                                    <input
                                        required
                                        maxLength={150}
                                        value={form.name}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                name: event.target.value,
                                            }))
                                        }
                                    />
                                </label>

                                <label>
                                    Mã voucher
                                    <input
                                        required
                                        maxLength={40}
                                        value={form.code}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                code: event.target.value.toUpperCase(),
                                            }))
                                        }
                                    />
                                </label>

                                <label>
                                    Loại giảm
                                    <select
                                        value={form.discountType}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                discountType: event.target.value,
                                            }))
                                        }
                                    >
                                        <option value="PERCENT">Theo phần trăm</option>
                                        <option value="FIXED">Theo số tiền</option>
                                    </select>
                                </label>

                                <label>
                                    Giá trị giảm
                                    <input
                                        required
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={form.discountValue}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                discountValue: event.target.value,
                                            }))
                                        }
                                    />
                                </label>

                                <label>
                                    Giảm tối đa
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.maxDiscount}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                maxDiscount: event.target.value,
                                            }))
                                        }
                                    />
                                </label>

                                <label>
                                    Đơn tối thiểu (VND)
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.minBookingValue}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                minBookingValue: event.target.value,
                                            }))
                                        }
                                    />
                                </label>

                                <label>
                                    Bắt đầu
                                    <input
                                        required
                                        type="datetime-local"
                                        value={form.startAt}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                startAt: event.target.value,
                                            }))
                                        }
                                    />
                                </label>

                                <label>
                                    Kết thúc
                                    <input
                                        required
                                        type="datetime-local"
                                        value={form.endAt}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                endAt: event.target.value,
                                            }))
                                        }
                                    />
                                </label>

                                <label>
                                    Giới hạn lượt dùng
                                    <input
                                        type="number"
                                        min="1"
                                        value={form.usageLimit}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                usageLimit: event.target.value,
                                            }))
                                        }
                                    />
                                </label>

                                <label>
                                    Bên tài trợ
                                    <select
                                        value={form.sponsor}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                sponsor: event.target.value,
                                            }))
                                        }
                                    >
                                        <option value="PLATFORM">Sàn CleanMate</option>
                                        <option value="PROVIDER">Nhà cung cấp</option>
                                        <option value="SHARED">Đồng tài trợ</option>
                                    </select>
                                </label>

                                <label className="promotion-full-field">
                                    ID dịch vụ áp dụng
                                    <input
                                        value={form.serviceIdsText}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                serviceIdsText: event.target.value,
                                            }))
                                        }
                                        placeholder="Để trống để áp dụng toàn bộ dịch vụ; ví dụ: 1, 2, 5"
                                    />
                                </label>

                                <label className="promotion-full-field">
                                    Mô tả
                                    <textarea
                                        rows={3}
                                        value={form.description}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                description: event.target.value,
                                            }))
                                        }
                                    />
                                </label>
                            </div>

                            <label className="promotion-toggle">
                                <input
                                    type="checkbox"
                                    checked={form.combinableWithPoints}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            combinableWithPoints: event.target.checked,
                                        }))
                                    }
                                />
                                Cho phép kết hợp với điểm thưởng
                            </label>

                            <div className="promotion-modal-actions">
                                <button
                                    type="button"
                                    className="promotion-secondary-btn"
                                    onClick={() => setModalOpen(false)}
                                    disabled={saving}
                                >
                                    Hủy
                                </button>

                                <button
                                    type="submit"
                                    className="promotion-primary-btn"
                                    disabled={saving}
                                >
                                    {saving ? "Đang lưu..." : "Lưu chương trình"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {adjustingAccount && (
                    <div
                        className="promotion-modal-backdrop"
                        onClick={() => !saving && setAdjustingAccount(null)}
                    >
                        <form
                            className="promotion-modal promotion-adjust-modal"
                            onSubmit={saveAdjustment}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="promotion-modal-heading">
                                <div>
                                    <h2>Điều chỉnh điểm thưởng</h2>
                                    <p>
                                        {adjustingAccount.fullName} · {adjustingAccount.email}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setAdjustingAccount(null)}
                                >
                                    ×
                                </button>
                            </div>

                            <label>
                                Số điểm điều chỉnh
                                <input
                                    type="number"
                                    step="1"
                                    required
                                    value={adjustment.points}
                                    onChange={(event) =>
                                        setAdjustment((current) => ({
                                            ...current,
                                            points: event.target.value,
                                        }))
                                    }
                                    placeholder="Số dương để cộng, số âm để trừ"
                                />
                            </label>

                            <label>
                                Lý do điều chỉnh
                                <textarea
                                    required
                                    rows={4}
                                    maxLength={500}
                                    value={adjustment.reason}
                                    onChange={(event) =>
                                        setAdjustment((current) => ({
                                            ...current,
                                            reason: event.target.value,
                                        }))
                                    }
                                />
                            </label>

                            <div className="promotion-modal-actions">
                                <button
                                    type="button"
                                    className="promotion-secondary-btn"
                                    onClick={() => setAdjustingAccount(null)}
                                    disabled={saving}
                                >
                                    Hủy
                                </button>

                                <button
                                    type="submit"
                                    className="promotion-primary-btn"
                                    disabled={saving}
                                >
                                    {saving ? "Đang lưu..." : "Xác nhận điều chỉnh"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
