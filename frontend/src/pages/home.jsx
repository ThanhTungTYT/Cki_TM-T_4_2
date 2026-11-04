
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faHouse,
    faMagnifyingGlass,
    faStar,
    faCalendarCheck,
    faUserCheck,
    faClipboardCheck,
    faShieldHalved,
    faCircleCheck,
    faHeadset,
    faCreditCard
} from '@fortawesome/free-solid-svg-icons';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { publicServicesApi } from '../services/api';
import './home.css';

const formatPrice = (value) => {
    if (value === null || value === undefined || value === '') {
        return 'Liên hệ';
    }
    return `${Number(value).toLocaleString('vi-VN')}đ`;
};

function Home() {
    const navigate = useNavigate();
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchArea, setSearchArea] = useState('');
    const [searchCategory, setSearchCategory] = useState('');
    const [searchFilters, setSearchFilters] = useState(null);
    const [filtersLoading, setFiltersLoading] = useState(true);
    const [filtersError, setFiltersError] = useState('');
    const [filterRetry, setFilterRetry] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        publicServicesApi.getFilters({ signal: controller.signal })
            .then(options => {
                if (!controller.signal.aborted) setSearchFilters(options);
            })
            .catch(err => {
                if (!controller.signal.aborted) setFiltersError(err.message || 'Không thể tải bộ lọc dịch vụ.');
            })
            .finally(() => {
                if (!controller.signal.aborted) setFiltersLoading(false);
            });
        return () => controller.abort();
    }, [filterRetry]);

    const handleSearch = event => {
        event.preventDefault();
        const params = new URLSearchParams();
        if (searchArea) params.set('area', searchArea);
        if (searchCategory) params.set('category', searchCategory);
        navigate(`/services${params.size ? `?${params.toString()}` : ''}`);
    };

    useEffect(() => {
        const controller = new AbortController();

        publicServicesApi.search(
            {
                page: 0,
                size: 6,
                sortBy: 'popular'
            },
            { signal: controller.signal }
        )
            .then((result) => {
                setServices(Array.isArray(result?.content) ? result.content : []);
                setError('');
            })
            .catch((err) => {
                if (err.name !== 'AbortError') {
                    setError(err.message || 'Không thể tải dịch vụ.');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, []);

    const featuredImage = services.find((service) => service.thumbnailUrl)?.thumbnailUrl;

    return (
        <div className="home">
            <Header />

            <main>
                <section className="hero">
                    <div className="hero-content">
                        <div className="hero-left">
                            <h1>Dịch vụ vệ sinh chuyên nghiệp tại nhà</h1>
                            <p>
                                Tìm kiếm dịch vụ vệ sinh phù hợp, xem thông tin và
                                lựa chọn gói dịch vụ theo nhu cầu của bạn.
                            </p>

                            <form className="search-box" onSubmit={handleSearch} aria-label="Tìm dịch vụ theo khu vực và loại dịch vụ" aria-busy={filtersLoading}>
                                <label className="search-item" htmlFor="home-search-area">
                                    <span>KHU VỰC</span>
                                    <select id="home-search-area" value={searchArea} onChange={event => setSearchArea(event.target.value)} disabled={filtersLoading || !searchFilters}>
                                        <option value="">{filtersLoading ? 'Đang tải khu vực…' : 'Tất cả khu vực'}</option>
                                        {(searchFilters?.areas || []).map(area => <option key={area.value} value={area.value}>{area.label}</option>)}
                                    </select>
                                </label>
                                <label className="search-item" htmlFor="home-search-category">
                                    <span>LOẠI DỊCH VỤ</span>
                                    <select id="home-search-category" value={searchCategory} onChange={event => setSearchCategory(event.target.value)} disabled={filtersLoading || !searchFilters}>
                                        <option value="">{filtersLoading ? 'Đang tải loại dịch vụ…' : 'Tất cả loại dịch vụ'}</option>
                                        {(searchFilters?.categories || []).map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
                                    </select>
                                </label>
                                <button type="submit" disabled={filtersLoading}>
                                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                                    Tìm dịch vụ
                                </button>
                            </form>
                            {filtersError && <div className="home-search-error" role="alert">
                                <span>{filtersError}</span>
                                <button type="button" onClick={() => {
                                    setFiltersLoading(true);
                                    setFiltersError('');
                                    setFilterRetry(value => value + 1);
                                }}>Tải lại bộ lọc</button>
                            </div>}
                        </div>

                        <div className="hero-image">
                            {featuredImage ? (
                                <img
                                    src={featuredImage}
                                    alt="Dịch vụ vệ sinh CleanMate"
                                    onError={(event) => {
                                        event.currentTarget.style.display = 'none';
                                    }}
                                />
                            ) : (
                                <div className="hero-image-placeholder">
                                    {loading ? 'Đang tải hình ảnh...' : 'CleanMate'}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <section className="section services-section">
                    <div className="section-heading">
                        <span>DANH MỤC DỊCH VỤ</span>
                        <h2>Giải pháp làm sạch toàn diện</h2>
                    </div>

                    {loading && (
                        <p role="status">Đang tải danh sách dịch vụ...</p>
                    )}

                    {!loading && error && (
                        <div className="home-data-message">
                            <p>Không thể tải dịch vụ: {error}</p>
                            <button type="button" onClick={() => window.location.reload()}>
                                Thử lại
                            </button>
                        </div>
                    )}

                    {!loading && !error && services.length === 0 && (
                        <p>Hiện chưa có dịch vụ nào được công khai.</p>
                    )}

                    {!loading && !error && services.length > 0 && (
                        <div className="service-grid">
                            {services.map((service) => (
                                <article className="service-card" key={service.id}>
                                    {service.thumbnailUrl ? (
                                        <img
                                            className="home-service-image"
                                            src={service.thumbnailUrl}
                                            alt={service.name}
                                            onError={(event) => {
                                                event.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <div className="service-icon">
                                            <FontAwesomeIcon icon={faHouse} />
                                        </div>
                                    )}

                                    <h3>{service.name}</h3>
                                    <p>{service.description || 'Chưa có mô tả dịch vụ.'}</p>

                                    <div className="service-bottom">
                                        <span>Giá khởi điểm</span>
                                        <strong>{formatPrice(service.basePrice)}</strong>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => navigate(`/service-detail/${service.id}`)}
                                    >
                                        Xem chi tiết
                                    </button>
                                </article>
                            ))}
                        </div>
                    )}

                    <div className="home-section-action">
                        <button type="button" onClick={() => navigate('/services')}>
                            Xem tất cả dịch vụ
                        </button>
                    </div>
                </section>

                <section className="section process-section">
                    <div className="section-heading">
                        <span>CÁCH THỨC HOẠT ĐỘNG</span>
                        <h2>Quy trình 4 bước đơn giản</h2>
                    </div>

                    <div className="process-grid">
                        <div className="process-card">
                            <strong>01</strong>
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                            <h3>Chọn dịch vụ</h3>
                            <p>Tìm loại dịch vụ phù hợp với nhu cầu.</p>
                        </div>

                        <div className="process-card">
                            <strong>02</strong>
                            <FontAwesomeIcon icon={faCalendarCheck} />
                            <h3>Đặt lịch trực tuyến</h3>
                            <p>Chọn thời gian và địa điểm thuận tiện.</p>
                        </div>

                        <div className="process-card">
                            <strong>03</strong>
                            <FontAwesomeIcon icon={faUserCheck} />
                            <h3>Nhân viên thực hiện</h3>
                            <p>Nhà cung cấp tiếp nhận và thực hiện đơn đặt dịch vụ.</p>
                        </div>

                        <div className="process-card">
                            <strong>04</strong>
                            <FontAwesomeIcon icon={faClipboardCheck} />
                            <h3>Đánh giá dịch vụ</h3>
                            <p>Khách hàng đánh giá sau khi sử dụng dịch vụ.</p>
                        </div>
                    </div>
                </section>

                <section className="section commitment-section">
                    <div className="section-heading">
                        <span>TRẢI NGHIỆM CLEANMATE</span>
                        <h2>Thông tin rõ ràng, đặt dịch vụ thuận tiện</h2>
                    </div>

                    <div className="commitment-grid">
                        <div className="commitment-card">
                            <FontAwesomeIcon icon={faShieldHalved} />
                            <div>
                                <h3>Thông tin minh bạch</h3>
                                <p>Xem mô tả và giá dịch vụ trước khi đặt.</p>
                            </div>
                        </div>

                        <div className="commitment-card">
                            <FontAwesomeIcon icon={faCircleCheck} />
                            <div>
                                <h3>Quản lý đơn đặt</h3>
                                <p>Theo dõi đơn hàng qua tài khoản của bạn.</p>
                            </div>
                        </div>

                        <div className="commitment-card">
                            <FontAwesomeIcon icon={faHeadset} />
                            <div>
                                <h3>Hỗ trợ khách hàng</h3>
                                <p>Gửi yêu cầu hỗ trợ khi gặp vấn đề.</p>
                            </div>
                        </div>

                        <div className="commitment-card">
                            <FontAwesomeIcon icon={faCreditCard} />
                            <div>
                                <h3>Thanh toán</h3>
                                <p>Kiểm tra phương thức thanh toán được hệ thống hỗ trợ.</p>
                            </div>
                        </div>

                        <div className="commitment-card">
                            <FontAwesomeIcon icon={faStar} />
                            <div>
                                <h3>Đánh giá thực tế</h3>
                                <p>Thông tin đánh giá cần được lấy từ dữ liệu hợp lệ.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="cta">
                    <div>
                        <h2>Đặt dịch vụ vệ sinh ngay hôm nay</h2>
                        <p>Khám phá danh sách dịch vụ đang được cung cấp trên CleanMate.</p>
                        <button type="button" onClick={() => navigate('/services')}>
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                            Khám phá dịch vụ
                        </button>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}

export default Home;
