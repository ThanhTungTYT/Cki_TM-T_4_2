import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faHouse,
    faClipboardList,
    faUsers,
    faStore,
    faCreditCard,
    faChartColumn,
    faChartPie,
    faBell,
    faArrowRightFromBracket,
    faCalendarDays,
    faCheckCircle,
    faClock,
    faRotate,
    faMoneyBillWave,
    faTags,
} from '@fortawesome/free-solid-svg-icons';
import './AdminDashboard.css';

const chartData = {
    '7': [
        { label: 'T2', value: 3200000 },
        { label: 'T3', value: 4500000 },
        { label: 'T4', value: 2800000 },
        { label: 'T5', value: 6200000 },
        { label: 'T6', value: 5100000 },
        { label: 'T7', value: 7800000 },
        { label: 'CN', value: 6500000 },
    ],
    '30': [
        { label: 'Tuần 1', value: 18500000 },
        { label: 'Tuần 2', value: 24000000 },
        { label: 'Tuần 3', value: 21000000 },
        { label: 'Tuần 4', value: 31500000 },
    ],
    '365': [
        { label: 'T1', value: 42000000 },
        { label: 'T2', value: 48000000 },
        { label: 'T3', value: 39000000 },
        { label: 'T4', value: 55000000 },
        { label: 'T5', value: 61000000 },
        { label: 'T6', value: 58000000 },
        { label: 'T7', value: 72000000 },
        { label: 'T8', value: 68000000 },
        { label: 'T9', value: 79000000 },
        { label: 'T10', value: 85000000 },
        { label: 'T11', value: 76000000 },
        { label: 'T12', value: 92000000 },
    ],
};

const orderStats = [
    { label: 'Hoàn thành', value: 58, color: '#16a34a', count: 145 },
    { label: 'Đang xử lý', value: 25, color: '#3b82f6', count: 63 },
    { label: 'Chờ xác nhận', value: 10, color: '#f59e0b', count: 25 },
    { label: 'Đã hủy', value: 7, color: '#ef4444', count: 17 },
];

const formatMoney = (value) =>
    new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
    }).format(value);

