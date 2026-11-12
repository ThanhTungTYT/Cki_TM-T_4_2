
import { useCallback, useEffect, useState } from 'react';
import { cleanerNotificationApi } from '../../services/api';
import './CleanerWorkspace.css';

function formatDateTime(value) {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export default function CleanerNotifications() {
    const [items, setItems] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [markingAll, setMarkingAll] = useState(false);

    const load = useCallback(async () => {
        setError('');

        const data = await cleanerNotificationApi.getAll();

        const notifications = Array.isArray(data?.items)
            ? data.items
            : [];

        setItems(notifications);
        setUnreadCount(
            Number(
                data?.unreadCount ??
                notifications.filter((item) => !item.read).length
            )
        );
    }, []);

    useEffect(() => {
        let active = true;

        const fetchNotifications = async () => {
            try {
                const data = await cleanerNotificationApi.getAll();

                if (!active) return;

                const notifications = Array.isArray(data?.items)
                    ? data.items
                    : [];

                setItems(notifications);
                setUnreadCount(
                    Number(
                        data?.unreadCount ??
                        notifications.filter((item) => !item.read).length
                    )
                );
            } catch (err) {
                if (active) {
                    setError(
                        err?.message || 'Không thể tải thông báo.'
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchNotifications();

        return () => {
            active = false;
        };
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);

        try {
            await load();
        } catch (err) {
            setError(
                err?.message || 'Không thể tải thông báo.'
            );
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    };

    const markRead = async (id) => {
        if (busyId !== null || markingAll) return;

        const notification = items.find((item) => item.id === id);

        if (!notification || notification.read) return;

        setBusyId(id);
        setError('');

        try {
            const updated = await cleanerNotificationApi.markRead(id);

            setItems((previous) =>
                previous.map((item) =>
                    item.id === id
                        ? { ...item, ...updated, read: true }
                        : item
                )
            );

            setUnreadCount((previous) =>
                Math.max(0, previous - 1)
            );
        } catch (err) {
            setError(
                err?.message || 'Không thể đánh dấu đã đọc.'
            );
        } finally {
            setBusyId(null);
        }
    };

    const markAllRead = async () => {
        if (markingAll || busyId !== null || unreadCount === 0) {
            return;
        }

        const unreadItems = items.filter((item) => !item.read);

        if (unreadItems.length === 0) {
            setUnreadCount(0);
            return;
        }

        setMarkingAll(true);
        setError('');

        const successfulIds = [];
        const failedIds = [];

        // Giữ tuần tự để tránh gửi quá nhiều request cùng lúc.
        for (const notification of unreadItems) {
            try {
                await cleanerNotificationApi.markRead(notification.id);
                successfulIds.push(notification.id);
            } catch {
                failedIds.push(notification.id);
            }
        }

        if (successfulIds.length > 0) {
            const successfulSet = new Set(successfulIds);

            setItems((previous) =>
                previous.map((item) =>
                    successfulSet.has(item.id)
                        ? { ...item, read: true }
                        : item
                )
            );

            setUnreadCount((previous) =>
                Math.max(0, previous - successfulIds.length)
            );
        }

        if (failedIds.length > 0) {
            setError(
                `Đã cập nhật ${successfulIds.length} thông báo. ` +
                `Còn ${failedIds.length} thông báo chưa thể đánh dấu đã đọc.`
            );
        }

        setMarkingAll(false);
    };

    return (
        <section className="cw-page">
            <header className="cw-heading">
                <div>
                    <span className="cw-eyebrow">
                        CẬP NHẬT TÀI KHOẢN
                    </span>

                    <h1>Thông báo</h1>

                    <p>
                        Những thông tin mới liên quan đến công việc
                        và tài khoản Cleaner của bạn.
                    </p>
                </div>

                <button
                    type="button"
                    className="cw-button secondary"
                    onClick={handleRefresh}
                    disabled={loading || refreshing || markingAll}
                >
                    {refreshing ? 'Đang cập nhật...' : 'Làm mới'}
                </button>
            </header>

            {error && (
                <div className="cw-alert error">
                    {error}
                </div>
            )}

            <div className="cw-toolbar">
                <span className="cw-unread">
                    {unreadCount} thông báo chưa đọc
                </span>

                <button
                    type="button"
                    className="cw-text-button"
                    disabled={
                        unreadCount === 0 ||
                        markingAll ||
                        busyId !== null ||
                        loading
                    }
                    onClick={markAllRead}
                >
                    {markingAll
                        ? 'Đang cập nhật...'
                        : 'Đánh dấu tất cả đã đọc'}
                </button>
            </div>

            <div className="cw-panel cw-notification-list">
                {loading ? (
                    <p className="cw-muted">
                        Đang tải thông báo...
                    </p>
                ) : items.length === 0 ? (
                    <div className="cw-empty">
                        <span>🔔</span>

                        <strong>Bạn chưa có thông báo</strong>

                        <p>
                            Khi có cập nhật mới, thông báo sẽ hiển thị
                            tại đây.
                        </p>
                    </div>
                ) : (
                    items.map((notification) => (
                        <article
                            className={
                                `cw-notification ${
                                    notification.read ? '' : 'unread'
                                }`
                            }
                            key={notification.id}
                        >
                            <div className="cw-notification-icon">
                                {String(notification.type || '')
                                    .toUpperCase()
                                    .includes('BOOK')
                                    ? '🧹'
                                    : '🔔'}
                            </div>

                            <div className="cw-notification-content">
                                <div className="cw-notification-title">
                                    <strong>
                                        {notification.title ||
                                            'Thông báo mới'}
                                    </strong>

                                    {!notification.read && (
                                        <i>Chưa đọc</i>
                                    )}
                                </div>

                                <p>
                                    {notification.message ||
                                        'Không có nội dung thông báo.'}
                                </p>

                                <small>
                                    {formatDateTime(
                                        notification.createdAt
                                    )}
                                </small>
                            </div>

                            {!notification.read && (
                                <button
                                    type="button"
                                    className="cw-text-button"
                                    disabled={
                                        busyId === notification.id ||
                                        busyId !== null ||
                                        markingAll
                                    }
                                    onClick={() =>
                                        markRead(notification.id)
                                    }
                                >
                                    {busyId === notification.id
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
