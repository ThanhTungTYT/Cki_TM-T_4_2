import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBoxArchive,
    faClockRotateLeft,
    faUser,
    faHeadset,
    faRightFromBracket,
    faCalendarDays,
    faBuilding,
    faCircleCheck,
    faCircleXmark,
    faRotate
} from '@fortawesome/free-solid-svg-icons';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { bookingApi } from '../services/api';
import './profile.css';
import './customer-bookings.css';

const HISTORY_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'];

const STATUS_LABELS = {
    COMPLETED: 'Đã hoàn thành',
    CANCELLED: 'Đã hủy',
    REJECTED: 'Đối tác từ chối',
    EXPIRED: 'Đã hết hạn'
};

function formatPrice(value) {
    if (value === null || value === undefined || value === '') {
        return 'Chưa có dữ liệu';
    }

    return `${Number(value).toLocaleString('vi-VN')}đ`;
}

function formatDate(value) {
    if (!value) return 'Chưa có dữ liệu';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu';

    return date.toLocaleString('vi-VN');
}

function getBookingId(booking) {
    return booking.bookingCode || (booking.id ? `CM-${booking.id}` : 'Chưa có mã đơn');
}

export default function CustomerBookingHistory() {
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('ALL');

    const handleLogout = () => {
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
    };

    const loadBookings = async () => {
        const token =
            sessionStorage.getItem('accessToken') ||
            localStorage.getItem('accessToken');

        if (!token) {
            navigate('/login', { replace: true });
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await bookingApi.getMyBookings();
            setBookings(Array.isArray(result) ? result : []);
        } catch (err) {
            setError(err.message || 'Không thể tải lịch sử đơn hàng.');
            setBookings([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBookings();
    }, []);

    const historyBookings = useMemo(() => {
        const history = bookings.filter(booking =>
            HISTORY_STATUSES.includes(String(booking.status || '').toUpperCase())
        );

        if (filter === 'ALL') return history;

        return history.filter(booking =>
            String(booking.status || '').toUpperCase() === filter
        );
    }, [bookings, filter]);

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
                                className="sidebar-item"
                                onClick={() => navigate('/customer/bookings')}
                            >
                                <FontAwesomeIcon icon={faBoxArchive} />
                                Đơn hàng của tôi
                            </li>
                            <li
                                className="sidebar-item active"
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
                        <div className="profile-header-title">
                            <h2>Lịch sử đơn hàng</h2>
                            <p>Xem lại các dịch vụ đã hoàn thành, đã hủy, bị từ chối hoặc hết hạn.</p>
                        </div>

                        <div className="booking-history-panel">
                            <div className="booking-history-toolbar">
                                <div className="booking-history-filters">
                                    {[
                                        { value: 'ALL', label: `Tất cả (${bookings.filter(b => HISTORY_STATUSES.includes(String(b.status || '').toUpperCase())).length})` },
                                        { value: 'COMPLETED', label: 'Đã hoàn thành' },
                                        { value: 'CANCELLED', label: 'Đã hủy' },
                                        { value: 'REJECTED', label: 'Bị từ chối' },
                                        { value: 'EXPIRED', label: 'Đã hết hạn' }
                                    ].map(item => (
                                        <button
                                            key={item.value}
                                            type="button"
                                            className={`booking-history-filter ${filter === item.value ? 'active' : ''}`}
                                            onClick={() => setFilter(item.value)}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    className="booking-history-reload"
                                    onClick={loadBookings}
                                    disabled={loading}
                                >
                                    <FontAwesomeIcon icon={faRotate} />
                                    Tải lại
                                </button>
                            </div>

                            {loading ? (
                                <div className="booking-history-message">
                                    Đang tải lịch sử đơn hàng...
                                </div>
                            ) : error ? (
                                <div className="booking-history-message error">
                                    <p>{error}</p>
                                    <button type="button" onClick={loadBookings}>
                                        Thử tải lại
                                    </button>
                                </div>
                            ) : historyBookings.length === 0 ? (
                                <div className="booking-history-message">
                                    <FontAwesomeIcon icon={faClockRotateLeft} />
                                    <h3>Chưa có lịch sử đơn hàng</h3>
                                    <p>
                                        Không tìm thấy đơn hàng nào thuộc trạng thái lịch sử trong dữ liệu hiện tại.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/customer/bookings')}
                                    >
                                        Xem đơn hàng của tôi
                                    </button>
                                </div>
                            ) : (
                                <div className="booking-history-list">
                                    {historyBookings.map((booking, index) => {
                                        const status = String(booking.status || '').toUpperCase();
                                        const isCompleted = status === 'COMPLETED';
                                        const serviceName =
                                            booking.serviceName ||
                                            booking.serviceTitle ||
                                            booking.packageName ||
                                            '';

                                        return (
                                            <article
                                                className="booking-history-card"
                                                key={booking.id || booking.bookingCode || index}
                                            >
                                                <div className="booking-history-card-top">
                                                    <div>
                                                        <span className="booking-history-label">
                                                            Mã đơn hàng
                                                        </span>
                                                        <h3>{getBookingId(booking)}</h3>
                                                    </div>
                                                    <span className={`booking-history-status ${status.toLowerCase()}`}>
                                                        <FontAwesomeIcon
                                                            icon={isCompleted ? faCircleCheck : faCircleXmark}
                                                        />
                                                        {STATUS_LABELS[status] || status}
                                                    </span>
                                                </div>

                                                <div className="booking-history-card-content">
                                                    <div className="booking-history-info">
                                                        <FontAwesomeIcon icon={faBuilding} />
                                                        <div>
                                                            <span>Đối tác dịch vụ</span>
                                                            <strong>
                                                                {booking.partnerName || 'Chưa có dữ liệu'}
                                                            </strong>
                                                        </div>
                                                    </div>

                                                    <div className="booking-history-info">
                                                        <FontAwesomeIcon icon={faCalendarDays} />
                                                        <div>
                                                            <span>Thời gian đặt</span>
                                                            <strong>
                                                                {formatDate(
                                                                    booking.scheduledStart ||
                                                                    booking.createdAt
                                                                )}
                                                            </strong>
                                                        </div>
                                                    </div>

                                                    <div className="booking-history-info">
                                                        <FontAwesomeIcon icon={faBoxArchive} />
                                                        <div>
                                                            <span>Dịch vụ</span>
                                                            <strong>
                                                                {serviceName || 'Chưa có dữ liệu'}
                                                            </strong>
                                                        </div>
                                                    </div>

                                                    <div className="booking-history-info">
                                                        <FontAwesomeIcon icon={faCircleCheck} />
                                                        <div>
                                                            <span>Tổng tiền</span>
                                                            <strong>
                                                                {formatPrice(booking.totalAmount)}
                                                            </strong>
                                                        </div>
                                                    </div>
                                                </div>

                                                {booking.fullAddress && (
                                                    <div className="booking-history-address">
                                                        <span>Địa chỉ thực hiện:</span> {booking.fullAddress}
                                                    </div>
                                                )}

                                                {booking.statusHistory?.length > 0 && (
                                                    <details className="booking-history-details">
                                                        <summary>Xem lịch sử trạng thái</summary>
                                                        <div className="booking-history-timeline">
                                                            {booking.statusHistory.map((item, itemIndex) => (
                                                                <div
                                                                    className="booking-history-timeline-item"
                                                                    key={item.id || itemIndex}
                                                                >
                                                                    <strong>
                                                                        {item.newStatus || item.status || 'Cập nhật trạng thái'}
                                                                    </strong>
                                                                    <span>{formatDate(item.createdAt)}</span>
                                                                    {item.note && <p>{item.note}</p>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </details>
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}