import { useCallback, useEffect, useState } from 'react';
import { cleanerNotificationApi } from '../../services/api';
import './CleanerWorkspace.css';

const dateTime = (v) => v
    ? new Date(v).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
    : '—';

export default function CleanerNotifications() {
    const [items, setItems] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async () => {
        setError('');

        const data = await cleanerNotificationApi.getAll();

        setItems(Array.isArray(data.items) ? data.items : []);
        setUnreadCount(Number(data.unreadCount || 0));
    }, []);

    useEffect(() => {
        let active = true;

        cleanerNotificationApi.getAll()
            .then((data) => {
                if (active) {
                    setItems(Array.isArray(data.items) ? data.items : []);
                    setUnreadCount(Number(data.unreadCount || 0));
                }
            })
            .catch((e) => {
                if (active) {
                    setError(e.message || 'Không thể tải thông báo.');
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const markRead = async (id) => {
        setBusyId(id);

        try {
            const updated = await cleanerNotificationApi.markRead(id);

            setItems((old) => old.map((n) =>
                n.id === id
                    ? { ...n, ...updated, read: true }
                    : n
            ));

            setUnreadCount((n) => Math.max(0, n - 1));
        } catch (e) {
            setError(e.message || 'Không thể đánh dấu đã đọc.');
        } finally {
            setBusyId(null);
        }
    };

    const markAllRead = async () => {
        for (const n of items.filter((x) => !x.read)) {
            await markRead(n.id);
        }
    };

    return (
        <section className="cw-page">
            <header className="cw-heading">
                <div>
                    <span className="cw-eyebrow">CẬP NHẬT TÀI KHOẢN</span>
                    <h1>Thông báo</h1>
                    <p>
                        Những thông tin mới liên quan đến công việc của bạn.
                    </p>
                </div>

                <button
                    className="cw-button secondary"
                    onClick={() => {
                        setLoading(true);
                        load()
                            .catch((e) => {
                                setError(
                                    e.message || 'Không thể tải thông báo.'
                                );
                            })
                            .finally(() => setLoading(false));
                    }}
                >
                    Làm mới
                </button>
            </header>

            {error && <div className="cw-alert error">{error}</div>}

            <div className="cw-toolbar">
                <span className="cw-unread">
                    {unreadCount} thông báo chưa đọc
                </span>

                <button
                    className="cw-text-button"
                    disabled={!unreadCount || busyId !== null}
                    onClick={markAllRead}
                >
                    Đánh dấu tất cả đã đọc
                </button>
            </div>

            <div className="cw-panel cw-notification-list">
                {loading ? (
                    <p className="cw-muted">Đang tải thông báo...</p>
                ) : items.length === 0 ? (
                    <div className="cw-empty">
                        <span>🔔</span>
                        <strong>Bạn chưa có thông báo</strong>
                        <p>
                            Khi có cập nhật mới, thông báo sẽ hiển thị tại đây.
                        </p>
                    </div>
                ) : (
                    items.map((n) => (
                        <article
                            className={`cw-notification ${n.read ? '' : 'unread'}`}
                            key={n.id}
                        >
                            <div className="cw-notification-icon">
                                {String(n.type || '').toUpperCase().includes('BOOK')
                                    ? '🧹'
                                    : '🔔'}
                            </div>

                            <div className="cw-notification-content">
                                <div className="cw-notification-title">
                                    <strong>{n.title || 'Thông báo mới'}</strong>

                                    {!n.read && <i>Chưa đọc</i>}
                                </div>

                                <p>{n.message}</p>

                                <small>{dateTime(n.createdAt)}</small>
                            </div>

                            {!n.read && (
                                <button
                                    className="cw-text-button"
                                    disabled={busyId === n.id}
                                    onClick={() => markRead(n.id)}
                                >
                                    {busyId === n.id
                                        ? 'Đang lưu...'
                                        : 'Đánh dấu đã đọc'}
                                </button>
                            )}
                        </article>
                    ))
                )}
            </div>
        </section>
    );
}