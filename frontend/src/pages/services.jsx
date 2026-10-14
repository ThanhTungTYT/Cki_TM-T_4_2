import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faMagnifyingGlass,
    faStar,
    faLocationDot,
    faCartPlus
} from '@fortawesome/free-solid-svg-icons'
import Header from '../components/Header';
import Footer from '../components/Footer';
import ServicePackageModal from '../components/ServicePackageModal';
import { useCartDispatch } from '../context/CartContext';
import './services.css'

const services = [
    {
        id: 1,
        name: 'Vệ sinh nhà ở định kỳ',
        provider: 'Công ty TNHH Vệ sinh CleanPro',
        rating: 4.9,
        reviews: 120,
        location: 'Quận 1, HCM',
        price: '120.000đ/giờ',
        basePrice: 120000,
        type: 'Vệ sinh nhà ở',
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
        rating: 4.8,
        reviews: 850,
        location: 'Quận 7, HCM',
        price: '1.200.000đ/lần',
        basePrice: 1200000,
        type: 'Tổng vệ sinh',
        packages: [
            { id: 201, name: 'Căn hộ dưới 70m²', durationMinutes: 240, employeeCount: 2, minArea: 40, maxArea: 70, price: 1200000 },
            { id: 202, name: 'Căn hộ 70 - 100m²', durationMinutes: 300, employeeCount: 3, minArea: 70, maxArea: 100, price: 1650000 },
            { id: 203, name: 'Nhà phố / Biệt thự > 100m²', durationMinutes: 360, employeeCount: 4, minArea: 100, maxArea: 200, price: 2400000 }
        ]
    },
    {
        id: 3,
        name: 'Vệ sinh máy lạnh 1.5 HP',
        provider: 'Dịch vụ vệ sinh Hoàng...',
        rating: 4.7,
        reviews: 620,
        location: 'Quận 3, HCM',
        price: '180.000đ/lần',
        basePrice: 180000,
        type: 'Vệ sinh máy lạnh',
        packages: [
            { id: 301, name: 'Vệ sinh máy treo tường tiêu chuẩn', durationMinutes: 60, employeeCount: 1, price: 180000 },
            { id: 302, name: 'Vệ sinh + Nạp ga R32 / R410A', durationMinutes: 90, employeeCount: 1, price: 320000 }
        ]
    },
    {
        id: 4,
        name: 'Giặt sấy sofa nệm bằng hơi...',
        provider: 'Vệ sinh Xanh Sài Gòn',
        rating: 4.6,
        reviews: 340,
        location: 'Bình Thạnh, HCM',
        price: '300.000đ/lần',
        basePrice: 300000,
        type: 'Vệ sinh sofa/nệm',
        packages: [
            { id: 401, name: 'Sofa đơn / Sofa băng 2 chỗ', durationMinutes: 60, employeeCount: 1, price: 300000 },
            { id: 402, name: 'Sofa góc L / Sofa giường', durationMinutes: 120, employeeCount: 2, price: 480000 }
        ]
    },
    {
        id: 5,
        name: 'Vệ sinh kính văn phòng tầm...',
        provider: 'Công ty Sạch Bóng',
        rating: 4.8,
        reviews: 210,
        location: 'Thủ Đức, HCM',
        price: '400.000đ/lần',
        basePrice: 400000,
        type: 'Vệ sinh văn phòng'
    },
    {
        id: 6,
        name: 'Dọn dẹp căn hộ sau xây dựng',
        provider: 'CleanPro Việt Nam',
        rating: 4.5,
        reviews: 95,
        location: 'Quận 2, HCM',
        price: '1.500.000đ/lần',
        basePrice: 1500000,
        type: 'Vệ sinh sau xây dựng'
    }
]

