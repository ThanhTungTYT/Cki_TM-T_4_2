
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    bookingApi,
    cleanerNotificationApi
} from '../../services/api';
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

function getAssignmentId(assignment) {
    return assignment?.assignmentId || assignment?.id;
}

function getNotificationIcon(type) {
    const value = String(type || '').toUpperCase();

    if (value.includes('ASSIGN') || value.includes('BOOKING')) {
        return '🧹';
    }

    if (value.includes('INCIDENT') || value.includes('ISSUE')) {
        return '⚠️';
    }

    if (value.includes('CANCEL')) {
        return '❌';
    }

    if (value.includes('REMINDER') || value.includes('DEADLINE')) {
        return '⏰';
    }

    return '🔔';
}

export default function CleanerNotifications() {
    const navigate = useNavigate();
    const mountedRef = useRef(false);

    const [items, setItems] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [openingId, setOpeningId] = useState(null);
    const [markingAll, setMarkingAll] = useState(false);

    const load = useCallback(async (silent = false) => {
        if (!silent && mountedRef.current) {
            setLoading(true);
        }

        try {
            const data = await cleanerNotificationApi.getAll();

            if (!mountedRef.current) return;

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
            setError('');
        } catch (err) {
            if (mountedRef.current) {
                setError(
                    err?.message || 'Không thể tải thông báo.'
                );
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, []);


    useEffect(() => {
        mountedRef.current = true;

        // Đưa lần tải dữ liệu đầu tiên ra khỏi lượt chạy đồng bộ của effect.
        const initialLoadId = window.setTimeout(() => {
            if (navigator.onLine) {
                load(true);
            }
        }, 0);

        const intervalId = window.setInterval(() => {
            if (navigator.onLine) {
                load(true);
            }
        }, 30000);

        // Khi mạng được kết nối lại, tải trạng thái mới nhất từ server.
        const handleOnline = () => {
            load(true);
        };

        window.addEventListener('online', handleOnline);

        return () => {
            mountedRef.current = false;
            window.clearTimeout(initialLoadId);
            window.clearInterval(intervalId);
            window.removeEventListener('online', handleOnline);
        };
    }, [load]);


    const handleRefresh = async () => {
        if (refreshing || loading) return;

        setRefreshing(true);
        await load(true);
    };

    const markRead = async (id) => {
        if (
            busyId !== null ||
            markingAll ||
            openingId !== null
        ) {
            return false;
        }

        const notification = items.find(
            (item) => String(item.id) === String(id)
        );

        if (!notification) return false;

        if (notification.read) return true;

        setBusyId(id);
        setError('');

        try {
            await cleanerNotificationApi.markRead(id);

            if (mountedRef.current) {
                setItems((previous) =>
                    previous.map((item) =>
                        String(item.id) === String(id)
                            ? { ...item, read: true }
                            : item
                    )
                );

                setUnreadCount((previous) =>
                    Math.max(0, previous - 1)
                );
            }

            return true;
        } catch (err) {
            if (mountedRef.current) {
                setError(
                    err?.message || 'Không thể đánh dấu đã đọc.'
                );
            }

            return false;
        } finally {
            if (mountedRef.current) {
                setBusyId(null);
            }
        }
    };

    const markAllRead = async () => {
        if (
            markingAll ||
            busyId !== null ||
            openingId !== null ||
            unreadCount === 0
        ) {
            return;
        }

        const unreadItems = items.filter(
            (item) => !item.read
        );

        if (unreadItems.length === 0) {
            setUnreadCount(0);
            return;
        }

        setMarkingAll(true);
        setError('');

        const successfulIds = [];
        const failedIds = [];

        // Backend hiện chỉ có API đánh dấu từng thông báo.
        // Gửi tuần tự để tránh tạo nhiều request cùng lúc.
        for (const notification of unreadItems) {
            try {
                await cleanerNotificationApi.markRead(
                    notification.id
                );

                successfulIds.push(notification.id);
            } catch {
                failedIds.push(notification.id);
            }
        }

        if (mountedRef.current && successfulIds.length > 0) {
            const successfulSet = new Set(
                successfulIds.map(String)
            );

            setItems((previous) =>
                previous.map((item) =>
                    successfulSet.has(String(item.id))
                        ? { ...item, read: true }
                        : item
                )
            );

            setUnreadCount((previous) =>
                Math.max(0, previous - successfulIds.length)
            );
        }

        if (mountedRef.current && failedIds.length > 0) {
            setError(
                `Đã cập nhật ${successfulIds.length} thông báo. ` +
                `Còn ${failedIds.length} thông báo chưa thể đánh dấu đã đọc.`
            );
        }

        if (mountedRef.current) {
            setMarkingAll(false);
        }
    };

    const openRelatedJob = async (notification) => {
        if (
            openingId !== null ||
            busyId !== null ||
            markingAll
        ) {
            return;
        }

        setOpeningId(notification.id);
        setError('');

        try {
            // Đánh dấu đã đọc trước khi chuyển trang.
            if (!notification.read) {
                try {
                    await cleanerNotificationApi.markRead(
                        notification.id
                    );

                    if (mountedRef.current) {
                        setItems((previous) =>
                            previous.map((item) =>
                                String(item.id) ===
                                String(notification.id)
                                    ? { ...item, read: true }
                                    : item
                            )
                        );

                        setUnreadCount((previous) =>
                            Math.max(0, previous - 1)
                        );
                    }
                } catch {
                    // Không chặn việc mở công việc chỉ vì lỗi đánh dấu đọc.
                }
            }

            const referenceType = String(
                notification.referenceType || ''
            ).toUpperCase();

            const referenceId = notification.referenceId;

            if (!referenceId) {
                throw new Error(
                    'Thông báo này không có liên kết đến công việc.'
                );
            }

            // Backend Provider phân công Cleaner đang dùng:
            // referenceType = BOOKING_ASSIGNMENT
            // referenceId = assignment.id
            if (
                referenceType === 'BOOKING_ASSIGNMENT' ||
                referenceType === 'ASSIGNMENT'
            ) {
                navigate(`/cleaner/jobs/${referenceId}`);
                return;
            }

            // Một số thông báo khác tham chiếu trực tiếp Booking.
            // Cần tìm assignment thuộc tài khoản Cleaner hiện tại,
            // không tự suy đoán assignment ID từ booking ID.
            if (referenceType === 'BOOKING') {
                const data = await bookingApi.getCleanerAssignments();

                const assignments = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.items)
                        ? data.items
                        : [];

                const matchedAssignment = assignments.find(
                    (assignment) =>
                        String(assignment?.booking?.id) ===
                        String(referenceId)
                );

                const assignmentId = getAssignmentId(
                    matchedAssignment
                );

                if (!assignmentId) {
                    throw new Error(
                        'Công việc không còn trong danh sách được phân công của bạn.'
                    );
                }

                navigate(`/cleaner/jobs/${assignmentId}`);
                return;
            }

            throw new Error(
                'Loại thông báo này chưa hỗ trợ mở chi tiết công việc.'
            );
        } catch (err) {
            if (mountedRef.current) {
                setError(
                    err?.message || 'Không thể mở công việc liên quan.'
                );
            }
        } finally {
            if (mountedRef.current) {
                setOpeningId(null);
            }
        }
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
                        openingId !== null ||
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
                                {getNotificationIcon(
                                    notification.type
                                )}
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
                                        busyId !== null ||
                                        openingId !== null ||
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

                            {notification.referenceId &&
                                ['BOOKING', 'BOOKING_ASSIGNMENT', 'ASSIGNMENT']
                                    .includes(
                                        String(
                                            notification.referenceType || ''
                                        ).toUpperCase()
                                    ) && (
                                    <button
                                        type="button"
                                        className="cw-text-button"
                                        disabled={
                                            busyId !== null ||
                                            openingId !== null ||
                                            markingAll
                                        }
                                        onClick={() =>
                                            openRelatedJob(notification)
                                        }
                                    >
                                        {openingId === notification.id
                                            ? 'Đang mở...'
                                            : 'Xem công việc'}
                                    </button>
                                )}
                        </article>
                    ))
                )}
            </div>
        </section>
    );
}
