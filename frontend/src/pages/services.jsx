
import { useState, useMemo } from 'react';
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
import './services.css';

const services = [
    {
        id: 1,
        name: 'Vệ sinh nhà ở định kỳ',
        provider: 'Công ty TNHH Vệ sinh CleanPro',
        providerId: 1,
        rating: 4.9,
        reviews: 120,
        location: 'Quận 1, HCM',
        price: '120.000đ/giờ',
        basePrice: 120000,
        type: 'Vệ sinh nhà ở',
        pricingType: 'Giá theo giờ',
        packages: [
            { id: 101, name: 'Gói tiêu chuẩn 2 giờ', durationMinutes: 120, employeeCount: 1, minArea: 30, maxArea: 55, price: 150000 },
            { id: 102, name: 'Gói chuyên sâu 3.5 giờ', durationMinutes: 210, employeeCount: 1, minArea: 55, maxArea: 85, price: 250000 },
            { id: 103, name: 'Gói đại gia đình 4 giờ (2 NV)', durationMinutes: 240, employeeCount: 2, minArea: 85, maxArea: 130, price: 420000 }
        ]
    },
    {
        id: 2,
        name: 'Tổng dọn dẹp nhà trọn gói',
        provider: 'CleanPro Việt Nam',
        providerId: 2,
        rating: 4.8,
        reviews: 850,
        location: 'Quận 7, HCM',
        price: '1.200.000đ/lần',
        basePrice: 1200000,
        type: 'Tổng vệ sinh',
        pricingType: 'Giá trọn gói',
        packages: [
            { id: 201, name: 'Căn hộ dưới 70m²', durationMinutes: 240, employeeCount: 2, minArea: 40, maxArea: 70, price: 1200000 },
            { id: 202, name: 'Căn hộ 70 - 100m²', durationMinutes: 300, employeeCount: 3, minArea: 70, maxArea: 100, price: 1650000 },
            { id: 203, name: 'Nhà phố / Biệt thự > 100m²', durationMinutes: 360, employeeCount: 4, minArea: 100, maxArea: 200, price: 2400000 }
        ]
    },
    {
        id: 3,
        name: 'Vệ sinh máy lạnh 1.5 HP',
        provider: 'Dịch vụ vệ sinh Hoàng Gia',
        providerId: 3,
        rating: 4.7,
        reviews: 620,
        location: 'Quận 3, HCM',
        price: '180.000đ/lần',
        basePrice: 180000,
        type: 'Vệ sinh máy lạnh',
        pricingType: 'Giá cố định',
        packages: [
            { id: 301, name: 'Vệ sinh máy treo tường tiêu chuẩn', durationMinutes: 60, employeeCount: 1, price: 180000 },
            { id: 302, name: 'Vệ sinh + Nạp ga R32 / R410A', durationMinutes: 90, employeeCount: 1, price: 320000 }
        ]
    },
    {
        id: 4,
        name: 'Giặt sấy sofa nệm bằng hơi nước',
        provider: 'Vệ sinh Xanh Sài Gòn',
        providerId: 4,
        rating: 4.6,
        reviews: 340,
        location: 'Bình Thạnh, HCM',
        price: '300.000đ/lần',
        basePrice: 300000,
        type: 'Vệ sinh sofa/nệm',
        pricingType: 'Giá cố định',
        packages: [
            { id: 401, name: 'Sofa đơn / Sofa băng 2 chỗ', durationMinutes: 60, employeeCount: 1, price: 300000 },
            { id: 402, name: 'Sofa góc L / Sofa giường', durationMinutes: 120, employeeCount: 2, price: 480000 }
        ]
    },
    {
        id: 5,
        name: 'Vệ sinh kính văn phòng',
        provider: 'Công ty Sạch Bóng',
        providerId: 5,
        rating: 4.8,
        reviews: 210,
        location: 'Thủ Đức, HCM',
        price: '400.000đ/lần',
        basePrice: 400000,
        type: 'Vệ sinh văn phòng',
        pricingType: 'Giá theo m²',
        packages: []
    },
    {
        id: 6,
        name: 'Dọn dẹp căn hộ sau xây dựng',
        provider: 'CleanPro Việt Nam',
        providerId: 2,
        rating: 4.5,
        reviews: 95,
        location: 'Quận 2, HCM',
        price: '1.500.000đ/lần',
        basePrice: 1500000,
        type: 'Vệ sinh sau xây dựng',
        pricingType: 'Giá trọn gói',
        packages: []
    }
];

const categories = [
    'Vệ sinh nhà ở',
    'Vệ sinh văn phòng',
    'Vệ sinh sau xây dựng',
    'Vệ sinh sofa/nệm',
    'Vệ sinh máy lạnh',
    'Tổng vệ sinh'
];

