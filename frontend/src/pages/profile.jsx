import { useState } from "react";
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
                                        <input type="text" />
                                    </div>
                                    <div className="form-group">
                                        <label>Email</label>
                                        <div className="input-with-badge">
                                            <input type="email" />
                                            <span className="verified-tag">Đã xác minh</span>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Số điện thoại</label>
                                        <input type="text" />
                                    </div>
                                    <div className="form-group">
                                        <label>Ngày sinh</label>
                                        <input type="text" />
                                    </div>
                                    <div className="form-group">
                                        <label>Giới tính</label>
                                        <select>
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
                            <button className="btn-cancel">Hủy bỏ</button>
                            <button className="btn-save">Lưu thay đổi</button>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}

export default Profile;