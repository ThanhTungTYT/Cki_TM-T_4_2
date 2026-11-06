import { useEffect, useState } from 'react';
import { providerRevenueApi } from '../../services/providerApi';

const VND = (v) =>
    v != null ? `${Number(v).toLocaleString('vi-VN')}đ` : '0đ';

function toInputDate(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

    // Quick range presets
    function setMonthPreset(monthsAgo) {
        const d = new Date();
        d.setMonth(d.getMonth() - monthsAgo);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = monthsAgo === 0 ? today : new Date(d.getFullYear(), d.getMonth() + 1, 0);
        setFromDate(toInputDate(start));
        setToDate(toInputDate(end));
    }

    // CSV Export function
    function exportToCSV() {
        if (!data) return;

        const headers = [
            'Mã chỉ số',
            'Chỉ tiêu đối soát',
            'Giá trị',
            'Đơn vị tính'
        ];

        const rows = [
            ['KY_BAO_CAO', 'Kỳ báo cáo', `${data.fromDate} đến ${data.toDate}`, 'Thời gian'],
            ['DON_HOAN_THANH', 'Số đơn hàng hoàn thành', data.completedOrders ?? 0, 'Đơn'],
            ['TONG_GIA_TRI', 'Tổng giá trị đơn hoàn thành', data.completedOrderValue ?? 0, 'VNĐ'],
            ['HOAN_TIEN', 'Tổng tiền đã hoàn (duyệt khiếu nại)', data.approvedRefundAmount ?? 0, 'VNĐ'],
            ['DOANH_THU_THUC', 'Doanh thu thực tế (sau hoàn tiền)', data.valueAfterApprovedRefunds ?? 0, 'VNĐ'],
            ['GHI_CHU', 'Ghi chú hệ thống', (data.note || 'Không có').replace(/,/g, ';'), 'Văn bản']
        ];

        // Format CSV with UTF-8 BOM
        const csvContent = '\uFEFF' + [
            headers.join(','),
            ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\r\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Bao_cao_doanh_thu_${fromDate}_${toDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Calculations for visual progress bar
    const grossVal = data?.completedOrderValue || 0;
    const refundVal = data?.approvedRefundAmount || 0;
    const netVal = data?.valueAfterApprovedRefunds || 0;
    const refundPct = grossVal > 0 ? Math.min(100, Math.round((refundVal / grossVal) * 100)) : 0;
    const netPct = grossVal > 0 ? Math.max(0, 100 - refundPct) : 100;

    return (
        <div className="pp-revenue-page">
            <div className="pp-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 className="pp-page-title">Doanh thu & Đối soát thanh toán</h1>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                        Theo dõi tổng giá trị dịch vụ hoàn tất, khoản hoàn tiền và thực nhận theo kỳ.
                    </p>
                </div>
                {data && (
                    <button
                        className="pp-btn pp-btn-outline"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        onClick={exportToCSV}
                    >
                        <span>📥</span> Xuất báo cáo CSV
                    </button>
                )}
            </div>

            {/* Date filter card */}
            <div className="pp-card" style={{ marginBottom: 16, padding: '14px 20px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label className="pp-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Từ ngày:</label>
                        <input
                            className="pp-input"
                            type="date"
                            style={{ width: 145 }}
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label className="pp-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Đến ngày:</label>
                        <input
                            className="pp-input"
                            type="date"
                            style={{ width: 145 }}
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                        />
                    </div>

                    {/* Presets */}
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="pp-btn pp-btn-ghost pp-btn-sm" onClick={() => setMonthPreset(0)}>Tháng này</button>
                        <button type="button" className="pp-btn pp-btn-ghost pp-btn-sm" onClick={() => setMonthPreset(1)}>Tháng trước</button>
                    </div>

                    <button className="pp-btn pp-btn-primary pp-btn-sm" onClick={load} disabled={loading} style={{ marginLeft: 'auto' }}>
                        {loading ? 'Đang tải...' : 'Xem báo cáo'}
                    </button>
                </div>
            </div>

            {error && <div className="pp-alert pp-alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

            {data && (
                <>
                    {/* Summary cards */}
                    <div className="pp-stats-grid" style={{ marginBottom: 20 }}>
                        <div className="pp-stat-card success">
                            <span className="pp-stat-label">Đơn hoàn thành</span>
                            <span className="pp-stat-value">{data.completedOrders ?? 0}</span>
                            <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Đã nghiệm thu dịch vụ</span>
                        </div>
                        <div className="pp-stat-card highlight" style={{ gridColumn: 'span 2' }}>
                            <span className="pp-stat-label">Tổng giá trị đơn hoàn thành</span>
                            <span className="pp-stat-value" style={{ fontSize: 24, color: '#0f766e' }}>
                                {VND(data.completedOrderValue)}
                            </span>
                            <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Tổng doanh thu gộp trước giảm trừ</span>
                        </div>
                        <div className="pp-stat-card warning">
                            <span className="pp-stat-label">Đã hoàn tiền (khiếu nại)</span>
                            <span className="pp-stat-value" style={{ fontSize: 20, color: '#e11d48' }}>
                                - {VND(data.approvedRefundAmount)}
                            </span>
                            <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Chiếm {refundPct}% tổng giá trị</span>
                        </div>
                        <div className="pp-stat-card success" style={{ gridColumn: 'span 2' }}>
                            <span className="pp-stat-label">Doanh thu thực tế (sau hoàn tiền)</span>
                            <span className="pp-stat-value" style={{ fontSize: 26, color: '#16a34a' }}>
                                {VND(data.valueAfterApprovedRefunds)}
                            </span>
                            <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Doanh thu ròng nhà cung cấp được đối soát</span>
                        </div>
                    </div>

                    {/* Visual Revenue Breakdown Progress Bar */}
                    <div className="pp-card" style={{ marginBottom: 20, padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h3 style={{ margin: 0, fontSize: 15, color: '#1e293b', fontWeight: 600 }}>
                                📊 Tỷ trọng doanh thu & Hoàn tiền
                            </h3>
                            <span style={{ fontSize: 13, color: '#64748b' }}>
                                Tỷ lệ giữ lại thực tế: <strong style={{ color: '#16a34a' }}>{netPct}%</strong>
                            </span>
                        </div>

                        {/* Stacked bar */}
                        <div style={{
                            height: 24,
                            width: '100%',
                            background: '#f1f5f9',
                            borderRadius: 12,
                            overflow: 'hidden',
                            display: 'flex',
                            marginBottom: 12
                        }}>
                            <div
                                style={{
                                    width: `${netPct}%`,
                                    background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                                    transition: 'width 0.5s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff',
                                    fontSize: 11,
                                    fontWeight: 700
                                }}
                                title={`Doanh thu thực: ${VND(netVal)} (${netPct}%)`}
                            >
                                {netPct > 15 ? `Doanh thu thực (${netPct}%)` : ''}
                            </div>
                            {refundPct > 0 && (
                                <div
                                    style={{
                                        width: `${refundPct}%`,
                                        background: '#f43f5e',
                                        transition: 'width 0.5s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#ffffff',
                                        fontSize: 11,
                                        fontWeight: 700
                                    }}
                                    title={`Hoàn tiền: ${VND(refundVal)} (${refundPct}%)`}
                                >
                                    {refundPct > 10 ? `Hoàn ${refundPct}%` : ''}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: 20, fontSize: 12, color: '#475569' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 12, height: 12, borderRadius: 3, background: '#10b981', display: 'inline-block' }} />
                                <span>Doanh thu thực tế: <strong>{VND(netVal)}</strong></span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 12, height: 12, borderRadius: 3, background: '#f43f5e', display: 'inline-block' }} />
                                <span>Tiền đã hoàn khách: <strong>{VND(refundVal)}</strong></span>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Settlement Table */}
                    <div className="pp-card" style={{ marginBottom: 20 }}>
                        <p className="pp-card-title">Bảng kê chi tiết đối soát</p>
                        <table className="pp-table">
                            <tbody>
                                <tr>
                                    <td style={{ color: 'var(--pp-muted)', width: 280 }}>
                                        Kỳ báo cáo
                                    </td>
                                    <td>
                                        <strong>{data.fromDate}</strong> → <strong>{data.toDate}</strong>
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ color: 'var(--pp-muted)' }}>
                                        Số lượng đơn hoàn thành
                                    </td>
                                    <td><strong>{data.completedOrders}</strong> đơn hàng</td>
                                </tr>
                                <tr>
                                    <td style={{ color: 'var(--pp-muted)' }}>
                                        Tổng giá trị dịch vụ đã cung cấp
                                    </td>
                                    <td><strong>{VND(data.completedOrderValue)}</strong></td>
                                </tr>
                                <tr>
                                    <td style={{ color: 'var(--pp-muted)' }}>
                                        Khấu trừ hoàn tiền khiếu nại (Admin đã duyệt)
                                    </td>
                                    <td style={{ color: 'var(--pp-warning)' }}>
                                        <strong>- {VND(data.approvedRefundAmount)}</strong>
                                    </td>
                                </tr>
                                <tr style={{ background: '#f0fdf4' }}>
                                    <td style={{ fontWeight: 700, color: 'var(--pp-navy)' }}>
                                        Doanh thu thực nhận sau đối soát
                                    </td>
                                    <td style={{ color: 'var(--pp-success)', fontWeight: 800, fontSize: 17 }}>
                                        {VND(data.valueAfterApprovedRefunds)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {data.note && (
                            <div style={{
                                fontSize: 13,
                                color: '#1e293b',
                                marginTop: 16,
                                padding: '12px 16px',
                                background: '#f8fafc',
                                borderRadius: 8,
                                borderLeft: '4px solid #3b82f6',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10
                            }}>
                                <span style={{ fontSize: 18 }}>ℹ️</span>
                                <div>
                                    <strong>Ghi chú đối soát:</strong> {data.note}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Settlement & Commission Policy Notice */}
                    <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        padding: 16,
                        fontSize: 12.5,
                        color: '#64748b',
                        lineHeight: 1.6
                    }}>
                        <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                            📋 Quy định đối soát & chính sách thanh toán:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                            <li>Kỳ đối soát định kỳ diễn ra vào ngày 01 và 15 hàng tháng.</li>
                            <li>Các đơn hàng bị khiếu nại và được Admin chấp thuận hoàn tiền sẽ tự động được cấn trừ vào doanh thu thực nhận của đối tác.</li>
                            <li>Đơn hàng thanh toán tiền mặt (sau khi hoàn thành) do đối tác trực tiếp thu từ khách hàng, phí hoa hồng nền tảng sẽ được tổng hợp và đối soát theo hợp đồng cung cấp dịch vụ.</li>
                        </ul>
                    </div>
                </>
            )}

            {!data && !loading && !error && (
                <div className="pp-card">
                    <div className="pp-empty" style={{ padding: 40, textAlign: 'center' }}>
                        <div style={{ fontSize: 40, marginBottom: 8 }}>📊</div>
                        <p style={{ color: '#64748b' }}>Chọn khoảng thời gian và nhấn "Xem báo cáo" để tải dữ liệu đối soát.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProviderRevenue;
