
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faStar,
    faLocationDot,
    faChevronRight,
    faArrowLeft,
    faBroom
} from '@fortawesome/free-solid-svg-icons';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { publicServicesApi } from '../services/api';
import './provider.css';

const formatPrice = (value) => {
    if (value === null || value === undefined || value === '') {
        return 'Chưa cập nhật';
    }
    return `${Number(value).toLocaleString('vi-VN')}đ`;
};

function Provider() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();

        setLoading(true);
        setError('');
        setServices([]);

        publicServicesApi.search(
            { page: 0, size: 100, sortBy: 'popular' },
            { signal: controller.signal }
        )
            .then((result) => {
                const allServices = Array.isArray(result?.content)
                    ? result.content
                    : [];

                setServices(
                    allServices.filter(
                        (service) => String(service.providerId) === String(id)
                    )
                );
            })
            .catch((err) => {
                if (err.name !== 'AbortError') {
                    setError(err.message || 'Không thể tải thông tin nhà cung cấp.');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [id]);

    const providerName = services[0]?.providerName || 'Nhà cung cấp';
    const location = services.find((item) => item.location)?.location;
    const ratings = services
        .map((item) => Number(item.rating))
        .filter((rating) => Number.isFinite(rating) && rating > 0);
    const averageRating = ratings.length
        ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
        : null;

    return (
        <div className="home">
            <Header />

            <main className="provider-main">
                <div className="provider-breadcrumb">
                    <Link to="/">Trang chủ</Link>
                    <FontAwesomeIcon icon={faChevronRight} className="breadcrumb-icon" />
                    <Link to="/services">Dịch vụ</Link>
                    <FontAwesomeIcon icon={faChevronRight} className="breadcrumb-icon" />
                    <span className="current">{providerName}</span>
                </div>

                {loading && (
                    <div className="detail-not-found">
                        <p>Đang tải thông tin nhà cung cấp...</p>
                    </div>
                )}

                {!loading && error && (
                    <div className="detail-not-found">
                        <h2>Không thể tải dữ liệu</h2>
                        <p>{error}</p>
                        <button type="button" onClick={() => window.location.reload()}>
                            Thử lại
                        </button>
                    </div>
                )}

                {!loading && !error && services.length === 0 && (
                    <div className="detail-not-found">
                        <h2>Chưa có thông tin nhà cung cấp</h2>
                        <p>
                            Không tìm thấy dịch vụ công khai thuộc nhà cung cấp này.
                            Hồ sơ chi tiết cần được backend cung cấp.
                        </p>
                        <button type="button" onClick={() => navigate('/services')}>
                            <FontAwesomeIcon icon={faArrowLeft} /> Quay lại dịch vụ
                        </button>
                    </div>
                )}

                {!loading && !error && services.length > 0 && (
                    <>
                        <section className="provider-header-card">
                            <div className="provider-avatar-box">
                                <span>{providerName.charAt(0).toUpperCase()}</span>
                            </div>

                            <div className="provider-main-info">
                                <div className="provider-title-row">
                                    <h1>{providerName}</h1>
                                </div>

                                <div className="provider-meta-stats">
                                    {averageRating !== null && (
                                        <span className="stat-item rating">
                                            <FontAwesomeIcon icon={faStar} className="star-icon" />
                                            <strong>{averageRating.toFixed(1)}</strong>
                                            {' '}điểm trung bình dịch vụ
                                        </span>
                                    )}

                                    {location && (
                                        <span className="stat-item">
                                            <FontAwesomeIcon icon={faLocationDot} />
                                            {' '}{location}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </section>

                        <section className="provider-services-section">
                            <h2>Dịch vụ đang cung cấp</h2>

                            <div className="provider-services-grid">
                                {services.map((service) => (
                                    <article className="provider-service-card" key={service.id}>
                                        {service.thumbnailUrl ? (
                                            <img
                                                src={service.thumbnailUrl}
                                                alt={service.name}
                                                onError={(event) => {
                                                    event.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <div className="provider-service-image-empty">
                                                <FontAwesomeIcon icon={faBroom} />
                                            </div>
                                        )}

                                        <div className="provider-service-info">
                                            <h3>{service.name}</h3>
                                            <p>
                                                {service.description || 'Chưa có mô tả dịch vụ.'}
                                            </p>

                                            <div className="provider-service-meta">
                                                {service.rating !== null &&
                                                    service.rating !== undefined && (
                                                        <span>
                                                            <FontAwesomeIcon
                                                                icon={faStar}
                                                                className="star-icon"
                                                            />{' '}
                                                            {Number(service.rating).toFixed(1)}
                                                            {' '}({service.reviews ?? 0})
                                                        </span>
                                                    )}

                                                <strong>{formatPrice(service.basePrice)}</strong>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    navigate(`/service-detail/${service.id}`)
                                                }
                                            >
                                                Xem chi tiết
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </main>

            <Footer />
        </div>
    );
}

export default Provider;
