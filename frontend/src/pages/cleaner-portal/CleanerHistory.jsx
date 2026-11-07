import { useEffect, useMemo, useState } from 'react';
import { bookingApi } from '../../services/api';
import './CleanerWorkspace.css';

const terminal = ['COMPLETED', 'DECLINED', 'REJECTED', 'CANCELLED'];

const label = (s) => ({
    COMPLETED: 'Hoàn thành',
    DECLINED: 'Đã từ chối',
    REJECTED: 'Bị từ chối',
    CANCELLED: 'Đã hủy',
    WORK_SUBMITTED: 'Đã gửi nghiệm thu'
}[String(s || '').toUpperCase()] || s || 'Chưa xác định');

const dateTime = (v) => v
    ? new Date(v).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
    : '—';

const money = (v) => v == null
    ? '—'
    : `${Number(v).toLocaleString('vi-VN')}đ`;

export default function CleanerHistory() {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('ALL');

    useEffect(() => {
        let active = true;

        bookingApi.getCleanerAssignments()
            .then((rows) => {
                if (active) {
                    setAssignments(Array.isArray(rows) ? rows : []);
                }
            })
            .catch((e) => {
                if (active) {
                    setError(e.message || 'Không thể tải lịch sử công việc.');
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const history = useMemo(() => assignments
        .filter((a) => {
            const s = String(a.assignmentStatus || '').toUpperCase();

            return terminal.includes(s) ||
                ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(
                    String(a.booking?.status || '').toUpperCase()
                );
        })
        .filter((a) => {
            if (filter === 'ALL') return true;

            if (filter === 'COMPLETED') {
                return String(a.assignmentStatus).toUpperCase() === 'COMPLETED';
            }

            return String(a.assignmentStatus).toUpperCase() !== 'COMPLETED';
        })
        .sort((a, b) =>
            new Date(
                b.completedAt ||
                b.booking?.completedAt ||
                b.assignedAt ||
                0
            ) -
            new Date(
                a.completedAt ||
                a.booking?.completedAt ||
                a.assignedAt ||
                0
            )
        ), [assignments, filter]);

    return (
        <section className="cw-page">
            <header className="cw-heading">
                <div>
                    <span className="cw-eyebrow">CÔNG VIỆC ĐÃ QUA</span>
                    <h1>Lịch sử công việc</h1>
                    <p>
                        Xem lại các phân công đã hoàn thành, từ chối hoặc bị hủy.
                    </p>
                </div>
            </header>

            {error && <div className="cw-alert error">{error}</div>}

            <div className="cw-toolbar">
                <div className="cw-tabs">
                    <button
                        className={filter === 'ALL' ? 'active' : ''}
                        onClick={() => setFilter('ALL')}
                    >
                        Tất cả
                    </button>

                    <button
                        className={filter === 'COMPLETED' ? 'active' : ''}
                        onClick={() => setFilter('COMPLETED')}
                    >
                        Hoàn thành
                    </button>

                    <button
                        className={filter === 'OTHER' ? 'active' : ''}
                        onClick={() => setFilter('OTHER')}
                    >
                        Đã từ chối / hủy
                    </button>
                </div>

                <span className="cw-muted">
                    {history.length} kết quả
                </span>
            </div>

            <div className="cw-panel cw-history-panel">
                {loading ? (
                    <p className="cw-muted">Đang tải lịch sử...</p>
                ) : history.length === 0 ? (
                    <div className="cw-empty">
                        <span>🗂️</span>
                        <strong>Chưa có lịch sử công việc</strong>
                        <p>Các công việc đã kết thúc sẽ xuất hiện tại đây.</p>
                    </div>
                ) : (
                    history.map((a) => {
                        const b = a.booking || {};
                        const status = String(
                            a.assignmentStatus || b.status || ''
                        ).toUpperCase();

                        return (
                            <article
                                className="cw-history-row"
                                key={a.assignmentId}
                            >
                                <div
                                    className={`cw-status-dot ${status === 'COMPLETED' ? 'success' : ''}`}
                                />

                                <div className="cw-history-main">
                                    <strong>
                                        {b.items?.map((x) => x.serviceName)
                                                .filter(Boolean)
                                                .join(', ') ||
                                            b.bookingCode ||
                                            `Đơn #${b.id}`}
                                    </strong>

                                    <span>
                                        {b.fullAddress || 'Chưa có địa chỉ'}
                                    </span>

                                    <small>
                                        {b.bookingCode || `Mã đơn #${b.id}`}
                                        {' · '}
                                        {dateTime(
                                            a.completedAt ||
                                            b.completedAt ||
                                            a.assignedAt
                                        )}
                                    </small>
                                </div>

                                <div className="cw-history-side">
                                    <b>{label(status)}</b>
                                    <span>{money(b.totalAmount)}</span>
                                </div>
                            </article>
                        );
                    })
                )}
            </div>
        </section>
    );
}