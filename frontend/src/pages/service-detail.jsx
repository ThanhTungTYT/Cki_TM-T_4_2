
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
    faTag
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
                            ? 'Không tìm thấy dịch vụ trong cơ sở dữ liệu.'
                            : `Không thể tải dịch vụ. Mã lỗi: ${response.status}`)
                    );
                }

                if (!data || data.id == null) {
                    throw new Error('Backend không trả về thông tin dịch vụ hợp lệ.');
                }

                setService(data);
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
                <FontAwesomeIcon className="detail-breadcrumb-separator" icon={faChevronRight} aria-hidden="true" />
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
                <FontAwesomeIcon className="detail-breadcrumb-separator" icon={faChevronRight} aria-hidden="true" />
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
                                <FontAwesomeIcon icon={faHashtag} aria-hidden="true" />
                                Mã dịch vụ: {service.id}
                            </span>
                            {service.status && (
                                <span className={`detail-status-badge status-${String(service.status).toLowerCase()}`}>
                                    <span className="detail-status-dot" aria-hidden="true" />
                                    {service.status}
                                </span>
                            )}
                        </div>

                        <hr />

                        <h2 className="detail-section-title">
                            <FontAwesomeIcon icon={faLayerGroup} aria-hidden="true" />
                            Mô tả dịch vụ
                        </h2>
                        <p className="detail-description">
                            {service.description || 'Chưa có mô tả cho dịch vụ này.'}
                        </p>

                        <h2 className="detail-section-title">
                            <FontAwesomeIcon icon={faTag} aria-hidden="true" />
                            Thông tin dịch vụ
                        </h2>

                        <div className="detail-specifications">
                            <div>
                                <span><FontAwesomeIcon icon={faLayerGroup} aria-hidden="true" /> Loại dịch vụ</span>
                                <strong>
                                    {service.categoryName || 'Chưa cập nhật'}
                                </strong>
                            </div>

                            <div>
                                <span><FontAwesomeIcon icon={faTag} aria-hidden="true" /> Hình thức tính giá</span>
                                <strong>
                                    {service.pricingType || 'Chưa cập nhật'}
                                </strong>
                            </div>

                            <div>
                                <span><FontAwesomeIcon icon={faClock} aria-hidden="true" /> Thời gian dự kiến</span>
                                <strong>
                                    {formatDuration(service.estimatedMinutes)}
                                </strong>
                            </div>

                            <div>
                                <span><FontAwesomeIcon icon={faTag} aria-hidden="true" /> Giá cơ bản</span>
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
                            Giá và thông tin hiển thị được lấy từ hệ thống.
                            Vui lòng kiểm tra gói dịch vụ và chi phí cuối cùng
                            trước khi xác nhận đặt lịch.
                        </p>
                    </div>
                </section>

                <aside className="detail-booking">
                    <span className="detail-price-label">
                        <FontAwesomeIcon icon={faTag} aria-hidden="true" /> Giá cơ bản
                    </span>

                    <div className="detail-price">
                        {formatPrice(price)}
                        {unit && <small>/{unit}</small>}
                    </div>

                    <p className="detail-note">
                        Giá cuối cùng có thể phụ thuộc vào gói dịch vụ,
                        số lượng và các lựa chọn khi đặt lịch.
                    </p>

                    <button
                        type="button"
                        className="detail-book-button"
                        onClick={() => navigate('/services')}
                    >
                        <FontAwesomeIcon icon={faCalendarCheck} aria-hidden="true" />
                        <span>Xem và chọn gói dịch vụ</span>
                    </button>

                    <button
                        type="button"
                        className="detail-back-button"
                        onClick={() => navigate('/services')}
                    >
                        <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
                        <span>Quay lại danh sách</span>
                    </button>
                </aside>

                <ServiceReviews serviceId={service.id} />
            </main>

            <Footer />
        </div>
    );
}

export default ServiceDetail;
