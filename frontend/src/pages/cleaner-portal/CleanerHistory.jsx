
import { useEffect, useMemo, useState } from 'react';
import { bookingApi } from '../../services/api';
import './CleanerWorkspace.css';

const TERMINAL_STATUSES = [
    'COMPLETED',
    'WORK_SUBMITTED',
    'DECLINED',
    'REJECTED',
    'CANCELLED',
    'EXPIRED'
];

const CANCELLED_STATUSES = [
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

const PAGE_SIZE = 8;

function normalizeStatus(value) {
    return String(value || '').trim().toUpperCase();
}

function getAssignmentStatus(assignment) {
    const assignmentStatus = normalizeStatus(
        assignment?.assignmentStatus ||
        assignment?.status
    );

    const bookingStatus = normalizeStatus(
        assignment?.booking?.status
    );

    // Ưu tiên trạng thái kết thúc của chính phân công.
    if (TERMINAL_STATUSES.includes(assignmentStatus)) {
        return assignmentStatus;
    }

    // Nếu đơn đã bị hủy nhưng phân công chưa có trạng thái kết thúc.
    if (
        ['CANCELLED', 'REJECTED'].includes(bookingStatus)
    ) {
        return bookingStatus;
    }

    return assignmentStatus || bookingStatus || 'UNKNOWN';
}

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

function getDateKey(value) {
    if (!value) return '';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function getStatusConfig(status) {
    return STATUS_CONFIG[normalizeStatus(status)] || {
        label: 'Chưa xác định',
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
        assignment?.workSubmittedAt ||
        booking?.completedAt ||
        assignment?.updatedAt ||
        assignment?.assignedAt ||
        booking?.updatedAt ||
        booking?.createdAt ||
        null
    );
}

function isHistoryAssignment(assignment) {
    const assignmentStatus = normalizeStatus(
        assignment?.assignmentStatus ||
        assignment?.status
    );

    const bookingStatus = normalizeStatus(
        assignment?.booking?.status
    );

    return (
        TERMINAL_STATUSES.includes(assignmentStatus) ||
        ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(
            bookingStatus
        )
    );
}

export default function CleanerHistory() {
    const [assignments, setAssignments] = useState([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [error, setError] = useState('');

    const [filter, setFilter] = useState('ALL');
    const [search, setSearch] = useState('');

    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [page, setPage] = useState(1);

    // Tải lịch sử lần đầu.
    useEffect(() => {
        let active = true;

        const fetchHistory = async () => {
            try {
                const rows = await bookingApi.getCleanerAssignments();

                if (!active) return;

                setAssignments(Array.isArray(rows) ? rows : []);
                setError('');
            } catch (err) {
                if (active) {
                    setError(
                        err?.message ||
                        'Không thể tải lịch sử công việc.'
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        fetchHistory();

        return () => {
            active = false;
        };
    }, []);

    // Làm mới dữ liệu.
    const loadHistory = async () => {
        setRefreshing(true);
        setError('');

        try {
            const rows = await bookingApi.getCleanerAssignments();

            setAssignments(Array.isArray(rows) ? rows : []);
        } catch (err) {
            setError(
                err?.message ||
                'Không thể tải lịch sử công việc.'
            );
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    };

    // Chuẩn hóa danh sách lịch sử.
    const allHistory = useMemo(() => {
        return assignments
            .filter(isHistoryAssignment)
            .map((assignment) => ({
                ...assignment,
                historyStatus: getAssignmentStatus(assignment),
                booking: assignment?.booking || {}
            }))
            .sort((a, b) => {
                const timeA = new Date(
                    getHistoryTime(a, a.booking) || 0
                ).getTime();

                const timeB = new Date(
                    getHistoryTime(b, b.booking) || 0
                ).getTime();

                return timeB - timeA;
            });
    }, [assignments]);

    // Thống kê toàn bộ lịch sử, không phụ thuộc bộ lọc tìm kiếm.
    const statistics = useMemo(() => {
        return {
            total: allHistory.length,

            completed: allHistory.filter(
                (item) => item.historyStatus === 'COMPLETED'
            ).length,

            submitted: allHistory.filter(
                (item) => item.historyStatus === 'WORK_SUBMITTED'
            ).length,

            cancelled: allHistory.filter((item) =>
                CANCELLED_STATUSES.includes(item.historyStatus)
            ).length
        };
    }, [allHistory]);

    // Lọc trạng thái, từ khóa và thời gian.
    const filteredHistory = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return allHistory.filter((assignment) => {
            const status = assignment.historyStatus;
            const booking = assignment.booking;

            if (filter === 'COMPLETED' && status !== 'COMPLETED') {
                return false;
            }

            if (
                filter === 'SUBMITTED' &&
                status !== 'WORK_SUBMITTED'
            ) {
                return false;
            }

            if (
                filter === 'CANCELLED' &&
                !CANCELLED_STATUSES.includes(status)
            ) {
                return false;
            }

            const historyDate = getDateKey(
                getHistoryTime(assignment, booking)
            );

            if (dateFrom && (!historyDate || historyDate < dateFrom)) {
                return false;
            }

            if (dateTo && (!historyDate || historyDate > dateTo)) {
                return false;
            }

            if (keyword) {
                const searchableText = [
                    booking.bookingCode,
                    booking.fullAddress,
                    booking.customerName,
                    booking.receiverName,
                    getServiceNames(booking),
                    assignment.assignmentId,
                    booking.id
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();

                if (!searchableText.includes(keyword)) {
                    return false;
                }
            }

            return true;
        });
    }, [
        allHistory,
        filter,
        search,
        dateFrom,
        dateTo
    ]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredHistory.length / PAGE_SIZE)
    );

    const currentPage = Math.min(page, totalPages);

    const paginatedHistory = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;

        return filteredHistory.slice(
            start,
            start + PAGE_SIZE
        );
    }, [filteredHistory, currentPage]);

    const handleFilterChange = (value) => {
        setFilter(value);
        setPage(1);
    };

    const handleSearchChange = (value) => {
        setSearch(value);
        setPage(1);
    };

    const handleDateFromChange = (value) => {
        setDateFrom(value);
        setPage(1);
    };

    const handleDateToChange = (value) => {
        setDateTo(value);
        setPage(1);
    };

    const clearFilters = () => {
        setFilter('ALL');
        setSearch('');
        setDateFrom('');
        setDateTo('');
        setPage(1);
    };

    return (
        <section className="cw-page">
            <header className="cw-heading">
                <div>
                    <span className="cw-eyebrow">
                        CÔNG VIỆC ĐÃ QUA
                    </span>

                    <h1>Lịch sử công việc</h1>

                    <p>
                        Theo dõi các công việc đã hoàn thành,
                        đã gửi kết quả hoặc đã kết thúc phân công.
                    </p>
                </div>

                <button
                    type="button"
                    className="cw-button"
                    onClick={loadHistory}
                    disabled={loading || refreshing}
                >
                    {refreshing ? 'Đang cập nhật...' : 'Làm mới'}
                </button>
            </header>

            {error && (
                <div className="cw-alert error" role="alert">
                    {error}
                </div>
            )}

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

            <div className="cw-panel cw-history-panel">
                <div className="cw-toolbar">
                    <div className="cw-tabs">
                        <button
                            type="button"
                            className={filter === 'ALL' ? 'active' : ''}
                            onClick={() => handleFilterChange('ALL')}
                        >
                            Tất cả
                        </button>

                        <button
                            type="button"
                            className={
                                filter === 'COMPLETED' ? 'active' : ''
                            }
                            onClick={() =>
                                handleFilterChange('COMPLETED')
                            }
                        >
                            Hoàn thành
                        </button>

                        <button
                            type="button"
                            className={
                                filter === 'SUBMITTED' ? 'active' : ''
                            }
                            onClick={() =>
                                handleFilterChange('SUBMITTED')
                            }
                        >
                            Đã gửi kết quả
                        </button>

                        <button
                            type="button"
                            className={
                                filter === 'CANCELLED' ? 'active' : ''
                            }
                            onClick={() =>
                                handleFilterChange('CANCELLED')
                            }
                        >
                            Từ chối / hủy
                        </button>
                    </div>

                    <span className="cw-muted">
                        {filteredHistory.length} kết quả
                    </span>
                </div>

                <div className="cw-search">
                    <input
                        type="search"
                        value={search}
                        onChange={(event) =>
                            handleSearchChange(event.target.value)
                        }
                        placeholder="Tìm theo mã đơn, dịch vụ hoặc địa chỉ..."
                        aria-label="Tìm kiếm lịch sử công việc"
                    />
                </div>

                <div className="cw-toolbar">
                    <label>
                        Từ ngày
                        <input
                            type="date"
                            value={dateFrom}
                            max={dateTo || undefined}
                            onChange={(event) =>
                                handleDateFromChange(event.target.value)
                            }
                        />
                    </label>

                    <label>
                        Đến ngày
                        <input
                            type="date"
                            value={dateTo}
                            min={dateFrom || undefined}
                            onChange={(event) =>
                                handleDateToChange(event.target.value)
                            }
                        />
                    </label>

                    <button
                        type="button"
                        className="cw-text-button"
                        onClick={clearFilters}
                        disabled={
                            filter === 'ALL' &&
                            !search &&
                            !dateFrom &&
                            !dateTo
                        }
                    >
                        Xóa bộ lọc
                    </button>
                </div>

                {loading ? (
                    <div className="cw-empty">
                        <strong>Đang tải lịch sử...</strong>
                    </div>
                ) : filteredHistory.length === 0 ? (
                    <div className="cw-empty">
                        <span>🗂️</span>

                        <strong>
                            {search || dateFrom || dateTo ||
                            filter !== 'ALL'
                                ? 'Không tìm thấy công việc phù hợp'
                                : 'Chưa có lịch sử công việc'}
                        </strong>

                        <p>
                            Các phân công đã kết thúc sẽ xuất hiện tại đây.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="cw-history-list">
                            {paginatedHistory.map((assignment) => {
                                const booking = assignment.booking;

                                const status = assignment.historyStatus;

                                const statusConfig =
                                    getStatusConfig(status);

                                const historyTime = getHistoryTime(
                                    assignment,
                                    booking
                                );

                                return (
                                    <article
                                        className="cw-history-row"
                                        key={
                                            assignment.assignmentId ||
                                            assignment.id
                                        }
                                    >
                                        <div
                                            className={
                                                `cw-status-dot ${
                                                    status === 'COMPLETED'
                                                        ? 'success'
                                                        : ''
                                                }`
                                            }
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
                                            </small>

                                            <small>
                                                Thời gian ghi nhận:{' '}
                                                {formatDateTime(historyTime)}
                                            </small>

                                            {booking.scheduledStart && (
                                                <small>
                                                    Lịch làm việc:{' '}
                                                    {formatDateTime(
                                                        booking.scheduledStart
                                                    )}
                                                </small>
                                            )}
                                        </div>

                                        <div className="cw-history-side">
                                            <b
                                                className={
                                                    `cw-status-label ${statusConfig.type}`
                                                }
                                            >
                                                {statusConfig.label}
                                            </b>

                                            <span>
                                                Phân công: #
                                                {assignment.assignmentId || '—'}
                                            </span>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>

                        {totalPages > 1 && (
                            <div className="cw-pagination">
                                <button
                                    type="button"
                                    className="cw-button secondary"
                                    disabled={currentPage <= 1}
                                    onClick={() =>
                                        setPage((previous) =>
                                            Math.max(1, previous - 1)
                                        )
                                    }
                                >
                                    Trang trước
                                </button>

                                <span>
                                    Trang {currentPage} / {totalPages}
                                </span>

                                <button
                                    type="button"
                                    className="cw-button secondary"
                                    disabled={currentPage >= totalPages}
                                    onClick={() =>
                                        setPage((previous) =>
                                            Math.min(
                                                totalPages,
                                                previous + 1
                                            )
                                        )
                                    }
                                >
                                    Trang sau
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}
