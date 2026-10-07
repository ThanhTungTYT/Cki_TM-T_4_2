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
    );
}

export default Footer;
