import { useEffect, useState } from 'react';
import { providerComplaintsApi } from '../../services/providerApi';

function ProviderComplaints() {
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('');
    const [msg, setMsg] = useState('');

    // Modal Chi tiết & Giải trình
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [ticketDetail, setTicketDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [responseText, setResponseText] = useState('');
    const [evidenceUrl, setEvidenceUrl] = useState('');
    const [submittingResp, setSubmittingResp] = useState(false);
    const [respError, setRespError] = useState('');

    function loadComplaints() {
        setLoading(true);
        setError('');
        providerComplaintsApi
            .list()
            .then((data) => setComplaints(Array.isArray(data) ? data : []))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        loadComplaints();
    }, []);

    function openDetail(ticket) {
        setSelectedTicket(ticket);
        setTicketDetail(null);
        setDetailLoading(true);
        setResponseText('');
        setEvidenceUrl('');
        setRespError('');

        providerComplaintsApi
            .get(ticket.id)
            .then((data) => setTicketDetail(data))
            .catch((e) => setRespError(e.message))
            .finally(() => setDetailLoading(false));
    }

    async function handleSubmitResponse() {
        setRespError('');
        if (!responseText.trim()) {
            setRespError('Vui lòng nhập nội dung giải trình.');
            return;
        }

        setSubmittingResp(true);
        try {
            await providerComplaintsApi.respond(selectedTicket.id, {
                content: responseText.trim(),
                evidenceUrl: evidenceUrl.trim() || null,
            });
            setMsg('✅ Đã gửi giải trình thành công! Staff/Admin sẽ tiếp nhận và thẩm định.');
            setResponseText('');
            setEvidenceUrl('');
            // Reload detail
            const updated = await providerComplaintsApi.get(selectedTicket.id);
            setTicketDetail(updated);
            loadComplaints();
        } catch (e) {
            setRespError(e.message);
        } finally {
            setSubmittingResp(false);
        }
    }

    function statusBadge(s) {
        const map = {
            OPEN: { cls: 'pp-badge-pending', label: 'Mới nhận' },
            WAITING_PROVIDER: { cls: 'pp-badge-warning', label: 'Chờ đối tác' },
            PROVIDER_RESPONDED: { cls: 'pp-badge-confirmed', label: 'Đã giải trình' },
            IN_PROGRESS: { cls: 'pp-badge-assigned', label: 'Đang xác minh' },
            RESOLVED: { cls: 'pp-badge-completed', label: 'Đã kết luận' },
            REJECTED: { cls: 'pp-badge-cancelled', label: 'Bị bác bỏ' },
        };
        const cfg = map[(s || '').toUpperCase()] || { cls: '', label: s || '—' };
        return <span className={`pp-badge ${cfg.cls}`}>{cfg.label}</span>;
    }

    const filtered = complaints.filter((c) => {
        if (!filter) return true;
        return (c.status || '').toUpperCase() === filter;
    });

    return (
        <>
            <div className="pp-page-header">
                <div>
                    <h1 className="pp-page-title">Quản lý khiếu nại ({filtered.length})</h1>
                    <span style={{ fontSize: 13, color: 'var(--pp-muted)' }}>
                        Theo dõi và phối hợp giải trình các khiếu nại liên quan đến đơn hàng của đối tác
                    </span>
                </div>
            </div>

            {msg && <div className="pp-alert pp-alert-success">{msg}</div>}
            {error && <div className="pp-alert pp-alert-error">⚠️ {error}</div>}

            {/* Filter */}
            <div className="pp-card" style={{ marginBottom: 16, padding: '12px 20px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Lọc theo trạng thái:</span>
                    <select
                        className="pp-select"
                        style={{ maxWidth: 200 }}
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    >
                        <option value="">Tất cả trạng thái</option>
                        <option value="OPEN">Mới nhận (OPEN)</option>
                        <option value="WAITING_PROVIDER">Chờ đối tác phản hồi</option>
                        <option value="PROVIDER_RESPONDED">Đã gửi giải trình</option>
                        <option value="IN_PROGRESS">Đang xác minh</option>
                        <option value="RESOLVED">Đã kết luận</option>
                        <option value="REJECTED">Bị bác bỏ</option>
                    </select>
                </div>
            </div>

            {loading && <div className="pp-loading">Đang tải danh sách khiếu nại...</div>}

            {!loading && (
                <div className="pp-card" style={{ padding: 0 }}>
                    {filtered.length === 0 ? (
                        <div className="pp-empty">
                            <p>Không có hồ sơ khiếu nại nào theo bộ lọc đã chọn.</p>
                        </div>
                    ) : (
                        <div className="pp-table-wrap">
                            <table className="pp-table">
                                <thead>
                                    <tr>
                                        <th>Mã #</th>
                                        <th>Mã đơn hàng</th>
                                        <th>Khách hàng</th>
                                        <th>Tiêu đề khiếu nại</th>
                                        <th>Thời gian gửi</th>
                                        <th>Trạng thái</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((item) => (
                                        <tr key={item.id}>
                                            <td><strong>#{item.id}</strong></td>
                                            <td><strong>{item.bookingCode || '—'}</strong></td>
                                            <td>{item.reporterName || '—'}</td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{item.subject}</div>
                                                <div style={{ fontSize: 12, color: 'var(--pp-muted)' }}>
                                                    Danh mục: {item.category}
                                                </div>
                                            </td>
                                            <td>{item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '—'}</td>
                                            <td>{statusBadge(item.status)}</td>
                                            <td>
                                                <button
                                                    className="pp-btn pp-btn-outline pp-btn-sm"
                                                    onClick={() => openDetail(item)}
                                                >
                                                    Xem & Giải trình →
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL CHI TIẾT & GIẢI TRÌNH */}
            {selectedTicket && (
                <div className="pp-modal-overlay">
                    <div className="pp-modal" style={{ maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="pp-modal-header">
                            <div>
                                <span className="pp-modal-title">
                                    Hồ sơ khiếu nại #{selectedTicket.id}
                                </span>
                                <div style={{ fontSize: 12, color: 'var(--pp-muted)' }}>
                                    Đơn hàng #{selectedTicket.bookingCode || '—'}
                                </div>
                            </div>
                            <button className="pp-modal-close" onClick={() => setSelectedTicket(null)}>×</button>
                        </div>

                        <div className="pp-modal-body" style={{ overflowY: 'auto' }}>
                            {detailLoading && <div className="pp-loading">Đang tải chi tiết khiếu nại...</div>}

                            {respError && <div className="pp-alert pp-alert-error">{respError}</div>}

                            {ticketDetail && (
                                <>
                                    {/* Khối phản ánh của khách */}
                                    <div className="pp-bubble customer" style={{ width: '100%', marginBottom: 16 }}>
                                        <div className="pp-bubble-header">
                                            <strong>👤 {ticketDetail.reporterName || 'Khách hàng'}</strong>
                                            <span>{ticketDetail.createdAt ? new Date(ticketDetail.createdAt).toLocaleString('vi-VN') : ''}</span>
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pp-navy)', marginBottom: 4 }}>
                                            Tiêu đề: {ticketDetail.subject}
                                        </div>
                                        <div className="pp-bubble-content">
                                            {ticketDetail.description}
                                        </div>
                                        {ticketDetail.evidenceUrl && (
                                            <div style={{ marginTop: 8 }}>
                                                <a
                                                    href={ticketDetail.evidenceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ fontSize: 12, color: 'var(--pp-primary)', textDecoration: 'underline' }}
                                                >
                                                    📎 Xem tệp bằng chứng đính kèm
                                                </a>
                                            </div>
                                        )}
                                    </div>

                                    {/* Kết luận của Staff nếu có */}
                                    {ticketDetail.resolution && (
                                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pp-success)', textTransform: 'uppercase', marginBottom: 4 }}>
                                                Kết luận từ Staff/Admin ({ticketDetail.handledBy || 'Hệ thống'})
                                            </div>
                                            <div style={{ fontSize: 13.5 }}>
                                                {ticketDetail.resolution}
                                            </div>
                                        </div>
                                    )}

                                    {/* Dòng thời gian các giải trình trước đó */}
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pp-navy)', marginBottom: 8 }}>
                                            Lịch sử giải trình & phản hồi ({ticketDetail.responses?.length || 0})
                                        </div>
                                        {(!ticketDetail.responses || ticketDetail.responses.length === 0) ? (
                                            <div style={{ fontSize: 12.5, color: 'var(--pp-muted)', fontStyle: 'italic' }}>
                                                Chưa có phản hồi nào được ghi nhận cho khiếu nại này.
                                            </div>
                                        ) : (
                                            <div className="pp-timeline">
                                                {ticketDetail.responses.map((r) => (
                                                    <div key={r.id} className={`pp-bubble ${r.authorRole?.toLowerCase() === 'provider' ? 'provider' : 'staff'}`}>
                                                        <div className="pp-bubble-header">
                                                            <strong>
                                                                {r.authorRole === 'PROVIDER' ? '🏢 ' : '🛡️ '}
                                                                {r.authorName || r.authorRole}
                                                            </strong>
                                                            <span>{r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : ''}</span>
                                                        </div>
                                                        <div className="pp-bubble-content">
                                                            {r.content}
                                                        </div>
                                                        {r.evidenceUrl && (
                                                            <div style={{ marginTop: 6 }}>
                                                                <a
                                                                    href={r.evidenceUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    style={{ fontSize: 12, color: 'var(--pp-primary)', textDecoration: 'underline' }}
                                                                >
                                                                    📎 Bằng chứng đính kèm
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Form gửi giải trình mới */}
                                    {ticketDetail.status !== 'RESOLVED' && ticketDetail.status !== 'REJECTED' && (
                                        <div style={{ borderTop: '1px solid var(--pp-border)', paddingTop: 14 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pp-navy)', marginBottom: 8 }}>
                                                Gửi giải trình từ Đối tác
                                            </div>
                                            <div className="pp-form-group">
                                                <label className="pp-label">Nội dung giải trình *</label>
                                                <textarea
                                                    className="pp-textarea"
                                                    placeholder="Trình bày chi tiết quá trình thực hiện công việc, nguyên nhân và đề xuất phương án..."
                                                    value={responseText}
                                                    onChange={(e) => setResponseText(e.target.value)}
                                                />
                                            </div>
                                            <div className="pp-form-group">
                                                <label className="pp-label">Link bằng chứng / ảnh kiểm chứng (nếu có)</label>
                                                <input
                                                    className="pp-input"
                                                    placeholder="https://..."
                                                    value={evidenceUrl}
                                                    onChange={(e) => setEvidenceUrl(e.target.value)}
                                                />
                                            </div>
                                            <p style={{ fontSize: 11.5, color: 'var(--pp-muted)', background: '#fffbeb', padding: '8px 12px', borderRadius: 6, margin: 0, border: '1px solid #fef3c7' }}>
                                                ⚠️ <strong>Lưu ý:</strong> Đối tác không có quyền tự đóng khiếu nại hay xử lý hoàn tiền. Staff sàn sẽ xem xét giải trình và đưa ra kết luận xử lý.
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="pp-modal-footer">
                            <button className="pp-btn pp-btn-ghost" onClick={() => setSelectedTicket(null)}>Đóng</button>
                            {ticketDetail && ticketDetail.status !== 'RESOLVED' && ticketDetail.status !== 'REJECTED' && (
                                <button
                                    className="pp-btn pp-btn-primary"
                                    onClick={handleSubmitResponse}
                                    disabled={submittingResp}
                                >
                                    {submittingResp ? 'Đang gửi...' : 'Gửi giải trình'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default ProviderComplaints;