const areas = [
    'Quận 1',
    'Quận 2',
    'Quận 3',
    'Quận 7',
    'Bình Thạnh',
    'Thủ Đức'
];

const pricingTypes = [
    'Giá cố định',
    'Giá theo m²',
    'Giá theo giờ',
    'Giá trọn gói'
];

const PAGE_SIZE = 6;

function Services() {
    const navigate = useNavigate();
    const dispatch = useCartDispatch();

    const [modalService, setModalService] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [bookingNow, setBookingNow] = useState(false);

    const [keyword, setKeyword] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedArea, setSelectedArea] = useState('');
    const [maxPrice, setMaxPrice] = useState(2000000);
    const [minRating, setMinRating] = useState(0);
    const [selectedPricingTypes, setSelectedPricingTypes] = useState([]);
    const [sortBy, setSortBy] = useState('popular');
    const [currentPage, setCurrentPage] = useState(1);

    const handleOpenModal = (service, goToCheckout = false) => {
        setModalService(service);
        setBookingNow(goToCheckout);
        setIsModalOpen(true);
    };

    const handleConfirmAdd = (item) => {
        dispatch({ type: 'ADD_ITEM', payload: item });

        if (bookingNow) {
            navigate('/checkout');
        }
    };

    const toggleCategory = (category) => {
        setSelectedCategories((current) =>
            current.includes(category)
                ? current.filter((item) => item !== category)
                : [...current, category]
        );
        setCurrentPage(1);
    };

    const togglePricingType = (pricingType) => {
        setSelectedPricingTypes((current) =>
            current.includes(pricingType)
                ? current.filter((item) => item !== pricingType)
                : [...current, pricingType]
        );
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setKeyword('');
        setSelectedCategories([]);
        setSelectedArea('');
        setMaxPrice(2000000);
        setMinRating(0);
        setSelectedPricingTypes([]);
        setSortBy('popular');
        setCurrentPage(1);
    };

    const filteredServices = useMemo(() => {
        const normalizedKeyword = keyword.trim().toLocaleLowerCase('vi');

        const result = services.filter((service) => {
            const searchableText = [
                service.name,
                service.provider,
                service.type,
                service.location
            ].join(' ').toLocaleLowerCase('vi');

            const matchesKeyword =
                !normalizedKeyword || searchableText.includes(normalizedKeyword);

            const matchesCategory =
                selectedCategories.length === 0 ||
                selectedCategories.includes(service.type);

            const areaName = service.location.split(',')[0].trim();
            const matchesArea =
                !selectedArea || areaName === selectedArea;

            const matchesPrice = service.basePrice <= maxPrice;

            const matchesRating = service.rating >= minRating;

            const matchesPricingType =
                selectedPricingTypes.length === 0 ||
                selectedPricingTypes.includes(service.pricingType);

            return (
                matchesKeyword &&
                matchesCategory &&
                matchesArea &&
                matchesPrice &&
                matchesRating &&
                matchesPricingType
            );
        });

        if (sortBy === 'price-asc') {
            result.sort((a, b) => a.basePrice - b.basePrice);
        } else if (sortBy === 'price-desc') {
            result.sort((a, b) => b.basePrice - a.basePrice);
        } else if (sortBy === 'rating') {
            result.sort((a, b) => b.rating - a.rating);
        } else if (sortBy === 'reviews') {
            result.sort((a, b) => b.reviews - a.reviews);
        } else {
            result.sort((a, b) => b.reviews - a.reviews);
        }

        return result;
    }, [
        keyword,
        selectedCategories,
        selectedArea,
        maxPrice,
        minRating,
        selectedPricingTypes,
        sortBy
    ]);

    const totalPages = Math.max(1, Math.ceil(filteredServices.length / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);

    const visibleServices = filteredServices.slice(
        (safePage - 1) * PAGE_SIZE,
        safePage * PAGE_SIZE
    );

    return (
        <div className="services-page">
            <Header />

            <div className="breadcrumb">
                <span
                    onClick={() => navigate('/')}
                    style={{ cursor: 'pointer' }}
                >
                    Trang chủ
                </span>
                {' › '}
                <strong>Dịch vụ</strong>
            </div>

            <main className="services-container">
                <aside className="filter-sidebar">
                    <div className="filter-title">
                        <h3>Bộ lọc tìm kiếm</h3>
                        <button type="button" onClick={clearFilters}>
                            Xóa tất cả
                        </button>
                    </div>

                    <div className="filter-section">
                        <h4>TÌM KIẾM</h4>
                        <div className="service-search">
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                            <input
                                type="search"
                                value={keyword}
                                placeholder="Tên dịch vụ, nhà cung cấp..."
                                onChange={(e) => {
                                    setKeyword(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                    </div>

                    <div className="filter-section">
                        <h4>LOẠI DỊCH VỤ</h4>

                        {categories.map((category) => (
                            <label key={category}>
                                <input
                                    type="checkbox"
                                    checked={selectedCategories.includes(category)}
                                    onChange={() => toggleCategory(category)}
                                />
                                {category}
                                <span>
                                    ({services.filter((s) => s.type === category).length})
                                </span>
                            </label>
                        ))}
                    </div>

                    <div className="filter-section">
                        <h4>KHU VỰC</h4>
                        <select
                            value={selectedArea}
                            onChange={(e) => {
                                setSelectedArea(e.target.value);
                                setCurrentPage(1);
                            }}
                        >
                            <option value="">Tất cả quận huyện</option>
                            {areas.map((area) => (
                                <option key={area} value={area}>
                                    {area}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-section">
                        <h4>KHOẢNG GIÁ (VNĐ)</h4>
                        <input
                            type="range"
                            min="100000"
                            max="2000000"
                            step="50000"
                            value={maxPrice}
                            onChange={(e) => {
                                setMaxPrice(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                        />
                        <div className="price-range">
                            <span>100.000đ</span>
                            <span>{maxPrice.toLocaleString('vi-VN')}đ</span>
                        </div>
                    </div>

                    <div className="filter-section">
                        <h4>ĐÁNH GIÁ</h4>

                        {[5, 4, 3].map((rating) => (
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
                                {rating === 5
                                    ? '⭐⭐⭐⭐⭐'
                                    : `${'⭐'.repeat(rating)} trở lên`}
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
                            Tất cả đánh giá
                        </label>
                    </div>

                    <div className="filter-section">
                        <h4>HÌNH THỨC GIÁ</h4>

                        {pricingTypes.map((pricingType) => (
                            <label key={pricingType}>
                                <input
                                    type="checkbox"
                                    checked={selectedPricingTypes.includes(pricingType)}
                                    onChange={() => togglePricingType(pricingType)}
                                />
                                {pricingType}
                            </label>
                        ))}
                    </div>
                </aside>

                <section className="service-list">
                    <div className="service-list-header">
                        <div>
                            <h1>Danh sách dịch vụ vệ sinh</h1>
                            <p>
                                Tìm thấy {filteredServices.length} dịch vụ phù hợp
                                tại TP. HCM
                            </p>
                        </div>

                        <select
                            value={sortBy}
                            onChange={(e) => {
                                setSortBy(e.target.value);
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

                    {visibleServices.length > 0 ? (
                        <div className="service-grid">
                            {visibleServices.map((service) => (
                                <div className="service-card" key={service.id}>
                                    <div
                                        className="service-image"
                                        onClick={() =>
                                            navigate(`/service-detail/${service.id}`)
                                        }
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                navigate(`/service-detail/${service.id}`);
                                            }
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div>ẢNH DỊCH VỤ</div>
                                    </div>

                                    <div className="service-content">
                                        <h3
                                            className="service-detail-link"
                                            onClick={() =>
                                                navigate(`/service-detail/${service.id}`)
                                            }
                                            style={{ cursor: 'pointer' }}
                                        >
                                            {service.name}
                                        </h3>

                                        <p className="provider">
                                            Bởi:{' '}
                                            <span
                                                onClick={() =>
                                                    navigate(`/provider/${service.providerId}`)
                                                }
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {service.provider}
                                            </span>
                                        </p>

                                        <div className="service-info">
                                            <span className="rating">
                                                <FontAwesomeIcon icon={faStar} />
                                                {' '}{service.rating} ({service.reviews})
                                            </span>

                                            <span>
                                                <FontAwesomeIcon icon={faLocationDot} />
                                                {' '}{service.location}
                                            </span>
                                        </div>

                                        <div className="service-bottom">
                                            <div>
                                                <small>Mức phí</small>
                                                <strong>{service.price}</strong>
                                            </div>

                                            <div className="service-card-actions">
                                                <button
                                                    type="button"
                                                    className="btn-add-cart"
                                                    onClick={() =>
                                                        handleOpenModal(service, false)
                                                    }
                                                    title="Chọn gói và thêm vào giỏ hàng"
                                                >
                                                    <FontAwesomeIcon icon={faCartPlus} />
                                                    {' '}Thêm giỏ
                                                </button>

                                                <button
                                                    type="button"
                                                    className="btn-book"
                                                    onClick={() =>
                                                        handleOpenModal(service, true)
                                                    }
                                                >
                                                    Đặt ngay
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
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

                    {filteredServices.length > PAGE_SIZE && (
                        <div className="service-pagination">
                            <button
                                type="button"
                                disabled={safePage === 1}
                                onClick={() => setCurrentPage((page) => page - 1)}
                            >
                                Trang trước
                            </button>

                            <span>
                                Trang {safePage} / {totalPages}
                            </span>

                            <button
                                type="button"
                                disabled={safePage === totalPages}
                                onClick={() => setCurrentPage((page) => page + 1)}
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
