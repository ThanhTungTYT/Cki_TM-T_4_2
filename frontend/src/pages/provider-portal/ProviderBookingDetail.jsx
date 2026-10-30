import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { providerBookingApi, providerEmployeeApi } from '../../services/providerApi';

const VND = (v) => (v != null ? `${Number(v).toLocaleString('vi-VN')}đ` : '—');

function statusBadge(status) {
    const map = {
        PENDING_PROVIDER: { cls: 'pp-badge-pending',   label: 'Chờ duyệt' },
        CONFIRMED:        { cls: 'pp-badge-confirmed',  label: 'Đã xác nhận' },
        ASSIGNED:         { cls: 'pp-badge-assigned',   label: 'Đã phân công' },
        COMPLETED:        { cls: 'pp-badge-completed',  label: 'Hoàn thành' },
    };
    const s = (status || '').toUpperCase();
    const found = Object.entries(map).find(([k]) => s === k || s.includes(k));
    const cfg = found ? found[1] : { cls: '', label: status || '—' };
    return <span className={`pp-badge ${cfg.cls}`}>{cfg.label}</span>;
}

function ProviderBookingDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [booking, setBooking] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionMsg, setActionMsg] = useState('');
    const [actionError, setActionError] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [assignNote, setAssignNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    function loadBooking() {
        setLoading(true);
        providerBookingApi
            .get(id)
            .then(setBooking)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        loadBooking();
        providerEmployeeApi
            .list()
            .then((data) => setEmployees(Array.isArray(data) ? data.filter(e => e.status === 'ACTIVE') : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    function clearMessages() {
        setActionMsg('');
        setActionError('');
    }

    async function handleAccept() {
        clearMessages();
        setSubmitting(true);
        try {
            await providerBookingApi.accept(id);
            setActionMsg('✅ Đã xác nhận đơn hàng thành công!');
            loadBooking();
        } catch (e) {
            setActionError(`❌ ${e.message}`);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleReject() {
        if (!rejectReason.trim()) {
            setActionError('Vui lòng nhập lý do từ chối.');
            return;
        }
        clearMessages();
        setSubmitting(true);
        try {
            await providerBookingApi.reject(id, rejectReason);
            setActionMsg('Đã từ chối đơn hàng.');
            setShowRejectModal(false);
            setRejectReason('');
            loadBooking();
        } catch (e) {
            setActionError(`❌ ${e.message}`);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleAssign() {
        if (!selectedEmployee) {
            setActionError('Vui lòng chọn nhân viên.');
            return;
        }
        clearMessages();
        setSubmitting(true);
        try {
            await providerBookingApi.assign(id, Number(selectedEmployee), assignNote);
            setActionMsg('✅ Đã phân công nhân viên thành công!');
            setShowAssignModal(false);
            setSelectedEmployee('');
            setAssignNote('');
            loadBooking();
        } catch (e) {
            setActionError(`❌ ${e.message}`);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleRemoveAssignment(assignmentId) {
        if (!window.confirm('Xóa phân công này?')) return;
        clearMessages();
        try {
            await providerBookingApi.removeAssignment(id, assignmentId);
            setActionMsg('Đã xóa phân công.');
            loadBooking();
        } catch (e) {
            setActionError(`❌ ${e.message}`);
        }
    }

    if (loading) return <div className="pp-loading">Đang tải chi tiết đơn hàng...</div>;
    if (error)   return <div className="pp-alert pp-alert-error">⚠️ {error}</div>;
    if (!booking) return null;

    const status = (booking.status || '').toUpperCase();
    const canAccept = status === 'PENDING_PROVIDER';
    const canReject = status === 'PENDING_PROVIDER';
    const canAssign = status === 'CONFIRMED' || status === 'ASSIGNED';
    const assignments = booking.assignments || [];

    return (
        <>
            <div className="pp-page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                        className="pp-btn pp-btn-ghost pp-btn-sm"
                        onClick={() => navigate('/provider-portal/bookings')}
                    >
                        ← Quay lại
                    </button>
                    <h1 className="pp-page-title" style={{ margin: 0 }}>
                        Đơn hàng #{booking.bookingCode}
                    </h1>
                </div>
                {statusBadge(booking.status)}
            </div>

            {actionMsg   && <div className="pp-alert pp-alert-success">{actionMsg}</div>}
            {actionError && <div className="pp-alert pp-alert-error">{actionError}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
                {/* Left column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Info card */}
                    <div className="pp-card">
                        <p className="pp-card-title">Thông tin đơn hàng</p>
                        <table className="pp-table">
                            <tbody>
                                <tr><td style={{ color: 'var(--pp-muted)', width: 160 }}>Khách hàng</td><td><strong>{booking.customerName || '—'}</strong></td></tr>
                                <tr><td style={{ color: 'var(--pp-muted)' }}>Số điện thoại</td><td>{booking.customerPhone || '—'}</td></tr>
                                <tr><td style={{ color: 'var(--pp-muted)' }}>Ngày thực hiện</td><td>{booking.scheduledStart ? new Date(booking.scheduledStart).toLocaleString('vi-VN') : '—'}</td></tr>
                                <tr><td style={{ color: 'var(--pp-muted)' }}>Kết thúc dự kiến</td><td>{booking.scheduledEnd ? new Date(booking.scheduledEnd).toLocaleString('vi-VN') : '—'}</td></tr>
                                <tr><td style={{ color: 'var(--pp-muted)' }}>Ngày đặt</td><td>{booking.createdAt ? new Date(booking.createdAt).toLocaleString('vi-VN') : '—'}</td></tr>
                                {booking.cancelReason && <tr><td style={{ color: 'var(--pp-muted)' }}>Lý do hủy</td><td style={{ color: 'var(--pp-danger)' }}>{booking.cancelReason}</td></tr>}
                            </tbody>
                        </table>
                    </div>

                    {/* Items */}
                    {booking.items?.length > 0 && (
                        <div className="pp-card">
                            <p className="pp-card-title">Dịch vụ đã đặt</p>
                            <div className="pp-table-wrap">
                                <table className="pp-table">
                                    <thead>
                                        <tr>
                                            <th>Dịch vụ</th>
                                            <th>SL</th>
                                            <th>Đơn giá</th>
                                            <th>Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {booking.items.map((item, i) => (
                                            <tr key={i}>
                                                <td>{item.serviceName}</td>
                                                <td>{item.quantity}</td>
                                                <td>{VND(item.unitPrice)}</td>
                                                <td><strong>{VND(item.totalPrice)}</strong></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Assignments */}
                    <div className="pp-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <p className="pp-card-title" style={{ margin: 0 }}>
                                Phân công nhân viên ({assignments.length})
                            </p>
                            {canAssign && (
                                <button
                                    className="pp-btn pp-btn-primary pp-btn-sm"
                                    onClick={() => setShowAssignModal(true)}
                                >
                                    + Thêm nhân viên
                                </button>
                            )}
                        </div>

                        {assignments.length === 0 ? (
                            <div className="pp-empty" style={{ padding: '20px 0' }}>
                                <p>Chưa có nhân viên nào được phân công.</p>
                            </div>
                        ) : (
                            <div className="pp-table-wrap">
                                <table className="pp-table">
                                    <thead>
                                        <tr>
                                            <th>Mã NV</th>
                                            <th>Nhân viên</th>
                                            <th>Trạng thái</th>
                                            <th>Ghi chú</th>
                                            {canAssign && <th></th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assignments.map((a) => (
                                            <tr key={a.id}>
                                                <td>{a.employeeCode || '—'}</td>
                                                <td>{a.employeeName || '—'}</td>
                                                <td>
                                                    <span className="pp-badge pp-badge-confirmed">
                                                        {a.status}
                                                    </span>
                                                </td>
                                                <td>{a.note || '—'}</td>
                                                {canAssign && (
                                                    <td>
                                                        <button
                                                            className="pp-btn pp-btn-danger pp-btn-sm"
                                                            onClick={() => handleRemoveAssignment(a.id)}
                                                        >
                                                            Xóa
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right column — actions */}
                <div>
                    <div className="pp-card">
                        <p className="pp-card-title">Thao tác</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ color: 'var(--pp-muted)', fontSize: 13 }}>Tổng tiền</span>
                                <strong style={{ fontSize: 18, color: 'var(--pp-navy)' }}>
                                    {VND(booking.totalAmount)}
                                </strong>
                            </div>

                            {canAccept && (
                                <button
                                    className="pp-btn pp-btn-success"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                    onClick={handleAccept}
                                    disabled={submitting}
                                >
                                    ✓ Xác nhận đơn hàng
                                </button>
                            )}

                            {canReject && (
                                <button
                                    className="pp-btn pp-btn-danger"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                    onClick={() => setShowRejectModal(true)}
                                    disabled={submitting}
                                >
                                    ✕ Từ chối đơn hàng
                                </button>
                            )}

                            {!canAccept && !canReject && (
                                <p style={{ color: 'var(--pp-muted)', fontSize: 13, textAlign: 'center' }}>
                                    Không có thao tác khả dụng ở trạng thái này.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Reject modal */}
            {showRejectModal && (
                <div className="pp-modal-overlay">
                    <div className="pp-modal">
                        <div className="pp-modal-header">
                            <span className="pp-modal-title">Từ chối đơn hàng</span>
                            <button className="pp-modal-close" onClick={() => setShowRejectModal(false)}>×</button>
                        </div>
                        <div className="pp-modal-body">
                            <div className="pp-form-group">
                                <label className="pp-label">Lý do từ chối *</label>
                                <textarea
                                    className="pp-textarea"
                                    placeholder="Nhập lý do từ chối đơn hàng..."
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                />
                            </div>
                            {actionError && <div className="pp-alert pp-alert-error">{actionError}</div>}
                        </div>
                        <div className="pp-modal-footer">
                            <button className="pp-btn pp-btn-ghost" onClick={() => setShowRejectModal(false)}>Hủy</button>
                            <button
                                className="pp-btn pp-btn-danger"
                                onClick={handleReject}
                                disabled={submitting}
                            >
                                Xác nhận từ chối
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign modal */}
            {showAssignModal && (
                <div className="pp-modal-overlay">
                    <div className="pp-modal">
                        <div className="pp-modal-header">
                            <span className="pp-modal-title">Phân công nhân viên</span>
                            <button className="pp-modal-close" onClick={() => setShowAssignModal(false)}>×</button>
                        </div>
                        <div className="pp-modal-body">
                            <div className="pp-form-group">
                                <label className="pp-label">Chọn nhân viên *</label>
                                <select
                                    className="pp-select"
                                    value={selectedEmployee}
                                    onChange={(e) => setSelectedEmployee(e.target.value)}
                                >
                                    <option value="">— Chọn nhân viên —</option>
                                    {employees.map((emp) => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.employeeCode} — {emp.fullName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="pp-form-group">
                                <label className="pp-label">Ghi chú</label>
                                <textarea
                                    className="pp-textarea"
                                    placeholder="Ghi chú thêm (không bắt buộc)"
                                    value={assignNote}
                                    onChange={(e) => setAssignNote(e.target.value)}
                                />
                            </div>
                            {actionError && <div className="pp-alert pp-alert-error">{actionError}</div>}
                        </div>
                        <div className="pp-modal-footer">
                            <button className="pp-btn pp-btn-ghost" onClick={() => setShowAssignModal(false)}>Hủy</button>
                            <button
                                className="pp-btn pp-btn-primary"
                                onClick={handleAssign}
                                disabled={submitting}
                            >
                                Phân công
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default ProviderBookingDetail;
