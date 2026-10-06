import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faBroom,
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
} from '@fortawesome/free-solid-svg-icons'
import {
    faFacebookF,
    faInstagram,
    faYoutube
} from '@fortawesome/free-brands-svg-icons'
import './home.css'

function Home() {
    const services = []
    const partners = []
    const reviews = []

    return (
        <div className="home">
            <header className="header">
                <div className="header-inner">
                    <div className="logo">
                        <div className="logo-icon">
                            <FontAwesomeIcon icon={faBroom} />
                        </div>
                        <span>CleanMate</span>
                    </div>

                    <nav className="nav">
                        <a href="#">Trang chủ</a>
                        <a href="#">Dịch vụ</a>
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

            <main>
                <section className="hero">
                    <div className="hero-content">
                        <div className="hero-left">
                            <h1>Dịch vụ vệ sinh chuyên nghiệp tại nhà</h1>
                            <p>
                                Giải pháp dọn dẹp ngôi nhà thông minh. CleanMate kết nối bạn
                                với hàng trăm đối tác vệ sinh tận tâm, lành nghề và được xác
                                minh kỹ lưỡng tại khu vực của bạn.
                            </p>

                            <div className="search-box">
                                <div className="search-item">
                                    <span>KHU VỰC</span>
                                    <strong>Tất cả quận huyện</strong>
                                </div>
                                <div className="search-item">
                                    <span>LOẠI DỊCH VỤ</span>
                                    <strong>Chọn dịch vụ</strong>
                                </div>
                                <div className="search-item">
                                    <span>CHỌN NGÀY</span>
                                    <strong>Hôm nay, mai...</strong>
                                </div>
                                <button>
                                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                                    Tìm dịch vụ
                                </button>
                            </div>

                            <div className="hero-stats">
                                <div>
                                    <strong>10,000+</strong>
                                    <span>Khách hàng</span>
                                </div>
                                <div>
                                    <strong>500+</strong>
                                    <span>Đối tác</span>
                                </div>
                                <div>
                                    <strong>50,000+</strong>
                                    <span>Đơn hoàn thành</span>
                                </div>
                            </div>
                        </div>

                        <div className="hero-image">
                            <div className="hero-image-placeholder"></div>
                        </div>
                    </div>
                </section>

                <section className="section services-section">
                    <div className="section-heading">
                        <span>DANH MỤC DỊCH VỤ</span>
                        <h2>Giải pháp làm sạch toàn diện</h2>
                    </div>

                    <div className="service-grid">
                        {services.map((service, index) => (
                            <div className="service-card" key={index}>
                                <div className="service-icon">
                                    <FontAwesomeIcon icon={faHouse} />
                                </div>
                                <h3>{service.name}</h3>
                                <p>{service.description}</p>
                                <div className="service-bottom">
                                    <span>Giá khởi điểm</span>
                                    <strong>{service.price}</strong>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="section partners-section">
                    <div className="section-heading">
                        <span>ĐỐI TÁC NỔI BẬT</span>
                        <h2>Đơn vị uy tín hàng đầu</h2>
                    </div>

                    <div className="partner-grid">
                        {partners.map((partner, index) => (
                            <div className="partner-card" key={index}>
                                <div className="partner-image"></div>
                                <div className="partner-content">
                                    <h3>{partner.name}</h3>
                                    <p>{partner.address}</p>
                                    <div className="partner-info">
                                        <span>
                                            <FontAwesomeIcon icon={faStar} />
                                            {partner.rating}
                                        </span>
                                        <span>{partner.orders} đơn hoàn thành</span>
                                    </div>
                                    <button>Xem chi tiết</button>
                                </div>
                            </div>
                        ))}
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
                            <p>Dễ dàng tìm loại dịch vụ phù hợp với nhu cầu của bạn.</p>
                        </div>

                        <div className="process-card">
                            <strong>02</strong>
                            <FontAwesomeIcon icon={faCalendarCheck} />
                            <h3>Đặt lịch trực tuyến</h3>
                            <p>Chọn thời gian và địa điểm thuận tiện cho bạn.</p>
                        </div>

                        <div className="process-card">
                            <strong>03</strong>
                            <FontAwesomeIcon icon={faUserCheck} />
                            <h3>Nhân viên thực hiện</h3>
                            <p>Đội ngũ chuyên nghiệp đến tận nơi và thực hiện dịch vụ.</p>
                        </div>

                        <div className="process-card">
                            <strong>04</strong>
                            <FontAwesomeIcon icon={faClipboardCheck} />
                            <h3>Đánh giá dịch vụ</h3>
                            <p>Xác nhận hoàn tất và đánh giá chất lượng dịch vụ.</p>
                        </div>
                    </div>
                </section>

                <section className="section commitment-section">
                    <div className="section-heading">
                        <span>TẠI SAO CHỌN CLEANMATE</span>
                        <h2>Cam kết chất lượng dịch vụ vượt trội</h2>
                    </div>

                    <div className="commitment-grid">
                        <div className="commitment-card">
                            <FontAwesomeIcon icon={faShieldHalved} />
                            <div>
                                <h3>Đối tác được xác minh</h3>
                                <p>Đối tác được kiểm tra thông tin và chất lượng.</p>
                            </div>
                        </div>

                        <div className="commitment-card">
                            <FontAwesomeIcon icon={faCircleCheck} />
                            <div>
                                <h3>Giá minh bạch</h3>
                                <p>Chi phí được hiển thị rõ ràng trước khi đặt.</p>
                            </div>
                        </div>

                        <div className="commitment-card">
                            <FontAwesomeIcon icon={faShieldHalved} />
                            <div>
                                <h3>Bảo hiểm & bảo hành</h3>
                                <p>Hỗ trợ bảo vệ khách hàng trong quá trình sử dụng.</p>
                            </div>
                        </div>

                        <div className="commitment-card">
                            <FontAwesomeIcon icon={faHeadset} />
                            <div>
                                <h3>Hỗ trợ 24/7</h3>
                                <p>Đội ngũ chăm sóc khách hàng luôn sẵn sàng.</p>
                            </div>
                        </div>

                        <div className="commitment-card">
                            <FontAwesomeIcon icon={faCreditCard} />
                            <div>
                                <h3>Thanh toán linh hoạt</h3>
                                <p>Nhiều phương thức thanh toán thuận tiện.</p>
                            </div>
                        </div>

                        <div className="commitment-card">
                            <FontAwesomeIcon icon={faStar} />
                            <div>
                                <h3>Đánh giá thực tế</h3>
                                <p>Đánh giá từ khách hàng đã sử dụng dịch vụ.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="section reviews-section">
                    <div className="section-heading">
                        <span>ĐÁNH GIÁ TỪ KHÁCH HÀNG</span>
                        <h2>Hơn 10,000+ niềm tin trao gửi</h2>
                    </div>

                    <div className="review-grid">
                        {reviews.map((review, index) => (
                            <div className="review-card" key={index}>
                                <div className="stars">
                                    <FontAwesomeIcon icon={faStar} />
                                    <FontAwesomeIcon icon={faStar} />
                                    <FontAwesomeIcon icon={faStar} />
                                    <FontAwesomeIcon icon={faStar} />
                                    <FontAwesomeIcon icon={faStar} />
                                </div>
                                <p>{review.content}</p>
                                <div className="review-user">
                                    <div className="avatar"></div>
                                    <div>
                                        <strong>{review.name}</strong>
                                        <span>{review.address}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="cta">
                    <div>
                        <h2>Đặt dịch vụ vệ sinh ngay hôm nay</h2>
                        <p>Nhận ưu đãi giảm ngay 10% cho đơn đặt dịch vụ đầu tiên tại hệ thống CleanMate.</p>
                        <div className="cta-form">
                            <input type="text" placeholder="Nhập email hoặc số điện thoại của bạn" />
                            <button>Nhận tư vấn</button>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="footer">
                <div className="footer-content">
                    <div className="footer-brand">
                        <div className="logo">
                            <div className="logo-icon">
                                <FontAwesomeIcon icon={faBroom} />
                            </div>
                            <span>CleanMate</span>
                        </div>
                        <p>
                            Nền tảng công nghệ kết nối khách hàng với các đối tác
                            vệ sinh chuyên nghiệp, tận tâm hàng đầu tại Việt Nam.
                        </p>
                        <span>Hotline: 1900 8198</span>
                        <span>Email: 23130241@st.hcmuaf.edu.vn</span>
                    </div>

                    <div className="footer-column">
                        <h3>Dịch vụ</h3>
                        <a href="#">Vệ sinh nhà ở</a>
                        <a href="#">Vệ sinh văn phòng</a>
                        <a href="#">Vệ sinh sau xây dựng</a>
                        <a href="#">Vệ sinh máy lạnh</a>
                        <a href="#">Tổng vệ sinh</a>
                    </div>

                    <div className="footer-column">
                        <h3>Hỗ trợ</h3>
                        <a href="#">Trung tâm trợ giúp</a>
                        <a href="#">Chính sách giá</a>
                        <a href="#">Quy trình đặt lịch</a>
                        <a href="#">Câu hỏi thường gặp</a>
                    </div>

                    <div className="footer-column">
                        <h3>Về chúng tôi</h3>
                        <a href="#">Giới thiệu</a>
                        <a href="#">Tin tức & Sự kiện</a>
                        <a href="#">Tuyển dụng</a>
                        <a href="#">Trở thành đối tác</a>
                        <a href="#">Liên hệ hệ thống</a>
                    </div>

                    <div className="footer-column">
                        <h3>Kết nối với chúng tôi</h3>
                        <div className="socials">
                            <span><FontAwesomeIcon icon={faFacebookF} /></span>
                            <span><FontAwesomeIcon icon={faInstagram} /></span>
                            <span><FontAwesomeIcon icon={faYoutube} /></span>
                        </div>
                    </div>
                </div>

                <div className="footer-bottom">
                    <span>© 2026 CleanMate Marketplace. Tất cả quyền được bảo lưu.</span>
                    <div>
                        <a href="#">Điều khoản sử dụng</a>
                        <a href="#">Chính sách bảo mật</a>
                    </div>
                </div>
            </footer>
        </div>
    )
}

export default Home