import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faMagnifyingGlass,
    faStar,
    faLocationDot
} from '@fortawesome/free-solid-svg-icons'

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
        type: 'Vệ sinh nhà ở'
    },
    {
        id: 2,
        name: 'Tổng dọn dẹp nhà trọn gói',
        provider: 'CleanPro Việt Nam',
        rating: 4.8,
        reviews: 850,
        location: 'Quận 7, HCM',
        price: '1.200.000đ/lần',
        type: 'Tổng vệ sinh'
    },
    {
        id: 3,
        name: 'Vệ sinh máy lạnh 1.5 HP',
        provider: 'Dịch vụ vệ sinh Hoàng...',
        rating: 4.7,
        reviews: 620,
        location: 'Quận 3, HCM',
        price: '180.000đ/lần',
        type: 'Vệ sinh máy lạnh'
    },
    {
        id: 4,
        name: 'Giặt sấy sofa nệm bằng hơi...',
        provider: 'Vệ sinh Xanh Sài Gòn',
        rating: 4.6,
        reviews: 340,
        location: 'Bình Thạnh, HCM',
        price: '300.000đ/lần',
        type: 'Vệ sinh sofa/nệm'
    },
    {
        id: 5,
        name: 'Vệ sinh kính văn phòng tầm...',
        provider: 'Công ty Sạch Bóng',
        rating: 4.8,
        reviews: 210,
        location: 'Thủ Đức, HCM',
        price: '400.000đ/lần',
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
        type: 'Vệ sinh sau xây dựng'
    }
]

function Services() {
    return (
        <div className="services-page">
            <header className="services-header">
                <div className="services-header-inner">

                    <div className="logo">
                        <span className="logo-icon">🧹</span>
                        <span>CleanMate</span>
                    </div>

                    <nav className="nav">
                        <a href="/">Trang chủ</a>
                        <a href="#" className="active">Dịch vụ</a>
                        <a href="#">Đối tác vệ sinh</a>
                        <a href="#">Về chúng tôi</a>
                        <a href="#">Hỗ trợ</a>
                    </nav>

                    <div className="header-actions">
                        <button className="login-btn">Đăng nhập</button>
                        <button className="register-btn">Đăng ký</button>
                        <button className="service-btn">Đặt dịch vụ</button>
                    </div>
                </div>
            </header>
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

                                <div className="service-image">
                                    <div>ẢNH DỊCH VỤ</div>
                                </div>

                                <div className="service-content">

                                    <h3>{service.name}</h3>

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

                                        <button>Đặt ngay</button>

                                    </div>

                                </div>
                            </div>
                        ))}

                    </div>

                </section>

            </main>
        </div>
    )
}

export default Services