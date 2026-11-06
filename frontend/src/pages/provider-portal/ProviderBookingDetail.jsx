import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { providerBookingApi } from '../../services/providerApi';

const VND = (v) => (v != null ? `${Number(v).toLocaleString('vi-VN')}đ` : '—');

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

const ASSIGNMENT_STATUS_MAP = {
    ASSIGNED:       { cls: 'pp-badge-assigned',   label: 'Đã giao' },
    ACCEPTED:       { cls: 'pp-badge-confirmed',  label: 'Đã nhận' },
    EN_ROUTE:       { cls: 'pp-badge-progress',   label: 'Đang di chuyển' },
    IN_PROGRESS:    { cls: 'pp-badge-progress',   label: 'Đang làm' },
    WORK_SUBMITTED: { cls: 'pp-badge-waiting',    label: 'Đã báo xong' },
    COMPLETED:      { cls: 'pp-badge-completed',  label: 'Hoàn thành' },
    DECLINED:       { cls: 'pp-badge-cancelled',  label: 'Từ chối' },
    CANCELLED:      { cls: 'pp-badge-cancelled',  label: 'Đã hủy' },
};

const STATUS_CONFIG = {
    PENDING_PROVIDER:      { cls: 'pp-badge-pending',   label: 'Chờ duyệt' },
    CONFIRMED:             { cls: 'pp-badge-confirmed', label: 'Đã xác nhận' },
    ASSIGNED:              { cls: 'pp-badge-assigned',  label: 'Đã phân công' },
    EN_ROUTE:              { cls: 'pp-badge-progress',  label: 'Đang di chuyển' },
    IN_PROGRESS:           { cls: 'pp-badge-progress',  label: 'Đang thực hiện' },
    PENDING_COMPLETION:    { cls: 'pp-badge-waiting',   label: 'Chờ nghiệm thu' },
    COMPLETED:             { cls: 'pp-badge-completed', label: 'Hoàn thành' },
    EXPIRED:               { cls: 'pp-badge-cancelled', label: 'Quá hạn tiếp nhận' },
    CANCELLED:             { cls: 'pp-badge-cancelled', label: 'Đã hủy' },
    REJECTED:              { cls: 'pp-badge-cancelled', label: 'Bị từ chối' },
    CANCELLED_BY_CUSTOMER: { cls: 'pp-badge-cancelled', label: 'KH hủy' },
    CANCELLED_BY_PROVIDER: { cls: 'pp-badge-cancelled', label: 'NCC hủy' },
    CANCELLED_BY_ADMIN:    { cls: 'pp-badge-cancelled', label: 'Admin hủy' },
};

function statusBadge(status) {
    const s = (status || '').toUpperCase();
    const cfg = STATUS_CONFIG[s] || { cls: '', label: status || '—' };
    return <span className={`pp-badge ${cfg.cls}`}>{cfg.label}</span>;
}

