
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '../../services/api';

const REMINDER_WINDOW = 24 * 60 * 60 * 1000;
const POLLING_INTERVAL = 60 * 1000;
const STORAGE_KEY = 'cleanmate_cleaner_job_reminders';

function getReminderKey(assignment) {
    const assignmentId =
        assignment?.assignmentId || assignment?.id;

    const scheduledStart =
        assignment?.booking?.scheduledStart || '';

    return `${assignmentId}:${scheduledStart}`;
}

function readNotifiedKeys() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];

        return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
        return new Set();
    }
}

function saveNotifiedKeys(keys) {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([...keys])
        );
    } catch {
        // Không làm gián đoạn chức năng nếu trình duyệt chặn storage.
    }
}

function formatDate(value) {
    if (!value) return 'Chưa có thời gian';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 'Chưa có thời gian';

    return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getRemainingText(value) {
    const remaining = new Date(value).getTime() - Date.now();

    if (!Number.isFinite(remaining) || remaining < 0) {
        return 'Đã đến giờ thực hiện';
    }

    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor(
        (remaining % (60 * 60 * 1000)) / (60 * 1000)
    );

    if (hours <= 0) {
        return `Còn ${minutes} phút`;
    }

    if (hours < 24) {
        return `Còn ${hours} giờ ${minutes} phút`;
    }

    return `Còn ${Math.floor(hours / 24)} ngày`;
}

export default function CleanerJobReminder() {
    const navigate = useNavigate();

    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [permission, setPermission] = useState(
        typeof window !== 'undefined' &&
        'Notification' in window
            ? window.Notification.permission
            : 'unsupported'
    );
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);

    const notifyPendingAssignments = useCallback((assignments) => {
        if (
            typeof window === 'undefined' ||
            !('Notification' in window) ||
            window.Notification.permission !== 'granted'
        ) {
            return;
        }

        const notifiedKeys = readNotifiedKeys();
        let changed = false;

        assignments.forEach((assignment) => {
            const key = getReminderKey(assignment);
            const booking = assignment?.booking || {};

            if (!key || key.startsWith('undefined:')) return;
            if (notifiedKeys.has(key)) return;

            const scheduledStart = booking.scheduledStart;

            if (!scheduledStart) return;

            const remaining =
                new Date(scheduledStart).getTime() - Date.now();

            if (
                !Number.isFinite(remaining) ||
                remaining < 0 ||
                remaining > REMINDER_WINDOW
            ) {
                return;
            }

            const bookingCode =
                booking.bookingCode ||
                `Đơn #${booking.id || ''}`;

            try {
                const notification = new window.Notification(
                    'CleanMate – Bạn có công việc sắp đến giờ',
                    {
                        body:
                            `${bookingCode}\n` +
                            `Thời gian: ${formatDate(scheduledStart)}\n` +
                            `${getRemainingText(scheduledStart)}. Vui lòng tiếp nhận công việc.`,
                        tag: `cleanmate-assignment-${key}`,
                        icon: '/favicon.ico'
                    }
                );

                notification.onclick = () => {
                    window.focus();
                    navigate('/cleaner/jobs');
                    notification.close();
                };

                notifiedKeys.add(key);
                changed = true;
            } catch (notificationError) {
                console.error(
                    'Không thể tạo thông báo Cleaner:',
                    notificationError
                );
            }
        });

        if (changed) {
            saveNotifiedKeys(notifiedKeys);
        }
    }, [navigate]);

    const loadReminders = useCallback(async (showLoading = false) => {
        if (showLoading) {
            setLoading(true);
        }

        try {
            const assignments =
                await bookingApi.getCleanerAssignments();

            const rows = Array.isArray(assignments)
                ? assignments
                : [];

            const now = Date.now();

            const pending = rows
                .filter((assignment) => {
                    const status = String(
                        assignment?.assignmentStatus || ''
                    ).toUpperCase();

                    if (status !== 'ASSIGNED') {
                        return false;
                    }

                    const scheduledStart =
                        assignment?.booking?.scheduledStart;

                    if (!scheduledStart) return false;

                    const startTime =
                        new Date(scheduledStart).getTime();

                    const remaining = startTime - now;

                    return (
                        Number.isFinite(startTime) &&
                        remaining >= 0 &&
                        remaining <= REMINDER_WINDOW
                    );
                })
                .sort((a, b) => {
                    return (
                        new Date(a.booking.scheduledStart).getTime() -
                        new Date(b.booking.scheduledStart).getTime()
                    );
                });

            setReminders(pending);
            setLastUpdated(new Date());
            setError('');

            notifyPendingAssignments(pending);
        } catch (err) {
            setError(
                err?.message ||
                'Không thể cập nhật danh sách công việc sắp đến giờ.'
            );
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    }, [notifyPendingAssignments]);

    useEffect(() => {
        let active = true;

        const initialLoad = async () => {
            if (!active) return;
            await loadReminders(true);
        };

        initialLoad();

        const intervalId = window.setInterval(() => {
            if (active) {
                loadReminders(false);
            }
        }, POLLING_INTERVAL);

        return () => {
            active = false;
            window.clearInterval(intervalId);
        };
    }, [loadReminders]);

    async function enableBrowserNotifications() {
        if (
            typeof window === 'undefined' ||
            !('Notification' in window)
        ) {
            setPermission('unsupported');
            return;
        }

        try {
            const result =
                await window.Notification.requestPermission();

            setPermission(result);

            if (result === 'granted') {
                await loadReminders(false);
            }
        } catch {
            setError(
                'Không thể bật thông báo trình duyệt. Vui lòng kiểm tra quyền thông báo của trình duyệt.'
            );
        }
    }

    if (loading && reminders.length === 0) {
        return null;
    }

    if (reminders.length === 0 && !error) {
        return null;
    }

    return (
        <section
            aria-label="Nhắc nhở công việc Cleaner"
            style={{
                marginBottom: 20,
                padding: 16,
                borderRadius: 12,
                border: '1px solid #fed7aa',
                background: '#fff7ed'
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    flexWrap: 'wrap'
                }}
            >
                <div>
                    <strong
                        style={{
                            display: 'block',
                            color: '#9a3412',
                            fontSize: 15
                        }}
                    >
                        ⚠ Nhắc nhở tiếp nhận công việc
                    </strong>

                    <p
                        style={{
                            margin: '7px 0 0',
                            color: '#9a3412',
                            fontSize: 13
                        }}
                    >
                        {reminders.length > 0
                            ? `Bạn có ${reminders.length} công việc chưa tiếp nhận và sẽ bắt đầu trong vòng 24 giờ.`
                            : 'Không thể tải dữ liệu nhắc nhở.'}
                    </p>
                </div>

                {permission === 'default' && (
                    <button
                        type="button"
                        onClick={enableBrowserNotifications}
                        style={{
                            border: 0,
                            borderRadius: 8,
                            padding: '9px 12px',
                            background: '#c2410c',
                            color: '#fff',
                            fontWeight: 650,
                            cursor: 'pointer'
                        }}
                    >
                        Bật thông báo trình duyệt
                    </button>
                )}

                {permission === 'granted' && (
                    <span
                        style={{
                            color: '#28745f',
                            fontSize: 12,
                            fontWeight: 700
                        }}
                    >
                        ✓ Đã bật thông báo
                    </span>
                )}

                {permission === 'denied' && (
                    <span
                        style={{
                            color: '#9a3412',
                            fontSize: 12
                        }}
                    >
                        Thông báo đang bị chặn trong trình duyệt
                    </span>
                )}
            </div>

            {error && (
                <p
                    role="alert"
                    style={{
                        margin: '10px 0 0',
                        color: '#b42318',
                        fontSize: 12
                    }}
                >
                    {error}
                </p>
            )}

            {reminders.length > 0 && (
                <div style={{ marginTop: 12 }}>
                    {reminders.map((assignment) => {
                        const booking = assignment.booking;
                        const assignmentId =
                            assignment.assignmentId || assignment.id;

                        return (
                            <div
                                key={assignmentId}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 12,
                                    flexWrap: 'wrap',
                                    padding: '10px 0',
                                    borderTop: '1px solid #fed7aa'
                                }}
                            >
                                <div>
                                    <strong
                                        style={{
                                            display: 'block',
                                            color: '#7c2d12',
                                            fontSize: 13
                                        }}
                                    >
                                        {booking.bookingCode ||
                                            `Đơn #${booking.id}`}
                                    </strong>

                                    <span
                                        style={{
                                            display: 'block',
                                            color: '#9a3412',
                                            fontSize: 12,
                                            marginTop: 4
                                        }}
                                    >
                                        {formatDate(booking.scheduledStart)}
                                    </span>
                                </div>

                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10
                                    }}
                                >
                                    <strong
                                        style={{
                                            color: '#c2410c',
                                            fontSize: 12
                                        }}
                                    >
                                        {getRemainingText(
                                            booking.scheduledStart
                                        )}
                                    </strong>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            navigate('/cleaner/jobs')
                                        }
                                        style={{
                                            border: '1px solid #fdba74',
                                            borderRadius: 7,
                                            background: '#fff',
                                            padding: '7px 10px',
                                            color: '#9a3412',
                                            fontSize: 12,
                                            fontWeight: 650,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Xem công việc
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {lastUpdated && (
                <small
                    style={{
                        display: 'block',
                        color: '#a16207',
                        marginTop: 8,
                        fontSize: 10
                    }}
                >
                    Cập nhật lúc {formatDate(lastUpdated)}
                    {' · '}
                    Tự kiểm tra lại sau mỗi phút
                </small>
            )}
        </section>
    );
}
