
import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faStar,
    faCheckCircle,
    faLocationDot,
    faBriefcase,
    faChevronRight,
    faArrowLeft
} from '@fortawesome/free-solid-svg-icons';

import Header from '../components/Header';
import Footer from '../components/Footer';
import './provider.css';

// Dữ liệu nhà cung cấp mẫu để phục vụ giao diện.
// Khi backend sẵn sàng, thay dữ liệu này bằng dữ liệu API.
const providers = [
    {
        id: 1,
        name: 'Công ty TNHH Vệ sinh CleanPro',
        rating: 4.9,
        reviews: 120,
        yearsActive: 5,
        completedOrders: 320,
        location: 'Quận 1, TP. HCM',
        introduction:
            'CleanPro cung cấp dịch vụ vệ sinh nhà ở định kỳ, hướng đến không gian sống sạch sẽ và gọn gàng. Khách hàng có thể lựa chọn gói dịch vụ phù hợp với diện tích và nhu cầu thực tế.',
        teamSize: '10–20 nhân viên',
        certifications: ['Hồ sơ nhà cung cấp mẫu', 'Thông tin pháp lý cần xác minh'],
        verified: false
    },
    {
        id: 2,
        name: 'CleanPro Việt Nam',
        rating: 4.8,
        reviews: 850,
        yearsActive: 4,
        completedOrders: 680,
        location: 'Quận 7, TP. HCM',
        introduction:
            'CleanPro Việt Nam cung cấp dịch vụ tổng vệ sinh và dọn dẹp căn hộ. Phạm vi công việc, thời gian và chi phí cần được thống nhất với khách hàng trước khi thực hiện.',
        teamSize: '15–30 nhân viên',
        certifications: ['Hồ sơ nhà cung cấp mẫu', 'Thông tin pháp lý cần xác minh'],
        verified: false
    },
    {
        id: 3,
        name: 'Dịch vụ vệ sinh Hoàng Gia',
        rating: 4.7,
        reviews: 620,
        yearsActive: 3,
        completedOrders: 410,
        location: 'Quận 3, TP. HCM',
        introduction:
            'Dịch vụ vệ sinh Hoàng Gia tập trung vào vệ sinh máy lạnh và hỗ trợ làm sạch các thiết bị gia dụng theo phạm vi dịch vụ đã thống nhất.',
        teamSize: '5–10 nhân viên',
        certifications: ['Hồ sơ nhà cung cấp mẫu', 'Thông tin pháp lý cần xác minh'],
        verified: false
    },
    {
        id: 4,
        name: 'Vệ sinh Xanh Sài Gòn',
        rating: 4.6,
        reviews: 340,
        yearsActive: 3,
        completedOrders: 260,
        location: 'Bình Thạnh, TP. HCM',
        introduction:
            'Vệ sinh Xanh Sài Gòn cung cấp dịch vụ vệ sinh sofa và nệm. Phương pháp làm sạch được lựa chọn tùy theo chất liệu và tình trạng thực tế.',
        teamSize: '5–10 nhân viên',
        certifications: ['Hồ sơ nhà cung cấp mẫu', 'Thông tin pháp lý cần xác minh'],
        verified: false
    },
    {
        id: 5,
        name: 'Công ty Sạch Bóng',
        rating: 4.8,
        reviews: 210,
        yearsActive: 2,
        completedOrders: 180,
        location: 'Thủ Đức, TP. HCM',
        introduction:
            'Công ty Sạch Bóng cung cấp dịch vụ vệ sinh kính văn phòng. Chi phí phụ thuộc vào diện tích, vị trí thi công và điều kiện an toàn.',
        teamSize: '5–15 nhân viên',
        certifications: ['Hồ sơ nhà cung cấp mẫu', 'Thông tin pháp lý cần xác minh'],
        verified: false
    }
];

