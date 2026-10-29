import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBoxArchive,
    faClockRotateLeft,
    faUser,
    faHeadset,
    faRightFromBracket,
    faPaperPlane,
    faRotate,
    faCircleCheck,
    faClock,
    faFileCircleExclamation
} from '@fortawesome/free-solid-svg-icons';
import Header from '../components/Header';
import Footer from '../components/Footer';
import './profile.css';
import './customer-bookings.css';

const API_URL = 'http://localhost:8080/api/reports';

const CATEGORIES = [
    { value: 'SERVICE_QUALITY', label: 'Chất lượng dịch vụ' },
    { value: 'PARTNER_BEHAVIOR', label: 'Thái độ đối tác vệ sinh' },
    { value: 'PAYMENT', label: 'Thanh toán' },
    { value: 'BOOKING', label: 'Đặt lịch dịch vụ' },
    { value: 'OTHER', label: 'Khác' }
];

const STATUS_LABELS = {
    OPEN: 'Đang chờ xử lý',
    IN_PROGRESS: 'Đang xử lý',
    RESOLVED: 'Đã giải quyết',
    REJECTED: 'Đã từ chối'
};

function getToken() {
    return sessionStorage.getItem('accessToken') ||
        localStorage.getItem('accessToken') || '';
}

function formatDate(value) {
    if (!value) return 'Chưa có dữ liệu';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu';
    return date.toLocaleString('vi-VN');
}

function getErrorMessage(status, data) {
    const message = data?.detail || data?.message || data?.error;

    if (status === 401) {
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }

    if (status === 403) {
        return message ||
            'Bạn không có quyền gửi khiếu nại cho đơn hàng này. Hãy kiểm tra mã đơn và bảo đảm đơn thuộc tài khoản của bạn.';
    }

    if (status === 400) {
        return message || 'Thông tin khiếu nại chưa hợp lệ. Vui lòng kiểm tra tiêu đề và nội dung.';
    }

    if (status === 404) {
        return message || 'Không tìm thấy đơn hàng liên quan. Hãy kiểm tra lại mã đơn.';
    }

    return message || `Yêu cầu thất bại (${status}).`;
}

