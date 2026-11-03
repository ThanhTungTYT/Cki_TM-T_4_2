
import { Link } from 'react-router-dom';

function getCleanerName() {
    try {
        const savedUser =
            sessionStorage.getItem('user') ||
            localStorage.getItem('user') ||
            sessionStorage.getItem('userInfo') ||
            localStorage.getItem('userInfo');

        if (!savedUser) return 'bạn';

        const user = JSON.parse(savedUser);
        return user.fullName || user.name || 'bạn';
    } catch {
        return 'bạn';
    }
}

const STAT_ITEMS = [
    {
        title: 'Công việc hôm nay',
        value: '—',
        description: 'Chưa có dữ liệu',
        icon: '📋'
    },
    {
        title: 'Đang thực hiện',
        value: '—',
        description: 'Chưa có dữ liệu',
        icon: '🧹'
    },
    {
        title: 'Chờ xác nhận',
        value: '—',
        description: 'Chưa có dữ liệu',
        icon: '⏳'
    },
    {
        title: 'Đã hoàn thành',
        value: '—',
        description: 'Chưa có dữ liệu',
        icon: '✓'
    }
];

function CleanerDashboard() {
    const userName = getCleanerName();

    const today = new Date().toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    return (
        <div className="cl-page">
            <div className="cl-page-heading">
                <div>
                    <h1>Tổng quan</h1>
                    <p>Theo dõi công việc và lịch làm việc của bạn.</p>
                </div>

                <div className="cl-current-date">
                    <span>Hôm nay</span>
                    <strong>{today}</strong>
                </div>
            </div>

            <section className="cl-welcome">
                <div className="cl-welcome-content">
                    <span className="cl-welcome-label">
                        CLEANMATE - CLEANER PORTAL
                    </span>

                    <h2>Xin chào, {userName}!</h2>

                    <p>
                        Chúc bạn có một ngày làm việc hiệu quả.
                        Hãy kiểm tra lịch và các công việc được phân công nhé.
                    </p>

                    <Link to="/cleaner/jobs" className="cl-primary-button">
                        Xem công việc
                        <span>→</span>
                    </Link>
                </div>

                <div className="cl-welcome-decoration">
                    <div className="cl-decoration-circle">
                        <span>✦</span>
                    </div>
                </div>
            </section>

            <section className="cl-section">
                <div className="cl-section-heading">
                    <div>
                        <h2>Tình hình công việc</h2>
                        <p>Tổng quan hoạt động của bạn</p>
                    </div>
                </div>

                <div className="cl-stat-grid">
                    {STAT_ITEMS.map((item, index) => (
                        <div className="cl-stat-card" key={index}>
                            <div className={`cl-stat-icon cl-stat-icon-${index + 1}`}>
                                {item.icon}
                            </div>

                            <div className="cl-stat-info">
                                <span>{item.title}</span>
                                <strong>{item.value}</strong>
                                <small>{item.description}</small>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <div className="cl-dashboard-grid">
                <section className="cl-panel cl-schedule-panel">
                    <div className="cl-panel-heading">
                        <div>
                            <h2>Lịch làm việc hôm nay</h2>
                            <p>Các công việc được phân công trong ngày</p>
                        </div>

                        <Link to="/cleaner/calendar" className="cl-text-link">
                            Xem lịch
                        </Link>
                    </div>

                    <div className="cl-empty-state">
                        <div className="cl-empty-icon">📅</div>
                        <strong>Chưa có dữ liệu lịch làm việc</strong>
                        <p>
                            Lịch làm việc sẽ xuất hiện tại đây khi hệ thống
                            được kết nối với dữ liệu phân công.
                        </p>
                    </div>
                </section>

                <section className="cl-panel cl-shortcut-panel">
                    <div className="cl-panel-heading">
                        <div>
                            <h2>Truy cập nhanh</h2>
                            <p>Các chức năng thường dùng</p>
                        </div>
                    </div>

                    <div className="cl-shortcut-list">
                        <Link to="/cleaner/jobs" className="cl-shortcut-item">
                            <div className="cl-shortcut-icon">📋</div>
                            <div>
                                <strong>Công việc của tôi</strong>
                                <span>Xem công việc được phân công</span>
                            </div>
                            <span className="cl-shortcut-arrow">›</span>
                        </Link>

                        <Link to="/cleaner/calendar" className="cl-shortcut-item">
                            <div className="cl-shortcut-icon">🗓️</div>
                            <div>
                                <strong>Lịch làm việc</strong>
                                <span>Theo dõi lịch làm việc</span>
                            </div>
                            <span className="cl-shortcut-arrow">›</span>
                        </Link>

                        <Link to="/cleaner/history" className="cl-shortcut-item">
                            <div className="cl-shortcut-icon">🕘</div>
                            <div>
                                <strong>Lịch sử công việc</strong>
                                <span>Xem các công việc trước đây</span>
                            </div>
                            <span className="cl-shortcut-arrow">›</span>
                        </Link>

                        <Link to="/cleaner/profile" className="cl-shortcut-item">
                            <div className="cl-shortcut-icon">👤</div>
                            <div>
                                <strong>Hồ sơ của tôi</strong>
                                <span>Thông tin tài khoản cá nhân</span>
                            </div>
                            <span className="cl-shortcut-arrow">›</span>
                        </Link>
                    </div>
                </section>
            </div>

            <div className="cl-info-note">
                <span className="cl-info-note-icon">i</span>
                <p>
                    <strong>Lưu ý:</strong> Đây là giao diện tổng quan ban đầu.
                    Các số liệu và lịch làm việc sẽ được cập nhật sau khi
                    hoàn thành kết nối API với hệ thống backend.
                </p>
            </div>
        </div>
    );
}

export default CleanerDashboard;
