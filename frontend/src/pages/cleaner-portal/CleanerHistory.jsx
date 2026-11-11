
import { useEffect, useMemo, useState } from 'react';
import { bookingApi } from '../../services/api';
import './CleanerWorkspace.css';

const TERMINAL_ASSIGNMENT_STATUSES = [
    'COMPLETED',
    'WORK_SUBMITTED',
    'DECLINED',
    'REJECTED',
    'CANCELLED',
    'EXPIRED'
];

const STATUS_CONFIG = {
    COMPLETED: {
        label: 'Hoàn thành',
        type: 'success'
    },
    WORK_SUBMITTED: {
        label: 'Đã gửi kết quả',
        type: 'waiting'
    },
    DECLINED: {
        label: 'Đã từ chối',
        type: 'cancelled'
    },
    REJECTED: {
        label: 'Bị từ chối',
        type: 'cancelled'
    },
    CANCELLED: {
        label: 'Đã hủy',
        type: 'cancelled'
    },
    EXPIRED: {
        label: 'Hết hạn',
        type: 'cancelled'
    }
};

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

function getStatus(status) {
    const key = String(status || '').toUpperCase();

    return STATUS_CONFIG[key] || {
        label: status || 'Chưa xác định',
        type: 'default'
    };
}

function getServiceNames(booking) {
    const items = Array.isArray(booking?.items)
        ? booking.items
        : [];

    const names = items
        .map((item) => item?.serviceName)
        .filter(Boolean);

    return names.length > 0
        ? [...new Set(names)].join(', ')
        : 'Dịch vụ vệ sinh';
}

function getHistoryTime(assignment, booking) {
    return (
        assignment?.completedAt ||
        booking?.completedAt ||
        assignment?.assignedAt ||
        booking?.updatedAt ||
        booking?.createdAt ||
        null
    );
}

