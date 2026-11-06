import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBriefcase, faChevronRight, faLocationDot, faStar } from '@fortawesome/free-solid-svg-icons';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { publicProvidersApi } from '../services/api';
import './providers.css';

function Providers() {
    const navigate = useNavigate();
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError('');
        publicProvidersApi.getAll({ signal: controller.signal })
            .then(result => setProviders(Array.isArray(result) ? result : []))
            .catch(err => {
                if (err.name !== 'AbortError') setError(err.message || 'Không thể tải danh sách đối tác vệ sinh.');
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, []);

    return (
        <div className="public-providers-page">
            <Header />
            <main className="providers-container">
                <nav className="providers-breadcrumb" aria-label="Đường dẫn">
                    <Link to="/">Trang chủ</Link>
                    <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
                    <strong>Đối tác vệ sinh</strong>
                </nav>

                <header className="providers-heading">
                    <span>ĐỘI NGŨ ĐỐI TÁC</span>
                    <p>Xem đánh giá, khu vực hoạt động và dịch vụ của các nhà cung cấp.</p>
                </header>

                {loading ? (
                    <div className="providers-state" role="status">Đang tải danh sách đối tác...</div>
                ) : error ? (
                    <div className="providers-state providers-error" role="alert">
                        <p>{error}</p>
                        <button type="button" onClick={() => window.location.reload()}>Thử tải lại</button>
                    </div>
                ) : providers.length === 0 ? (
                    <div className="providers-state">Hiện chưa có đối tác nào cung cấp dịch vụ công khai.</div>
                ) : (
                    <section className="providers-grid" aria-label="Danh sách đối tác">
                        {providers.map(provider => (
                            <article className="providers-card" key={provider.providerId}>
                                <div className="providers-card-heading">
                                    <div className="providers-avatar">
                                        {provider.avatarUrl
                                            ? <img src={provider.avatarUrl} alt={`Ảnh đại diện ${provider.businessName}`} />
                                            : <span>{(provider.businessName || 'Đ').charAt(0).toUpperCase()}</span>}
                                    </div>
                                    <div className="providers-card-title">
                                        <h2>{provider.businessName}</h2>
                                        <span className="providers-rating">
                                            <FontAwesomeIcon icon={faStar} />{' '}
                                            {provider.ratingAverage != null
                                                ? `${Number(provider.ratingAverage).toFixed(1)} (${provider.totalReviews ?? 0} đánh giá)`
                                                : 'Chưa có đánh giá'}
                                        </span>
                                    </div>
                                </div>
                                <p className="providers-description">
                                    {provider.description || 'Nhà cung cấp chưa cập nhật mô tả.'}
                                </p>
                                <div className="providers-meta">
                                    {provider.address && (
                                        <span><FontAwesomeIcon icon={faLocationDot} /> {provider.address}</span>
                                    )}
                                    <span><FontAwesomeIcon icon={faBriefcase} /> {provider.totalCompletedJobs ?? 0} đơn hoàn thành</span>
                                    <span>{provider.serviceCount ?? 0} dịch vụ đang cung cấp</span>
                                </div>
                                <button type="button" onClick={() => navigate(`/provider/${provider.providerId}`)}>
                                    Xem hồ sơ và dịch vụ
                                </button>
                            </article>
                        ))}
                    </section>
                )}
            </main>
            <Footer />
        </div>
    );
}

export default Providers;
