import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faCheck } from '@fortawesome/free-solid-svg-icons';
import './CustomerNotifications.css';

const API_URL = 'http://localhost:8080/api/customer/notifications';

function getToken() {
    return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken')
        || sessionStorage.getItem('token') || localStorage.getItem('token');
}

export default function CustomerNotifications() {
    const [items, setItems] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    const refresh = useCallback(async () => {
        const token = getToken();
        if (!token) return;
        try {
            const response = await fetch(API_URL, { headers: { Authorization: `Bearer ${token}` } });
            if (!response.ok) return;
            const data = await response.json();
            setItems(Array.isArray(data.items) ? data.items : []);
            setUnreadCount(Number(data.unreadCount) || 0);
        } catch {
            // Keep the last notification snapshot when the API is temporarily unavailable.
        }
    }, []);

    useEffect(() => {
        const token = getToken();
        if (!token) return undefined;
        refresh();

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const client = new Client({
            brokerURL: `${protocol}//localhost:8080/ws`,
            connectHeaders: { Authorization: `Bearer ${token}` },
            reconnectDelay: 5000,
            onConnect: () => client.subscribe('/user/queue/customer-notifications', message => {
                try {
                    const notification = JSON.parse(message.body);
                    setItems(current => [notification, ...current.filter(item => item.id !== notification.id)].slice(0, 100));
                    setUnreadCount(current => current + 1);
                } catch {
                    refresh();
                }
            })
        });
        client.activate();
        const interval = window.setInterval(refresh, 60000);
        return () => {
            window.clearInterval(interval);
            client.deactivate();
        };
    }, [refresh]);

    const markRead = async notification => {
        if (notification.read) return;
        const token = getToken();
        try {
            const response = await fetch(`${API_URL}/${notification.id}/read`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) return;
            setItems(current => current.map(item => item.id === notification.id ? { ...item, read: true } : item));
            setUnreadCount(current => Math.max(0, current - 1));
        } catch {
            // Leave the item unread so the customer can retry.
        }
    };

    return (
        <div className="customer-notifications-wrap">
            <button
                className="cart-btn customer-notifications-trigger"
                type="button"
                title="Thông báo"
                aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ''}`}
                aria-expanded={isOpen}
                onClick={() => { setIsOpen(open => !open); if (!isOpen) refresh(); }}
            >
                <FontAwesomeIcon icon={faBell} />
                {unreadCount > 0 && <span className="cart-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
            {isOpen && (
                <div className="customer-notifications-panel">
                    <div className="customer-notifications-heading">
                        <strong>Thông báo</strong>
                        {unreadCount > 0 && <span>{unreadCount} chưa đọc</span>}
                    </div>
                    <div className="customer-notifications-list">
                        {items.length ? items.map(item => (
                            <article className={`customer-notification-item${item.read ? '' : ' unread'}`} key={item.id}>
                                <div>
                                    <strong>{item.title}</strong>
                                    <p>{item.message}</p>
                                    <small>{item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : ''}</small>
                                </div>
                                {!item.read && (
                                    <button type="button" title="Đánh dấu đã đọc" onClick={() => markRead(item)}>
                                        <FontAwesomeIcon icon={faCheck} />
                                    </button>
                                )}
                            </article>
                        )) : <p className="customer-notifications-empty">Bạn chưa có thông báo.</p>}
                    </div>
                    <Link to="/customer/bookings" onClick={() => setIsOpen(false)}>Xem đơn hàng</Link>
                </div>
            )}
        </div>
    );
}
