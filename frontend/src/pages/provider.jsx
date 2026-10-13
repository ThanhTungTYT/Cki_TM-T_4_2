import { useState } from "react";
import { useParams, Link } from 'react-router-dom';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faStar,
    faCheckCircle,
    faLocationDot,
    faBriefcase,
    faPlus,
    faChevronRight
} from "@fortawesome/free-solid-svg-icons";
import Header from '../components/Header';
import Footer from '../components/Footer';
import './provider.css';

function Provider() {
    const { id } = useParams();
    const [currentPage, setCurrentPage] = useState(1);

    return (
        <div className="home">
            <Header />

            <main className="provider-main">
                <div className="provider-breadcrumb">
                    <span>Trang chủ</span>
                    <FontAwesomeIcon icon={faChevronRight} className="breadcrumb-icon" />
                    <span>Đối tác</span>
                    <FontAwesomeIcon icon={faChevronRight} className="breadcrumb-icon" />
                    <span className="current">[Tên nhà cung cấp]</span>
                </div>

                <div className="provider-header-card">
                    <div className="provider-avatar-box">
                        <FontAwesomeIcon icon={faPlus} className="provider-plus-icon" />
                    </div>
                    <div className="provider-main-info">
                        <div className="provider-title-row">
                            <h1>Tên công ty</h1>
                            <span className="verified-badge">
                                <FontAwesomeIcon icon={faCheckCircle} /> Đã xác thực
                            </span>
                        </div>
                        <div className="provider-meta-stats">
                            <span className="stat-item rating">
                                <FontAwesomeIcon icon={faStar} className="star-icon" />
                                <strong>0.0</strong> (0 đánh giá)
                            </span>
                            <span className="stat-separator">•</span>
                            <span className="stat-item">
                                <FontAwesomeIcon icon={faBriefcase} /> 0 năm hoạt động
                            </span>
                            <span className="stat-separator">•</span>
                            <span className="stat-item">
                                <FontAwesomeIcon icon={faCheckCircle} /> 0 đơn hoàn thành
                            </span>
                            <span className="stat-separator">•</span>
                            <span className="stat-item">
                                <FontAwesomeIcon icon={faLocationDot} /> Địa chỉ
                            </span>
                        </div>
                    </div>
                    <div className="provider-action-box">
                        <Link to={`/booking/${id || 1}`} className="btn-book-service">
                            Đặt dịch vụ
                        </Link>
                    </div>
                </div>

                <div className="provider-content-grid">
                    <div className="provider-left-column">
                        <section className="info-section">
                            <h2>Giới thiệu về chúng tôi</h2>
                            <p></p>
                        </section>

                        <section className="info-section">
                            <h2>Chứng nhận & Pháp lý</h2>
                            <div className="cert-tags">
                                <span className="cert-tag">Tên chứng nhận 1</span>
                                <span className="cert-tag">Tên chứng nhận 2</span>
                            </div>
                        </section>

                        <section className="info-section">
                            <h2>Quy mô đội ngũ</h2>
                            <p></p>
                        </section>
                    </div>

                    <div className="provider-right-column">
                        <div className="services-card-box">
                            <h2>Dịch vụ đang cung cấp</h2>
                            <div className="services-list">
                                <div className="service-item-row">
                                    <img src="" alt="Service" className="service-thumb" />
                                    <div className="service-details">
                                        <h4>Tên dịch vụ</h4>
                                        <span className="service-type">Chi tiết</span>
                                        <p className="service-price">0đ</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="provider-reviews-section">
                    <h2>Đánh giá thực tế từ khách hàng</h2>
                    <div className="reviews-grid">
                        <div className="review-card">
                            <div className="review-rating-stars">
                                <div className="stars-group">
                                    {[...Array(5)].map((_, i) => (
                                        <FontAwesomeIcon key={i} icon={faStar} className="star-inactive" />
                                    ))}
                                </div>
                                <span className="review-date">DD/MM/YYYY</span>
                            </div>
                            <p className="review-comment">"Nội dung đánh giá..."</p>
                            <div className="review-author-row">
                                <div className="author-avatar-placeholder">U</div>
                                <div className="author-info">
                                    <h5>Tên khách hàng</h5>
                                    <span>Trạng thái</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pagination-container">
                        <button className={`page-btn ${currentPage === 1 ? 'active' : ''}`} onClick={() => setCurrentPage(1)}>1</button>
                        <button className={`page-btn ${currentPage === 2 ? 'active' : ''}`} onClick={() => setCurrentPage(2)}>2</button>
                        <button className={`page-btn ${currentPage === 3 ? 'active' : ''}`} onClick={() => setCurrentPage(3)}>3</button>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}

export default Provider;