export default function CleanerHistory() {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');

    async function loadHistory(showLoading = true) {
        if (showLoading) {
            setLoading(true);
        } else {
            setRefreshing(true);
        }

        setError('');

        try {
            const rows = await bookingApi.getCleanerAssignments();

            setAssignments(Array.isArray(rows) ? rows : []);
        } catch (err) {
            setError(
                err?.message || 'Không thể tải lịch sử công việc.'
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => {
        loadHistory();

        // Không cần giữ trạng thái cập nhật sau khi component unmount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const history = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return assignments
            .filter((assignment) => {
                const assignmentStatus = String(
                    assignment?.assignmentStatus || ''
                ).toUpperCase();

                const bookingStatus = String(
                    assignment?.booking?.status || ''
                ).toUpperCase();

                return (
                    TERMINAL_ASSIGNMENT_STATUSES.includes(
                        assignmentStatus
                    ) ||
                    ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(
                        bookingStatus
                    )
                );
            })
            .filter((assignment) => {
                const status = String(
                    assignment?.assignmentStatus || ''
                ).toUpperCase();

                if (filter === 'ALL') return true;

                if (filter === 'COMPLETED') {
                    return status === 'COMPLETED';
                }

                if (filter === 'SUBMITTED') {
                    return status === 'WORK_SUBMITTED';
                }

                if (filter === 'CANCELLED') {
                    return [
                        'DECLINED',
                        'REJECTED',
                        'CANCELLED',
                        'EXPIRED'
                    ].includes(status);
                }

                return true;
            })
            .filter((assignment) => {
                if (!keyword) return true;

                const booking = assignment?.booking || {};

                const searchableText = [
                    booking.bookingCode,
                    booking.fullAddress,
                    booking.customerName,
                    getServiceNames(booking),
                    assignment.assignmentId
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();

                return searchableText.includes(keyword);
            })
            .sort((a, b) => {
                const timeA = new Date(
                    getHistoryTime(a, a?.booking) || 0
                ).getTime();

                const timeB = new Date(
                    getHistoryTime(b, b?.booking) || 0
                ).getTime();

                return timeB - timeA;
            });
    }, [assignments, filter, search]);

    const statistics = useMemo(() => {
        return {
            total: assignments.filter((assignment) =>
                TERMINAL_ASSIGNMENT_STATUSES.includes(
                    String(
                        assignment?.assignmentStatus || ''
                    ).toUpperCase()
                )
            ).length,

            completed: assignments.filter(
                (assignment) =>
                    String(
                        assignment?.assignmentStatus || ''
                    ).toUpperCase() === 'COMPLETED'
            ).length,

            submitted: assignments.filter(
                (assignment) =>
                    String(
                        assignment?.assignmentStatus || ''
                    ).toUpperCase() === 'WORK_SUBMITTED'
            ).length,

            cancelled: assignments.filter((assignment) =>
                [
                    'DECLINED',
                    'REJECTED',
                    'CANCELLED',
                    'EXPIRED'
                ].includes(
                    String(
                        assignment?.assignmentStatus || ''
                    ).toUpperCase()
                )
            ).length
        };
    }, [assignments]);

    return (
        <section className="cw-page">
            <header className="cw-heading">
                <div>
                    <span className="cw-eyebrow">
                        CÔNG VIỆC ĐÃ QUA
                    </span>

                    <h1>Lịch sử công việc</h1>

                    <p>
                        Theo dõi các công việc bạn đã thực hiện,
                        đã gửi kết quả hoặc đã từ chối.
                    </p>
                </div>

                <button
                    type="button"
                    className="cw-button"
                    onClick={() => loadHistory(false)}
                    disabled={loading || refreshing}
                >
                    {refreshing ? 'Đang cập nhật...' : 'Làm mới'}
                </button>
            </header>

            <div className="cw-stats-grid">
                <article className="cw-stat-card">
                    <span>Tổng công việc đã qua</span>
                    <strong>{statistics.total}</strong>
                </article>

                <article className="cw-stat-card">
                    <span>Đã hoàn thành</span>
                    <strong>{statistics.completed}</strong>
                </article>

                <article className="cw-stat-card">
                    <span>Đã gửi kết quả</span>
                    <strong>{statistics.submitted}</strong>
                </article>

                <article className="cw-stat-card">
                    <span>Đã từ chối / hủy</span>
                    <strong>{statistics.cancelled}</strong>
                </article>
            </div>

            {error && (
                <div className="cw-alert error">
                    {error}
                </div>
            )}

            <div className="cw-toolbar">
                <div className="cw-tabs">
                    <button
                        type="button"
                        className={filter === 'ALL' ? 'active' : ''}
                        onClick={() => setFilter('ALL')}
                    >
                        Tất cả
                    </button>

                    <button
                        type="button"
                        className={filter === 'COMPLETED' ? 'active' : ''}
                        onClick={() => setFilter('COMPLETED')}
                    >
                        Hoàn thành
                    </button>

                    <button
                        type="button"
                        className={filter === 'SUBMITTED' ? 'active' : ''}
                        onClick={() => setFilter('SUBMITTED')}
                    >
                        Đã gửi kết quả
                    </button>

                    <button
                        type="button"
                        className={filter === 'CANCELLED' ? 'active' : ''}
                        onClick={() => setFilter('CANCELLED')}
                    >
                        Từ chối / hủy
                    </button>
                </div>

                <span className="cw-muted">
                    {history.length} kết quả
                </span>
            </div>

            <div className="cw-search">
                <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm theo mã đơn, dịch vụ hoặc địa chỉ..."
                    aria-label="Tìm kiếm lịch sử công việc"
                />
            </div>

            <div className="cw-panel cw-history-panel">
                {loading ? (
                    <div className="cw-empty">
                        <strong>Đang tải lịch sử...</strong>
                    </div>
                ) : history.length === 0 ? (
                    <div className="cw-empty">
                        <span>🗂️</span>

                        <strong>
                            {search
                                ? 'Không tìm thấy công việc phù hợp'
                                : 'Chưa có lịch sử công việc'}
                        </strong>

                        <p>
                            Các công việc đã kết thúc sẽ xuất hiện tại đây.
                        </p>
                    </div>
                ) : (
                    history.map((assignment) => {
                        const booking = assignment?.booking || {};

                        const status = String(
                            assignment?.assignmentStatus ||
                            booking?.status ||
                            ''
                        ).toUpperCase();

                        const statusConfig = getStatus(status);

                        return (
                            <article
                                className="cw-history-row"
                                key={assignment.assignmentId}
                            >
                                <div
                                    className={`cw-status-dot ${
                                        status === 'COMPLETED'
                                            ? 'success'
                                            : ''
                                    }`}
                                />

                                <div className="cw-history-main">
                                    <strong>
                                        {getServiceNames(booking)}
                                    </strong>

                                    <span>
                                        {booking.fullAddress ||
                                            'Chưa có địa chỉ'}
                                    </span>

                                    <small>
                                        {booking.bookingCode ||
                                            `Mã đơn #${booking.id || '—'}`}
                                        {' · '}
                                        {formatDateTime(
                                            getHistoryTime(
                                                assignment,
                                                booking
                                            )
                                        )}
                                    </small>
                                </div>

                                <div className="cw-history-side">
                                    <b
                                        className={`cw-status-label ${statusConfig.type}`}
                                    >
                                        {statusConfig.label}
                                    </b>

                                    <span>
                                        Mã phân công: #
                                        {assignment.assignmentId}
                                    </span>
                                </div>
                            </article>
                        );
                    })
                )}
            </div>
        </section>
    );
}
