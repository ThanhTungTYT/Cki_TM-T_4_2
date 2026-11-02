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
    const [notification, setNotification] = useState(null);

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
                        setNotification({
                            ...data,
                            localKey: `${data.id || Date.now()}-${Date.now()}`
                        });
                    } catch {
                        setNotification({
                            title: 'Thông báo mới',
                            message: 'Bạn vừa nhận được một thông báo mới.',
                            localKey: String(Date.now())
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

    if (!notification) return null;

    return (
        <div className="admin-realtime-notification">
            <div className="admin-realtime-icon">
                <FontAwesomeIcon icon={faBell} />
            </div>
            <div className="admin-realtime-content">
                <strong>{notification.title || 'Thông báo mới'}</strong>
                <p>{notification.message || 'Bạn vừa nhận được một thông báo mới.'}</p>
                {notification.createdAt && <small>{new Date(notification.createdAt).toLocaleString('vi-VN')}</small>}
            </div>
            <button type="button" onClick={() => setNotification(null)} aria-label="Đóng thông báo">
                <FontAwesomeIcon icon={faXmark} />
            </button>
        </div>
    );
}