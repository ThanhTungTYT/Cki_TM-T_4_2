
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBoxArchive,
    faClockRotateLeft,
    faUser,
    faHeadset,
    faRightFromBracket,
    faCamera
} from "@fortawesome/free-solid-svg-icons";
import Header from "../components/Header";
import Footer from "../components/Footer";
import CustomerBookingsView from "../components/CustomerBookingsView";
import "./profile.css";

function Profile() {
    const [searchParams] = useSearchParams();
    const tabParam = searchParams.get("tab");
    const [activeTab, setActiveTab] = useState(
        tabParam === "history" ? "history" :
            tabParam === "orders" ? "orders" : "profile"
    );
    const navigate = useNavigate();

    const handleLogout = () => {
        sessionStorage.removeItem("accessToken");
        sessionStorage.removeItem("user");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
    };

    const [profile, setProfile] = useState({
        fullName: "",
        email: "",
        phone: "",
        dateOfBirth: "",
        gender: ""
    });
    const [originalProfile, setOriginalProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [addresses, setAddresses] = useState([]);
    const [addressModalOpen, setAddressModalOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState(null);
    const [addressSaving, setAddressSaving] = useState(false);
    const [addressError, setAddressError] = useState("");
    const emptyAddress = {
        receiverName: "",
        phone: "",
        province: "",
        district: "",
        ward: "",
        streetAddress: "",
        isDefault: false
    };
    const [addressForm, setAddressForm] = useState(emptyAddress);

    const handleChange = event => {
        const { name, value } = event.target;
        setProfile(previous => ({ ...previous, [name]: value }));
    };

    useEffect(() => {
        const fetchProfile = async () => {
            const token = sessionStorage.getItem("accessToken") || localStorage.getItem("accessToken");

            if (!token) {
                navigate("/login", { replace: true });
                return;
            }

            try {
                const response = await fetch("http://localhost:8080/api/users/me", {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (response.status === 401) {
                    navigate("/login", { replace: true });
                    return;
                }

                if (!response.ok) {
                    throw new Error("Không thể tải thông tin cá nhân");
                }

                const data = await response.json();
                const userProfile = {
                    fullName: data.fullName || "",
                    email: data.email || "",
                    phone: data.phone || "",
                    dateOfBirth: data.dateOfBirth || "",
                    gender: data.gender || ""
                };

                setProfile(userProfile);
                setOriginalProfile(userProfile);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [navigate]);

    useEffect(() => {
        const token = sessionStorage.getItem("accessToken") || localStorage.getItem("accessToken");
        if (!token) return;

        fetch("http://localhost:8080/api/users/me/addresses", {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(async response => {
                if (!response.ok) throw new Error("Không thể tải danh sách địa chỉ");
                setAddresses(await response.json());
            })
            .catch(err => setAddressError(err.message));
    }, []);

    const openAddressModal = (address = null) => {
        setEditingAddress(address);
        setAddressForm(address ? { ...emptyAddress, ...address } : { ...emptyAddress });
        setAddressError("");
        setAddressModalOpen(true);
    };

    const saveAddress = async event => {
        event.preventDefault();
        setAddressError("");
        setAddressSaving(true);

        try {
            const token = sessionStorage.getItem("accessToken") || localStorage.getItem("accessToken");
            const response = await fetch(
                `http://localhost:8080/api/users/me/addresses${editingAddress ? `/${editingAddress.id}` : ""}`,
                {
                    method: editingAddress ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(addressForm)
                }
            );

            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || data.detail || "Không thể lưu địa chỉ");

            setAddresses(previous => {
                const next = editingAddress
                    ? previous.map(item => item.id === data.id ? data : item)
                    : [data, ...previous];

                return data.isDefault
                    ? next.map(item => item.id === data.id ? item : { ...item, isDefault: false })
                    : next;
            });

            setAddressModalOpen(false);
        } catch (err) {
            setAddressError(err.message);
        } finally {
            setAddressSaving(false);
        }
    };

    const deleteAddress = async address => {
        if (!window.confirm("Bạn có chắc muốn xóa địa chỉ này không?")) return;
        setAddressError("");

        try {
            const token = sessionStorage.getItem("accessToken") || localStorage.getItem("accessToken");
            const response = await fetch(`http://localhost:8080/api/users/me/addresses/${address.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || data.detail || "Không thể xóa địa chỉ");

            setAddresses(previous => {
                const remaining = previous.filter(item => item.id !== address.id);

                if (address.isDefault && remaining.length > 0) {
                    return remaining.map((item, index) => ({ ...item, isDefault: index === 0 }));
                }

                return remaining;
            });
        } catch (err) {
            setAddressError(err.message);
        }
    };

    const handleSave = async () => {
        setMessage("");
        setError("");

        if (!profile.fullName.trim()) {
            setError("Vui lòng nhập họ và tên");
            return;
        }

        setSaving(true);

        try {
            const token = sessionStorage.getItem("accessToken") || localStorage.getItem("accessToken");
            const response = await fetch("http://localhost:8080/api/users/me", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    fullName: profile.fullName,
                    phone: profile.phone,
                    dateOfBirth: profile.dateOfBirth || null,
                    gender: profile.gender
                })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || data.detail || "Cập nhật thông tin thất bại");
            }

            const data = await response.json();
            const updatedProfile = {
                fullName: data.fullName || "",
                email: data.email || "",
                phone: data.phone || "",
                dateOfBirth: data.dateOfBirth || "",
                gender: data.gender || ""
            };

            setProfile(updatedProfile);
            setOriginalProfile(updatedProfile);

            const storage = sessionStorage.getItem("user") ? sessionStorage : localStorage;
            const currentUser = JSON.parse(storage.getItem("user") || "{}");

            storage.setItem("user", JSON.stringify({
                ...currentUser,
                fullName: data.fullName
            }));

            setMessage("Cập nhật thông tin thành công!");
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        if (originalProfile) setProfile({ ...originalProfile });
        setMessage("");
        setError("");
    };

    return (
        <div className="home">
            <Header />
            <main className="profile-main">
                <div className="profile-container">
                    <aside className="profile-sidebar">
                        <ul className="sidebar-menu">
                            <li
                                className={`sidebar-item ${activeTab === "profile" ? "active" : ""}`}
                                onClick={() => setActiveTab("profile")}
                            >
                                <FontAwesomeIcon icon={faUser} />
                                Hồ sơ cá nhân
                            </li>
                            <li
                                className={`sidebar-item ${activeTab === "orders" ? "active" : ""}`}
                                onClick={() => navigate("/customer/bookings")}
                            >
                                <FontAwesomeIcon icon={faBoxArchive} />
                                Đơn hàng của tôi
                            </li>
                            <li
                                className="sidebar-item"
                                onClick={() => navigate('/customer/bookings/history')}
                            >
                                <FontAwesomeIcon icon={faClockRotateLeft} />
                                Lịch sử đơn hàng
                            </li>
                            <li
                                className="sidebar-item"
                                onClick={() => navigate('/customer/reports')}
                            >
                                <FontAwesomeIcon icon={faHeadset} />
                                Hỗ trợ & Khiếu nại
                            </li>
                            <li className="sidebar-item logout" onClick={handleLogout}>
                                <FontAwesomeIcon icon={faRightFromBracket} />
                                Đăng xuất
                            </li>
                        </ul>
                    </aside>

                    <div className="profile-content">
                        {activeTab === "orders" || activeTab === "history" ? (
                            <CustomerBookingsView />
                        ) : (
                            <>
                                <div className="profile-header-title">
                                    <h2>Hồ sơ cá nhân</h2>
                                    <p>Quản lý thông tin tài khoản, địa chỉ lưu trữ, cấu hình bảo mật và tùy chọn nhận thông báo của bạn.</p>
                                </div>

                                <div className="profile-grid-top">
                                    <div className="profile-card">
                                        <h3>Thông tin cá nhân</h3>
                                        <p className="card-subtitle">Cung cấp thông tin liên hệ chính xác giúp việc điều phối đối tác dọn dẹp dễ dàng hơn.</p>

                                        <div className="avatar-upload-row">
                                            <div className="avatar-preview-box">
                                                <div className="avatar-placeholder-img"></div>
                                                <div className="camera-badge">
                                                    <FontAwesomeIcon icon={faCamera} />
                                                </div>
                                            </div>
                                            <div className="avatar-action">
                                                <span className="change-avatar-text">Thay đổi ảnh đại diện</span>
                                                <span className="avatar-note">Định dạng JPG, PNG tối đa 5MB.</span>
                                            </div>
                                        </div>

                                        <div className="form-grid-2">
                                            <div className="form-group">
                                                <label>Họ và tên</label>
                                                <input type="text" name="fullName" value={profile.fullName} onChange={handleChange} />
                                            </div>
                                            <div className="form-group">
                                                <label>Email</label>
                                                <div className="input-with-badge">
                                                    <input type="email" name="email" value={profile.email} readOnly />
                                                    <span className="verified-tag">Đã xác minh</span>
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label>Số điện thoại</label>
                                                <input type="tel" name="phone" value={profile.phone} onChange={handleChange} />
                                            </div>
                                            <div className="form-group">
                                                <label>Ngày sinh</label>
                                                <input type="date" name="dateOfBirth" value={profile.dateOfBirth} onChange={handleChange} />
                                            </div>
                                            <div className="form-group">
                                                <label>Giới tính</label>
                                                <select name="gender" value={profile.gender} onChange={handleChange}>
                                                    <option value="">Chọn giới tính</option>
                                                    <option value="FEMALE">Nữ</option>
                                                    <option value="MALE">Nam</option>
                                                    <option value="OTHER">Khác</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="profile-card">
                                        <h3>Bảo mật tài khoản</h3>
                                        <p className="card-subtitle">Cập nhật mật khẩu định kỳ giúp tài khoản an toàn hơn.</p>
                                        <div className="form-group">
                                            <label>Mật khẩu hiện tại</label>
                                            <input type="password" />
                                        </div>
                                        <div className="form-group">
                                            <label>Mật khẩu mới</label>
                                            <input type="password" />
                                        </div>
                                        <div className="form-group">
                                            <label>Xác nhận mật khẩu mới</label>
                                            <input type="password" />
                                        </div>
                                    </div>
                                </div>

                                <div className="profile-card address-card">
                                    <div className="address-card-header">
                                        <div>
                                            <h3>Địa chỉ đã lưu</h3>
                                            <p className="card-subtitle">Danh sách địa chỉ giúp bạn đặt lịch dọn dẹp nhanh hơn.</p>
                                        </div>
                                        <button type="button" className="btn-add-address" onClick={() => openAddressModal()}>
                                            + Thêm địa chỉ mới
                                        </button>
                                    </div>

                                    <div className="address-list">
                                        {addressError && !addressModalOpen && <p className="address-error">{addressError}</p>}
                                        {addresses.length === 0 && <p className="address-empty">Bạn chưa lưu địa chỉ nào.</p>}
                                        {addresses.map(address => (
                                            <article className="saved-address" key={address.id}>
                                                <div className="saved-address-details">
                                                    <div className="saved-address-heading">
                                                        <strong>{address.receiverName}</strong>
                                                        {address.isDefault && <span className="default-address-badge">Mặc định</span>}
                                                    </div>
                                                    <span>{address.phone}</span>
                                                    <span>{[address.streetAddress, address.ward, address.district, address.province].filter(Boolean).join(", ")}</span>
                                                </div>
                                                <div className="saved-address-actions">
                                                    <button type="button" className="btn-edit-address" onClick={() => openAddressModal(address)}>Sửa</button>
                                                    <button type="button" className="btn-delete-address" onClick={() => deleteAddress(address)}>Xóa</button>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </div>

                                {addressModalOpen && (
                                    <div
                                        className="address-modal-backdrop"
                                        onMouseDown={event => {
                                            if (event.target === event.currentTarget) setAddressModalOpen(false);
                                        }}
                                    >
                                        <form className="address-modal" onSubmit={saveAddress}>
                                            <div className="address-modal-header">
                                                <h3>{editingAddress ? "Sửa địa chỉ" : "Thêm địa chỉ mới"}</h3>
                                                <button type="button" className="address-modal-close" aria-label="Đóng" onClick={() => setAddressModalOpen(false)}>×</button>
                                            </div>
                                            <div className="address-modal-grid">
                                                {[["receiverName", "Tên người nhận"], ["phone", "Số điện thoại"], ["province", "Tỉnh / Thành phố"], ["district", "Quận / Huyện"], ["ward", "Phường / Xã"], ["streetAddress", "Số nhà, tên đường"]].map(([name, label]) => (
                                                    <label className="address-modal-field" key={name}>
                                                        <span>{label}</span>
                                                        <input
                                                            required
                                                            name={name}
                                                            value={addressForm[name]}
                                                            onChange={event => setAddressForm(form => ({ ...form, [name]: event.target.value }))}
                                                        />
                                                    </label>
                                                ))}
                                            </div>
                                            <label className="address-default-option">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(addressForm.isDefault)}
                                                    onChange={event => setAddressForm(form => ({ ...form, isDefault: event.target.checked }))}
                                                />
                                                Đặt làm địa chỉ mặc định
                                            </label>
                                            {addressError && <p className="address-error">{addressError}</p>}
                                            <div className="address-modal-actions">
                                                <button type="button" className="btn-cancel" onClick={() => setAddressModalOpen(false)}>Hủy</button>
                                                <button type="submit" className="btn-save" disabled={addressSaving}>
                                                    {addressSaving ? "Đang lưu..." : "Lưu địa chỉ"}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}

                                <div className="profile-form-actions">
                                    {loading && <p>Đang tải thông tin...</p>}
                                    {error && <p style={{ color: "red" }}>{error}</p>}
                                    {message && <p style={{ color: "green" }}>{message}</p>}
                                    <button type="button" className="btn-cancel" onClick={handleCancel} disabled={saving || loading}>
                                        Hủy bỏ
                                    </button>
                                    <button type="button" className="btn-save" onClick={handleSave} disabled={saving || loading}>
                                        {saving ? "Đang lưu..." : "Lưu thay đổi"}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}

export default Profile;