function Services() {
    const navigate = useNavigate();
    const dispatch = useCartDispatch();
    const [modalService, setModalService] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleOpenModal = (service) => {
        setModalService(service);
        setIsModalOpen(true);
    };

    const handleConfirmAdd = (item) => {
        dispatch({ type: 'ADD_ITEM', payload: item });
    };

    return (
        <div className="services-page">
            <Header />
            <div className="breadcrumb">
                Trang chủ <span>›</span> <strong>Dịch vụ</strong>
            </div>
            <main className="services-container">
                <aside className="filter-sidebar">
                    <div className="filter-title">
                        <h3>Bộ lọc tìm kiếm</h3>
                        <button>Xóa tất cả</button>
                    </div>
                    <div className="filter-section">
                        <h4>LOẠI DỊCH VỤ</h4>
                        <label>
                            <input type="checkbox" />
                            Vệ sinh nhà ở
                            <span>(12)</span>
                        </label>
                        <label>
                            <input type="checkbox" />
                            Vệ sinh văn phòng
                            <span>(8)</span>
                        </label>

                        <label>
                            <input type="checkbox" />
                            Vệ sinh sau xây dựng
                            <span>(5)</span>
                        </label>

                        <label>
                            <input type="checkbox" />
                            Vệ sinh sofa/nệm
                            <span>(9)</span>
                        </label>

                        <label>
                            <input type="checkbox" />
                            Vệ sinh máy lạnh
                            <span>(14)</span>
                        </label>

                        <label>
                            <input type="checkbox" />
                            Tổng vệ sinh
                            <span>(7)</span>
                        </label>
                    </div>

                    <div className="filter-section">
                        <h4>KHU VỰC</h4>

                        <select>
                            <option>Tất cả quận huyện</option>
                            <option>Quận 1</option>
                            <option>Quận 3</option>
                            <option>Quận 7</option>
                            <option>Bình Thạnh</option>
                            <option>Thủ Đức</option>
                        </select>
                    </div>

                    <div className="filter-section">
                        <h4>KHOẢNG GIÁ (VNĐ)</h4>

                        <input
                            type="range"
                            min="0"
                            max="2000000"
                            defaultValue="1000000"
                        />

                        <div className="price-range">
                            <span>100.000đ</span>
                            <span>2.000.000đ</span>
                        </div>
                    </div>

                    <div className="filter-section">
                        <h4>ĐÁNH GIÁ</h4>

                        <label>
                            <input type="checkbox" />
                            ⭐⭐⭐⭐⭐
                        </label>

                        <label>
                            <input type="checkbox" />
                            ⭐⭐⭐⭐ trở lên
                        </label>

                        <label>
                            <input type="checkbox" />
                            ⭐⭐⭐ trở lên
                        </label>
                    </div>

                    <div className="filter-section">
                        <h4>HÌNH THỨC GIÁ</h4>

                        <label>
                            <input type="checkbox" />
                            Giá cố định
                        </label>

                        <label>
                            <input type="checkbox" />
                            Giá theo m²
                        </label>

                        <label>
                            <input type="checkbox" />
                            Giá theo giờ
                        </label>

                        <label>
                            <input type="checkbox" />
                            Giá trọn gói
                        </label>
                    </div>

                </aside>

                {/* Service list */}
                <section className="service-list">

                    <div className="service-list-header">
                        <div>
                            <h1>Danh sách dịch vụ vệ sinh</h1>
                            <p>Tìm thấy 24 kết quả phù hợp tại TP. HCM</p>
                        </div>

                        <select>
                            <option>Phổ biến nhất</option>
                            <option>Giá thấp nhất</option>
                            <option>Giá cao nhất</option>
                            <option>Đánh giá cao nhất</option>
                        </select>
                    </div>

                    <div className="service-grid">

                        {services.map((service) => (
                            <div className="service-card" key={service.id}>

                                <div
                                    className="service-image"
                                    onClick={() => navigate(`/service-detail/${service.id}`)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div>ẢNH DỊCH VỤ</div>
                                </div>
                                <div className="service-content">

                                    <h3
                                        className="service-detail-link"
                                        onClick={() => navigate(`/service-detail/${service.id}`)}
                                    >
                                        {service.name}
                                    </h3>

                                    <p className="provider">
                                        Bởi: {service.provider}
                                    </p>

                                    <div className="service-info">

                                        <span className="rating">
                                            <FontAwesomeIcon icon={faStar} />
                                            {service.rating} ({service.reviews})
                                        </span>

                                        <span>
                                            <FontAwesomeIcon icon={faLocationDot} />
                                            {service.location}
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
                                                onClick={() => handleOpenModal(service)}
                                                title="Chọn gói & thêm vào giỏ hàng"
                                            >
                                                <FontAwesomeIcon icon={faCartPlus} /> Thêm giỏ
                                            </button>
                                            <button type="button" className="btn-book">
                                                Đặt ngay
                                            </button>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        ))}

                    </div>

                </section>

            </main>
            <Footer />
            <ServicePackageModal
                service={modalService}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleConfirmAdd}
            />
        </div>
    )
}

export default Services