// Phải giữ ID nhà cung cấp khớp với services.jsx và service-detail.jsx.
const providerServices = [
    {
        id: 1,
        providerId: 1,
        name: 'Vệ sinh nhà ở định kỳ',
        type: 'Vệ sinh nhà ở',
        price: 120000,
        priceUnit: 'giờ',
        rating: 4.9,
        reviews: 120,
        image: 'https://placehold.co/240x160/eaf2ff/2563eb?text=Ve+sinh+nha+o'
    },
    {
        id: 2,
        providerId: 2,
        name: 'Tổng dọn dẹp nhà trọn gói',
        type: 'Tổng vệ sinh',
        price: 1200000,
        priceUnit: 'lần',
        rating: 4.8,
        reviews: 850,
        image: 'https://placehold.co/240x160/eaf2ff/2563eb?text=Tong+ve+sinh'
    },
    {
        id: 3,
        providerId: 3,
        name: 'Vệ sinh máy lạnh 1.5 HP',
        type: 'Vệ sinh máy lạnh',
        price: 180000,
        priceUnit: 'lần',
        rating: 4.7,
        reviews: 620,
        image: 'https://placehold.co/240x160/eaf2ff/2563eb?text=Ve+sinh+may+lanh'
    },
    {
        id: 4,
        providerId: 4,
        name: 'Giặt sấy sofa nệm bằng hơi nước',
        type: 'Vệ sinh sofa/nệm',
        price: 300000,
        priceUnit: 'lần',
        rating: 4.6,
        reviews: 340,
        image: 'https://placehold.co/240x160/eaf2ff/2563eb?text=Giat+sofa+nem'
    },
    {
        id: 5,
        providerId: 5,
        name: 'Vệ sinh kính văn phòng',
        type: 'Vệ sinh văn phòng',
        price: 400000,
        priceUnit: 'lần',
        rating: 4.8,
        reviews: 210,
        image: 'https://placehold.co/240x160/eaf2ff/2563eb?text=Ve+sinh+kinh'
    },
    {
        id: 6,
        providerId: 2,
        name: 'Dọn dẹp căn hộ sau xây dựng',
        type: 'Vệ sinh sau xây dựng',
        price: 1500000,
        priceUnit: 'lần',
        rating: 4.5,
        reviews: 95,
        image: 'https://placehold.co/240x160/eaf2ff/2563eb?text=Ve+sinh+sau+xay+dung'
    }
];

// Đánh giá minh họa cho giao diện.
// Không đại diện cho đánh giá thực tế từ khách hàng.
const sampleReviews = [
    {
        id: 1,
        author: 'Khách hàng mẫu',
        rating: 5,
        date: 'Dữ liệu minh họa',
        comment:
            'Giao diện đánh giá mẫu. Nội dung và điểm số thực tế cần lấy từ dữ liệu đánh giá hợp lệ.'
    },
    {
        id: 2,
        author: 'Khách hàng mẫu',
        rating: 4,
        date: 'Dữ liệu minh họa',
        comment:
            'Đây là dữ liệu minh họa để kiểm tra cách hiển thị đánh giá trên trang nhà cung cấp.'
    },
    {
        id: 3,
        author: 'Khách hàng mẫu',
        rating: 5,
        date: 'Dữ liệu minh họa',
        comment:
            'Khi tích hợp backend, chỉ hiển thị đánh giá thực tế được phép công khai.'
    }
];

const REVIEWS_PER_PAGE = 2;

