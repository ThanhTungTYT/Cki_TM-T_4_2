import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowLeft,
    faBroom,
    faBriefcase,
    faChevronRight,
    faLocationDot,
    faStar
} from '@fortawesome/free-solid-svg-icons';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { publicServicesApi } from '../services/api';
import './provider.css';

const formatPrice = value => value == null || value === ''
    ? 'Chưa cập nhật'
    : `${Number(value).toLocaleString('vi-VN')}đ`;

function Provider() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError('');
        setProfile(null);

        publicServicesApi.getProviderProfile(id, { signal: controller.signal })
            .catch(async profileError => {
                if (controller.signal.aborted) throw profileError;
                const result = await publicServicesApi.search(
                    { page: 0, size: 100, sortBy: 'popular' },
                    { signal: controller.signal }
                );
                const services = (Array.isArray(result?.content) ? result.content : [])
                    .filter(service => String(service.providerId) === String(id));
                if (services.length === 0) throw profileError;

                const first = services[0];
                return {
                    providerId: first.providerId,
                    businessName: first.providerName,
                    address: first.location,
                    ratingAverage: first.providerRating ?? first.rating,
                    totalReviews: first.providerReviews ?? first.reviews,
                    totalCompletedJobs: first.providerCompletedJobs,
                    services
                };
            })
            .then(setProfile)
            .catch(err => {
                if (err.name !== 'AbortError') {
                    setError(err.message || 'Không thể tải hồ sơ nhà cung cấp.');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [id]);

    const services = Array.isArray(profile?.services) ? profile.services : [];
    const providerName = profile?.businessName || 'Nhà cung cấp';

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

                {loading && <div className="detail-not-found" role="status">Đang tải hồ sơ nhà cung cấp...</div>}

                {!loading && error && (
                    <div className="detail-not-found" role="alert">
                        <h2>Không thể tải hồ sơ</h2>
                        <p>{error}</p>
                        <button type="button" onClick={() => navigate('/services')}>
                            <FontAwesomeIcon icon={faArrowLeft} /> Quay lại dịch vụ
                        </button>
                    </div>
                )}

                {!loading && !error && profile && (
                    <>
                        <section className="provider-header-card">
                            <div className="provider-avatar-box">
                                {profile.avatarUrl ? (
                                    <img src={profile.avatarUrl} alt={`Ảnh đại diện ${providerName}`} />
                                ) : (
                                    <span>{providerName.charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                            <div className="provider-main-info">
                                <div className="provider-title-row"><h1>{providerName}</h1></div>
                                <div className="provider-meta-stats">
                                    <span className="stat-item rating">
                                        <FontAwesomeIcon icon={faStar} className="star-icon" />
                                        {profile.ratingAverage != null
                                            ? <><strong>{Number(profile.ratingAverage).toFixed(1)}</strong> ({profile.totalReviews ?? 0} đánh giá)</>
                                            : 'Chưa có đánh giá'}
                                    </span>
                                    <span className="stat-item">
                                        <FontAwesomeIcon icon={faBriefcase} />
                                        {profile.totalCompletedJobs ?? 0} đơn hoàn thành
                                    </span>
                                    {profile.address && (
                                        <span className="stat-item">
                                            <FontAwesomeIcon icon={faLocationDot} /> {profile.address}
                                        </span>
                                    )}
                                </div>
                                {profile.description && <p className="provider-description">{profile.description}</p>}
                            </div>
                        </section>

                        <section className="provider-services-section">
                            <h2>Dịch vụ đang cung cấp ({services.length})</h2>
                            {services.length === 0 ? (
                                <div className="provider-empty-services">Nhà cung cấp hiện chưa có dịch vụ công khai.</div>
                            ) : (
                                <div className="provider-services-grid">
                                    {services.map(service => (
                                        <article className="provider-service-card" key={service.id}>
                                            {service.thumbnailUrl ? (
                                                <img src={service.thumbnailUrl} alt={service.name} loading="lazy" />
                                            ) : (
                                                <div className="provider-service-image-empty"><FontAwesomeIcon icon={faBroom} /></div>
                                            )}
                                            <div className="provider-service-info">
                                                <h3>{service.name}</h3>
                                                <p>{service.description || 'Chưa có mô tả dịch vụ.'}</p>
                                                <div className="provider-service-meta">
                                                    <span>
                                                        <FontAwesomeIcon icon={faStar} className="star-icon" />{' '}
                                                        {service.rating != null && Number(service.reviews || 0) > 0
                                                            ? `${Number(service.rating).toFixed(1)} (${service.reviews} đánh giá)`
                                                            : 'Chưa có đánh giá'}
                                                    </span>
                                                    <strong>{formatPrice(service.basePrice)}</strong>
                                                </div>
                                                <button type="button" onClick={() => navigate(`/service-detail/${service.id}`)}>
                                                    Xem chi tiết
                                                </button>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </main>
            <Footer />
        </div>
    );
}

export default Provider;
