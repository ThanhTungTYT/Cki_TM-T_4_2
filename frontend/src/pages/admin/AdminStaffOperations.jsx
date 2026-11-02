import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faClipboardCheck, faClock, faRotate, faUsers, faArrowRightArrowLeft, faCheck, faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import AdminLayout from './AdminLayout';
import './AdminStaffOperations.css';

const API_URL = 'http://localhost:8080/api/admin/operations';

function getToken() {
    return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken') || sessionStorage.getItem('token') || localStorage.getItem('token');
}

async function request(path, options = {}) {
    const token = getToken();
    if (!token) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            Accept: 'application/json',
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            Authorization: `Bearer ${token}`,
            ...options.headers
        }
    });
    if (!response.ok) {
        let message = `Yêu cầu thất bại (HTTP ${response.status}).`;
        try {
            const data = await response.json();
            message = data.message || data.detail || data.error || message;
        } catch {}
        throw new Error(message);
    }
    if (response.status === 204) return null;
    return response.json();
}

function formatDate(value) {
    if (!value) return 'Chưa đặt hạn';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

export default function AdminStaffOperations() {
    const [staff, setStaff] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [unassignedTickets, setUnassignedTickets] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [staffId, setStaffId] = useState('');
    const [reason, setReason] = useState('');
    const [dueAt, setDueAt] = useState('');
    const [keyword, setKeyword] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [newStaff, setNewStaff] = useState({ name: '', email: '', phone: '', password: '' });
    const [creatingStaff, setCreatingStaff] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const staffResult = await request('/staff').catch(() => null);
            const adminMode = Array.isArray(staffResult);
            setIsAdmin(adminMode);
            if (adminMode) setStaff(staffResult);
            const [assignmentResult, notificationResult, auditResult, unassignedResult] = await Promise.all([
                request('/assignments'),
                request('/notifications'),
                adminMode ? request('/audit-logs?page=0&size=30').catch(() => null) : Promise.resolve(null),
                adminMode ? request('/unassigned-tickets').catch(() => []) : Promise.resolve([])
            ]);
            setAssignments(Array.isArray(assignmentResult) ? assignmentResult : []);
            setUnassignedTickets(Array.isArray(unassignedResult) ? unassignedResult : []);
            setNotifications(Array.isArray(notificationResult?.items) ? notificationResult.items : []);
            setAuditLogs(Array.isArray(auditResult?.items) ? auditResult.items : []);
        } catch (err) {
            setError(err.message || 'Không thể tải dữ liệu quản lý nhân sự.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredAssignments = useMemo(() => {
        const search = keyword.trim().toLowerCase();
        if (!search) return assignments;
        return assignments.filter(item => [item.subject, item.staffName, item.staffEmail, item.ticketId, item.ticketStatus].join(' ').toLowerCase().includes(search));
    }, [assignments, keyword]);

    async function submitAssignment(event) {
        event.preventDefault();
        if (!selectedTicket || !staffId || !reason.trim()) {
            setError('Vui lòng chọn nhân viên và nhập lý do phân công.');
            return;
        }
        setSubmitting(true);
        setError('');
        setNotice('');
        try {
            await request('/assignments', {
                method: 'POST',
                body: JSON.stringify({
                    ticketId: selectedTicket.ticketId,
                    staffId: Number(staffId),
                    reason: reason.trim(),
                    dueAt: dueAt || null,
                    idempotencyKey: `STAFF-ASSIGN-${selectedTicket.ticketId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                })
            });
            setNotice('Đã lưu phân công và tạo thông báo riêng cho nhân viên.');
            setSelectedTicket(null);
            setStaffId('');
            setReason('');
            setDueAt('');
            await loadData();
        } catch (err) {
            setError(err.message || 'Không thể lưu phân công.');
        } finally {
            setSubmitting(false);
        }
    }

    async function createStaff(event) {
        event.preventDefault();
        setCreatingStaff(true);
        setError('');
        setNotice('');
        try {
            const token = getToken();
            const response = await fetch('http://localhost:8080/api/admin/accounts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: newStaff.name.trim(),
                    email: newStaff.email.trim(),
                    phone: newStaff.phone.trim(),
                    password: newStaff.password,
                    role: 'STAFF',
                    status: 'ACTIVE'
                })
            });
            if (!response.ok) {
                let message = `Không thể tạo Staff (HTTP ${response.status}).`;
                try {
                    const data = await response.json();
                    message = data.message || data.detail || data.error || message;
                } catch {}
                throw new Error(message);
            }
            setNewStaff({ name: '', email: '', phone: '', password: '' });
            setNotice('Đã tạo tài khoản Staff. Nhân viên có thể đăng nhập bằng tài khoản vừa tạo.');
            await loadData();
        } catch (err) {
            setError(err.message || 'Không thể tạo tài khoản Staff.');
        } finally {
            setCreatingStaff(false);
        }
    }

    async function markRead(id) {
        try {
            await request(`/notifications/${id}/read`, { method: 'PATCH' });
            setNotifications(current => current.map(item => item.id === id ? { ...item, read: true } : item));
        } catch (err) {
            setError(err.message || 'Không thể cập nhật thông báo.');
        }
    }

    return (
        <AdminLayout>
            <div className="staff-operations-page">
                <header className="staff-operations-header">
                    <div>
                        <h1>Nhân sự & vận hành</h1>
                        <p>{isAdmin ? 'Phân công công việc, theo dõi nhân viên và kiểm tra nhật ký thao tác.' : 'Danh sách khiếu nại được phân công và thông báo dành cho bạn.'}</p>
                    </div>
                    <button type="button" className="staff-refresh-button" onClick={loadData} disabled={loading}>
                        <FontAwesomeIcon icon={faRotate} spin={loading} /> Làm mới
                    </button>
                </header>

                {error && <div className="staff-alert error"><FontAwesomeIcon icon={faCircleExclamation} /> {error}</div>}
                {notice && <div className="staff-alert success"><FontAwesomeIcon icon={faCheck} /> {notice}</div>}

                <section className="staff-operations-stats">
                    <article><span><FontAwesomeIcon icon={faUsers} /></span><div><small>{isAdmin ? 'Nhân viên hoạt động' : 'Công việc được giao'}</small><strong>{isAdmin ? staff.filter(item => item.status === 'ACTIVE').length : assignments.length}</strong></div></article>
                    <article><span><FontAwesomeIcon icon={faClipboardCheck} /></span><div><small>Phân công đang theo dõi</small><strong>{assignments.length}</strong></div></article>
                    <article><span><FontAwesomeIcon icon={faBell} /></span><div><small>Thông báo chưa đọc</small><strong>{notifications.filter(item => !item.read).length}</strong></div></article>
                </section>

                {isAdmin && <section className="staff-panel"><div className="staff-panel-heading"><div><h2>Tạo tài khoản Staff</h2><p>Tạo tài khoản nhân viên hỗ trợ mới, không cấp quyền Admin.</p></div></div><form className="staff-create-form" onSubmit={createStaff}><label>Họ và tên<input value={newStaff.name} onChange={event => setNewStaff(current => ({ ...current, name: event.target.value }))} required maxLength={100} /></label><label>Email<input type="email" value={newStaff.email} onChange={event => setNewStaff(current => ({ ...current, email: event.target.value }))} required maxLength={150} /></label><label>Số điện thoại<input value={newStaff.phone} onChange={event => setNewStaff(current => ({ ...current, phone: event.target.value }))} maxLength={20} /></label><label>Mật khẩu tạm<input type="password" value={newStaff.password} onChange={event => setNewStaff(current => ({ ...current, password: event.target.value }))} required minLength={8} /></label><button type="submit" disabled={creatingStaff}>{creatingStaff ? 'Đang tạo...' : 'Tạo Staff'}</button></form></section>}

                {isAdmin && (
                    <section className="staff-panel">
                        <div className="staff-panel-heading"><div><h2>Danh sách Staff</h2><p>Chỉ tài khoản có vai trò STAFF và đang hoạt động mới được phân công.</p></div></div>
                        <div className="staff-directory">
                            {staff.map(item => <div className="staff-directory-item" key={item.id}><div className="staff-avatar">{(item.name || 'S').slice(0, 1).toUpperCase()}</div><div><strong>{item.name}</strong><span>{item.email}</span></div><span className={`staff-state ${item.status === 'ACTIVE' ? 'active' : 'locked'}`}>{item.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}</span></div>)}
                            {!loading && staff.length === 0 && <p className="staff-empty">Chưa có tài khoản Staff trong hệ thống.</p>}
                        </div>
                    </section>
                )}

                {isAdmin && <section className="staff-panel"><div className="staff-panel-heading"><div><h2>Ticket chưa được phân công</h2><p>Admin có thể giao ticket mới cho Staff đang hoạt động.</p></div></div><div className="staff-unassigned-list">{unassignedTickets.length ? unassignedTickets.map(item => <article key={item.ticketId}><div><strong>#{item.ticketId} · {item.subject}</strong><small>{item.status} · {formatDate(item.createdAt)}</small></div><button type="button" onClick={() => { setSelectedTicket(item); setStaffId(''); setReason(''); setDueAt(''); }}>Phân công</button></article>) : <p className="staff-empty">Không có ticket chờ phân công.</p>}</div></section>}

                <section className="staff-panel">
                    <div className="staff-panel-heading staff-assignment-heading"><div><h2>{isAdmin ? 'Phân công & theo dõi ticket' : 'Ticket được giao cho bạn'}</h2><p>{isAdmin ? 'Mỗi lần bàn giao được lưu thành một bản ghi lịch sử.' : 'Bạn chỉ xem được các ticket đang được giao cho tài khoản của mình.'}</p></div><input value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="Tìm ticket hoặc nhân viên..." /></div>
                    {loading ? <p className="staff-empty">Đang tải dữ liệu...</p> : filteredAssignments.length ? <div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>Ticket</th><th>Nhân viên</th><th>Lý do phân công</th><th>Hạn xử lý</th><th>Ngày giao</th>{isAdmin && <th>Thao tác</th>}</tr></thead><tbody>{filteredAssignments.map(item => <tr key={item.id}><td><strong>#{item.ticketId} · {item.subject}</strong><small>{item.ticketStatus}</small></td><td>{item.staffName}<small>{item.staffEmail}</small></td><td>{item.reason}</td><td><FontAwesomeIcon icon={faClock} /> {formatDate(item.dueAt)}</td><td>{formatDate(item.assignedAt)}</td>{isAdmin && <td><button type="button" className="staff-reassign-button" onClick={() => { setSelectedTicket(item); setStaffId(String(item.staffId)); setReason(''); setDueAt(''); }}><FontAwesomeIcon icon={faArrowRightArrowLeft} /> Bàn giao</button></td>}</tr>)}</tbody></table></div> : <p className="staff-empty">Chưa có công việc được phân công.</p>}
                </section>

                {isAdmin && selectedTicket && (
                    <section className="staff-panel staff-assignment-form-panel">
                        <div className="staff-panel-heading"><div><h2>{selectedTicket.staffId ? 'Bàn giao ticket #' : 'Phân công ticket #'}{selectedTicket.ticketId}</h2><p>{selectedTicket.subject}</p></div><button type="button" className="staff-close-button" onClick={() => setSelectedTicket(null)}>Đóng</button></div>
                        <form className="staff-assignment-form" onSubmit={submitAssignment}>
                            <label>Nhân viên phụ trách<select value={staffId} onChange={event => setStaffId(event.target.value)} required><option value="">Chọn Staff</option>{staff.filter(item => item.status === 'ACTIVE').map(item => <option key={item.id} value={item.id}>{item.name} · {item.email}</option>)}</select></label>
                            <label>Hạn xử lý<input type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} /></label>
                            <label className="staff-reason-field">Lý do phân công / bàn giao<textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} required placeholder="Nêu rõ nội dung cần xử lý và lý do giao việc..." /></label>
                            <button type="submit" disabled={submitting || !staffId || !reason.trim()}>{submitting ? 'Đang lưu...' : 'Lưu phân công'}</button>
                        </form>
                    </section>
                )}

                <section className="staff-panel">
                    <div className="staff-panel-heading"><div><h2>Thông báo của tôi</h2><p>Thông báo chỉ hiển thị với tài khoản nhận.</p></div></div>
                    <div className="staff-notifications-list">{notifications.length ? notifications.map(item => <article className={item.read ? 'read' : 'unread'} key={item.id}><div><strong>{item.title}</strong><p>{item.message}</p><small>{formatDate(item.createdAt)}</small></div>{!item.read && <button type="button" onClick={() => markRead(item.id)}>Đánh dấu đã đọc</button>}</article>) : <p className="staff-empty">Chưa có thông báo.</p>}</div>
                </section>

                {isAdmin && <section className="staff-panel"><div className="staff-panel-heading"><div><h2>Nhật ký kiểm toán</h2><p>Theo dõi các thao tác quản trị, phân công và bàn giao được ghi nhận trong hệ thống.</p></div></div><div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Thao tác</th><th>Đối tượng</th><th>Lý do</th><th>Thay đổi</th></tr></thead><tbody>{auditLogs.map(item => <tr key={item.id}><td>{formatDate(item.createdAt)}</td><td>{item.actorName}<small>{item.actorEmail}</small></td><td>{item.action}</td><td>{item.entityType} #{item.entityId}</td><td>{item.reason}</td><td>{item.beforeValue || '—'} → {item.afterValue || '—'}</td></tr>)}</tbody></table>{!auditLogs.length && <p className="staff-empty">Chưa có nhật ký thao tác quản trị.</p>}</div></section>}
            </div>
        </AdminLayout>
    );
}