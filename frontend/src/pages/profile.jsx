import { useEffect, useState } from "react";
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faTableColumns,
    faBoxArchive,
    faClockRotateLeft,
    faUser,
    faHeadset,
    faRightFromBracket,
    faCamera
} from "@fortawesome/free-solid-svg-icons";
import Header from '../components/Header';
import Footer from '../components/Footer';
import './profile.css';

function Profile() {
    const [activeTab, setActiveTab] = useState("profile");
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

    const handleChange = (e) => {
        const { name, value } = e.target;

        setProfile((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    useEffect(() => {
        console.log("Profile useEffect đã chạy");
        const fetchProfile = async () => {
            const token =
                sessionStorage.getItem("accessToken") ||
                localStorage.getItem("accessToken");

            console.log("Có JWT:", Boolean(token));

            if (!token) {
                navigate("/login", { replace: true });
                return;
            }

            try {
                const response = await fetch(
                    "http://localhost:8080/api/users/me",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if (response.status === 401) {
                    navigate("/login", { replace: true });
                    return;
                }

                if (!response.ok) {
                    throw new Error(
                        "Không thể tải thông tin cá nhân"
                    );
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
                console.log("Hoàn tất tải profile");
                setLoading(false);
            }
        };
        fetchProfile();
    }, [navigate]);
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
            const response = await fetch(
                "http://localhost:8080/api/users/me",
                {
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
                }
            );
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));

                throw new Error(
                    data.message ||
                    data.detail ||
                    "Cập nhật thông tin thất bại"
                );
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
            const storage = sessionStorage.getItem("user")
                ? sessionStorage
                : localStorage;
            const currentUser = JSON.parse(
                storage.getItem("user") || "{}"
            );
            storage.setItem(
                "user",
                JSON.stringify({
                    ...currentUser,
                    fullName: data.fullName
                })
            );
            setMessage("Cập nhật thông tin thành công!");
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };
    const handleCancel = () => {
        if (originalProfile) {
            setProfile({ ...originalProfile });
        }
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
                            <li className="sidebar-item">
                                <FontAwesomeIcon icon={faTableColumns} /> Tổng quan
                            </li>
                            <li className="sidebar-item">
                                <FontAwesomeIcon icon={faBoxArchive} /> Đơn hàng của tôi
                            </li>
                            <li className="sidebar-item">
                                <FontAwesomeIcon icon={faClockRotateLeft} /> Lịch sử đơn hàng
                            </li>
                            <li className={`sidebar-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                                <FontAwesomeIcon icon={faUser} /> Hồ sơ cá nhân
                            </li>
                            <li className="sidebar-item">
                                <FontAwesomeIcon icon={faHeadset} /> Hỗ trợ & Khiếu nại
                            </li>
                            <li className="sidebar-item logout" onClick={handleLogout}>
                                <FontAwesomeIcon icon={faRightFromBracket} />Đăng xuất
                            </li>
                        </ul>
                    </aside>

                    <div className="profile-content">
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
                                        <input type="text" name="fullName" value={profile.fullName} onChange={handleChange}/>
                                    </div>
                                    <div className="form-group">
                                        <label>Email</label>
                                        <div className="input-with-badge">
                                            <input type="email" name="email" value={profile.email} readOnly/> <span className="verified-tag">Đã xác minh</span>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Số điện thoại</label>
                                        <input type="tel" name="phone" value={profile.phone} onChange={handleChange}/>
                                    </div>
                                    <div className="form-group">
                                        <label>Ngày sinh</label>
                                        <input type="date" name="dateOfBirth" value={profile.dateOfBirth} onChange={handleChange}/>
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
                                    <p className="card-subtitle">Danh sách các địa điểm dọn dẹp yêu thích giúp đặt lịch tới nhanh thời gian đặt lịch dọn lần sau.</p>
                                </div>
                                <button className="btn-add-address">+ Thêm địa chỉ mới</button>
                            </div>

                            <div className="address-list">
                            </div>
                        </div>


                        <div className="profile-form-actions">
                            {error && (
                                <p style={{ color: "red" }}>
                                    {error}
                                </p>
                            )}
                            {message && (
                                <p style={{ color: "green" }}>
                                    {message}
                                </p>
                            )}
                            <button type="button" className="btn-cancel" onClick={handleCancel} disabled={saving || loading}>
                                Hủy bỏ
                            </button>
                            <button type="button" className="btn-save" onClick={handleSave} disabled={saving || loading}>
                                {saving ? "Đang lưu..." : "Lưu thay đổi"}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}

export default Profile;