function calculateDeadlineRemaining(deadlineAt) {
    if (!deadlineAt) return null;
    const diff = new Date(deadlineAt).getTime() - Date.now();
    if (diff <= 0) {
        return { expired: true, text: 'Đã hết hạn tiếp nhận' };
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return {
        expired: false,
        text: hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút ${seconds} giây`,
    };
}

function ProviderBookingDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [booking, setBooking] = useState(null);
    const [availableData, setAvailableData] = useState({
        serviceDate: '',
        totalEmployees: 0,
        availableCount: 0,
        busyCount: 0,
        employees: []
    });
    const [, setLoadingAvailable] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionMsg, setActionMsg] = useState('');
    const [actionError, setActionError] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [assignNote, setAssignNote] = useState('');
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [ticker, setTicker] = useState(0);

    // Live tick for countdown timer
    useEffect(() => {
        const timer = setInterval(() => {
            setTicker((t) => t + 1);
        }, 10000);
        return () => clearInterval(timer);
    }, []);

    function loadAvailableEmployees() {
        setLoadingAvailable(true);
        providerBookingApi
            .getAvailableEmployees(id)
            .then((data) => {
                if (data && Array.isArray(data.employees)) {
                    setAvailableData(data);
                }
            })
            .catch((err) => {
                console.error('Không thể tải danh sách nhân viên khả dụng:', err);
            })
            .finally(() => setLoadingAvailable(false));
    }

    function loadBooking() {
        setLoading(true);
        providerBookingApi
            .get(id)
            .then((b) => {
                setBooking(b);
                loadAvailableEmployees();
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        loadBooking();
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


    async function handleCancel() {
        if (!cancelReason.trim()) {
            setActionError('Vui lòng nhập lý do hủy đơn hàng.');
            return;
        }
        clearMessages();
        setSubmitting(true);
        try {
            await providerBookingApi.cancel(id, cancelReason);
            setActionMsg('Đã hủy đơn hàng thành công.');
            setShowCancelModal(false);
            setCancelReason('');
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
    const canAssign = status === 'PENDING_PROVIDER' || status === 'CONFIRMED' || status === 'ASSIGNED';
    const canCancel = status === 'CONFIRMED' || status === 'ASSIGNED';
    const assignments = booking.assignments || [];
    const declinedAssignments = assignments.filter((a) => (a.status || '').toUpperCase() === 'DECLINED');

    // Deadline calculation
    const deadlineRemaining = status === 'PENDING_PROVIDER' && booking.providerDeadlineAt
        ? calculateDeadlineRemaining(booking.providerDeadlineAt)
        : null;

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

            {/* Warning banner: Cleaner declined */}
            {declinedAssignments.length > 0 && (
                <div style={{
                    background: '#fffbeb',
                    border: '1px solid #fef3c7',
                    borderLeft: '4px solid #f59e0b',
                    borderRadius: 8,
                    padding: '14px 18px',
                    marginBottom: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 18 }}>⚠️</span>
                            <strong style={{ color: '#b45309', fontSize: 14 }}>
                                Nhân viên đã từ chối nhận việc
                            </strong>
                        </div>
                        {declinedAssignments.map((da) => (
                            <div key={da.id} style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                                • Nhân viên: <strong>{da.employeeName || da.employeeCode}</strong> ({da.employeeCode})
                                {da.note && (
                                    <span> — Lý do từ chối: <strong style={{ color: '#dc2626' }}>"{da.note}"</strong></span>
                                )}
                            </div>
                        ))}
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>
                            Đơn hàng hiện đang ở trạng thái xác nhận để bạn phân công nhân viên khác thay thế kịp thời.
                        </div>
                    </div>
                    {canAssign && (
                        <button
                            className="pp-btn pp-btn-primary"
                            style={{ flexShrink: 0, marginLeft: 16 }}
                            onClick={() => {
                                clearMessages();
                                loadAvailableEmployees();
                                setShowAssignModal(true);
                            }}
                        >
                            🔄 Phân công nhân viên khác
                        </button>
                    )}
                </div>
            )}

            {/* Countdown / Deadline banner for PENDING_PROVIDER */}
            {status === 'PENDING_PROVIDER' && booking.providerDeadlineAt && deadlineRemaining && (
                <div style={{
                    background: deadlineRemaining.expired ? '#fef2f2' : '#eff6ff',
                    border: deadlineRemaining.expired ? '1px solid #fecaca' : '1px solid #bfdbfe',
                    borderLeft: deadlineRemaining.expired ? '4px solid #ef4444' : '4px solid #3b82f6',
                    borderRadius: 8,
                    padding: '14px 18px',
                    marginBottom: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 18 }}>{deadlineRemaining.expired ? '⏰' : '⏳'}</span>
                            <strong style={{ color: deadlineRemaining.expired ? '#991b1b' : '#1e40af', fontSize: 14 }}>
                                {deadlineRemaining.expired ? 'Đã quá thời hạn tiếp nhận đơn hàng!' : 'Thời hạn tiếp nhận đơn hàng'}
                            </strong>
                        </div>
                        <div style={{ fontSize: 13, color: '#334155' }}>
                            {deadlineRemaining.expired ? (
                                <span>Hạn chót tiếp nhận lúc <strong>{formatDateTime(booking.providerDeadlineAt)}</strong> đã qua. Đơn hàng sẽ bị hủy tự động.</span>
                            ) : (
                                <span>
                                    Thời gian còn lại để duyệt: <strong style={{ color: '#2563eb', fontSize: 14 }}>{deadlineRemaining.text}</strong> (Hạn chót: {formatDateTime(booking.providerDeadlineAt)})
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                            {booking.paymentMethod === 'CASH'
                                ? '• Đơn thanh toán tiền mặt: hệ thống sẽ hủy và gửi thông báo cho khách hàng.'
                                : '• Đơn thanh toán trực tuyến: hệ thống sẽ hủy và xử lý hoàn tiền cho khách hàng.'}
                        </div>
                    </div>
                    {canAccept && !deadlineRemaining.expired && (
                        <button
                            className="pp-btn pp-btn-success"
                            style={{ flexShrink: 0, marginLeft: 16 }}
                            onClick={handleAccept}
                            disabled={submitting}
                        >
                            ✓ Xác nhận ngay
                        </button>
                    )}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
                {/* Left column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Info card */}
                    <div className="pp-card">
                        <p className="pp-card-title">Thông tin đơn hàng & Khách hàng</p>
                        <table className="pp-table">
                            <tbody>
                                <tr>
                                    <td style={{ color: 'var(--pp-muted)', width: 170 }}>Khách hàng đặt đơn</td>
                                    <td><strong>{booking.customerName || '—'}</strong></td>
                                </tr>
                                <tr>
                                    <td style={{ color: 'var(--pp-muted)' }}>SĐT tài khoản</td>
                                    <td>{booking.customerPhone || '—'}</td>
                                </tr>
                                <tr>
                                    <td style={{ color: 'var(--pp-muted)' }}>Người nhận / Liên hệ</td>
                                    <td>
                                        <strong>{booking.receiverName || booking.customerName || '—'}</strong>
                                        {booking.receiverPhone && (
                                            <span style={{ color: 'var(--pp-muted)', marginLeft: 8 }}>
                                                ({booking.receiverPhone})
                                            </span>
                                        )}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ color: 'var(--pp-muted)' }}>Địa chỉ thực hiện</td>
                                    <td>
                                        <span style={{ fontWeight: 500, color: '#0f172a' }}>
                                            📍 {booking.fullAddress || 'Chưa có địa chỉ'}
                                        </span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ color: 'var(--pp-muted)' }}>Ghi chú của khách</td>
                                    <td>
                                        {booking.customerNote ? (
                                            <div style={{
                                                background: '#f8fafc',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: 6,
                                                padding: '6px 10px',
                                                fontSize: 13,
                                                color: '#334155',
                                                fontStyle: 'italic'
                                            }}>
                                                "{booking.customerNote}"
                                            </div>
                                        ) : (
                                            <span style={{ color: '#94a3b8' }}>Không có ghi chú</span>
                                        )}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ color: 'var(--pp-muted)' }}>Phương thức thanh toán</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontWeight: 600 }}>
                                                {booking.paymentMethod === 'CASH'
                                                    ? '💵 Tiền mặt (thu sau khi hoàn thành)'
                                                    : '💳 VNPAY / Chuyển khoản trực tuyến'}
                                            </span>
                                            <span className={`pp-badge ${booking.paymentStatus === 'PAID' ? 'pp-badge-completed' : 'pp-badge-waiting'}`}>
                                                {booking.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ color: 'var(--pp-muted)' }}>Ngày thực hiện dịch vụ</td>
                                    <td><strong style={{ color: '#2563eb' }}>{formatDateTime(booking.scheduledStart)}</strong></td>
                                </tr>
                                <tr>
                                    <td style={{ color: 'var(--pp-muted)' }}>Kết thúc dự kiến</td>
                                    <td>{formatDateTime(booking.scheduledEnd)}</td>
                                </tr>
                                <tr>
                                    <td style={{ color: 'var(--pp-muted)' }}>Ngày tạo đơn</td>
                                    <td>{formatDateTime(booking.createdAt)}</td>
                                </tr>
                                {booking.providerDeadlineAt && (
                                    <tr>
                                        <td style={{ color: 'var(--pp-muted)' }}>Hạn chót tiếp nhận</td>
                                        <td>
                                            <span style={{ color: '#d97706', fontWeight: 600 }}>
                                                ⏱️ {formatDateTime(booking.providerDeadlineAt)}
                                            </span>
                                        </td>
                                    </tr>
                                )}
                                {booking.cancelReason && (
                                    <tr>
                                        <td style={{ color: 'var(--pp-muted)' }}>Lý do hủy</td>
                                        <td style={{ color: 'var(--pp-danger)', fontWeight: 600 }}>{booking.cancelReason}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Items */}
                    {booking.items?.length > 0 && (
                        <div className="pp-card">
                            <p className="pp-card-title" style={{ marginBottom: 6 }}>Dịch vụ đã đặt</p>
<div style={{ fontSize: 12, color: 'var(--pp-muted)', marginBottom: 12, background: '#f8fafc', padding: '6px 10px', borderRadius: 6 }}>
    ℹ️ <strong>Lưu ý:</strong> Thời gian hoàn thành là ước tính dự kiến (~2-3 giờ). Khung giờ phục vụ bắt đầu theo đúng yêu cầu hẹn của khách.
</div>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                            <div>
                                <p className="pp-card-title" style={{ margin: 0 }}>
                                    Phân công nhân viên ({assignments.length})
                                </p>
                                {booking.scheduledStart && (
                                    <div style={{ fontSize: 12.5, color: 'var(--pp-muted)', marginTop: 4 }}>
                                        <span>📅 Phục vụ ngày: <strong>{formatDateTime(booking.scheduledStart)}</strong></span>
                                        {availableData.availableCount != null && (
                                            <span style={{ marginLeft: 8, color: availableData.availableCount > 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                                                • 🟢 {availableData.availableCount} NV trống lịch
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            {canAssign && (
                                <button
                                    className="pp-btn pp-btn-primary pp-btn-sm"
                                    onClick={() => {
                                        clearMessages();
                                        loadAvailableEmployees();
                                        setShowAssignModal(true);
                                    }}
                                >
                                    + Phân công nhân viên
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
                                            <th>Ghi chú / Phản hồi</th>
                                            {canAssign && <th></th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assignments.map((a) => {
                                            const asg = ASSIGNMENT_STATUS_MAP[(a.status || '').toUpperCase()] || { cls: 'pp-badge-confirmed', label: a.status || 'ASSIGNED' };
                                            const isDeclined = (a.status || '').toUpperCase() === 'DECLINED';
                                            return (
                                                <tr key={a.id} style={{ background: isDeclined ? '#fffbeb' : undefined }}>
                                                    <td><strong>{a.employeeCode || '—'}</strong></td>
                                                    <td>
                                                        <div>{a.employeeName || '—'}</div>
                                                        {a.employeePhone && (
                                                            <div style={{ fontSize: 11.5, color: 'var(--pp-muted)' }}>{a.employeePhone}</div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span className={`pp-badge ${asg.cls}`}>{asg.label}</span>
                                                    </td>
                                                    <td>
                                                        {isDeclined ? (
                                                            <span style={{ color: '#dc2626', fontWeight: 500 }}>
                                                                ⛔ Lý do từ chối: {a.note || 'Không có lý do'}
                                                            </span>
                                                        ) : (
                                                            a.note || '—'
                                                        )}
                                                    </td>
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
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Status History Card */}
                    {booking.statusHistory?.length > 0 && (
                        <div className="pp-card">
                            <p className="pp-card-title">Lịch sử trạng thái đơn hàng ({booking.statusHistory.length})</p>
                            <div className="pp-table-wrap">
                                <table className="pp-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 140 }}>Thời gian</th>
                                            <th style={{ width: 140 }}>Người thao tác</th>
                                            <th style={{ width: 230 }}>Thay đổi trạng thái</th>
                                            <th>Ghi chú</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {booking.statusHistory.map((h, idx) => (
                                            <tr key={h.id || idx}>
                                                <td style={{ fontSize: 12, color: 'var(--pp-muted)' }}>
                                                    {formatDateTime(h.createdAt)}
                                                </td>
                                                <td>
                                                    <strong>{h.changedByName || 'Hệ thống'}</strong>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                                        {h.oldStatus ? statusBadge(h.oldStatus) : <span style={{ color: '#94a3b8' }}>Khởi tạo</span>}
                                                        <span>➔</span>
                                                        {statusBadge(h.newStatus)}
                                                    </div>
                                                </td>
                                                <td style={{ fontSize: 12.5, color: '#334155' }}>
                                                    {h.note || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right column — actions */}
                <div>
                    <div className="pp-card">
                        <p className="pp-card-title">Thao tác đơn hàng</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ color: 'var(--pp-muted)', fontSize: 13 }}>Tổng tiền</span>
                                <strong style={{ fontSize: 20, color: 'var(--pp-navy)' }}>
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

                            {canAssign && (
                                <button
                                    className="pp-btn pp-btn-primary"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                    onClick={() => {
                                        clearMessages();
                                        loadAvailableEmployees();
                                        setShowAssignModal(true);
                                    }}
                                >
                                    + Phân công nhân viên
                                </button>
                            )}

                            {canCancel && (
                                <button
                                    className="pp-btn pp-btn-danger"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                    onClick={() => {
                                        clearMessages();
                                        setCancelReason('');
                                        setShowCancelModal(true);
                                    }}
                                    disabled={submitting}
                                >
                                    ✕ Hủy đơn hàng
                                </button>
                            )}

                            {!canAccept && !canReject && !canAssign && !canCancel && (
                                <p style={{ color: 'var(--pp-muted)', fontSize: 13, textAlign: 'center', margin: '8px 0' }}>
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

            {/* Cancel modal (F04) */}
            {showCancelModal && (
                <div className="pp-modal-overlay">
                    <div className="pp-modal">
                        <div className="pp-modal-header">
                            <span className="pp-modal-title">Hủy đơn hàng #{booking.bookingCode}</span>
                            <button className="pp-modal-close" onClick={() => setShowCancelModal(false)}>×</button>
                        </div>
                        <div className="pp-modal-body">
                            <p style={{ fontSize: 13, color: '#dc2626', marginTop: 0 }}>
                                ⚠️ Bạn đang thực hiện hủy đơn hàng đã tiếp nhận. Vui lòng ghi rõ lý do hủy để thông báo cho khách hàng và ban quản trị.
                            </p>
                            <div className="pp-form-group">
                                <label className="pp-label">Lý do hủy đơn hàng *</label>
                                <textarea
                                    className="pp-textarea"
                                    placeholder="Nhập lý do hủy (ví dụ: Nhân viên gặp sự cố đột xuất không thể sắp xếp thay thế kịp...)"
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                />
                            </div>
                            {actionError && <div className="pp-alert pp-alert-error">{actionError}</div>}
                        </div>
                        <div className="pp-modal-footer">
                            <button className="pp-btn pp-btn-ghost" onClick={() => setShowCancelModal(false)}>Quay lại</button>
                            <button
                                className="pp-btn pp-btn-danger"
                                onClick={handleCancel}
                                disabled={submitting || !cancelReason.trim()}
                            >
                                {submitting ? 'Đang hủy...' : 'Xác nhận hủy đơn'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign modal */}
            {showAssignModal && (
                <div className="pp-modal-overlay">
                    <div className="pp-modal" style={{ maxWidth: 540 }}>
                        <div className="pp-modal-header">
                            <span className="pp-modal-title">Phân công nhân viên</span>
                            <button className="pp-modal-close" onClick={() => setShowAssignModal(false)}>×</button>
                        </div>
                        <div className="pp-modal-body">
                            {/* Service date & summary box */}
                            <div style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: 8,
                                padding: '10px 14px',
                                marginBottom: 16
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <span style={{ fontSize: 13, color: '#64748b' }}>Ngày thực hiện dịch vụ:</span>
                                    <strong style={{ fontSize: 13.5, color: '#0f172a' }}>
                                        {formatDateTime(booking.scheduledStart)}
                                    </strong>
                                </div>
                                <div style={{ fontSize: 11.5, color: '#1e40af', background: '#eff6ff', padding: '6px 10px', borderRadius: 6, marginBottom: 8 }}>
    💡 <strong>Quy định:</strong> Mỗi nhân viên chỉ làm tối đa 1 dịch vụ trong ngày để đảm bảo chất lượng phục vụ tốt nhất.
</div>
<div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
                                    <span style={{ color: '#16a34a', fontWeight: 600 }}>
                                        🟢 {availableData.availableCount || 0} nhân viên trống lịch
                                    </span>
                                    <span style={{ color: '#dc2626', fontWeight: 600 }}>
                                        🔴 {availableData.busyCount || 0} nhân viên bận trong ngày
                                    </span>
                                </div>
                            </div>

                            <div className="pp-form-group">
                                <label className="pp-label">Chọn nhân viên thực hiện *</label>
                                <select
                                    className="pp-select"
                                    value={selectedEmployee}
                                    onChange={(e) => setSelectedEmployee(e.target.value)}
                                >
                                    <option value="">— Chọn nhân viên phù hợp —</option>
                                    {(() => {
                                        const empList = availableData.employees || [];
                                        const availList = empList.filter(e => e.isAvailable);
                                        const busyList = empList.filter(e => !e.isAvailable);

                                        return (
                                            <>
                                                {availList.length > 0 && (
                                                    <optgroup label={`🟢 NHÂN VIÊN TRỐNG LỊCH (${availList.length})`}>
                                                        {availList.map((emp) => (
                                                            <option key={emp.id} value={emp.id}>
                                                                🟢 {emp.employeeCode} — {emp.fullName} ({emp.phone || 'SĐT: —'})
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                                {busyList.length > 0 && (
                                                    <optgroup label={`🔴 NHÂN VIÊN BẬN VIỆC TRONG NGÀY (${busyList.length})`}>
                                                        {busyList.map((emp) => (
                                                            <option key={emp.id} value={emp.id} disabled>
                                                                🔴 {emp.employeeCode} — {emp.fullName} ({emp.busyReason || 'Bận'})
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                                {empList.length === 0 && (
                                                    <option value="" disabled>Chưa có nhân viên nào</option>
                                                )}
                                            </>
                                        );
                                    })()}
                                </select>
                            </div>

                            {/* Quick select employee cards */}
                            <div style={{ marginTop: 12, marginBottom: 12 }}>
                                <label className="pp-label" style={{ marginBottom: 6 }}>Danh sách nhân sự của bạn:</label>
                                <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {(availableData.employees || []).map((emp) => {
                                        const isSelected = String(selectedEmployee) === String(emp.id);
                                        return (
                                            <div
                                                key={emp.id}
                                                onClick={() => {
                                                    if (emp.isAvailable) setSelectedEmployee(String(emp.id));
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '7px 10px',
                                                    borderRadius: 6,
                                                    border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                                                    background: isSelected ? '#eff6ff' : emp.isAvailable ? '#ffffff' : '#f8fafc',
                                                    cursor: emp.isAvailable ? 'pointer' : 'not-allowed',
                                                    opacity: emp.isAvailable ? 1 : 0.65
                                                }}
                                            >
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
                                                        {emp.employeeCode} — {emp.fullName}
                                                    </div>
                                                    <div style={{ fontSize: 11.5, color: '#64748b' }}>
                                                        SĐT: {emp.phone || '—'} • {emp.totalCompletedJobs || 0} đơn hoàn thành
                                                    </div>
                                                </div>
                                                <div>
                                                    {emp.isAvailable ? (
                                                        <span className="pp-badge pp-badge-active" style={{ fontSize: 11 }}>
                                                            Trống lịch
                                                        </span>
                                                    ) : (
                                                        <span className="pp-badge pp-badge-cancelled" style={{ fontSize: 11 }} title={emp.busyReason}>
                                                            {emp.busyReason ? (emp.busyReason.length > 25 ? emp.busyReason.substring(0, 25) + '...' : emp.busyReason) : 'Bận'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
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
                                disabled={submitting || !selectedEmployee}
                            >
                                {status === 'PENDING_PROVIDER' ? 'Tiếp nhận & Phân công' : 'Phân công'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default ProviderBookingDetail;