function Provider() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [currentPage, setCurrentPage] = useState(1);

    const providerId = Number(id);

    const provider = providers.find(
        (item) => item.id === providerId
    );

    const services = useMemo(
        () => providerServices.filter(
            (service) => service.providerId === providerId
        ),
        [providerId]
    );

    const totalReviewPages = Math.max(
        1,
        Math.ceil(sampleReviews.length / REVIEWS_PER_PAGE)
    );

    const visibleReviews = sampleReviews.slice(
        (currentPage - 1) * REVIEWS_PER_PAGE,
        currentPage * REVIEWS_PER_PAGE
    );

    if (!provider) {
        return (
            <div className="home">
                <Header />

                <main className="provider-main">
                    <div className="detail-not-found">
                        <h2>Không tìm thấy nhà cung cấp</h2>
                        <p>
                            Nhà cung cấp này không tồn tại trong dữ liệu mẫu.
                        </p>
                        <button
                            type="button"
                            onClick={() => navigate('/services')}
                        >
                            Quay lại danh sách dịch vụ
                        </button>
                    </div>
                </main>

                <Footer />
            </div>
        );
    }

    return (
        <div className="home">
            <Header />

            <main className="provider-main">
                <div className="provider-breadcrumb">
                    <Link to="/">Trang chủ</Link>

                    <FontAwesomeIcon
                        icon={faChevronRight}
                        className="breadcrumb-icon"
                    />

                    <Link to="/services">Dịch vụ</Link>

                    <FontAwesomeIcon
                        icon={faChevronRight}
                        className="breadcrumb-icon"
                    />

                    <span className="current">{provider.name}</span>
                </div>

                <section className="provider-header-card">
                    <div className="provider-avatar-box">
                        <span>
                            {provider.name.charAt(0).toUpperCase()}
                        </span>
                    </div>

                    <div className="provider-main-info">
                        <div className="provider-title-row">
                            <h1>{provider.name}</h1>

                            {provider.verified && (
                                <span className="verified-badge">
                                    <FontAwesomeIcon icon={faCheckCircle} />
                                    {' '}Đã xác thực
                                </span>
                            )}

                            {!provider.verified && (
                                <span className="provider-demo-badge">
                                    Hồ sơ mẫu
                                </span>
                            )}
                        </div>

                        <div className="provider-meta-stats">
                            <span className="stat-item rating">
                                <FontAwesomeIcon
                                    icon={faStar}
                                    className="star-icon"
                                />
                                <strong>{provider.rating.toFixed(1)}</strong>
                                {' '}({provider.reviews} đánh giá mẫu)
                            </span>

                            <span className="stat-separator">•</span>

                            <span className="stat-item">
                                <FontAwesomeIcon icon={faBriefcase} />
                                {' '}{provider.yearsActive} năm hoạt động (mẫu)
                            </span>

                            <span className="stat-separator">•</span>

                            <span className="stat-item">
                                <FontAwesomeIcon icon={faCheckCircle} />
                                {' '}{provider.completedOrders} đơn (mẫu)
                            </span>

                            <span className="stat-separator">•</span>

                            <span className="stat-item">
                                <FontAwesomeIcon icon={faLocationDot} />
                                {' '}{provider.location}
                            </span>
                        </div>
                    </div>

                    <div className="provider-action-box">
                        <button
                            type="button"
                            className="btn-book-service"
                            onClick={() => {
                                if (services.length > 0) {
                                    navigate(`/service-detail/${services[0].id}`);
                                } else {
                                    navigate('/services');
                                }
                            }}
                        >
                            Xem dịch vụ
                        </button>
                    </div>
                </section>

                <div className="provider-content-grid">
                    <div className="provider-left-column">
                        <section className="info-section">
                            <h2>Giới thiệu về chúng tôi</h2>
                            <p>{provider.introduction}</p>
                        </section>

                        <section className="info-section">
                            <h2>Chứng nhận &amp; Pháp lý</h2>

                            <p>
                                Thông tin dưới đây chỉ là nội dung mẫu,
                                chưa xác nhận tính pháp lý.
                            </p>

                            <div className="cert-tags">
                                {provider.certifications.map((cert, index) => (
                                    <span className="cert-tag" key={index}>
                                        {cert}
                                    </span>
                                ))}
                            </div>
                        </section>

                        <section className="info-section">
                            <h2>Quy mô đội ngũ</h2>
                            <p>{provider.teamSize} (thông tin mẫu).</p>
                        </section>

                        <section className="info-section">
                            <h2>Khu vực hoạt động</h2>
                            <p>{provider.location}</p>
                            <p>
                                Vui lòng xác nhận phạm vi phục vụ với nhà cung
                                cấp trước khi đặt lịch.
                            </p>
                        </section>
                    </div>

                    <div className="provider-right-column">
                        <section className="services-card-box">
                            <h2>Dịch vụ đang cung cấp</h2>

                            {services.length > 0 ? (
                                <div className="services-list">
                                    {services.map((service) => (
                                        <article
                                            className="service-item-row"
                                            key={service.id}
                                        >
                                            <img
                                                src={service.image}
                                                alt={service.name}
                                                className="service-thumb"
                                            />

                                            <div className="service-details">
                                                <Link
                                                    to={`/service-detail/${service.id}`}
                                                    className="provider-service-link"
                                                >
                                                    <h4>{service.name}</h4>
                                                </Link>

                                                <span className="service-type">
                                                    {service.type}
                                                </span>

                                                <p className="provider-service-rating">
                                                    <FontAwesomeIcon
                                                        icon={faStar}
                                                        className="star-icon"
                                                    />
                                                    {' '}{service.rating.toFixed(1)}
                                                    {' '}({service.reviews} đánh giá mẫu)
                                                </p>

                                                <p className="service-price">
                                                    {service.price.toLocaleString('vi-VN')}đ
                                                    /{service.priceUnit}
                                                </p>

                                                <Link
                                                    to={`/service-detail/${service.id}`}
                                                    className="provider-view-service"
                                                >
                                                    Xem chi tiết
                                                </Link>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <p>
                                    Nhà cung cấp chưa có dịch vụ trong dữ liệu
                                    mẫu.
                                </p>
                            )}
                        </section>
                    </div>
                </div>

                <section className="provider-reviews-section">
                    <h2>Đánh giá từ khách hàng</h2>

                    <p className="provider-review-notice">
                        Các đánh giá bên dưới là dữ liệu minh họa giao diện,
                        không phải đánh giá thật.
                    </p>

                    <div className="reviews-grid">
                        {visibleReviews.map((review) => (
                            <article className="review-card" key={review.id}>
                                <div className="review-rating-stars">
                                    <div className="stars-group">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <FontAwesomeIcon
                                                key={star}
                                                icon={faStar}
                                                className={
                                                    star <= review.rating
                                                        ? 'star-active'
                                                        : 'star-inactive'
                                                }
                                            />
                                        ))}
                                    </div>

                                    <span className="review-date">
                                        {review.date}
                                    </span>
                                </div>

                                <p className="review-comment">
                                    {review.comment}
                                </p>

                                <div className="review-author-row">
                                    <div className="author-avatar-placeholder">
                                        {review.author.charAt(0)}
                                    </div>

                                    <div className="author-info">
                                        <h5>{review.author}</h5>
                                        <span>Đánh giá minh họa</span>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>

                    {totalReviewPages > 1 && (
                        <div className="pagination-container">
                            <button
                                type="button"
                                className="page-btn"
                                disabled={currentPage === 1}
                                onClick={() =>
                                    setCurrentPage((page) => page - 1)
                                }
                            >
                                Trang trước
                            </button>

                            {Array.from(
                                { length: totalReviewPages },
                                (_, index) => index + 1
                            ).map((page) => (
                                <button
                                    type="button"
                                    key={page}
                                    className={`page-btn ${
                                        currentPage === page ? 'active' : ''
                                    }`}
                                    onClick={() => setCurrentPage(page)}
                                >
                                    {page}
                                </button>
                            ))}

                            <button
                                type="button"
                                className="page-btn"
                                disabled={currentPage === totalReviewPages}
                                onClick={() =>
                                    setCurrentPage((page) => page + 1)
                                }
                            >
                                Trang sau
                            </button>
                        </div>
                    )}
                </section>

                <button
                    type="button"
                    className="provider-back-button"
                    onClick={() => navigate('/services')}
                >
                    <FontAwesomeIcon icon={faArrowLeft} />
                    {' '}Quay lại danh sách dịch vụ
                </button>
            </main>

            <Footer />
        </div>
    );
}

export default Provider;
