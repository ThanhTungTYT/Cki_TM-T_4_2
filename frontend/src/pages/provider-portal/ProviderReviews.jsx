import { useEffect, useState } from 'react';
import { providerReviewApi } from '../../services/providerApi';

function formatDateTime(val) {
    if (!val) return '—';
    try {
        return new Date(val).toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return String(val);
    }
}

function StarRating({ rating }) {
    const stars = [];
    const r = Math.round(Number(rating) || 0);
    for (let i = 1; i <= 5; i++) {
        stars.push(
            <span
                key={i}
                style={{
                    color: i <= r ? '#f59e0b' : '#cbd5e1',
                    fontSize: 16,
                    marginRight: 2
                }}
            >
                ★
            </span>
        );
    }
    return <span>{stars}</span>;
}

function ProviderReviews() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [starFilter, setStarFilter] = useState('ALL');

    useEffect(() => {
        setLoading(true);
        providerReviewApi
            .list()
            .then((data) => setReviews(Array.isArray(data) ? data : []))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    const totalCount = reviews.length;
    const avgRating = totalCount > 0
        ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / totalCount
        : 5.0;

    const starCounts = {
        5: reviews.filter((r) => r.rating === 5).length,
        4: reviews.filter((r) => r.rating === 4).length,
        3: reviews.filter((r) => r.rating === 3).length,
        2: reviews.filter((r) => r.rating === 2).length,
        1: reviews.filter((r) => r.rating === 1).length,
    };

    const filtered = reviews.filter((r) => {
        if (starFilter === 'ALL') return true;
        return String(r.rating) === starFilter;
    });

    return (
        <>
            <div className="pp-page-header">
                <div>
                    <h1 className="pp-page-title" style={{ margin: 0 }}>
                        Đánh giá & Phản hồi khách hàng ({totalCount})
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--pp-muted)' }}>
                        Tổng hợp nhận xét, mức độ hài lòng và trải nghiệm từ khách hàng
                    </p>
                </div>
            </div>

            {error && <div className="pp-alert pp-alert-error">⚠️ {error}</div>}

            {loading && <div className="pp-loading">Đang tải đánh giá từ khách hàng...</div>}

            {!loading && !error && (
                <>
                    {/* Summary Overview Card */}
                    <div className="pp-card" style={{ marginBottom: 20 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 32, alignItems: 'center' }}>
                            {/* Left score */}
                            <div style={{ textAlign: 'center', borderRight: '1px solid var(--pp-border)', paddingRight: 24 }}>
                                <div style={{ fontSize: 44, fontWeight: 800, color: '#1e385c', lineHeight: 1 }}>
                                    {avgRating.toFixed(1)}
                                </div>
                                <div style={{ margin: '8px 0 4px' }}>
                                    <StarRating rating={avgRating} />
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--pp-muted)' }}>
                                    Dựa trên <strong>{totalCount}</strong> lượt đánh giá
                                </div>
                            </div>

                            {/* Right star bars */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {[5, 4, 3, 2, 1].map((star) => {
                                    const count = starCounts[star] || 0;
                                    const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
                                    return (
                                        <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                                            <span style={{ width: 45, fontWeight: 600, color: '#334155' }}>
                                                {star} sao
                                            </span>
                                            <div style={{
                                                flex: 1,
                                                height: 10,
                                                background: '#f1f5f9',
                                                borderRadius: 999,
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    width: `${pct}%`,
                                                    height: '100%',
                                                    background: star >= 4 ? '#16a34a' : star === 3 ? '#f59e0b' : '#ef4444',
                                                    borderRadius: 999,
                                                    transition: 'width 0.3s'
                                                }} />
                                            </div>
                                            <span style={{ width: 40, textAlign: 'right', color: 'var(--pp-muted)' }}>
                                                {count} ({pct.toFixed(0)}%)
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Filter tabs */}
                    <div className="pp-card" style={{ marginBottom: 16, padding: '12px 18px' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pp-muted)', marginRight: 6 }}>
                                Lọc theo sao:
                            </span>
                            <button
                                className={`pp-btn pp-btn-sm ${starFilter === 'ALL' ? 'pp-btn-primary' : 'pp-btn-ghost'}`}
                                onClick={() => setStarFilter('ALL')}
                            >
                                Tất cả ({totalCount})
                            </button>
                            {[5, 4, 3, 2, 1].map((s) => (
                                <button
                                    key={s}
                                    className={`pp-btn pp-btn-sm ${starFilter === String(s) ? 'pp-btn-primary' : 'pp-btn-ghost'}`}
                                    onClick={() => setStarFilter(String(s))}
                                >
                                    ★ {s} ({starCounts[s] || 0})
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Reviews list */}
                    {filtered.length === 0 ? (
                        <div className="pp-card">
                            <div className="pp-empty">
                                <p>Không có đánh giá nào phù hợp với bộ lọc.</p>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {filtered.map((r) => (
                                <div key={r.id} className="pp-card" style={{ padding: '18px 22px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{
                                                width: 38,
                                                height: 38,
                                                borderRadius: '50%',
                                                background: '#e0e7ef',
                                                color: '#1e385c',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 700,
                                                fontSize: 14
                                            }}>
                                                {(r.customerName || 'K')[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                                                    {r.customerName || 'Khách hàng'}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--pp-muted)' }}>
                                                    <span>Dịch vụ: <strong>{r.serviceName || 'Dịch vụ'}</strong></span>
                                                    {r.bookingCode && (
                                                        <span>• Đơn: <code style={{ fontSize: 11 }}>#{r.bookingCode}</code></span>
                                                    )}
                                                    {r.employeeName && (
                                                        <span>• Nhân viên: <strong>{r.employeeName}</strong></span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ textAlign: 'right' }}>
                                            <div>
                                                <StarRating rating={r.rating} />
                                            </div>
                                            <div style={{ fontSize: 11.5, color: 'var(--pp-muted)', marginTop: 2 }}>
                                                {formatDateTime(r.createdAt)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Review content */}
                                    <div style={{
                                        background: '#f8fafc',
                                        border: '1px solid #f1f5f9',
                                        borderRadius: 8,
                                        padding: '10px 14px',
                                        fontSize: 13.5,
                                        color: '#334155',
                                        lineHeight: 1.5,
                                        fontStyle: r.comment ? 'normal' : 'italic'
                                    }}>
                                        {r.comment ? `"${r.comment}"` : 'Khách hàng không để lại nhận xét bằng lời.'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </>
    );
}

export default ProviderReviews;
