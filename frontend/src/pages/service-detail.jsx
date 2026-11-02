import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowLeft,
    faCalendarCheck,
    faChevronRight,
    faClock,
    faHashtag,
    faLayerGroup,
    faTag,
    faStar,
    faLocationDot,
    faUserGroup,
    faBriefcase,
    faRulerCombined,
    faBuilding,
    faCheckCircle
} from '@fortawesome/free-solid-svg-icons';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ServiceReviews from '../components/ServiceReviews';
import './service-detail.css';

const API_URL = 'http://localhost:8080/api/v1/services';

function formatPrice(value) {
    if (value === null || value === undefined || value === '') {
        return 'Chưa cập nhật';
    }

    return `${Number(value).toLocaleString('vi-VN')}đ`;
}

function formatDuration(minutes) {
    if (minutes === null || minutes === undefined || minutes <= 0) {
        return 'Chưa cập nhật';
    }

    if (minutes < 60) {
        return `${minutes} phút`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes > 0
        ? `${hours} giờ ${remainingMinutes} phút`
        : `${hours} giờ`;
}

function getPricingUnit(pricingType) {
    if (!pricingType) return '';

    const type = String(pricingType).toUpperCase();

    const units = {
        HOURLY: 'giờ',
        PER_HOUR: 'giờ',
        HOUR: 'giờ',
        PER_TIME: 'lần',
        PER_SESSION: 'lần',
        FIXED: 'gói',
        PACKAGE: 'gói',
        PER_M2: 'm²',
        PER_SQUARE_METER: 'm²'
    };

    return units[type] || '';
}

function formatRating(value) {
    if (value === null || value === undefined) {
        return 'Chưa có đánh giá';
    }

    return Number(value).toFixed(1);
}

function ServiceDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [service, setService] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();

        async function loadService() {
            setIsLoading(true);
            setError('');
            setService(null);

            if (!id || !/^\d+$/.test(id)) {
                setError('Mã dịch vụ không hợp lệ.');
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch(`${API_URL}/${id}`, {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json'
                    },
                    signal: controller.signal
                });

                const data = await response.json().catch(() => null);

                if (!response.ok) {
                    throw new Error(
                        data?.message ||
                        data?.detail ||
                        data?.error ||
                        (response.status === 404
                            ? 'Không tìm thấy dịch vụ hoặc dịch vụ đã ngừng hoạt động.'
                            : `Không thể tải dịch vụ. Mã lỗi: ${response.status}`)
                    );
                }

                if (!data || data.id == null) {
                    throw new Error('Backend không trả về thông tin dịch vụ hợp lệ.');
                }

                setService({
                    ...data,
                    packages: Array.isArray(data.packages) ? data.packages : [],
                    providers: Array.isArray(data.providers) ? data.providers : []
                });
            } catch (err) {
                if (err.name !== 'AbortError') {
                    setError(
                        err.message ||
                        'Không thể kết nối đến máy chủ. Hãy kiểm tra backend.'
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }

        loadService();

        return () => controller.abort();
    }, [id]);

    if (isLoading) {
        return (
            <div className="detail-page">
                <Header />
                <div className="detail-state">
                    <p>Đang tải thông tin dịch vụ...</p>
                </div>
                <Footer />
            </div>
        );
    }

    if (error || !service) {
        return (
            <div className="detail-page">
                <Header />
                <div className="detail-not-found">
                    <h2>Không thể tải dịch vụ</h2>
                    <p>{error || 'Không tìm thấy thông tin dịch vụ.'}</p>
                    <button type="button" onClick={() => navigate('/services')}>
                        Quay lại danh sách dịch vụ
                    </button>
                    <button
                        type="button"
                        className="detail-retry-button"
                        onClick={() => window.location.reload()}
                    >
                        Thử tải lại
                    </button>
                </div>
                <Footer />
            </div>
        );
    }

    const price = service.basePrice;
    const unit = getPricingUnit(service.pricingType);
    const image = service.thumbnailUrl;
    const packages = service.packages;
    const providers = service.providers;

    return (
        <div className="detail-page">
            <Header />

            <nav className="detail-breadcrumb" aria-label="Đường dẫn">
                <span
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate('/')}
                    onKeyDown={event => {
                        if (event.key === 'Enter') navigate('/');
                    }}
                >
                    Trang chủ
                </span>

                <FontAwesomeIcon
                    className="detail-breadcrumb-separator"
                    icon={faChevronRight}
                    aria-hidden="true"
                />

                <span
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate('/services')}
                    onKeyDown={event => {
                        if (event.key === 'Enter') navigate('/services');
                    }}
                >
                    Dịch vụ
                </span>

                <FontAwesomeIcon
                    className="detail-breadcrumb-separator"
                    icon={faChevronRight}
                    aria-hidden="true"
                />

                <strong>{service.name || 'Chi tiết dịch vụ'}</strong>
            </nav>

            <main className="detail-container">
                <section className="detail-main">
                    {image ? (
                        <img
                            className="detail-image"
                            src={image}
                            alt={service.name || 'Dịch vụ vệ sinh'}
                            onError={event => {
                                event.currentTarget.style.display = 'none';
                            }}
                        />
                    ) : (
                        <div className="detail-image-placeholder">
                            Chưa có hình ảnh dịch vụ
                        </div>
                    )}

                    <div className="detail-information">
                        <span className="detail-category">
                            {service.categoryName || 'Dịch vụ vệ sinh'}
                        </span>

                        <h1>{service.name || 'Chưa có tên dịch vụ'}</h1>

                        <div className="detail-rating">
                            <span className="detail-meta-item">
                                <FontAwesomeIcon icon={faHashtag} />
                                Mã dịch vụ: {service.id}
                            </span>

                            {service.status && (
                                <span className={`detail-status-badge status-${String(service.status).toLowerCase()}`}>
                                    <span className="detail-status-dot" />
                                    {service.status}
                                </span>
                            )}
                        </div>

                        <hr />

                        <h2 className="detail-section-title">
                            <FontAwesomeIcon icon={faLayerGroup} />
                            Mô tả dịch vụ
                        </h2>

                        <p className="detail-description">
                            {service.description || 'Chưa có mô tả cho dịch vụ này.'}
                        </p>

                        <h2 className="detail-section-title">
                            <FontAwesomeIcon icon={faTag} />
                            Thông tin dịch vụ
                        </h2>

                        <div className="detail-specifications">
                            <div>
                                <span>
                                    <FontAwesomeIcon icon={faLayerGroup} />
                                    Loại dịch vụ
                                </span>
                                <strong>{service.categoryName || 'Chưa cập nhật'}</strong>
                            </div>

                            <div>
                                <span>
                                    <FontAwesomeIcon icon={faTag} />
                                    Hình thức tính giá
                                </span>
                                <strong>{service.pricingType || 'Chưa cập nhật'}</strong>
                            </div>

                            <div>
                                <span>
                                    <FontAwesomeIcon icon={faClock} />
                                    Thời gian dự kiến
                                </span>
                                <strong>{formatDuration(service.estimatedMinutes)}</strong>
                            </div>

                            <div>
                                <span>
                                    <FontAwesomeIcon icon={faTag} />
                                    Giá cơ bản
                                </span>
                                <strong>{formatPrice(price)}</strong>
                            </div>

                            {service.slug && (
                                <div>
                                    <span>Mã đường dẫn</span>
                                    <strong>{service.slug}</strong>
                                </div>
                            )}
                        </div>

                        <p className="detail-disclaimer">
                            Giá hiển thị là giá tham khảo. Chi phí thực tế có thể
                            thay đổi theo Provider, gói dịch vụ và nhu cầu sử dụng.
                            Vui lòng kiểm tra thông tin trước khi đặt lịch.
                        </p>
                    </div>
                </section>

                <aside className="detail-booking">
                    <span className="detail-price-label">
                        <FontAwesomeIcon icon={faTag} />
                        Giá cơ bản
                    </span>

                    <div className="detail-price">
                        {formatPrice(price)}
                        {unit && <small>/{unit}</small>}
                    </div>

                    <p className="detail-note">
                        Giá cuối cùng phụ thuộc vào Provider và gói dịch vụ
                        mà bạn lựa chọn.
                    </p>

                    <button
                        type="button"
                        className="detail-book-button"
                        onClick={() => navigate('/services')}
                    >
                        <FontAwesomeIcon icon={faCalendarCheck} />
                        <span>Xem và chọn gói dịch vụ</span>
                    </button>

                    <button
                        type="button"
                        className="detail-back-button"
                        onClick={() => navigate('/services')}
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                        <span>Quay lại danh sách</span>
                    </button>
                </aside>

                <section style={{
                    gridColumn: '1 / -1',
                    marginTop: '30px'
                }}>
                    <h2 className="detail-section-title">
                        <FontAwesomeIcon icon={faLayerGroup} />
                        Các gói dịch vụ
                    </h2>

                    {packages.length === 0 ? (
                        <p style={{ color: '#777', padding: '15px 0' }}>
                            Hiện chưa có gói dịch vụ nào được công khai.
                        </p>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                            gap: '18px',
                            marginTop: '20px'
                        }}>
                            {packages.map(item => (
                                <article
                                    key={item.id}
                                    style={{
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '14px',
                                        padding: '20px',
                                        background: '#fff',
                                        boxShadow: '0 3px 12px rgba(0,0,0,0.04)'
                                    }}
                                >
                                    <h3 style={{
                                        color: '#15966f',
                                        margin: '0 0 15px',
                                        fontSize: '19px'
                                    }}>
                                        {item.name || 'Gói dịch vụ'}
                                    </h3>

                                    <p>
                                        <FontAwesomeIcon icon={faTag} />
                                        {' '}Giá:
                                        <strong style={{ color: '#15966f', marginLeft: '5px' }}>
                                            {formatPrice(item.price)}
                                        </strong>
                                    </p>

                                    <p>
                                        <FontAwesomeIcon icon={faClock} />
                                        {' '}Thời gian:
                                        {' '}{formatDuration(item.durationMinutes)}
                                    </p>

                                    <p>
                                        <FontAwesomeIcon icon={faUserGroup} />
                                        {' '}Số nhân viên:
                                        {' '}{item.employeeCount ?? 'Chưa cập nhật'}
                                    </p>

                                    <p>
                                        <FontAwesomeIcon icon={faRulerCombined} />
                                        {' '}Diện tích:
                                        {' '}
                                        {item.minArea != null || item.maxArea != null
                                            ? `${item.minArea ?? 0} - ${item.maxArea ?? 'Không giới hạn'} m²`
                                            : 'Chưa cập nhật'}
                                    </p>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <section style={{
                    gridColumn: '1 / -1',
                    marginTop: '30px'
                }}>
                    <h2 className="detail-section-title">
                        <FontAwesomeIcon icon={faBuilding} />
                        Nhà cung cấp dịch vụ
                    </h2>

                    {providers.length === 0 ? (
                        <p style={{ color: '#777', padding: '15px 0' }}>
                            Hiện chưa có nhà cung cấp nào đang cung cấp dịch vụ này.
                        </p>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                            gap: '18px',
                            marginTop: '20px'
                        }}>
                            {providers.map(provider => (
                                <article
                                    key={provider.providerId}
                                    style={{
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '14px',
                                        padding: '20px',
                                        background: '#fff',
                                        boxShadow: '0 3px 12px rgba(0,0,0,0.04)'
                                    }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        marginBottom: '15px'
                                    }}>
                                        {provider.avatarUrl ? (
                                            <img
                                                src={provider.avatarUrl}
                                                alt={provider.businessName}
                                                style={{
                                                    width: '55px',
                                                    height: '55px',
                                                    borderRadius: '50%',
                                                    objectFit: 'cover'
                                                }}
                                                onError={event => {
                                                    event.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: '55px',
                                                height: '55px',
                                                borderRadius: '50%',
                                                background: '#e5f7ef',
                                                color: '#15966f',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '22px',
                                                fontWeight: 'bold'
                                            }}>
                                                {(provider.businessName || 'P').charAt(0).toUpperCase()}
                                            </div>
                                        )}

                                        <div>
                                            <h3 style={{
                                                margin: 0,
                                                color: '#173b35',
                                                fontSize: '18px'
                                            }}>
                                                {provider.businessName || 'Nhà cung cấp'}
                                            </h3>

                                            <span style={{
                                                color: '#15966f',
                                                fontSize: '13px'
                                            }}>
                                                <FontAwesomeIcon icon={faCheckCircle} />
                                                {' '}Đang cung cấp dịch vụ
                                            </span>
                                        </div>
                                    </div>

                                    <p style={{
                                        color: '#666',
                                        lineHeight: 1.6
                                    }}>
                                        {provider.description || 'Nhà cung cấp chưa cập nhật mô tả.'}
                                    </p>

                                    <p>
                                        <FontAwesomeIcon icon={faLocationDot} />
                                        {' '}{provider.address || 'Chưa cập nhật địa chỉ'}
                                    </p>

                                    <p>
                                        <FontAwesomeIcon icon={faStar} style={{ color: '#f5a623' }} />
                                        {' '}Đánh giá:
                                        <strong style={{ marginLeft: '5px' }}>
                                            {formatRating(provider.ratingAverage)}
                                        </strong>
                                        {' '}({provider.totalReviews ?? 0} đánh giá)
                                    </p>

                                    <p>
                                        <FontAwesomeIcon icon={faBriefcase} />
                                        {' '}Công việc hoàn thành:
                                        {' '}{provider.totalCompletedJobs ?? 0}
                                    </p>

                                    <div style={{
                                        borderTop: '1px solid #eee',
                                        marginTop: '15px',
                                        paddingTop: '15px'
                                    }}>
                                        <span style={{ color: '#666' }}>
                                            Giá cung cấp
                                        </span>

                                        <h3 style={{
                                            color: '#15966f',
                                            margin: '5px 0 0'
                                        }}>
                                            {formatPrice(provider.price)}
                                        </h3>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => navigate(`/provider/${provider.providerId}`)}
                                        style={{
                                            width: '100%',
                                            marginTop: '15px',
                                            padding: '11px',
                                            border: '1px solid #15966f',
                                            borderRadius: '8px',
                                            background: '#fff',
                                            color: '#15966f',
                                            cursor: 'pointer',
                                            fontWeight: 600
                                        }}
                                    >
                                        Xem hồ sơ nhà cung cấp
                                    </button>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <section style={{
                    gridColumn: '1 / -1',
                    marginTop: '30px'
                }}>
                    <ServiceReviews serviceId={service.id} />
                </section>
            </main>

            <Footer />
        </div>
    );
}

export default ServiceDetail;