export default function CustomerReports() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        subject: '',
        category: 'SERVICE_QUALITY',
        bookingCode: '',
        description: ''
    });
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const handleLogout = () => {
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
    };

    const loadReports = async () => {
        const token = getToken();

        if (!token) {
            navigate('/login', { replace: true });
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${API_URL}/mine`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                if (response.status === 401) {
                    navigate('/login', { replace: true });
                    return;
                }
                throw new Error(getErrorMessage(response.status, data));
            }

            setReports(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message || 'Không thể tải lịch sử khiếu nại.');
            setReports([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, []);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm(previous => ({
            ...previous,
            [name]: value
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setNotice('');

        const token = getToken();

        if (!token) {
            navigate('/login', { replace: true });
            return;
        }

        const subject = form.subject.trim();
        const description = form.description.trim();
        const bookingCode = form.bookingCode.trim();

        if (!subject) {
            setError('Vui lòng nhập tiêu đề khiếu nại.');
            return;
        }

        if (description.length < 10) {
            setError('Nội dung khiếu nại phải có ít nhất 10 ký tự.');
            return;
        }

        setSubmitting(true);

        try {
            const payload = {
                subject,
                category: form.category,
                description
            };

            if (bookingCode) {
                payload.bookingCode = bookingCode;
            }

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                if (response.status === 401) {
                    navigate('/login', { replace: true });
                    return;
                }
                throw new Error(getErrorMessage(response.status, data));
            }

            setNotice('Gửi khiếu nại thành công.');
            setForm({
                subject: '',
                category: 'SERVICE_QUALITY',
                bookingCode: '',
                description: ''
            });

            await loadReports();
        } catch (err) {
            setError(err.message || 'Không thể gửi khiếu nại.');
        } finally {
            setSubmitting(false);
        }
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
                                className="sidebar-item"
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
                            <li className="sidebar-item active">
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

                    <div className="profile-content customer-reports-content">
                        <div className="profile-header-title">
                            <h2>Hỗ trợ & Khiếu nại</h2>
                            <p>Gửi yêu cầu hỗ trợ và theo dõi tình trạng xử lý từ hệ thống.</p>
                        </div>

                        {error && (
                            <div className="customer-report-alert error" role="alert">
                                {error}
                            </div>
                        )}

                        {notice && (
                            <div className="customer-report-alert success" role="status">
                                <FontAwesomeIcon icon={faCircleCheck} />
                                {notice}
                            </div>
                        )}

                        <section className="customer-report-card">
                            <h3>Thông tin khiếu nại</h3>
                            <form onSubmit={handleSubmit}>
                                <div className="customer-report-form-grid">
                                    <div className="customer-report-field">
                                        <label htmlFor="report-subject">Tiêu đề</label>
                                        <input
                                            id="report-subject"
                                            name="subject"
                                            type="text"
                                            value={form.subject}
                                            onChange={handleChange}
                                            maxLength={200}
                                            placeholder="Nhập tiêu đề khiếu nại"
                                            required
                                        />
                                    </div>

                                    <div className="customer-report-field">
                                        <label htmlFor="report-category">Loại khiếu nại</label>
                                        <select
                                            id="report-category"
                                            name="category"
                                            value={form.category}
                                            onChange={handleChange}
                                            required
                                        >
                                            {CATEGORIES.map(category => (
                                                <option
                                                    key={category.value}
                                                    value={category.value}
                                                >
                                                    {category.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="customer-report-field">
                                        <label htmlFor="report-booking-code">
                                            Mã đơn hàng (không bắt buộc)
                                        </label>
                                        <input
                                            id="report-booking-code"
                                            name="bookingCode"
                                            type="text"
                                            value={form.bookingCode}
                                            onChange={handleChange}
                                            placeholder="Nhập đúng mã đơn hàng nếu có"
                                        />
                                        <small>
                                            Nếu khiếu nại liên quan đến đơn hàng, hãy nhập mã đơn thực tế. Có thể để trống nếu cần hỗ trợ chung.
                                        </small>
                                    </div>

                                    <div className="customer-report-field full">
                                        <label htmlFor="report-description">Nội dung chi tiết</label>
                                        <textarea
                                            id="report-description"
                                            name="description"
                                            value={form.description}
                                            onChange={handleChange}
                                            minLength={10}
                                            maxLength={5000}
                                            rows={5}
                                            placeholder="Mô tả cụ thể vấn đề bạn gặp phải..."
                                            required
                                        />
                                        <small>{form.description.trim().length}/5000 ký tự</small>
                                    </div>
                                </div>

                                <div className="customer-report-actions">
                                    <button
                                        type="button"
                                        className="customer-report-secondary"
                                        onClick={() => {
                                            setForm({
                                                subject: '',
                                                category: 'SERVICE_QUALITY',
                                                bookingCode: '',
                                                description: ''
                                            });
                                            setError('');
                                            setNotice('');
                                        }}
                                        disabled={submitting}
                                    >
                                        Xóa nội dung
                                    </button>
                                    <button
                                        type="submit"
                                        className="customer-report-primary"
                                        disabled={submitting}
                                    >
                                        <FontAwesomeIcon icon={faPaperPlane} />
                                        {submitting ? 'Đang gửi...' : 'Gửi khiếu nại'}
                                    </button>
                                </div>
                            </form>
                        </section>

                        <section className="customer-report-card customer-report-history">
                            <div className="customer-report-history-heading">
                                <div>
                                    <h3>Lịch sử khiếu nại</h3>
                                    <p>Các yêu cầu do tài khoản của bạn gửi.</p>
                                </div>
                                <button
                                    type="button"
                                    className="customer-report-refresh"
                                    onClick={loadReports}
                                    disabled={loading}
                                >
                                    <FontAwesomeIcon icon={faRotate} />
                                    Tải lại
                                </button>
                            </div>

                            {loading ? (
                                <div className="customer-report-empty">
                                    Đang tải lịch sử khiếu nại...
                                </div>
                            ) : reports.length === 0 ? (
                                <div className="customer-report-empty">
                                    <FontAwesomeIcon icon={faFileCircleExclamation} />
                                    <p>Chưa có khiếu nại nào trong tài khoản của bạn.</p>
                                </div>
                            ) : (
                                <div className="customer-report-list">
                                    {reports.map(report => (
                                        <article className="customer-report-item" key={report.id}>
                                            <div className="customer-report-item-heading">
                                                <div>
                                                    <span className="customer-report-id">
                                                        Khiếu nại #{report.id}
                                                    </span>
                                                    <h4>{report.subject || 'Không có tiêu đề'}</h4>
                                                </div>
                                                <span className={`customer-report-status ${(report.status || 'OPEN').toLowerCase()}`}>
                                                    <FontAwesomeIcon icon={faClock} />
                                                    {STATUS_LABELS[report.status] || report.status || 'Chưa có trạng thái'}
                                                </span>
                                            </div>

                                            <div className="customer-report-meta">
                                                <span>
                                                    Loại: {CATEGORIES.find(item => item.value === report.category)?.label || report.category || 'Khác'}
                                                </span>
                                                <span>
                                                    Mã đơn: {report.bookingCode || 'Không liên kết đơn hàng'}
                                                </span>
                                                <span>
                                                    Ngày gửi: {formatDate(report.createdAt)}
                                                </span>
                                            </div>

                                            <p className="customer-report-description">
                                                {report.description || 'Không có nội dung'}
                                            </p>

                                            {report.resolution && (
                                                <div className="customer-report-resolution">
                                                    <strong>Kết quả xử lý:</strong>
                                                    <p>{report.resolution}</p>
                                                </div>
                                            )}
                                        </article>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}