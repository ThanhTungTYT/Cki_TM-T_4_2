
import { useCallback, useEffect, useMemo, useState } from 'react';
import { bookingApi } from '../../services/api';
import './CleanerJobs.css';

const STATUS_CONFIG = {
    ASSIGNED: { label: 'Chờ nhận việc', type: 'assigned' },
    ACCEPTED: { label: 'Đã nhận việc', type: 'confirmed' },
    EN_ROUTE: { label: 'Đang di chuyển', type: 'progress' },
    IN_PROGRESS: { label: 'Đang thực hiện', type: 'progress' },
    WORK_SUBMITTED: { label: 'Đã gửi kết quả', type: 'waiting' },
    PENDING_COMPLETION: { label: 'Chờ nghiệm thu', type: 'waiting' },
    COMPLETED: { label: 'Hoàn thành', type: 'completed' },
    DECLINED: { label: 'Đã từ chối', type: 'cancelled' },
    CANCELLED: { label: 'Đã hủy', type: 'cancelled' },
    REJECTED: { label: 'Bị từ chối', type: 'cancelled' },
    EXPIRED: { label: 'Hết hạn', type: 'cancelled' }
};

const FILTERS = [
    { value: 'ALL', label: 'Tất cả' },
    { value: 'UPCOMING', label: 'Sắp thực hiện' },
    { value: 'IN_PROGRESS', label: 'Đang thực hiện' },
    { value: 'COMPLETED', label: 'Hoàn thành' },
    { value: 'CANCELLED', label: 'Đã hủy' }
];

const INCIDENT_CATEGORIES = [
    { value: 'PROPERTY_DAMAGE', label: 'Hư hỏng tài sản' },
    { value: 'MISSING_EQUIPMENT', label: 'Thiếu dụng cụ' },
    { value: 'SAFETY', label: 'Vấn đề an toàn' },
    { value: 'CUSTOMER_ISSUE', label: 'Vấn đề với khách hàng' },
    { value: 'SERVICE_PROBLEM', label: 'Vấn đề dịch vụ' },
    { value: 'OTHER', label: 'Khác' }
];

const INCIDENT_SEVERITIES = [
    { value: 'LOW', label: 'Thấp' },
    { value: 'MEDIUM', label: 'Trung bình' },
    { value: 'HIGH', label: 'Cao' },
    { value: 'CRITICAL', label: 'Nghiêm trọng' }
];

const SEVERITY_LABELS = {
    LOW: 'Thấp',
    MEDIUM: 'Trung bình',
    HIGH: 'Cao',
    CRITICAL: 'Nghiêm trọng'
};

const CATEGORY_LABELS = Object.fromEntries(
    INCIDENT_CATEGORIES.map((item) => [item.value, item.label])
);

function formatDate(value) {
    if (!value) return 'Chưa có thời gian';

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
        type: 'pending'
    };
}

function getFilterGroup(status) {
    const key = String(status || '').toUpperCase();

    if (key === 'COMPLETED') return 'COMPLETED';

    if (
        ['CANCELLED', 'REJECTED', 'EXPIRED', 'DECLINED'].includes(key)
    ) {
        return 'CANCELLED';
    }

    if (
        [
            'ACCEPTED',
            'EN_ROUTE',
            'IN_PROGRESS',
            'WORK_SUBMITTED',
            'PENDING_COMPLETION'
        ].includes(key)
    ) {
        return 'IN_PROGRESS';
    }

    return 'UPCOMING';
}

function getServiceNames(booking) {
    const items = Array.isArray(booking?.items)
        ? booking.items
        : [];

    const names = items
        .map((item) => item?.serviceName)
        .filter(Boolean);

    return names.length
        ? [...new Set(names)].join(', ')
        : 'Chưa có thông tin dịch vụ';
}

function getImageUrls(log) {
    if (Array.isArray(log?.imageUrls)) return log.imageUrls;

    if (typeof log?.imageUrls === 'string') {
        return log.imageUrls
            .split('\n')
            .map((url) => url.trim())
            .filter(Boolean);
    }

    return [];
}

