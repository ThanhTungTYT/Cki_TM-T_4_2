import { useEffect, useState } from 'react';
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

const formatMoney = (value) =>
    new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
    }).format(Number(value) || 0);

function AdminDashboard() {
    const location = useLocation();

    const [period, setPeriod] = useState('7');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [appliedRange, setAppliedRange] = useState('7');
    const [appliedFromDate, setAppliedFromDate] = useState('');
    const [appliedToDate, setAppliedToDate] = useState('');

    const [chartData, setChartData] = useState([]);
    const [orderStats, setOrderStats] = useState([]);
    const [totalServiceValue, setTotalServiceValue] = useState(0);
    const [totalOrders, setTotalOrders] = useState(0);
    const [loadingStatistics, setLoadingStatistics] = useState(false);
    const [statisticsError, setStatisticsError] = useState('');

    const maxValue = Math.max(
        1,
        ...chartData.map((item) => Number(item.value) || 0)
    );

    const pieTotalOrders = orderStats.reduce(
        (sum, item) => sum + (Number(item.count) || 0),
        0
    );

    let accumulatedPercentage = 0;

    const pieBackground = orderStats
        .map((item) => {
            const percentage = Math.max(0, Number(item.value) || 0);

            if (percentage === 0) {
                return null;
            }

            const start = accumulatedPercentage;
            accumulatedPercentage += percentage;

            return `${item.color || '#64748b'} ${start}% ${accumulatedPercentage}%`;
        })
        .filter(Boolean)
        .join(', ');

    useEffect(() => {
        const controller = new AbortController();

        async function fetchStatistics() {
            if (
                appliedRange === 'custom' &&
                (!appliedFromDate ||
                    !appliedToDate ||
                    appliedFromDate > appliedToDate)
            ) {
                setStatisticsError(
                    'Vui lòng chọn khoảng ngày bắt đầu và kết thúc hợp lệ.'
                );
                setChartData([]);
                setOrderStats([]);
                setTotalServiceValue(0);
                setTotalOrders(0);
                setLoadingStatistics(false);
                return;
            }

            setLoadingStatistics(true);
            setStatisticsError('');

            try {
                const params = new URLSearchParams();

                if (appliedRange === 'custom') {
                    params.set('fromDate', appliedFromDate);
                    params.set('toDate', appliedToDate);
                } else {
                    params.set('period', appliedRange);
                }

                const token =
                    localStorage.getItem('accessToken') ||
                    localStorage.getItem('token') ||
                    sessionStorage.getItem('accessToken') ||
                    sessionStorage.getItem('token');

                const response = await fetch(
                    `/api/admin/statistics?${params.toString()}`,
                    {
                        method: 'GET',
                        signal: controller.signal,
                        headers: {
                            Accept: 'application/json',
                            ...(token
                                ? { Authorization: `Bearer ${token}` }
                                : {}),
                        },
                    }
                );

                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        throw new Error(
                            'Bạn cần đăng nhập bằng tài khoản có quyền Admin.'
                        );
                    }

                    throw new Error(
                        `Không lấy được dữ liệu thống kê (HTTP ${response.status}).`
                    );
                }

                const data = await response.json();

                setChartData(
                    Array.isArray(data.chartData) ? data.chartData : []
                );

                setOrderStats(
                    Array.isArray(data.orderStats) ? data.orderStats : []
                );

                setTotalServiceValue(
                    Number(data.totalServiceValue) || 0
                );

                setTotalOrders(Number(data.totalOrders) || 0);
            } catch (error) {
                if (error.name === 'AbortError') {
                    return;
                }

                setStatisticsError(
                    error.message || 'Không thể kết nối máy chủ thống kê.'
                );

                setChartData([]);
                setOrderStats([]);
                setTotalServiceValue(0);
                setTotalOrders(0);
            } finally {
                if (!controller.signal.aborted) {
                    setLoadingStatistics(false);
                }
            }
        }

        fetchStatistics();

        return () => controller.abort();
    }, [appliedRange, appliedFromDate, appliedToDate]);

    const handlePeriodChange = (value) => {
        setPeriod(value);
        setFromDate('');
        setToDate('');
        setAppliedFromDate('');
        setAppliedToDate('');
        setStatisticsError('');
        setAppliedRange(value);
    };

    const handleApplyFilter = () => {
        if (!fromDate && !toDate) {
            setAppliedFromDate('');
            setAppliedToDate('');
            setStatisticsError('');
            setAppliedRange(period);
            return;
        }

        if (!fromDate || !toDate) {
            setStatisticsError(
                'Bạn cần chọn cả ngày bắt đầu và ngày kết thúc.'
            );
            return;
        }

        if (fromDate > toDate) {
            setStatisticsError(
                'Ngày bắt đầu không được sau ngày kết thúc.'
            );
            return;
        }

        setAppliedFromDate(fromDate);
        setAppliedToDate(toDate);
        setStatisticsError('');
        setAppliedRange('custom');
    };

    const handleResetFilter = () => {
        setPeriod('7');
        setFromDate('');
        setToDate('');
        setAppliedFromDate('');
        setAppliedToDate('');
        setStatisticsError('');
        setAppliedRange('7');
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
                            location.pathname === '/admin/orders' ? 'active' : ''
                        }`}
                        href="/admin/orders"
                    >
                        <FontAwesomeIcon icon={faClipboardList} />
                        <span>Quản lý đơn hàng</span>
                    </a>

                    <a
                        className={`admin-menu-item ${
                            location.pathname === '/admin/providers' ? 'active' : ''
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
                            location.pathname === '/admin/transactions' ? 'active' : ''
                        }`}
                        href="/admin/transactions"
                    >
                        <FontAwesomeIcon icon={faCreditCard} />
                        <span>Giao dịch</span>
                    </a>

                    <a
                        className={`admin-menu-item ${
                            location.pathname === '/admin/reports' ? 'active' : ''
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
                        <p>
                            Xin chào! Đây là tình hình hoạt động của CleanMate.
                        </p>
                    </div>

                    <button
                        className="admin-notification"
                        aria-label="Thông báo"
                        type="button"
                    >
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
                            <span className="summary-tag">Thống kê</span>
                        </div>
                        <p>Tổng giá trị dịch vụ</p>
                        <h2>{formatMoney(totalServiceValue)}</h2>
                        <span className="summary-note">Trong kỳ thống kê</span>
                    </div>

                    <div className="admin-summary-card">
                        <div className="summary-card-top">
                            <span className="summary-icon purple">
                                <FontAwesomeIcon icon={faCreditCard} />
                            </span>
                            <span className="summary-tag">Thông tin</span>
                        </div>
                        <p>Phí nền tảng</p>
                        <h2>12.850.000đ</h2>
                        <span className="summary-note">
                            Chưa kết nối API thống kê phí nền tảng
                        </span>
                    </div>

                    <div className="admin-summary-card">
                        <div className="summary-card-top">
                            <span className="summary-icon orange">
                                <FontAwesomeIcon icon={faClipboardList} />
                            </span>
                            <span className="summary-tag">Thống kê</span>
                        </div>
                        <p>Tổng số đơn hàng</p>
                        <h2>{totalOrders}</h2>
                        <span className="summary-note">Trong kỳ thống kê</span>
                    </div>

                    <div className="admin-summary-card">
                        <div className="summary-card-top">
                            <span className="summary-icon green">
                                <FontAwesomeIcon icon={faStore} />
                            </span>
                            <span className="summary-tag">Thông tin</span>
                        </div>
                        <p>Đối tác đang hoạt động</p>
                        <h2>48</h2>
                        <span className="summary-note">
                            Chưa kết nối API thống kê đối tác
                        </span>
                    </div>
                </section>

                <section className="admin-chart-grid">
                    <div className="admin-panel revenue-panel">
                        <div className="admin-panel-heading">
                            <div>
                                <h2>Thống kê giá trị dịch vụ</h2>
                                <p>
                                    Biểu đồ cột theo khoảng thời gian tùy chọn (CN10)
                                </p>
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
                                    onChange={(event) =>
                                        handlePeriodChange(event.target.value)
                                    }
                                >
                                    <option value="7">7 ngày gần nhất</option>
                                    <option value="14">14 ngày gần nhất</option>
                                    <option value="30">1 tháng gần nhất</option>
                                    <option value="365">1 năm gần nhất</option>
                                </select>
                            </label>

                            <label>
                                <span>Từ ngày</span>
                                <input
                                    type="date"
                                    value={fromDate}
                                    max={toDate || undefined}
                                    onChange={(event) =>
                                        setFromDate(event.target.value)
                                    }
                                />
                            </label>

                            <label>
                                <span>Đến ngày</span>
                                <input
                                    type="date"
                                    value={toDate}
                                    min={fromDate || undefined}
                                    onChange={(event) =>
                                        setToDate(event.target.value)
                                    }
                                />
                            </label>

                            <button
                                className="apply-filter-btn"
                                type="button"
                                onClick={handleApplyFilter}
                                disabled={loadingStatistics}
                            >
                                <FontAwesomeIcon icon={faCalendarDays} />
                                Áp dụng
                            </button>

                            <button
                                className="apply-filter-btn"
                                type="button"
                                onClick={handleResetFilter}
                                disabled={loadingStatistics}
                            >
                                Đặt lại
                            </button>
                        </div>

                        <div className="revenue-total">
                            <div>
                                <span>Tổng giá trị trong biểu đồ</span>
                                <strong>{formatMoney(totalServiceValue)}</strong>
                            </div>

                            {loadingStatistics && (
                                <p className="statistics-message">
                                    Đang tải dữ liệu thống kê...
                                </p>
                            )}

                            {statisticsError && (
                                <p className="statistics-error" role="alert">
                                    {statisticsError}
                                </p>
                            )}

                            <span className="revenue-legend">
                                <i />
                                Giá trị dịch vụ
                            </span>
                        </div>

                        <div
                            className="bar-chart"
                            aria-label="Biểu đồ cột giá trị dịch vụ"
                        >
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
                                    {chartData.map((item, index) => (
                                        <div
                                            className="bar-column"
                                            key={`${item.label}-${index}`}
                                            title={`${item.label}: ${formatMoney(item.value)}`}
                                        >
                                            <div className="bar-value">
                                                {formatMoney(item.value)}
                                            </div>

                                            <div className="bar-track">
                                                <div
                                                    className="bar"
                                                    style={{
                                                        height: `${
                                                            ((Number(item.value) || 0) /
                                                                maxValue) *
                                                            100
                                                        }%`,
                                                    }}
                                                />
                                            </div>

                                            <span className="bar-label">
                                                {item.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {!loadingStatistics &&
                            !statisticsError &&
                            chartData.length === 0 && (
                                <p className="statistics-message">
                                    Không có dữ liệu trong khoảng thời gian này.
                                </p>
                            )}
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
                                style={{
                                    background: pieTotalOrders > 0
                                        ? `conic-gradient(${pieBackground})`
                                        : '#e5e7eb',
                                }}
                                role="img"
                                aria-label="Biểu đồ tròn tỷ lệ đơn hàng theo trạng thái"
                            >
                                <div className="pie-chart-center">
                                    <span>Tổng đơn</span>
                                    <strong>{pieTotalOrders}</strong>
                                </div>
                            </div>
                        </div>

                        <div className="order-legend">
                            {orderStats.map((item) => (
                                <div
                                    className="order-legend-row"
                                    key={item.status || item.label}
                                >
                                    <div className="order-legend-name">
                                        <i
                                            style={{
                                                backgroundColor: item.color,
                                            }}
                                        />
                                        <span>{item.label}</span>
                                    </div>

                                    <strong>{item.count}</strong>

                                    <span className="order-percent">
                                        {item.value}%
                                    </span>
                                </div>
                            ))}

                            {orderStats.length === 0 && (
                                <p className="statistics-message">
                                    Chưa có dữ liệu trạng thái đơn hàng.
                                </p>
                            )}
                        </div>

                        <div className="order-panel-footer">
                            <span>
                                <FontAwesomeIcon icon={faRotate} />
                                Dữ liệu từ database theo khoảng thời gian đã chọn
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
                                    <small>Hoạt động minh họa</small>
                                </div>
                            </div>

                            <div className="activity-item">
                                <span className="activity-icon orange">
                                    <FontAwesomeIcon icon={faClock} />
                                </span>
                                <div>
                                    <strong>Đơn hàng chờ xác nhận</strong>
                                    <p>Có 3 đơn hàng cần được kiểm tra</p>
                                    <small>Hoạt động minh họa</small>
                                </div>
                            </div>

                            <div className="activity-item">
                                <span className="activity-icon blue">
                                    <FontAwesomeIcon icon={faStore} />
                                </span>
                                <div>
                                    <strong>Đối tác đăng ký mới</strong>
                                    <p>2 hồ sơ đối tác đang chờ duyệt</p>
                                    <small>Hoạt động minh họa</small>
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
                    CleanMate Admin Panel
                </footer>
            </main>
        </div>
    );
}

export default AdminDashboard;