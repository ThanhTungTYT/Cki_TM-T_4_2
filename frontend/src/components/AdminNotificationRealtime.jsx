import { useEffect, useState } from 'react';
import { Client } from '@stomp/stompjs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faXmark } from '@fortawesome/free-solid-svg-icons';
import './AdminNotificationRealtime.css';

function getToken() {
    return sessionStorage.getItem('accessToken')
        || localStorage.getItem('accessToken')
        || sessionStorage.getItem('token')
        || localStorage.getItem('token');
}

function getRole() {
    try {
        const user = JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || '{}');
        return String(user.role || '').replace(/^ROLE_/i, '').toUpperCase();
    } catch {
        return '';
    }
}

export default function AdminNotificationRealtime() {
    const [notifications, setNotifications] = useState([]);

    const pushToast = (item) => {
        const key = `${item.id || Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const entry = { ...item, localKey: key };
        setNotifications((prev) => [entry, ...prev].slice(0, 3));
        window.setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.localKey !== key));
        }, 9000);
    };

    const dismissToast = (localKey) => {
        setNotifications((prev) => prev.filter((n) => n.localKey !== localKey));
    };

    useEffect(() => {
        const token = getToken();
        const role = getRole();

        if (!token || !['ADMIN', 'STAFF'].includes(role)) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const client = new Client({
            brokerURL: `${protocol}//localhost:8080/ws`,
            connectHeaders: {
                Authorization: `Bearer ${token}`
            },
            reconnectDelay: 5000,
            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,
            onConnect: () => {
                client.subscribe('/user/queue/admin-notifications', message => {
                    try {
                        const data = JSON.parse(message.body);
                        pushToast(data);
                    } catch {
                        pushToast({
                            title: 'Thông báo mới',
                            message: 'Bạn vừa nhận được một thông báo mới.'
                        });
                    }
                });
            },
            onStompError: frame => {
                console.error('WebSocket STOMP error:', frame.headers?.message || frame.body);
            }
        });

        client.activate();

        return () => {
            client.deactivate();
        };
    }, []);

    if (notifications.length === 0) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 16,
                right: 16,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                maxWidth: 380
            }}
        >
            {notifications.map((notification) => (
                <div
                    key={notification.localKey}
                    className="admin-realtime-notification"
                    style={{ position: 'static', margin: 0 }}
                >
                    <div className="admin-realtime-icon">
                        <FontAwesomeIcon icon={faBell} />
                    </div>
                    <div className="admin-realtime-content">
                        <strong>{notification.title || 'Thông báo mới'}</strong>
                        <p>{notification.message || 'Bạn vừa nhận được một thông báo mới.'}</p>
                        {notification.createdAt && <small>{new Date(notification.createdAt).toLocaleString('vi-VN')}</small>}
                    </div>
                    <button
                        type="button"
                        onClick={() => dismissToast(notification.localKey)}
                        aria-label="Đóng thông báo"
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
            ))}
        </div>
    );
}