function CleanerJobs() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('ALL');
    const [expandedId, setExpandedId] = useState(null);
    const [processingId, setProcessingId] = useState(null);

    const [actionFeedback, setActionFeedback] = useState({});

    const [workLogs, setWorkLogs] = useState({});
    const [logType, setLogType] = useState({});
    const [logNote, setLogNote] = useState({});
    const [incidentSeverity, setIncidentSeverity] = useState({});
    const [incidentCategory, setIncidentCategory] = useState({});
    const [logLoading, setLogLoading] = useState({});
    const [logFeedback, setLogFeedback] = useState({});
    const [selectedImages, setSelectedImages] = useState({});

    const fetchBookings = useCallback(async () => {
        const assignments = await bookingApi.getCleanerAssignments();

        if (!Array.isArray(assignments)) return [];

        return assignments
            .filter((assignment) => assignment?.booking)
            .map((assignment) => ({
                ...assignment.booking,
                cleanerAssignment: assignment
            }));
    }, []);

    const loadBookings = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const data = await fetchBookings();
            setBookings(data);
        } catch (err) {
            setError(
                err?.message || 'Không thể tải danh sách công việc.'
            );
        } finally {
            setLoading(false);
        }
    }, [fetchBookings]);

    useEffect(() => {
        let cancelled = false;

        fetchBookings()
            .then((data) => {
                if (!cancelled) setBookings(data);
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(
                        err?.message || 'Không thể tải danh sách công việc.'
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [fetchBookings]);

    function setLogMessage(assignmentId, type, message) {
        setLogFeedback((prev) => ({
            ...prev,
            [assignmentId]: { type, message }
        }));
    }

    function readImagePreview(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Không thể đọc ảnh.'));

            reader.readAsDataURL(file);
        });
    }

    async function handleSelectWorkLogImages(assignmentId, fileList) {
        const files = Array.from(fileList || []);
        const current = selectedImages[assignmentId] || [];
        const slots = 5 - current.length;

        if (slots <= 0) {
            setLogMessage(
                assignmentId,
                'error',
                'Mỗi báo cáo chỉ được đính kèm tối đa 5 ảnh.'
            );
            return;
        }

        const accepted = files.slice(0, slots);
        const newImages = [];

        for (const file of accepted) {
            if (
                !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
            ) {
                setLogMessage(
                    assignmentId,
                    'error',
                    'Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.'
                );
                continue;
            }

            if (file.size > 5 * 1024 * 1024) {
                setLogMessage(
                    assignmentId,
                    'error',
                    `Ảnh ${file.name} vượt quá 5 MB.`
                );
                continue;
            }

            try {
                const preview = await readImagePreview(file);
                newImages.push({ file, preview });
            } catch {
                setLogMessage(
                    assignmentId,
                    'error',
                    'Không thể đọc một ảnh đã chọn.'
                );
            }
        }

        setSelectedImages((prev) => ({
            ...prev,
            [assignmentId]: [
                ...(prev[assignmentId] || []),
                ...newImages
            ].slice(0, 5)
        }));
    }

    function handleRemoveWorkLogImage(assignmentId, indexToRemove) {
        setSelectedImages((prev) => ({
            ...prev,
            [assignmentId]: (prev[assignmentId] || []).filter(
                (_, index) => index !== indexToRemove
            )
        }));
    }

    async function loadWorkLogs(assignmentId) {
        if (!assignmentId) return;

        setLogLoading((prev) => ({
            ...prev,
            [assignmentId]: true
        }));

        try {
            const data = await bookingApi.getCleanerWorkLogs(assignmentId);

            setWorkLogs((prev) => ({
                ...prev,
                [assignmentId]: Array.isArray(data) ? data : []
            }));
        } catch (err) {
            setLogMessage(
                assignmentId,
                'error',
                err?.message || 'Không thể tải nhật ký công việc.'
            );
        } finally {
            setLogLoading((prev) => ({
                ...prev,
                [assignmentId]: false
            }));
        }
    }

    async function handleSubmitWorkLog(assignmentId) {
        if (!assignmentId || logLoading[assignmentId]) return;

        const note = (logNote[assignmentId] || '').trim();
        const type = logType[assignmentId] || 'PROGRESS';

        if (!note) {
            setLogMessage(
                assignmentId,
                'error',
                'Vui lòng nhập nội dung nhật ký.'
            );
            return;
        }

        if (note.length > 5000) {
            setLogMessage(
                assignmentId,
                'error',
                'Nội dung không được vượt quá 5000 ký tự.'
            );
            return;
        }

        const severity = incidentSeverity[assignmentId] || 'MEDIUM';
        const category = incidentCategory[assignmentId] || 'OTHER';

        setLogLoading((prev) => ({
            ...prev,
            [assignmentId]: true
        }));

        setLogFeedback((prev) => ({
            ...prev,
            [assignmentId]: null
        }));

        try {
            const images = selectedImages[assignmentId] || [];
            const imageUrls = [];

            for (const image of images) {
                const uploaded =
                    await bookingApi.uploadCleanerWorkLogImage(image.file);

                if (!uploaded?.imageUrl) {
                    throw new Error(
                        'Máy chủ không trả về đường dẫn ảnh.'
                    );
                }

                imageUrls.push(uploaded.imageUrl);
            }

            const payload = {
                logType: type,
                note,
                imageUrls
            };

            if (type === 'INCIDENT') {
                payload.severity = severity;
                payload.category = category;
            }

            await bookingApi.createCleanerWorkLog(
                assignmentId,
                payload
            );

            setLogNote((prev) => ({
                ...prev,
                [assignmentId]: ''
            }));

            setSelectedImages((prev) => ({
                ...prev,
                [assignmentId]: []
            }));

            setLogMessage(
                assignmentId,
                'success',
                type === 'INCIDENT'
                    ? 'Đã gửi báo cáo sự cố. Nhà cung cấp cần tiếp nhận và xử lý.'
                    : 'Đã gửi nhật ký tiến độ.'
            );

            await loadWorkLogs(assignmentId);
        } catch (err) {
            setLogMessage(
                assignmentId,
                'error',
                err?.message || 'Không thể gửi nhật ký.'
            );
        } finally {
            setLogLoading((prev) => ({
                ...prev,
                [assignmentId]: false
            }));
        }
    }

    async function handleBookingAction(booking, action) {
        if (processingId !== null) return;

        const assignment = booking.cleanerAssignment;
        const assignmentId =
            assignment?.assignmentId || assignment?.id;

        if (!assignmentId) {
            setActionFeedback((prev) => ({
                ...prev,
                [booking.id]: {
                    type: 'error',
                    message: 'Không tìm thấy phân công của bạn.'
                }
            }));
            return;
        }

        const messages = {
            ACCEPT: 'Đã nhận công việc.',
            START_JOB: 'Đã bắt đầu thực hiện công việc.',
            SUBMIT_COMPLETION: 'Đã gửi kết quả công việc.'
        };

        setProcessingId(booking.id);

        try {
            await bookingApi.executeCleanerAssignmentAction(
                assignmentId,
                action
            );

            setActionFeedback((prev) => ({
                ...prev,
                [booking.id]: {
                    type: 'success',
                    message: messages[action] || 'Cập nhật thành công.'
                }
            }));

            await loadBookings();
        } catch (err) {
            setActionFeedback((prev) => ({
                ...prev,
                [booking.id]: {
                    type: 'error',
                    message:
                        err?.message || 'Không thể cập nhật công việc.'
                }
            }));

            await loadBookings();
        } finally {
            setProcessingId(null);
        }
    }

    async function handleDeclineAssignment(booking) {
        if (processingId !== null) return;

        const assignment = booking.cleanerAssignment;
        const assignmentId =
            assignment?.assignmentId || assignment?.id;

        if (!assignmentId) return;

        const note = window.prompt(
            'Nhập lý do từ chối công việc:'
        );

        if (note === null) return;

        if (!note.trim()) {
            window.alert('Vui lòng nhập lý do từ chối.');
            return;
        }

        setProcessingId(booking.id);

        try {
            await bookingApi.executeCleanerAssignmentAction(
                assignmentId,
                'DECLINE',
                note.trim()
            );

            setActionFeedback((prev) => ({
                ...prev,
                [booking.id]: {
                    type: 'success',
                    message: 'Đã gửi yêu cầu từ chối phân công.'
                }
            }));

            await loadBookings();
        } catch (err) {
            setActionFeedback((prev) => ({
                ...prev,
                [booking.id]: {
                    type: 'error',
                    message: err?.message || 'Không thể từ chối phân công.'
                }
            }));

            await loadBookings();
        } finally {
            setProcessingId(null);
        }
    }

    const stats = useMemo(() => ({
        total: bookings.length,
        upcoming: bookings.filter((booking) =>
            getFilterGroup(
                booking.cleanerAssignment?.assignmentStatus || booking.status
            ) === 'UPCOMING'
        ).length,
        inProgress: bookings.filter((booking) =>
            getFilterGroup(
                booking.cleanerAssignment?.assignmentStatus || booking.status
            ) === 'IN_PROGRESS'
        ).length,
        completed: bookings.filter((booking) =>
            getFilterGroup(
                booking.cleanerAssignment?.assignmentStatus || booking.status
            ) === 'COMPLETED'
        ).length
    }), [bookings]);

    const filteredBookings = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return bookings.filter((booking) => {
            const status =
                booking.cleanerAssignment?.assignmentStatus ||
                booking.status;

            const matchFilter =
                filter === 'ALL' ||
                getFilterGroup(status) === filter;

            const searchableText = [
                booking.bookingCode,
                booking.customerName,
                booking.customerPhone,
                booking.fullAddress,
                getServiceNames(booking)
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return matchFilter &&
                (!keyword || searchableText.includes(keyword));
        });
    }, [bookings, filter, search]);

    const urgentPendingBookings = useMemo(() => {
        const now = Date.now();
        const windowMs = 24 * 60 * 60 * 1000;

        return bookings.filter((booking) => {
            const status = String(
                booking.cleanerAssignment?.assignmentStatus || ''
            ).toUpperCase();

            const start = new Date(booking.scheduledStart).getTime();

            return status === 'ASSIGNED' &&
                Number.isFinite(start) &&
                start >= now &&
                start - now <= windowMs;
        });
    }, [bookings]);

    return (
        <div className="cj-page">
            <div className="cj-header">
                <div>
                    <h1>Công việc của tôi</h1>
                    <p>
                        Danh sách công việc được nhà cung cấp phân công cho bạn.
                    </p>
                </div>

                <button
                    type="button"
                    className="cj-refresh-btn"
                    onClick={loadBookings}
                    disabled={loading}
                >
                    ↻ Làm mới
                </button>
            </div>

            {urgentPendingBookings.length > 0 && (
                <div className="cj-urgent-reminder">
                    <h3>⚠ Nhắc nhở tiếp nhận công việc</h3>
                    <p>
                        Bạn có {urgentPendingBookings.length} công việc chưa
                        tiếp nhận và sắp đến giờ thực hiện.
                    </p>

                    {urgentPendingBookings.map((booking) => (
                        <div key={booking.id}>
                            <strong>
                                {booking.bookingCode || `Đơn #${booking.id}`}
                            </strong>
                            <span>{formatDate(booking.scheduledStart)}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="cj-stats">
                <div className="cj-stat-card">
                    <div className="cj-stat-icon cj-icon-blue">▤</div>
                    <div>
                        <span>Tổng công việc</span>
                        <strong>{stats.total}</strong>
                    </div>
                </div>

                <div className="cj-stat-card">
                    <div className="cj-stat-icon cj-icon-orange">◷</div>
                    <div>
                        <span>Sắp thực hiện</span>
                        <strong>{stats.upcoming}</strong>
                    </div>
                </div>

                <div className="cj-stat-card">
                    <div className="cj-stat-icon cj-icon-purple">⚙</div>
                    <div>
                        <span>Đang thực hiện</span>
                        <strong>{stats.inProgress}</strong>
                    </div>
                </div>

                <div className="cj-stat-card">
                    <div className="cj-stat-icon cj-icon-green">✓</div>
                    <div>
                        <span>Đã hoàn thành</span>
                        <strong>{stats.completed}</strong>
                    </div>
                </div>
            </div>

            <div className="cj-toolbar">
                <div className="cj-search">
                    <span>⌕</span>
                    <input
                        type="text"
                        placeholder="Tìm mã đơn, khách hàng, địa chỉ..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>

                <div className="cj-filters">
                    {FILTERS.map((item) => (
                        <button
                            type="button"
                            key={item.value}
                            className={filter === item.value ? 'active' : ''}
                            onClick={() => setFilter(item.value)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading && (
                <div className="cj-message">
                    <div className="cj-spinner" />
                    <p>Đang tải danh sách công việc...</p>
                </div>
            )}

            {!loading && error && (
                <div className="cj-error">
                    <strong>Không tải được công việc</strong>
                    <p>{error}</p>
                    <button type="button" onClick={loadBookings}>
                        Thử lại
                    </button>
                </div>
            )}

            {!loading && !error && filteredBookings.length === 0 && (
                <div className="cj-empty">
                    <div className="cj-empty-icon">▤</div>
                    <h3>
                        {bookings.length === 0
                            ? 'Bạn chưa có công việc nào'
                            : 'Không tìm thấy công việc phù hợp'}
                    </h3>
                    <p>
                        {bookings.length === 0
                            ? 'Các công việc được nhà cung cấp phân công sẽ xuất hiện tại đây.'
                            : 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.'}
                    </p>
                    {(search || filter !== 'ALL') && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearch('');
                                setFilter('ALL');
                            }}
                        >
                            Xóa bộ lọc
                        </button>
                    )}
                </div>
            )}

            {!loading && !error && filteredBookings.length > 0 && (
                <div className="cj-booking-list">
                    {filteredBookings.map((booking) => {
                        const assignment = booking.cleanerAssignment || {};
                        const assignmentId =
                            assignment.assignmentId || assignment.id;

                        const assignmentStatus = String(
                            assignment.assignmentStatus ||
                            booking.status ||
                            ''
                        ).toUpperCase();

                        const status = getStatus(assignmentStatus);
                        const expanded = expandedId === booking.id;
                        const busy = processingId === booking.id;

                        const canWriteLog = [
                            'ACCEPTED',
                            'IN_PROGRESS'
                        ].includes(assignmentStatus);

                        return (
                            <article
                                className="cj-booking-card"
                                key={assignmentId || booking.id}
                            >
                                <div className="cj-card-top">
                                    <div>
                                        <span className="cj-booking-code">
                                            MÃ ĐƠN:{' '}
                                            {booking.bookingCode ||
                                                `#${booking.id}`}
                                        </span>

                                        <h3>
                                            {booking.customerName || 'Khách hàng'}
                                        </h3>
                                    </div>

                                    <span
                                        className={`cj-status cj-status-${status.type}`}
                                    >
                                        {status.label}
                                    </span>
                                </div>

                                <div className="cj-card-info">
                                    <div>
                                        <span className="cj-info-label">
                                            Thời gian thực hiện
                                        </span>
                                        <strong>
                                            {formatDate(booking.scheduledStart)}
                                        </strong>
                                    </div>

                                    <div>
                                        <span className="cj-info-label">
                                            Địa chỉ làm việc
                                        </span>
                                        <strong>
                                            {booking.fullAddress || 'Chưa có địa chỉ'}
                                        </strong>
                                    </div>

                                    <div>
                                        <span className="cj-info-label">
                                            Dịch vụ
                                        </span>
                                        <strong>{getServiceNames(booking)}</strong>
                                    </div>

                                    <div>
                                        <span className="cj-info-label">
                                            Thời lượng
                                        </span>
                                        <strong>
                                            {booking.durationMinutes
                                                ? `${booking.durationMinutes} phút`
                                                : 'Theo lịch phân công'}
                                        </strong>
                                    </div>
                                </div>

                                <div className="cj-card-bottom">
                                    <span>
                                        {booking.items?.length || 0} hạng mục dịch vụ
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const next = expanded
                                                ? null
                                                : booking.id;

                                            setExpandedId(next);

                                            if (next && assignmentId) {
                                                loadWorkLogs(assignmentId);
                                            }
                                        }}
                                    >
                                        {expanded ? 'Thu gọn' : 'Xem thông tin'}
                                        <span>{expanded ? '⌃' : '⌄'}</span>
                                    </button>
                                </div>

                                <div className="cj-actions">
                                    {assignmentStatus === 'ASSIGNED' && (
                                        <>
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() =>
                                                    handleBookingAction(
                                                        booking,
                                                        'ACCEPT'
                                                    )
                                                }
                                            >
                                                {busy ? 'Đang xử lý...' : 'Nhận việc'}
                                            </button>

                                            <button
                                                type="button"
                                                className="cj-decline-btn"
                                                disabled={busy}
                                                onClick={() =>
                                                    handleDeclineAssignment(booking)
                                                }
                                            >
                                                Từ chối
                                            </button>
                                        </>
                                    )}

                                    {assignmentStatus === 'ACCEPTED' && (
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                                handleBookingAction(
                                                    booking,
                                                    'START_JOB'
                                                )
                                            }
                                        >
                                            Bắt đầu công việc
                                        </button>
                                    )}

                                    {assignmentStatus === 'IN_PROGRESS' && (
                                        <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                                handleBookingAction(
                                                    booking,
                                                    'SUBMIT_COMPLETION'
                                                )
                                            }
                                        >
                                            Gửi kết quả hoàn thành
                                        </button>
                                    )}
                                </div>

                                {actionFeedback[booking.id] && (
                                    <p
                                        className={`cj-action-feedback ${actionFeedback[booking.id].type}`}
                                    >
                                        {actionFeedback[booking.id].message}
                                    </p>
                                )}

                                {expanded && (
                                    <div className="cj-card-details">
                                        <h4>Chi tiết dịch vụ</h4>

                                        {booking.items?.length > 0 ? (
                                            <div className="cj-items">
                                                {booking.items.map((item, index) => (
                                                    <div
                                                        className="cj-item"
                                                        key={item.id || index}
                                                    >
                                                        <div>
                                                            <strong>
                                                                {item.serviceName ||
                                                                    'Dịch vụ'}
                                                            </strong>
                                                            {item.description && (
                                                                <span>
                                                                    {item.description}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span>
                                                            x{item.quantity || 1}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="cj-no-items">
                                                Không có thông tin chi tiết dịch vụ.
                                            </p>
                                        )}

                                        {booking.assignments?.length > 1 && (
                                            <>
                                                <h4>
                                                    Đội ngũ cùng thực hiện (
                                                    {booking.assignments.length} người)
                                                </h4>

                                                <div className="cj-items">
                                                    {booking.assignments.map((item) => (
                                                        <div
                                                            className="cj-item"
                                                            key={
                                                                item.assignmentId ||
                                                                item.id
                                                            }
                                                        >
                                                            <div>
                                                                <strong>
                                                                    {item.employeeName ||
                                                                        item.employeeCode ||
                                                                        'Nhân viên'}
                                                                </strong>
                                                            </div>
                                                            <span>
                                                                {item.assignmentStatus ||
                                                                    item.status ||
                                                                    'Đã giao'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}

                                        {booking.customerNote && (
                                            <>
                                                <h4>Ghi chú của khách hàng</h4>
                                                <p className="cj-customer-note">
                                                    {booking.customerNote}
                                                </p>
                                            </>
                                        )}

                                        {canWriteLog && (
                                            <div className="cj-work-log">
                                                <h4>Nhật ký và báo cáo sự cố</h4>
                                                <p>
                                                    Ghi nhận tiến độ hoặc báo cáo
                                                    vấn đề phát sinh trong quá trình
                                                    thực hiện công việc.
                                                </p>

                                                <div className="cj-log-form">
                                                    <label>Loại nhật ký</label>
                                                    <select
                                                        value={
                                                            logType[assignmentId] ||
                                                            'PROGRESS'
                                                        }
                                                        onChange={(event) =>
                                                            setLogType((prev) => ({
                                                                ...prev,
                                                                [assignmentId]:
                                                                event.target.value
                                                            }))
                                                        }
                                                    >
                                                        <option value="PROGRESS">
                                                            Cập nhật tiến độ
                                                        </option>
                                                        <option value="INCIDENT">
                                                            Báo cáo sự cố
                                                        </option>
                                                    </select>

                                                    {(logType[assignmentId] ||
                                                        'PROGRESS') === 'INCIDENT' && (
                                                        <>
                                                            <label>
                                                                Nhóm sự cố
                                                            </label>
                                                            <select
                                                                value={
                                                                    incidentCategory[
                                                                        assignmentId
                                                                        ] || 'OTHER'
                                                                }
                                                                onChange={(event) =>
                                                                    setIncidentCategory(
                                                                        (prev) => ({
                                                                            ...prev,
                                                                            [assignmentId]:
                                                                            event.target.value
                                                                        })
                                                                    )
                                                                }
                                                            >
                                                                {INCIDENT_CATEGORIES.map(
                                                                    (item) => (
                                                                        <option
                                                                            key={item.value}
                                                                            value={item.value}
                                                                        >
                                                                            {item.label}
                                                                        </option>
                                                                    )
                                                                )}
                                                            </select>

                                                            <label>
                                                                Mức độ nghiêm trọng
                                                            </label>
                                                            <select
                                                                value={
                                                                    incidentSeverity[
                                                                        assignmentId
                                                                        ] || 'MEDIUM'
                                                                }
                                                                onChange={(event) =>
                                                                    setIncidentSeverity(
                                                                        (prev) => ({
                                                                            ...prev,
                                                                            [assignmentId]:
                                                                            event.target.value
                                                                        })
                                                                    )
                                                                }
                                                            >
                                                                {INCIDENT_SEVERITIES.map(
                                                                    (item) => (
                                                                        <option
                                                                            key={item.value}
                                                                            value={item.value}
                                                                        >
                                                                            {item.label}
                                                                        </option>
                                                                    )
                                                                )}
                                                            </select>

                                                            <div className="cj-incident-warning">
                                                                Báo cáo sự cố sẽ được
                                                                ghi nhận với trạng thái
                                                                ban đầu là OPEN để nhà
                                                                cung cấp tiếp nhận.
                                                            </div>
                                                        </>
                                                    )}

                                                    <label>Nội dung</label>
                                                    <textarea
                                                        rows="4"
                                                        maxLength={5000}
                                                        placeholder={
                                                            (logType[assignmentId] ||
                                                                'PROGRESS') ===
                                                            'INCIDENT'
                                                                ? 'Mô tả sự cố, thời điểm xảy ra và ảnh hưởng...'
                                                                : 'Nhập nội dung tiến độ công việc...'
                                                        }
                                                        value={
                                                            logNote[assignmentId] || ''
                                                        }
                                                        onChange={(event) =>
                                                            setLogNote((prev) => ({
                                                                ...prev,
                                                                [assignmentId]:
                                                                event.target.value
                                                            }))
                                                        }
                                                    />

                                                    <small>
                                                        {(logNote[assignmentId] || '')
                                                            .length}/5000 ký tự
                                                    </small>

                                                    <label>
                                                        Ảnh minh chứng (tối đa 5 ảnh,
                                                        mỗi ảnh không quá 5 MB)
                                                    </label>

                                                    <input
                                                        type="file"
                                                        accept="image/jpeg,image/png,image/webp"
                                                        multiple
                                                        onChange={(event) => {
                                                            handleSelectWorkLogImages(
                                                                assignmentId,
                                                                event.target.files
                                                            );
                                                            event.target.value = '';
                                                        }}
                                                    />

                                                    {(selectedImages[assignmentId] ||
                                                        []).length > 0 && (
                                                        <div className="cj-log-image-preview">
                                                            {selectedImages[
                                                                assignmentId
                                                                ].map((image, index) => (
                                                                <div
                                                                    className="cj-log-image-preview-item"
                                                                    key={`${index}-${image.file.name}`}
                                                                >
                                                                    <img
                                                                        src={image.preview}
                                                                        alt={`Ảnh minh chứng ${index + 1}`}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleRemoveWorkLogImage(
                                                                                assignmentId,
                                                                                index
                                                                            )
                                                                        }
                                                                    >
                                                                        Xóa
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <button
                                                        type="button"
                                                        disabled={
                                                            !!logLoading[assignmentId]
                                                        }
                                                        onClick={() =>
                                                            handleSubmitWorkLog(
                                                                assignmentId
                                                            )
                                                        }
                                                    >
                                                        {logLoading[assignmentId]
                                                            ? 'Đang gửi...'
                                                            : (logType[assignmentId] ||
                                                                'PROGRESS') ===
                                                            'INCIDENT'
                                                                ? 'Gửi báo cáo sự cố'
                                                                : 'Gửi nhật ký'}
                                                    </button>

                                                    {logFeedback[assignmentId] && (
                                                        <p
                                                            className={`cj-log-feedback ${logFeedback[assignmentId].type}`}
                                                        >
                                                            {
                                                                logFeedback[
                                                                    assignmentId
                                                                    ].message
                                                            }
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="cj-log-history">
                                                    <div className="cj-log-history-header">
                                                        <strong>
                                                            Lịch sử cập nhật
                                                        </strong>
                                                        <button
                                                            type="button"
                                                            disabled={
                                                                !!logLoading[assignmentId]
                                                            }
                                                            onClick={() =>
                                                                loadWorkLogs(
                                                                    assignmentId
                                                                )
                                                            }
                                                        >
                                                            Tải lịch sử
                                                        </button>
                                                    </div>

                                                    {(workLogs[assignmentId] || [])
                                                        .length === 0 ? (
                                                        <p>
                                                            Chưa có nhật ký công việc.
                                                        </p>
                                                    ) : (
                                                        (workLogs[assignmentId] || [])
                                                            .map((log) => (
                                                                <div
                                                                    className="cj-log-item"
                                                                    key={log.id}
                                                                >
                                                                    <strong>
                                                                        {log.logType ===
                                                                        'INCIDENT'
                                                                            ? '⚠ Báo cáo sự cố'
                                                                            : '✓ Cập nhật tiến độ'}
                                                                    </strong>

                                                                    {log.logType ===
                                                                        'INCIDENT' && (
                                                                            <div className="cj-incident-meta">
                                                                            <span>
                                                                                Nhóm:{' '}
                                                                                {CATEGORY_LABELS[
                                                                                        log.category
                                                                                        ] ||
                                                                                    log.category ||
                                                                                    'Khác'}
                                                                            </span>
                                                                                <span>
                                                                                Mức độ:{' '}
                                                                                    {SEVERITY_LABELS[
                                                                                            log.severity
                                                                                            ] ||
                                                                                        log.severity ||
                                                                                        'Trung bình'}
                                                                            </span>
                                                                                <span>
                                                                                Trạng thái:{' '}
                                                                                    {log.incidentStatus ||
                                                                                        'OPEN'}
                                                                            </span>
                                                                            </div>
                                                                        )}

                                                                    <p>{log.note}</p>

                                                                    {getImageUrls(log)
                                                                        .length > 0 && (
                                                                        <div className="cj-log-history-images">
                                                                            {getImageUrls(
                                                                                log
                                                                            ).map(
                                                                                (url, index) => (
                                                                                    <a
                                                                                        href={url}
                                                                                        target="_blank"
                                                                                        rel="noreferrer"
                                                                                        key={`${log.id}-${index}`}
                                                                                    >
                                                                                        <img
                                                                                            src={url}
                                                                                            alt={`Ảnh minh chứng ${index + 1}`}
                                                                                        />
                                                                                    </a>
                                                                                )
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    <small>
                                                                        {formatDate(
                                                                            log.createdAt
                                                                        )}
                                                                    </small>
                                                                </div>
                                                            ))
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default CleanerJobs;