function AdminDashboard() {
    const location = useLocation();
    const [period, setPeriod] = useState('7');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [appliedRange, setAppliedRange] = useState('7');

    const currentData = chartData[appliedRange] || chartData['7'];
    const maxValue = Math.max(...currentData.map((item) => item.value));

    const totalOrders = orderStats.reduce((sum, item) => sum + item.count, 0);
    const pieBackground = orderStats.reduce(
        (result, item, index) => {
            const previous = result.total;
            const next = previous + item.value;
            result.parts.push(`${item.color} ${previous}% ${next}%`);
            result.total = next;
            return result;
        },
        { parts: [], total: 0 }
    ).parts.join(', ');

    const handleApplyFilter = () => {
        setAppliedRange(period);
    };

    return (
        <div className="admin-layout">
            <aside className="admin-sidebar">
                <div className="admin-brand">
                    <div className="admin-brand-icon">
                        <FontAwesomeIcon icon={faHouse} />
                    </div>
                    <div>
                        <strong>CleanMate</strong>
                        <span>ADMIN PANEL</span>
                    </div>
                </div>

                <div className="admin-menu-title">MENU CHÍNH</div>

                <nav className="admin-menu">
                    <a
                        className={`admin-menu-item ${
                            location.pathname === '/admin' ? 'active' : ''
                        }`}
                        href="/admin"
                    >
                        <FontAwesomeIcon icon={faChartColumn} />
                        <span>Tổng quan</span>
                    </a>

                    <a
                        className={`admin-menu-item ${
                            location.pathname === "/admin/orders" ? "active" : ""
                        }`}
                        href="/admin/orders"
                    >
                        <FontAwesomeIcon icon={faClipboardList} />
                        <span>Quản lý đơn hàng</span>
                    </a>

                    <a
                        className={`admin-menu-item ${
                            location.pathname === "/admin/providers" ? "active" : ""
                        }`}
                        href="/admin/providers"
                    >
                        <FontAwesomeIcon icon={faStore} />
                        <span>Nhà cung cấp</span>
                    </a>

                    <a
                        className={`admin-menu-item ${
                            location.pathname === '/admin/accounts' ? 'active' : ''
                        }`}
                        href="/admin/accounts"
                    >
                        <FontAwesomeIcon icon={faUsers} />
                        <span>Quản lý tài khoản</span>
                    </a>

                    <a
                        className={`admin-menu-item ${
                            location.pathname === '/admin/services' ? 'active' : ''
                        }`}
                        href="/admin/services"
                    >
                        <FontAwesomeIcon icon={faTags} />
                        <span>Quản lý dịch vụ</span>
                    </a>

                    <a
                        className={`admin-menu-item ${
                            location.pathname === "/admin/transactions" ? "active" : ""
                        }`}
                        href="/admin/transactions"
                    >
                        <FontAwesomeIcon icon={faCreditCard} />
                        <span>Giao dịch</span>
                    </a>

                    <a
                        className={`admin-menu-item ${
                            location.pathname === "/admin/reports" ? "active" : ""
                        }`}
                        href="/admin/reports"
                    >
                        <FontAwesomeIcon icon={faChartPie} />
                        <span>Thống kê & báo cáo</span>
                    </a>
                </nav>

                <div className="admin-sidebar-bottom">
                    <div className="admin-user">
                        <div className="admin-avatar">AD</div>
                        <div className="admin-user-info">
                            <strong>Quản trị viên</strong>
                            <span>Administrator</span>
                        </div>
                    </div>
                    <a className="admin-menu-item logout" href="/login">
                        <FontAwesomeIcon icon={faArrowRightFromBracket} />
                        <span>Đăng xuất</span>
                    </a>
                </div>
            </aside>

            <main className="admin-main">
                <header className="admin-topbar">
                    <div>
                        <h1>Tổng quan hệ thống</h1>
                        <p>Xin chào! Đây là tình hình hoạt động của CleanMate.</p>
                    </div>
                    <button className="admin-notification" aria-label="Thông báo">
                        <FontAwesomeIcon icon={faBell} />
                        <span />
                    </button>
                </header>

                <section className="admin-summary-grid">
                    <div className="admin-summary-card">
                        <div className="summary-card-top">
                            <span className="summary-icon blue">
                                <FontAwesomeIcon icon={faMoneyBillWave} />
                            </span>
                            <span className="summary-tag">+12,5%</span>
                        </div>
                        <p>Tổng giá trị dịch vụ</p>
                        <h2>128.500.000đ</h2>
                        <span className="summary-note">So với kỳ trước</span>
                    </div>

                    <div className="admin-summary-card">
                        <div className="summary-card-top">
                            <span className="summary-icon purple">
                                <FontAwesomeIcon icon={faCreditCard} />
                            </span>
                            <span className="summary-tag">+8,2%</span>
                        </div>
                        <p>Phí nền tảng</p>
                        <h2>12.850.000đ</h2>
                        <span className="summary-note">Doanh thu hoa hồng</span>
                    </div>

                    <div className="admin-summary-card">
                        <div className="summary-card-top">
                            <span className="summary-icon orange">
                                <FontAwesomeIcon icon={faClipboardList} />
                            </span>
                            <span className="summary-tag">+6,4%</span>
                        </div>
                        <p>Tổng số đơn hàng</p>
                        <h2>250</h2>
                        <span className="summary-note">Trong kỳ thống kê</span>
                    </div>

                    <div className="admin-summary-card">
                        <div className="summary-card-top">
                            <span className="summary-icon green">
                                <FontAwesomeIcon icon={faStore} />
                            </span>
                            <span className="summary-tag">+4,1%</span>
                        </div>
                        <p>Đối tác đang hoạt động</p>
                        <h2>48</h2>
                        <span className="summary-note">Đối tác đã được duyệt</span>
                    </div>
                </section>

                <section className="admin-chart-grid">
                    <div className="admin-panel revenue-panel">
                        <div className="admin-panel-heading">
                            <div>
                                <h2>Thống kê giá trị dịch vụ</h2>
                                <p>Biểu đồ cột theo khoảng thời gian tùy chọn (CN10)</p>
                            </div>
                            <span className="panel-icon">
                                <FontAwesomeIcon icon={faChartColumn} />
                            </span>
                        </div>

                        <div className="chart-filter">
                            <label>
                                <span>Khoảng thời gian</span>
                                <select
                                    value={period}
                                    onChange={(event) => setPeriod(event.target.value)}
                                >
                                    <option value="7">7 ngày gần nhất</option>
                                    <option value="30">30 ngày gần nhất</option>
                                    <option value="365">12 tháng gần nhất</option>
                                </select>
                            </label>

                            <label>
                                <span>Từ ngày</span>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(event) => setFromDate(event.target.value)}
                                />
                            </label>

                            <label>
                                <span>Đến ngày</span>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(event) => setToDate(event.target.value)}
                                />
                            </label>

                            <button
                                className="apply-filter-btn"
                                onClick={handleApplyFilter}
                            >
                                <FontAwesomeIcon icon={faCalendarDays} />
                                Áp dụng
                            </button>
                        </div>

                        <div className="revenue-total">
                            <div>
                                <span>Tổng giá trị trong biểu đồ</span>
                                <strong>
                                    {formatMoney(
                                        currentData.reduce((sum, item) => sum + item.value, 0)
                                    )}
                                </strong>
                            </div>
                            <span className="revenue-legend">
                                <i />
                                Giá trị dịch vụ
                            </span>
                        </div>

                        <div className="bar-chart" aria-label="Biểu đồ cột giá trị dịch vụ">
                            <div className="chart-y-axis">
                                <span>100%</span>
                                <span>75%</span>
                                <span>50%</span>
                                <span>25%</span>
                                <span>0%</span>
                            </div>
                            <div className="bar-chart-content">
                                <div className="chart-grid-lines">
                                    <i />
                                    <i />
                                    <i />
                                    <i />
                                    <i />
                                </div>
                                <div className="bar-list">
                                    {currentData.map((item) => (
                                        <div className="bar-column" key={item.label}>
                                            <div className="bar-value">
                                                {formatMoney(item.value)}
                                            </div>
                                            <div className="bar-track">
                                                <div
                                                    className="bar"
                                                    style={{
                                                        height: `${(item.value / maxValue) * 100}%`,
                                                    }}
                                                />
                                            </div>
                                            <span className="bar-label">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="admin-panel order-panel">
                        <div className="admin-panel-heading">
                            <div>
                                <h2>Thống kê đơn hàng</h2>
                                <p>Tỷ lệ đơn hàng theo trạng thái (CN11)</p>
                            </div>
                            <span className="panel-icon">
                                <FontAwesomeIcon icon={faChartPie} />
                            </span>
                        </div>

                        <div className="pie-chart-wrap">
                            <div
                                className="pie-chart"
                                style={{ background: `conic-gradient(${pieBackground})` }}
                                role="img"
                                aria-label="Biểu đồ tròn tỷ lệ đơn hàng theo trạng thái"
                            >
                                <div className="pie-chart-center">
                                    <span>Tổng đơn</span>
                                    <strong>{totalOrders}</strong>
                                </div>
                            </div>
                        </div>

                        <div className="order-legend">
                            {orderStats.map((item) => (
                                <div className="order-legend-row" key={item.label}>
                                    <div className="order-legend-name">
                                        <i style={{ backgroundColor: item.color }} />
                                        <span>{item.label}</span>
                                    </div>
                                    <strong>{item.count}</strong>
                                    <span className="order-percent">{item.value}%</span>
                                </div>
                            ))}
                        </div>

                        <div className="order-panel-footer">
                            <span>
                                <FontAwesomeIcon icon={faRotate} />
                                Dữ liệu minh họa
                            </span>
                        </div>
                    </div>
                </section>

                <section className="admin-bottom-grid">
                    <div className="admin-panel">
                        <div className="admin-panel-heading">
                            <div>
                                <h2>Hoạt động gần đây</h2>
                                <p>Cập nhật tình hình hệ thống</p>
                            </div>
                        </div>
                        <div className="activity-list">
                            <div className="activity-item">
                                <span className="activity-icon green">
                                    <FontAwesomeIcon icon={faCheckCircle} />
                                </span>
                                <div>
                                    <strong>Đơn hàng được hoàn thành</strong>
                                    <p>Đơn hàng #CM1025 đã hoàn tất</p>
                                    <small>5 phút trước</small>
                                </div>
                            </div>
                            <div className="activity-item">
                                <span className="activity-icon orange">
                                    <FontAwesomeIcon icon={faClock} />
                                </span>
                                <div>
                                    <strong>Đơn hàng chờ xác nhận</strong>
                                    <p>Có 3 đơn hàng cần được kiểm tra</p>
                                    <small>20 phút trước</small>
                                </div>
                            </div>
                            <div className="activity-item">
                                <span className="activity-icon blue">
                                    <FontAwesomeIcon icon={faStore} />
                                </span>
                                <div>
                                    <strong>Đối tác đăng ký mới</strong>
                                    <p>2 hồ sơ đối tác đang chờ duyệt</p>
                                    <small>1 giờ trước</small>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="admin-panel">
                        <div className="admin-panel-heading">
                            <div>
                                <h2>Cần xử lý</h2>
                                <p>Các mục cần Admin kiểm tra</p>
                            </div>
                        </div>
                        <div className="pending-list">
                            <div className="pending-item">
                                <div>
                                    <strong>Đối tác chờ duyệt</strong>
                                    <span>Hồ sơ đăng ký mới</span>
                                </div>
                                <b>02</b>
                            </div>
                            <div className="pending-item">
                                <div>
                                    <strong>Yêu cầu hủy đơn</strong>
                                    <span>Cần kiểm tra và xử lý</span>
                                </div>
                                <b>03</b>
                            </div>
                            <div className="pending-item">
                                <div>
                                    <strong>Khiếu nại mới</strong>
                                    <span>Yêu cầu từ khách hàng</span>
                                </div>
                                <b>01</b>
                            </div>
                        </div>
                    </div>
                </section>

                <footer className="admin-footer">
                    CleanMate Admin Panel · Giao diện minh họa
                </footer>
            </main>
        </div>
    );
}

export default AdminDashboard;
