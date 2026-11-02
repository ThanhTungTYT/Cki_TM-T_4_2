import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotate, faTriangleExclamation, faArrowRotateRight, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import AdminLayout from './AdminLayout';
import './AdminOutboxManagement.css';

const API_URL = 'http://localhost:8080/api/admin/outbox';

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

    return response.status === 204 ? null : response.json();
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

export default function AdminOutboxManagement() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [retryingId, setRetryingId] = useState(null);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const loadEvents = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const result = await request('/failed');
            setEvents(Array.isArray(result) ? result : []);
        } catch (err) {
            setError(err.message || 'Không thể tải danh sách Outbox lỗi.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    async function retryEvent(event) {
        if (!reason.trim()) {
            setError('Vui lòng nhập lý do retry.');
            return;
        }

        setRetryingId(event.id);
        setError('');
        setSuccess('');

        try {
            await request(`/${event.id}/retry`, {
                method: 'POST',
                body: JSON.stringify({ reason: reason.trim() })
            });

            setSuccess(`Đã đưa sự kiện #${event.id} về hàng đợi xử lý.`);
            setSelectedEvent(null);
            setReason('');
            await loadEvents();
        } catch (err) {
            setError(err.message || 'Không thể retry sự kiện.');
        } finally {
            setRetryingId(null);
        }
    }

    return (
        <AdminLayout>
            <div className="admin-outbox-page">
                <header className="admin-outbox-header">
                    <div>
                        <h1>Giám sát thông báo hệ thống</h1>
                        <p>Theo dõi các sự kiện không gửi được đến Admin và retry có lưu lý do kiểm toán.</p>
                    </div>
                    <button type="button" onClick={loadEvents} disabled={loading}>
                        <FontAwesomeIcon icon={faRotate} spin={loading} /> Làm mới
                    </button>
                </header>

                {error && <div className="admin-outbox-alert error"><FontAwesomeIcon icon={faTriangleExclamation} /> {error}</div>}
                {success && <div className="admin-outbox-alert success"><FontAwesomeIcon icon={faCheckCircle} /> {success}</div>}

                <section className="admin-outbox-summary">
                    <div>
                        <span><FontAwesomeIcon icon={faTriangleExclamation} /></span>
                        <div><small>Sự kiện đang lỗi</small><strong>{events.length}</strong></div>
                    </div>
                    <p>Sự kiện tự động retry tối đa 10 lần. Khi hết lượt, trạng thái chuyển thành FAILED và cần Admin kiểm tra trước khi gửi lại.</p>
                </section>

                <section className="admin-outbox-table-panel">
                    <div className="admin-outbox-panel-heading">
                        <div>
                            <h2>Danh sách sự kiện FAILED</h2>
                            <p>Chỉ Admin được xem và thực hiện retry thủ công.</p>
                        </div>
                    </div>

                    {loading ? <p className="admin-outbox-empty">Đang tải...</p> : events.length ? (
                        <div className="admin-outbox-table-wrap">
                            <table>
                                <thead>
                                <tr>
                                    <th>Sự kiện</th>
                                    <th>Nội dung</th>
                                    <th>Số lần thử</th>
                                    <th>Lỗi gần nhất</th>
                                    <th>Ngày tạo</th>
                                    <th></th>
                                </tr>
                                </thead>
                                <tbody>
                                {events.map(event => (
                                    <tr key={event.id}>
                                        <td>
                                            <strong>#{event.id} · {event.eventType}</strong>
                                            <small>{event.eventKey}</small>
                                        </td>
                                        <td>
                                            <strong>{event.title}</strong>
                                            <small>{event.message}</small>
                                            <small>{event.referenceType} #{event.referenceId}</small>
                                        </td>
                                        <td>{event.attempts}/10</td>
                                        <td className="admin-outbox-error-text">{event.lastError || 'Không có chi tiết lỗi'}</td>
                                        <td>{formatDate(event.createdAt)}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className="admin-outbox-retry"
                                                onClick={() => {
                                                    setSelectedEvent(event);
                                                    setReason('');
                                                    setError('');
                                                }}
                                            >
                                                <FontAwesomeIcon icon={faArrowRotateRight} /> Retry
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <p className="admin-outbox-empty">Không có sự kiện Outbox nào đang ở trạng thái FAILED.</p>}
                </section>

                {selectedEvent && (
                    <section className="admin-outbox-retry-panel">
                        <div>
                            <h2>Retry sự kiện #{selectedEvent.id}</h2>
                            <p>{selectedEvent.title}</p>
                        </div>
                        <label>
                            Lý do retry
                            <textarea
                                value={reason}
                                onChange={event => setReason(event.target.value)}
                                maxLength={2000}
                                placeholder="Nêu nguyên nhân đã kiểm tra và lý do gửi lại..."
                            />
                        </label>
                        <div className="admin-outbox-retry-actions">
                            <button type="button" className="cancel" onClick={() => setSelectedEvent(null)}>Hủy</button>
                            <button
                                type="button"
                                onClick={() => retryEvent(selectedEvent)}
                                disabled={retryingId === selectedEvent.id || !reason.trim()}
                            >
                                {retryingId === selectedEvent.id ? 'Đang xử lý...' : 'Xác nhận retry'}
                            </button>
                        </div>
                    </section>
                )}
            </div>
        </AdminLayout>
    );
}