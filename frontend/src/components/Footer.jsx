import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBroom } from '@fortawesome/free-solid-svg-icons';
import { faFacebookF, faInstagram, faYoutube } from '@fortawesome/free-brands-svg-icons';
import './Footer.css';

function Footer() {
    return (
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
                    <Link to="/services">Vệ sinh nhà ở</Link>
                    <Link to="/services">Vệ sinh văn phòng</Link>
                    <Link to="/services">Vệ sinh sau xây dựng</Link>
                    <Link to="/services">Vệ sinh máy lạnh</Link>
                    <Link to="/services">Tổng vệ sinh</Link>
                </div>

                <div className="footer-column">
                    <h3>Hỗ trợ</h3>
                    <Link to="/customer/reports">Trung tâm trợ giúp</Link>
                    <Link to="/services">Bảng giá dịch vụ</Link>
                    <Link to="/customer/bookings">Theo dõi đơn đặt</Link>
                    <Link to="/rewards">Đổi thưởng Ccoin</Link>
                </div>

                <div className="footer-column">
                    <h3>Về chúng tôi</h3>
                    <Link to="/">Giới thiệu CleanMate</Link>
                    <Link to="/providers">Mạng lưới đối tác</Link>
                    <Link to="/become-partner">Trở thành đối tác (KYB)</Link>
                    <Link to="/customer/reports">Liên hệ hệ thống</Link>
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
                    <Link to="/become-partner">Điều khoản Đối tác</Link>
                    <Link to="/services">Khám phá dịch vụ</Link>
                </div>
            </div>
        </footer>
    );
}

export default Footer;
