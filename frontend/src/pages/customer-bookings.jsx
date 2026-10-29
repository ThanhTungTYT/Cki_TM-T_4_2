import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBoxArchive,
    faClockRotateLeft,
    faUser,
    faHeadset,
    faRightFromBracket
} from '@fortawesome/free-solid-svg-icons';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CustomerBookingsView from '../components/CustomerBookingsView';
import './profile.css';
import './customer-bookings.css';

export default function CustomerBookings() {
    const navigate = useNavigate();

    const handleLogout = () => {
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
    };

    return (
        <div className="home">
            <Header />
            <main className="profile-main">
                <div className="profile-container">
                    <aside className="profile-sidebar">
                        <ul className="sidebar-menu">
                            <li
                                className="sidebar-item"
                                onClick={() => navigate('/profile')}
                            >
                                <FontAwesomeIcon icon={faUser} />
                                Hồ sơ cá nhân
                            </li>
                            <li
                                className="sidebar-item active"
                                onClick={() => navigate('/customer/bookings')}
                            >
                                <FontAwesomeIcon icon={faBoxArchive} />
                                Đơn hàng của tôi
                            </li>
                            <li
                                className="sidebar-item"
                                onClick={() => navigate('/customer/bookings/history')}
                            >
                                <FontAwesomeIcon icon={faClockRotateLeft} />
                                Lịch sử đơn hàng
                            </li>
                            <li
                                className="sidebar-item"
                                onClick={() => navigate('/customer/reports')}
                            >
                                <FontAwesomeIcon icon={faHeadset} />
                                Hỗ trợ & Khiếu nại
                            </li>
                            <li
                                className="sidebar-item logout"
                                onClick={handleLogout}
                            >
                                <FontAwesomeIcon icon={faRightFromBracket} />
                                Đăng xuất
                            </li>
                        </ul>
                    </aside>
                    <div className="profile-content">
                        <CustomerBookingsView />
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}