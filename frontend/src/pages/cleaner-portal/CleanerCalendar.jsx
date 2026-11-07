import { useEffect, useMemo, useState } from 'react';
import { bookingApi } from '../../services/api';
import './CleanerWorkspace.css';

const pad = (n) => String(n).padStart(2, '0');

const dateKey = (value) => {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime())
        ? ''
        : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const dateLabel = (value) => value
    ? new Date(value).toLocaleString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    })
    : 'Chưa xác định';

const timeLabel = (value) => value
    ? new Date(value).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
    })
    : '--:--';

const statusLabel = (s) => ({
    ASSIGNED: 'Đã phân công',
    ACCEPTED: 'Đã nhận',
    EN_ROUTE: 'Đang di chuyển',
    IN_PROGRESS: 'Đang thực hiện',
    WORK_SUBMITTED: 'Chờ xác nhận',
    COMPLETED: 'Hoàn thành',
    DECLINED: 'Đã từ chối',
    CANCELLED: 'Đã hủy'
}[String(s || '').toUpperCase()] || s || 'Chưa xác định');

export default function CleanerCalendar() {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [month, setMonth] = useState(
        () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    );
    const [selected, setSelected] = useState(dateKey(new Date()));

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
                    setError(e.message || 'Không thể tải lịch làm việc.');
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const jobs = useMemo(() => assignments
        .map((a) => ({ ...a, booking: a.booking || {} }))
        .filter((a) => a.booking.scheduledStart)
        .sort((a, b) =>
            new Date(a.booking.scheduledStart) -
            new Date(b.booking.scheduledStart)
        ), [assignments]);

    const jobsByDay = useMemo(() => jobs.reduce((acc, a) => {
        const key = dateKey(a.booking.scheduledStart);
        (acc[key] ||= []).push(a);
        return acc;
    }, {}), [jobs]);

    const firstDay = new Date(
        month.getFullYear(),
        month.getMonth(),
        1
    );

    const offset = (firstDay.getDay() + 6) % 7;

    const days = new Date(
        month.getFullYear(),
        month.getMonth() + 1,
        0
    ).getDate();

    const selectedJobs = jobsByDay[selected] || [];

    return (
        <section className="cw-page">
            <header className="cw-heading">
                <div>
                    <span className="cw-eyebrow">LỊCH CÁ NHÂN</span>
                    <h1>Lịch làm việc</h1>
                    <p>Theo dõi những công việc được phân công theo ngày.</p>
                </div>

                <button
                    className="cw-button secondary"
                    onClick={() => {
                        setMonth(new Date(
                            new Date().getFullYear(),
                            new Date().getMonth(),
                            1
                        ));
                        setSelected(dateKey(new Date()));
                    }}
                >
                    Hôm nay
                </button>
            </header>

            {error && <div className="cw-alert error">{error}</div>}

            <div className="cw-calendar-layout">
                <div className="cw-panel cw-calendar-panel">
                    <div className="cw-monthbar">
                        <button
                            aria-label="Tháng trước"
                            onClick={() => setMonth(
                                new Date(
                                    month.getFullYear(),
                                    month.getMonth() - 1,
                                    1
                                )
                            )}
                        >
                            ‹
                        </button>

                        <h2>
                            Tháng {month.getMonth() + 1}/{month.getFullYear()}
                        </h2>

                        <button
                            aria-label="Tháng sau"
                            onClick={() => setMonth(
                                new Date(
                                    month.getFullYear(),
                                    month.getMonth() + 1,
                                    1
                                )
                            )}
                        >
                            ›
                        </button>
                    </div>

                    <div className="cw-calendar-grid">
                        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
                            <b key={d}>{d}</b>
                        ))}

                        {Array.from({ length: offset }, (_, i) => (
                            <span
                                className="cw-day empty"
                                key={`e${i}`}
                            />
                        ))}

                        {Array.from({ length: days }, (_, i) => {
                            const d = i + 1;
                            const key = `${month.getFullYear()}-${pad(month.getMonth() + 1)}-${pad(d)}`;

                            return (
                                <button
                                    key={key}
                                    className={`cw-day ${selected === key ? 'selected' : ''} ${dateKey(new Date()) === key ? 'today' : ''}`}
                                    onClick={() => setSelected(key)}
                                >
                                    <span>{d}</span>
                                    {jobsByDay[key]?.length > 0 && (
                                        <i>{jobsByDay[key].length}</i>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="cw-legend">
                        <span><i /> Có công việc</span>
                        <span><b /> Hôm nay</span>
                    </div>
                </div>

                <div className="cw-panel cw-day-panel">
                    <div className="cw-panel-title">
                        <div>
                            <span className="cw-eyebrow">CHI TIẾT NGÀY</span>
                            <h2>
                                {selected
                                    ? dateLabel(`${selected}T12:00:00`)
                                    : 'Chọn một ngày'}
                            </h2>
                        </div>

                        <span className="cw-count">
                            {selectedJobs.length} công việc
                        </span>
                    </div>

                    {loading ? (
                        <p className="cw-muted">Đang tải lịch...</p>
                    ) : selectedJobs.length === 0 ? (
                        <div className="cw-empty">
                            <span>📅</span>
                            <strong>Chưa có công việc</strong>
                            <p>Ngày này chưa có phân công nào dành cho bạn.</p>
                        </div>
                    ) : (
                        <div className="cw-job-list">
                            {selectedJobs.map((a) => {
                                const b = a.booking;

                                return (
                                    <article
                                        className="cw-job"
                                        key={a.assignmentId}
                                    >
                                        <div className="cw-job-time">
                                            {timeLabel(b.scheduledStart)}
                                            <small>
                                                {timeLabel(b.scheduledEnd)}
                                            </small>
                                        </div>

                                        <div className="cw-job-info">
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
                                                {b.receiverName ||
                                                    b.customerName ||
                                                    'Khách hàng'}
                                                {' · '}
                                                {statusLabel(a.assignmentStatus)}
                                            </small>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}