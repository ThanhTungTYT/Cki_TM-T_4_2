import { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { adminProviderChangeRequestApi } from '../../services/providerApi';

function AdminProviderChangeRequests() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [msg, setMsg] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Modal detail & action
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectInput, setShowRejectInput] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [modalError, setModalError] = useState('');

    function loadRequests() {
        setLoading(true);
        setError('');
        adminProviderChangeRequestApi
            .list(statusFilter)
            .then((data) => setRequests(Array.isArray(data) ? data : []))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        loadRequests();
    }, [statusFilter]); // eslint-disable-line

    function openModal(req) {
        setSelectedRequest(req);
        setRejectReason('');
        setShowRejectInput(false);
        setModalError('');
    }

    async function handleApprove() {
        if (!window.confirm(`Xác nhận PHÊ DUYỆT yêu cầu #${selectedRequest.id} và cập nhật hồ sơ đối tác?`)) return;
        setSubmitting(true);
        setModalError('');
        try {
            await adminProviderChangeRequestApi.approve(selectedRequest.id);
            setMsg(`✅ Đã phê duyệt yêu cầu #${selectedRequest.id} thành công!`);
            setSelectedRequest(null);
            loadRequests();
        } catch (e) {
            setModalError(e.message);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleReject() {
        if (!rejectReason.trim()) {
            setModalError('Vui lòng nhập lý do từ chối.');
            return;
        }
        setSubmitting(true);
        setModalError('');
        try {
            await adminProviderChangeRequestApi.reject(selectedRequest.id, rejectReason.trim());
            setMsg(`Đã từ chối yêu cầu #${selectedRequest.id}.`);
            setSelectedRequest(null);
            loadRequests();
        } catch (e) {
            setModalError(e.message);
        } finally {
            setSubmitting(false);
        }
    }

    function statusBadge(s) {
        const map = {
            PENDING_REVIEW: { cls: 'badge-warning', label: 'Chờ duyệt' },
            APPROVED:       { cls: 'badge-success', label: 'Đã duyệt' },
            REJECTED:       { cls: 'badge-danger',  label: 'Bị từ chối' },
            WITHDRAWN:      { cls: 'badge-secondary', label: 'Đã rút' },
        };
        const cfg = map[(s || '').toUpperCase()] || { cls: '', label: s || '—' };
        return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
    }

    function formatType(type) {
        switch (type) {
            case 'LOCATION_UPDATE': return '📍 Thay đổi vị trí / Tọa độ';
            case 'PROFILE_UPDATE':  return '🏢 Thay đổi thông tin công ty';
            case 'SERVICE_REGISTER':return '➕ Đăng ký dịch vụ mới';
            case 'SERVICE_UPDATE':  return '💵 Điều chỉnh giá dịch vụ';
            default: return type;
        }
    }

    function renderSnapshotTable(oldStr, newStr) {
        const parsePairs = (str) => {
            const map = {};
            if (!str) return map;
            str.replace(/[{}]/g, '').split(';').forEach(p => {
                const [k, v] = p.split('=');
                if (k && v !== undefined) map[k.trim()] = v.trim();
            });
            return map;
        };

        const oldMap = parsePairs(oldStr);
        const newMap = parsePairs(newStr);
        const keys = Array.from(new Set([...Object.keys(oldMap), ...Object.keys(newMap)]));

        return (
            <table className="admin-table" style={{ fontSize: 13, marginTop: 8 }}>
                <thead>
                    <tr>
                        <th>Trường thông tin</th>
                        <th>Dữ liệu hiện hành (Trước)</th>
                        <th>Dữ liệu đề xuất (Sau)</th>
                    </tr>
                </thead>
                <tbody>
                    {keys.map((k) => (
                        <tr key={k}>
                            <td><strong>{k}</strong></td>
                            <td style={{ color: '#b91c1c', textDecoration: 'line-through' }}>{oldMap[k] || '—'}</td>
                            <td style={{ color: '#15803d', fontWeight: 600 }}>{newMap[k] || '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    return (
        <AdminLayout>
            <div className="admin-header">
                <div>
                    <h1>Xét duyệt yêu cầu từ Đối tác</h1>
                    <p>Phê duyệt hoặc từ chối các đề xuất thay đổi vị trí, thông tin công ty và dịch vụ của đối tác</p>
                </div>
            </div>

            {msg && <div className="alert alert-success" style={{ padding: '12px 18px', borderRadius: 8, background: '#dcfce7', color: '#166534', marginBottom: 16 }}>{msg}</div>}
            {error && <div className="alert alert-danger" style={{ padding: '12px 18px', borderRadius: 8, background: '#fee2e2', color: '#991b1b', marginBottom: 16 }}>⚠️ {error}</div>}

            {/* Filter toolbar */}
            <div className="admin-card" style={{ marginBottom: 16, padding: '14px 20px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Trạng thái:</span>
                    <select
                        className="admin-select"
                        style={{ maxWidth: 220 }}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">Tất cả trạng thái</option>
                        <option value="PENDING_REVIEW">Chờ duyệt (PENDING_REVIEW)</option>
                        <option value="APPROVED">Đã phê duyệt (APPROVED)</option>
                        <option value="REJECTED">Bị từ chối (REJECTED)</option>
                        <option value="WITHDRAWN">Đã rút (WITHDRAWN)</option>
                    </select>
                    <button className="admin-btn admin-btn-outline" onClick={loadRequests}>
                        Làm mới
                    </button>
                </div>
            </div>

            {loading && <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Đang tải danh sách yêu cầu...</div>}

            {!loading && (
                <div className="admin-card" style={{ padding: 0 }}>
                    {requests.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                            Không có yêu cầu nào phù hợp bộ lọc.
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Mã #</th>
                                        <th>Đối tác</th>
                                        <th>Loại thay đổi</th>
                                        <th>Lý do đề nghị</th>
                                        <th>Ngày gửi</th>
                                        <th>Trạng thái</th>
                                        <th>Xử lý</th>
                                        <th>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {requests.map((r) => (
                                        <tr key={r.id}>
                                            <td><strong>#{r.id}</strong></td>
                                            <td>
                                                <strong>{r.businessName || '—'}</strong>
                                                <div style={{ fontSize: 11, color: '#64748b' }}>Mã đối tác: #{r.partnerId}</div>
                                            </td>
                                            <td>{formatType(r.requestType)}</td>
                                            <td style={{ maxWidth: 240 }}>{r.reason}</td>
                                            <td>{r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '—'}</td>
                                            <td>{statusBadge(r.status)}</td>
                                            <td>
                                                {r.reviewedBy && (
                                                    <span style={{ fontSize: 12, color: '#64748b' }}>
                                                        {r.reviewedBy} • {r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString('vi-VN') : ''}
                                                    </span>
                                                )}
                                                {r.rejectReason && (
                                                    <div style={{ fontSize: 11, color: '#dc2626' }}>
                                                        {r.rejectReason}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <button
                                                    className="admin-btn admin-btn-sm"
                                                    onClick={() => openModal(r)}
                                                >
                                                    Chi tiết & Duyệt →
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

            {/* MODAL CHI TIẾT & XÉT DUYỆT */}
            {selectedRequest && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20
                }}>
                    <div style={{
                        background: '#fff', borderRadius: 12, width: '100%', maxWidth: 640,
                        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', padding: 24
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: 14, marginBottom: 16 }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 18, color: '#1e385c' }}>
                                    Xét duyệt yêu cầu #{selectedRequest.id}
                                </h3>
                                <span style={{ fontSize: 12, color: '#64748b' }}>
                                    Đối tác: <strong>{selectedRequest.businessName}</strong> • {formatType(selectedRequest.requestType)}
                                </span>
                            </div>
                            <button
                                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#64748b' }}
                                onClick={() => setSelectedRequest(null)}
                            >×</button>
                        </div>

                        {modalError && (
                            <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: 6, marginBottom: 14 }}>
                                ⚠️ {modalError}
                            </div>
                        )}

                        <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Lý do đề nghị từ Đối tác:</div>
                            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 6, fontSize: 13.5, fontStyle: 'italic', border: '1px solid #e2e8f0' }}>
                                "{selectedRequest.reason}"
                            </div>
                        </div>

                        {/* So sánh trước vs sau */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e385c', marginBottom: 6 }}>
                                Bảng đối chiếu thay đổi (Trước → Sau):
                            </div>
                            {renderSnapshotTable(selectedRequest.oldSnapshot, selectedRequest.proposedSnapshot)}
                        </div>

                        {selectedRequest.evidenceUrl && (
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Bằng chứng đính kèm:</div>
                                <a
                                    href={selectedRequest.evidenceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: 13, color: '#2563eb', textDecoration: 'underline' }}
                                >
                                    📎 Mở tệp bằng chứng của đối tác
                                </a>
                            </div>
                        )}

                        {/* Ô nhập lý do từ chối nếu bấm từ chối */}
                        {showRejectInput && (
                            <div style={{ marginBottom: 16, background: '#fff5f5', padding: 14, borderRadius: 8, border: '1px solid #fecaca' }}>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>
                                    Lý do từ chối đề nghị *
                                </label>
                                <textarea
                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #fca5a5', fontSize: 13, boxSizing: 'border-box' }}
                                    rows={3}
                                    placeholder="Nêu rõ lý do từ chối để đối tác nắm rõ..."
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                />
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                            <button
                                className="admin-btn admin-btn-ghost"
                                onClick={() => setSelectedRequest(null)}
                            >
                                Đóng
                            </button>

                            {selectedRequest.status === 'PENDING_REVIEW' && (
                                <>
                                    {!showRejectInput ? (
                                        <button
                                            className="admin-btn admin-btn-danger"
                                            onClick={() => setShowRejectInput(true)}
                                            disabled={submitting}
                                        >
                                            Từ chối...
                                        </button>
                                    ) : (
                                        <button
                                            className="admin-btn admin-btn-danger"
                                            onClick={handleReject}
                                            disabled={submitting}
                                        >
                                            {submitting ? 'Đang xử lý...' : 'Xác nhận Từ chối'}
                                        </button>
                                    )}

                                    {!showRejectInput && (
                                        <button
                                            className="admin-btn admin-btn-success"
                                            onClick={handleApprove}
                                            disabled={submitting}
                                        >
                                            {submitting ? 'Đang duyệt...' : '✓ Phê duyệt yêu cầu'}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}

export default AdminProviderChangeRequests;
