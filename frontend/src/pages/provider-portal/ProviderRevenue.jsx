import { useEffect, useState } from 'react';
import { providerRevenueApi } from '../../services/providerApi';

const VND = (v) =>
    v != null ? `${Number(v).toLocaleString('vi-VN')}đ` : '—';

function toInputDate(d) {
    return d.toISOString().slice(0, 10);
}

function ProviderRevenue() {
    const today = new Date();
    const [fromDate, setFromDate] = useState(
        toInputDate(new Date(today.getFullYear(), today.getMonth(), 1))
    );
    const [toDate, setToDate] = useState(toInputDate(today));
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    function load() {
        setLoading(true);
        setError('');
        providerRevenueApi
            .get(fromDate, toDate)
            .then(setData)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }

    useEffect(() => { load(); }, []); // eslint-disable-line

    return (
        <>
            <div className="pp-page-header">
                <h1 className="pp-page-title">Doanh thu & Đối soát</h1>
            </div>

            {/* Date filter */}
            <div className="pp-card" style={{ marginBottom: 16, padding: '14px 20px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label className="pp-label" style={{ whiteSpace: 'nowrap' }}>Từ ngày</label>
                        <input
                            className="pp-input"
                            type="date"
                            style={{ width: 150 }}
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label className="pp-label" style={{ whiteSpace: 'nowrap' }}>Đến ngày</label>
                        <input
                            className="pp-input"
                            type="date"
                            style={{ width: 150 }}
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                        />
                    </div>
                    <button className="pp-btn pp-btn-primary" onClick={load} disabled={loading}>
                        {loading ? 'Đang tải...' : 'Xem báo cáo'}
                    </button>
                </div>
            </div>

            {error && <div className="pp-alert pp-alert-error">⚠️ {error}</div>}

            {data && (
                <>
                    {/* Summary cards */}
                    <div className="pp-stats-grid" style={{ marginBottom: 20 }}>
                        <div className="pp-stat-card success">
                            <span className="pp-stat-label">Đơn hoàn thành</span>
                            <span className="pp-stat-value">{data.completedOrders ?? 0}</span>
                        </div>
                        <div className="pp-stat-card highlight" style={{ gridColumn: 'span 2' }}>
                            <span className="pp-stat-label">Tổng giá trị đơn hoàn thành</span>
                            <span className="pp-stat-value" style={{ fontSize: 22 }}>
                                {VND(data.completedOrderValue)}
                            </span>
                        </div>
                        <div className="pp-stat-card warning">
                            <span className="pp-stat-label">Đã hoàn tiền</span>
                            <span className="pp-stat-value" style={{ fontSize: 18 }}>
                                {VND(data.approvedRefundAmount)}
                            </span>
                        </div>
                        <div className="pp-stat-card success" style={{ gridColumn: 'span 2' }}>
                            <span className="pp-stat-label">Doanh thu thực (sau hoàn tiền)</span>
                            <span className="pp-stat-value" style={{ fontSize: 22 }}>
                                {VND(data.valueAfterApprovedRefunds)}
                            </span>
                        </div>
                    </div>

                    {/* Detail card */}
                    <div className="pp-card">
                        <p className="pp-card-title">Chi tiết đối soát</p>
                        <table className="pp-table">
                            <tbody>
                                <tr>
                                    <td style={{ color: 'var(--pp-muted)', width: 260 }}>
                                        Kỳ báo cáo
                                    </td>
                                    <td>
                                        {data.fromDate} → {data.toDate}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ color: 'var(--pp-muted)' }}>
                                        Số đơn hoàn thành
                                    </td>
                                    <td><strong>{data.completedOrders}</strong> đơn</td>
                                </tr>
                                <tr>
                                    <td style={{ color: 'var(--pp-muted)' }}>
                                        Tổng giá trị dịch vụ
                                    </td>
                                    <td><strong>{VND(data.completedOrderValue)}</strong></td>
                                </tr>
                                <tr>
                                    <td style={{ color: 'var(--pp-muted)' }}>
                                        Tổng đã hoàn tiền (đã duyệt)
                                    </td>
                                    <td style={{ color: 'var(--pp-warning)' }}>
                                        <strong>- {VND(data.approvedRefundAmount)}</strong>
                                    </td>
                                </tr>
                                <tr style={{ background: '#f0fdf4' }}>
                                    <td style={{ fontWeight: 700, color: 'var(--pp-navy)' }}>
                                        Doanh thu thực tế
                                    </td>
                                    <td style={{ color: 'var(--pp-success)', fontWeight: 800, fontSize: 16 }}>
                                        {VND(data.valueAfterApprovedRefunds)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {data.note && (
                            <p style={{
                                fontSize: 12,
                                color: 'var(--pp-muted)',
                                marginTop: 14,
                                padding: '10px 14px',
                                background: '#f8fafc',
                                borderRadius: 6,
                                borderLeft: '3px solid var(--pp-border)',
                            }}>
                                ℹ️ {data.note}
                            </p>
                        )}
                    </div>
                </>
            )}

            {!data && !loading && !error && (
                <div className="pp-card">
                    <div className="pp-empty">
                        <p>Chọn khoảng thời gian và nhấn "Xem báo cáo" để tải dữ liệu.</p>
                    </div>
                </div>
            )}
        </>
    );
}

export default ProviderRevenue;
