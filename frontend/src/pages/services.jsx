
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faMagnifyingGlass,
    faStar,
    faLocationDot,
    faCartPlus
} from '@fortawesome/free-solid-svg-icons';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ServicePackageModal from '../components/ServicePackageModal';
import { useCartDispatch } from '../context/CartContext';
import { publicServicesApi } from '../services/api';
import './services.css';

const PAGE_SIZE = 6;

function formatPrice(value) {
    return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function Services() {
    const navigate = useNavigate();
    const dispatch = useCartDispatch();
    const [modalService, setModalService] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [bookingNow, setBookingNow] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedArea, setSelectedArea] = useState('');
    const [maxPrice, setMaxPrice] = useState(null);
    const [minRating, setMinRating] = useState(0);
    const [selectedPricingTypes, setSelectedPricingTypes] = useState([]);
    const [sortBy, setSortBy] = useState('popular');
    const [currentPage, setCurrentPage] = useState(1);
    const [filterOptions, setFilterOptions] = useState(null);
    const [services, setServices] = useState([]);
    const [totalServices, setTotalServices] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [retryKey, setRetryKey] = useState(0);

    useEffect(() => {
        const controller = new AbortController();

        publicServicesApi.getFilters({ signal: controller.signal })
            .then(options => {
                setFilterOptions(options);
                setMaxPrice(options.priceLimit ?? 0);
            })
            .catch(error => {
                if (error.name !== 'AbortError') setLoadError(error.message);
            });

        return () => controller.abort();
    }, [retryKey]);

    useEffect(() => {
        if (!filterOptions) return undefined;

        const controller = new AbortController();

        const timer = setTimeout(() => {
            setIsLoading(true);
            setLoadError('');

            publicServicesApi.search({
                keyword: keyword.trim(),
                category: selectedCategories.join(','),
                area: selectedArea,
                maxPrice,
                minRating: minRating || null,
                pricingType: selectedPricingTypes.join(','),
                sortBy,
                page: currentPage - 1,
                size: PAGE_SIZE
            }, { signal: controller.signal })
                .then(result => {
                    setServices(result.content || []);
                    setTotalServices(result.totalElements || 0);
                    setTotalPages(result.totalPages || 0);
                })
                .catch(error => {
                    if (error.name !== 'AbortError') setLoadError(error.message);
                })
                .finally(() => {
                    if (!controller.signal.aborted) setIsLoading(false);
                });
        }, keyword.trim() ? 250 : 0);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [
        filterOptions,
        keyword,
        selectedCategories,
        selectedArea,
        maxPrice,
        minRating,
        selectedPricingTypes,
        sortBy,
        currentPage,
        retryKey
    ]);

    const handleOpenModal = (service, goToCheckout = false) => {
        setModalService(service);
        setBookingNow(goToCheckout);
        setIsModalOpen(true);
    };

    const handleConfirmAdd = async item => {
        await dispatch({ type: 'ADD_ITEM', payload: item });
        setIsModalOpen(false);

        if (bookingNow) {
            navigate('/checkout');
        }
    };

    const toggleCategory = category => {
        setSelectedCategories(current =>
            current.includes(category)
                ? current.filter(item => item !== category)
                : [...current, category]
        );
        setCurrentPage(1);
    };

    const togglePricingType = pricingType => {
        setSelectedPricingTypes(current =>
            current.includes(pricingType)
                ? current.filter(item => item !== pricingType)
                : [...current, pricingType]
        );
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setKeyword('');
        setSelectedCategories([]);
        setSelectedArea('');
        setMaxPrice(filterOptions?.priceLimit ?? 0);
        setMinRating(0);
        setSelectedPricingTypes([]);
        setSortBy('popular');
        setCurrentPage(1);
    };

    const categories = filterOptions?.categories || [];
    const areas = filterOptions?.areas || [];
    const pricingTypes = filterOptions?.pricingTypes || [];
    const priceLimit = Number(filterOptions?.priceLimit || 0);
    const displayedMaxPrice = maxPrice ?? priceLimit;

    const activeFilters = [
        ...(keyword.trim() ? [{
            key: 'keyword',
            label: `Tìm: ${keyword.trim()}`,
            clear: () => setKeyword('')
        }] : []),
        ...selectedCategories.map(category => ({
            key: `category-${category}`,
            label: categories.find(item => item.value === category)?.label || category,
            clear: () => toggleCategory(category)
        })),
        ...(selectedArea ? [{
            key: 'area',
            label: areas.find(item => item.value === selectedArea)?.label || selectedArea,
            clear: () => setSelectedArea('')
        }] : []),
        ...(filterOptions && displayedMaxPrice < priceLimit ? [{
            key: 'price',
            label: `Giá đến ${displayedMaxPrice.toLocaleString('vi-VN')}đ`,
            clear: () => setMaxPrice(priceLimit)
        }] : []),
        ...(minRating ? [{
            key: 'rating',
            label: `Từ ${minRating} sao`,
            clear: () => setMinRating(0)
        }] : []),
        ...selectedPricingTypes.map(type => ({
            key: `pricing-${type}`,
            label: pricingTypes.find(item => item.value === type)?.label || type,
            clear: () => togglePricingType(type)
        }))
    ];

    return (
        <div className="services-page">
            <Header />

            <div className="breadcrumb">
                <span
                    onClick={() => navigate('/')}
                    role="link"
                    tabIndex={0}
                    onKeyDown={event => {
                        if (event.key === 'Enter') navigate('/');
                    }}
                >
                    Trang chủ
                </span>
                <span className="breadcrumb-separator">›</span>
                <strong>Dịch vụ</strong>
            </div>

            <main className="services-container">
                <aside className="filter-sidebar" aria-label="Bộ lọc dịch vụ">
                    <div className="filter-title">
                        <h3>Bộ lọc tìm kiếm</h3>
                        <button type="button" onClick={clearFilters}>Xóa tất cả</button>
                    </div>

                    <div className="filter-section">
                        <h4 id="service-search-label">TÌM KIẾM</h4>
                        <div className="service-search">
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                            <input
                                type="search"
                                aria-labelledby="service-search-label"
                                aria-describedby="service-search-hint"
                                value={keyword}
                                placeholder="Tên dịch vụ, nhà cung cấp, khu vực..."
                                onChange={event => {
                                    setKeyword(event.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                        <p id="service-search-hint" className="filter-hint">
                            Tìm dịch vụ theo tên, nhà cung cấp hoặc khu vực.
                        </p>
                    </div>

                    <div className="filter-section">
                        <h4>LOẠI DỊCH VỤ</h4>
                        {categories.map(category => (
                            <label key={category.value}>
                                <input
                                    type="checkbox"
                                    checked={selectedCategories.includes(category.value)}
                                    onChange={() => toggleCategory(category.value)}
                                />
                                <span className="filter-option-label">{category.label}</span>
                                <span className="filter-count">({category.count})</span>
                            </label>
                        ))}
                    </div>

                    <div className="filter-section">
                        <h4>KHU VỰC</h4>
                        <select
                            aria-label="Lọc theo khu vực"
                            value={selectedArea}
                            onChange={event => {
                                setSelectedArea(event.target.value);
                                setCurrentPage(1);
                            }}
                        >
                            <option value="">Tất cả quận huyện</option>
                            {areas.map(area => (
                                <option key={area.value} value={area.value}>
                                    {area.label} ({area.count})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-section">
                        <h4>GIÁ CƠ BẢN TỐI ĐA (VNĐ)</h4>
                        <input
                            type="range"
                            min="0"
                            max={priceLimit}
                            step="10000"
                            aria-label="Giá cơ bản tối đa"
                            aria-valuetext={`${displayedMaxPrice.toLocaleString('vi-VN')} đồng`}
                            value={displayedMaxPrice}
                            disabled={!filterOptions || priceLimit <= 0}
                            onChange={event => {
                                setMaxPrice(Number(event.target.value));
                                setCurrentPage(1);
                            }}
                        />
                        <div className="price-range">
                            <span>0đ</span>
                            <span>{displayedMaxPrice.toLocaleString('vi-VN')}đ</span>
                        </div>
                    </div>

                    <div className="filter-section">
                        <h4>ĐÁNH GIÁ</h4>
                        {[4.8, 4.5, 4].map(rating => (
                            <label key={rating}>
                                <input
                                    type="radio"
                                    name="rating-filter"
                                    checked={minRating === rating}
                                    onChange={() => {
                                        setMinRating(rating);
                                        setCurrentPage(1);
                                    }}
                                />
                                <span className="rating-filter-label">
                                    ★ {rating.toLocaleString('vi-VN')} trở lên
                                </span>
                            </label>
                        ))}
                        <label>
                            <input
                                type="radio"
                                name="rating-filter"
                                checked={minRating === 0}
                                onChange={() => {
                                    setMinRating(0);
                                    setCurrentPage(1);
                                }}
                            />
                            <span className="filter-option-label">Tất cả đánh giá</span>
                        </label>
                    </div>

                    <div className="filter-section">
                        <h4>HÌNH THỨC GIÁ</h4>
                        {pricingTypes.map(pricingType => (
                            <label key={pricingType.value}>
                                <input
                                    type="checkbox"
                                    checked={selectedPricingTypes.includes(pricingType.value)}
                                    onChange={() => togglePricingType(pricingType.value)}
                                />
                                <span className="filter-option-label">{pricingType.label}</span>
                                <span className="filter-count">({pricingType.count})</span>
                            </label>
                        ))}
                    </div>
                </aside>

                <section className="service-list">
                    <div className="service-list-header">
                        <div>
                            <h1>Danh sách dịch vụ vệ sinh</h1>
                            <p role="status" aria-live="polite" aria-atomic="true">
                                Tìm thấy {totalServices} dịch vụ phù hợp
                            </p>
                        </div>

                        <select
                            value={sortBy}
                            onChange={event => {
                                setSortBy(event.target.value);
                                setCurrentPage(1);
                            }}
                            aria-label="Sắp xếp dịch vụ"
                        >
                            <option value="popular">Phổ biến nhất</option>
                            <option value="price-asc">Giá thấp nhất</option>
                            <option value="price-desc">Giá cao nhất</option>
                            <option value="rating">Đánh giá cao nhất</option>
                            <option value="reviews">Nhiều đánh giá nhất</option>
                        </select>
                    </div>

                    {activeFilters.length > 0 && (
                        <div className="active-service-filters" aria-label="Các điều kiện đang lọc">
                            <span>Đang lọc:</span>
                            {activeFilters.map(filter => (
                                <button
                                    key={filter.key}
                                    type="button"
                                    aria-label={`Bỏ điều kiện ${filter.label}`}
                                    onClick={() => {
                                        filter.clear();
                                        setCurrentPage(1);
                                    }}
                                >
                                    {filter.label} <span aria-hidden="true">×</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {loadError ? (
                        <div className="no-services" role="alert">
                            <h3>Không thể tải danh sách dịch vụ</h3>
                            <p>{loadError}</p>
                            <button type="button" onClick={() => setRetryKey(value => value + 1)}>
                                Thử lại
                            </button>
                        </div>
                    ) : isLoading ? (
                        <div className="no-services" role="status">Đang tải dịch vụ…</div>
                    ) : services.length > 0 ? (
                        <div className="service-grid">
                            {services.map(service => (
                                <article className="service-card" key={`${service.id}-${service.providerId ?? ''}`}>
                                    <div
                                        className="service-image"
                                        onClick={() => navigate(`/service-detail/${service.id}`)}
                                        role="link"
                                        tabIndex={0}
                                        onKeyDown={event => {
                                            if (event.key === 'Enter') {
                                                navigate(`/service-detail/${service.id}`);
                                            }
                                        }}
                                    >
                                        {service.thumbnailUrl ? (
                                            <img
                                                src={service.thumbnailUrl}
                                                alt={service.name || 'Dịch vụ vệ sinh'}
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="service-image-placeholder">
                                                {service.name || 'Dịch vụ vệ sinh'}
                                            </div>
                                        )}
                                    </div>

                                    <div className="service-content">
                                        <h3
                                            className="service-detail-link"
                                            onClick={() => navigate(`/service-detail/${service.id}`)}
                                            role="link"
                                            tabIndex={0}
                                            onKeyDown={event => {
                                                if (event.key === 'Enter') {
                                                    navigate(`/service-detail/${service.id}`);
                                                }
                                            }}
                                        >
                                            {service.name || 'Dịch vụ chưa có tên'}
                                        </h3>

                                        <p className="provider">
                                            Bởi:{' '}
                                            {service.providerId ? (
                                                <span
                                                    className="provider-link"
                                                    onClick={() => navigate(`/provider/${service.providerId}`)}
                                                    role="link"
                                                    tabIndex={0}
                                                    onKeyDown={event => {
                                                        if (event.key === 'Enter') {
                                                            navigate(`/provider/${service.providerId}`);
                                                        }
                                                    }}
                                                >
                                                    {service.providerName || 'Đối tác'}
                                                </span>
                                            ) : (
                                                <span>Chưa có thông tin đối tác</span>
                                            )}
                                        </p>

                                        {service.description && (
                                            <p className="service-description">
                                                {service.description}
                                            </p>
                                        )}

                                        <div className="service-info">
                                            <span className="rating">
                                                <FontAwesomeIcon icon={faStar} />
                                                {' '}
                                                {Number(service.rating || 0) > 0
                                                    ? `${Number(service.rating).toFixed(1)} (${Number(service.reviews || 0)})`
                                                    : 'Chưa có đánh giá'}
                                            </span>

                                            <span className="service-location">
                                                <FontAwesomeIcon icon={faLocationDot} />
                                                {' '}{service.location || 'Chưa cập nhật khu vực'}
                                            </span>
                                        </div>

                                        <div className="service-bottom">
                                            <div className="service-price">
                                                <small>Mức phí</small>
                                                <strong>{formatPrice(service.basePrice)}</strong>
                                            </div>

                                            <div className="service-card-actions">
                                                <button
                                                    type="button"
                                                    className="btn-add-cart"
                                                    onClick={() => handleOpenModal(service, false)}
                                                    title="Chọn gói và thêm vào giỏ hàng"
                                                >
                                                    <FontAwesomeIcon icon={faCartPlus} />
                                                    <span>Thêm giỏ</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    className="btn-book"
                                                    onClick={() => handleOpenModal(service, true)}
                                                >
                                                    Đặt ngay
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="no-services">
                            <h3>Không tìm thấy dịch vụ phù hợp</h3>
                            <p>Hãy thử thay đổi từ khóa hoặc bộ lọc của bạn.</p>
                            <button type="button" onClick={clearFilters}>
                                Xóa bộ lọc
                            </button>
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="service-pagination">
                            <button
                                type="button"
                                disabled={currentPage === 1 || isLoading}
                                onClick={() => setCurrentPage(page => page - 1)}
                            >
                                Trang trước
                            </button>

                            <span>Trang {currentPage} / {totalPages}</span>

                            <button
                                type="button"
                                disabled={currentPage === totalPages || isLoading}
                                onClick={() => setCurrentPage(page => page + 1)}
                            >
                                Trang sau
                            </button>
                        </div>
                    )}
                </section>
            </main>

            <Footer />

            <ServicePackageModal
                service={modalService}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setBookingNow(false);
                }}
                onConfirm={handleConfirmAdd}
            />
        </div>
    );
}

export default Services;
