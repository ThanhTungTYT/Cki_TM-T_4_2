
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

// Nhận diện Assignment đã gửi báo cáo không thể thực hiện.
function hasReportedUnable(assignment) {
    return String(assignment?.assignmentNote || '').includes(
        'BÁO KHÔNG THỂ THỰC HIỆN ['
    );
}

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

    async function handleImageChange(assignmentId, event) {
        const files = Array.from(event.target.files || []);

        if (files.length === 0) return;

        const currentImages = selectedImages[assignmentId] || [];
        const remainingSlots = 5 - currentImages.length;

        if (remainingSlots <= 0) {
            setLogMessage(
                assignmentId,
                'error',
                'Mỗi nhật ký chỉ được gửi tối đa 5 ảnh.'
            );
            event.target.value = '';
            return;
        }

        const selectedFiles = files.slice(0, remainingSlots);

        const validFiles = selectedFiles.filter((file) => {
            const validType = [
                'image/jpeg',
                'image/png',
                'image/webp'
            ].includes(file.type);

            const validSize = file.size <= 5 * 1024 * 1024;

            return validType && validSize;
        });

        if (validFiles.length !== selectedFiles.length) {
            setLogMessage(
                assignmentId,
                'error',
                'Ảnh phải có định dạng JPG, PNG hoặc WEBP và không vượt quá 5 MB.'
            );
        }

        try {
            const previews = await Promise.all(
                validFiles.map(async (file) => ({
                    file,
                    preview: await readImagePreview(file)
                }))
            );

            setSelectedImages((prev) => ({
                ...prev,
                [assignmentId]: [
                    ...(prev[assignmentId] || []),
                    ...previews
                ]
            }));
        } catch (err) {
            setLogMessage(
                assignmentId,
                'error',
                err?.message || 'Không thể đọc ảnh đã chọn.'
            );
        }

        event.target.value = '';
    }

    function removeSelectedImage(assignmentId, index) {
        setSelectedImages((prev) => ({
            ...prev,
            [assignmentId]: (prev[assignmentId] || []).filter(
                (_, imageIndex) => imageIndex !== index
            )
        }));
    }

    async function loadWorkLogs(assignmentId) {
        if (!assignmentId) return;

        try {
            const logs = await bookingApi.getCleanerWorkLogs(assignmentId);

            setWorkLogs((prev) => ({
                ...prev,
                [assignmentId]: Array.isArray(logs) ? logs : []
            }));
        } catch (err) {
            setLogMessage(
                assignmentId,
                'error',
                err?.message || 'Không thể tải nhật ký công việc.'
            );
        }
    }

    async function handleSubmitWorkLog(assignmentId) {
        if (logLoading[assignmentId]) return;

        const note = (logNote[assignmentId] || '').trim();
        const type = logType[assignmentId] || 'PROGRESS';
        const images = selectedImages[assignmentId] || [];

        if (!note) {
            setLogMessage(
                assignmentId,
                'error',
                'Vui lòng nhập nội dung nhật ký.'
            );
            return;
        }

        if (images.length > 5) {
            setLogMessage(
                assignmentId,
                'error',
                'Mỗi nhật ký chỉ được gửi tối đa 5 ảnh.'
            );
            return;
        }

        if (
            type === 'INCIDENT' &&
            !incidentCategory[assignmentId]
        ) {
            setLogMessage(
                assignmentId,
                'error',
                'Vui lòng chọn loại sự cố.'
            );
            return;
        }

        if (
            type === 'INCIDENT' &&
            !incidentSeverity[assignmentId]
        ) {
            setLogMessage(
                assignmentId,
                'error',
                'Vui lòng chọn mức độ sự cố.'
            );
            return;
        }

        setLogLoading((prev) => ({
            ...prev,
            [assignmentId]: true
        }));

        try {
            const imageUrls = [];

            for (const image of images) {
                const result = await bookingApi.uploadCleanerWorkLogImage(
                    image.file
                );

                if (result?.imageUrl) {
                    imageUrls.push(result.imageUrl);
                }
            }

            await bookingApi.createCleanerWorkLog(
                assignmentId,
                {
                    logType: type,
                    note,
                    imageUrls,
                    category:
                        type === 'INCIDENT'
                            ? incidentCategory[assignmentId]
                            : null,
                    severity:
                        type === 'INCIDENT'
                            ? incidentSeverity[assignmentId]
                            : null
                }
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

        // Không cho phép bắt đầu nếu đã báo không thể thực hiện.
        if (
            action === 'START_JOB' &&
            hasReportedUnable(assignment)
        ) {
            setActionFeedback((prev) => ({
                ...prev,
                [booking.id]: {
                    type: 'error',
                    message:
                        'Bạn đã báo không thể thực hiện công việc này. Vui lòng chờ Provider/Staff điều phối nhân viên thay thế.'
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

    async function handleReportUnable(booking) {
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

        // Chặn gửi báo cáo lần thứ hai.
        if (hasReportedUnable(assignment)) {
            setActionFeedback((prev) => ({
                ...prev,
                [booking.id]: {
                    type: 'error',
                    message:
                        'Bạn đã gửi báo cáo trước đó. Vui lòng chờ Provider/Staff điều phối nhân viên thay thế.'
                }
            }));
            return;
        }

        const note = window.prompt(
            'Nhập lý do bạn không thể thực hiện công việc. Nhà cung cấp sẽ nhận được thông báo để điều phối nhân viên thay thế:'
        );

        if (note === null) return;

        if (!note.trim()) {
            window.alert('Vui lòng nhập lý do không thể thực hiện công việc.');
            return;
        }

        setProcessingId(booking.id);

        try {
            await bookingApi.executeCleanerAssignmentAction(
                assignmentId,
                'REPORT_UNABLE',
                note.trim()
            );

            setActionFeedback((prev) => ({
                ...prev,
                [booking.id]: {
                    type: 'success',
                    message:
                        'Đã gửi thông báo đến nhà cung cấp. Vui lòng chờ điều phối nhân viên thay thế.'
                }
            }));

            await loadBookings();
        } catch (err) {
            setActionFeedback((prev) => ({
                ...prev,
                [booking.id]: {
                    type: 'error',
                    message: err?.message || 'Không thể gửi thông báo.'
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
                booking.cleanerAssignment?.assignmentStatus
            ) === 'UPCOMING'
        ).length,
        inProgress: bookings.filter((booking) =>
            getFilterGroup(
                booking.cleanerAssignment?.assignmentStatus
            ) === 'IN_PROGRESS'
        ).length,
        completed: bookings.filter((booking) =>
            getFilterGroup(
                booking.cleanerAssignment?.assignmentStatus
            ) === 'COMPLETED'
        ).length
    }), [bookings]);

    const filteredBookings = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return bookings.filter((booking) => {
            const status = String(
                booking.cleanerAssignment?.assignmentStatus ||
                booking.status ||
                ''
            ).toUpperCase();

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
                    <div className="cj-stat-icon cj-icon-green">✓</div>
                    <div>
                        <span>Đang thực hiện</span>
                        <strong>{stats.inProgress}</strong>
                    </div>
                </div>

                <div className="cj-stat-card">
                    <div className="cj-stat-icon cj-icon-purple">★</div>
                    <div>
                        <span>Hoàn thành</span>
                        <strong>{stats.completed}</strong>
                    </div>
                </div>
            </div>

            <div className="cj-toolbar">
                <div className="cj-search">
                    <span>⌕</span>
                    <input
                        type="text"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Tìm mã đơn, khách hàng, địa chỉ..."
                    />
                </div>

                <div className="cj-filters">
                    {FILTERS.map((item) => (
                        <button
                            type="button"
                            key={item.value}
                            className={
                                filter === item.value
                                    ? 'active'
                                    : ''
                            }
                            onClick={() => setFilter(item.value)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading && (
                <div className="cj-state">
                    <div className="cj-spinner" />
                    <p>Đang tải danh sách công việc...</p>
                </div>
            )}

            {!loading && error && (
                <div className="cj-state cj-state-error">
                    <h3>Không thể tải công việc</h3>
                    <p>{error}</p>
                    <button
                        type="button"
                        onClick={loadBookings}
                    >
                        Thử lại
                    </button>
                </div>
            )}

            {!loading && !error && filteredBookings.length === 0 && (
                <div className="cj-state">
                    <div className="cj-empty-icon">▤</div>
                    <h3>Không tìm thấy công việc</h3>
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

                        const reportedUnable =
                            hasReportedUnable(assignment);

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
                                        reportedUnable ? (
                                            <div className="cj-action-feedback success">
                                                Bạn đã báo không thể thực hiện công việc.
                                                Vui lòng chờ Provider/Staff điều phối
                                                nhân viên thay thế.
                                            </div>
                                        ) : (
                                            <>
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
                                                    {busy
                                                        ? 'Đang xử lý...'
                                                        : 'Bắt đầu công việc'}
                                                </button>

                                                <button
                                                    type="button"
                                                    className="cj-decline-btn"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        handleReportUnable(booking)
                                                    }
                                                >
                                                    Báo không thể thực hiện
                                                </button>
                                            </>
                                        )
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
                                                            <span>
                                                                Số lượng: {item.quantity || 1}
                                                            </span>
                                                        </div>

                                                        {item.employeeCount && (
                                                            <span>
                                                                {item.employeeCount} nhân viên
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p>Chưa có thông tin chi tiết dịch vụ.</p>
                                        )}

                                        <div className="cj-customer-note">
                                            <h4>Ghi chú của khách hàng</h4>
                                            <p>
                                                {booking.note ||
                                                    booking.customerNote ||
                                                    'Khách hàng không có ghi chú.'}
                                            </p>
                                        </div>

                                        {canWriteLog && (
                                            <div className="cj-work-log-form">
                                                <h4>Cập nhật tiến độ công việc</h4>

                                                <div className="cj-log-type">
                                                    <button
                                                        type="button"
                                                        className={
                                                            (logType[assignmentId] || 'PROGRESS') === 'PROGRESS'
                                                                ? 'active'
                                                                : ''
                                                        }
                                                        onClick={() =>
                                                            setLogType((prev) => ({
                                                                ...prev,
                                                                [assignmentId]: 'PROGRESS'
                                                            }))
                                                        }
                                                    >
                                                        Nhật ký tiến độ
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className={
                                                            logType[assignmentId] === 'INCIDENT'
                                                                ? 'active'
                                                                : ''
                                                        }
                                                        onClick={() =>
                                                            setLogType((prev) => ({
                                                                ...prev,
                                                                [assignmentId]: 'INCIDENT'
                                                            }))
                                                        }
                                                    >
                                                        Báo cáo sự cố
                                                    </button>
                                                </div>

                                                {logType[assignmentId] === 'INCIDENT' && (
                                                    <div className="cj-incident-fields">
                                                        <label>
                                                            Loại sự cố
                                                            <select
                                                                value={incidentCategory[assignmentId] || ''}
                                                                onChange={(event) =>
                                                                    setIncidentCategory((prev) => ({
                                                                        ...prev,
                                                                        [assignmentId]: event.target.value
                                                                    }))
                                                                }
                                                            >
                                                                <option value="">
                                                                    Chọn loại sự cố
                                                                </option>
                                                                {INCIDENT_CATEGORIES.map((item) => (
                                                                    <option
                                                                        key={item.value}
                                                                        value={item.value}
                                                                    >
                                                                        {item.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </label>

                                                        <label>
                                                            Mức độ
                                                            <select
                                                                value={incidentSeverity[assignmentId] || ''}
                                                                onChange={(event) =>
                                                                    setIncidentSeverity((prev) => ({
                                                                        ...prev,
                                                                        [assignmentId]: event.target.value
                                                                    }))
                                                                }
                                                            >
                                                                <option value="">
                                                                    Chọn mức độ
                                                                </option>
                                                                {INCIDENT_SEVERITIES.map((item) => (
                                                                    <option
                                                                        key={item.value}
                                                                        value={item.value}
                                                                    >
                                                                        {item.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </label>
                                                    </div>
                                                )}

                                                <label className="cj-log-note">
                                                    Nội dung
                                                    <textarea
                                                        value={logNote[assignmentId] || ''}
                                                        onChange={(event) =>
                                                            setLogNote((prev) => ({
                                                                ...prev,
                                                                [assignmentId]: event.target.value
                                                            }))
                                                        }
                                                        placeholder={
                                                            logType[assignmentId] === 'INCIDENT'
                                                                ? 'Mô tả sự cố, tình trạng và cách xử lý hiện tại...'
                                                                : 'Mô tả tiến độ công việc đã thực hiện...'
                                                        }
                                                        rows={4}
                                                        maxLength={5000}
                                                    />
                                                </label>

                                                <div className="cj-image-upload">
                                                    <label>
                                                        Ảnh minh chứng (tối đa 5 ảnh)
                                                        <input
                                                            type="file"
                                                            accept="image/jpeg,image/png,image/webp"
                                                            multiple
                                                            onChange={(event) =>
                                                                handleImageChange(
                                                                    assignmentId,
                                                                    event
                                                                )
                                                            }
                                                        />
                                                    </label>

                                                    {(selectedImages[assignmentId] || []).length > 0 && (
                                                        <div className="cj-selected-images">
                                                            {selectedImages[assignmentId].map(
                                                                (image, index) => (
                                                                    <div
                                                                        className="cj-selected-image"
                                                                        key={`${image.file.name}-${index}`}
                                                                    >
                                                                        <img
                                                                            src={image.preview}
                                                                            alt={`Ảnh đã chọn ${index + 1}`}
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                removeSelectedImage(
                                                                                    assignmentId,
                                                                                    index
                                                                                )
                                                                            }
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <button
                                                    type="button"
                                                    className="cj-submit-log"
                                                    disabled={Boolean(logLoading[assignmentId])}
                                                    onClick={() =>
                                                        handleSubmitWorkLog(assignmentId)
                                                    }
                                                >
                                                    {logLoading[assignmentId]
                                                        ? 'Đang gửi...'
                                                        : logType[assignmentId] === 'INCIDENT'
                                                            ? 'Gửi báo cáo sự cố'
                                                            : 'Gửi nhật ký tiến độ'}
                                                </button>

                                                {logFeedback[assignmentId] && (
                                                    <p
                                                        className={`cj-log-feedback ${logFeedback[assignmentId].type}`}
                                                    >
                                                        {logFeedback[assignmentId].message}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        <div className="cj-work-log-history">
                                            <div className="cj-log-history-heading">
                                                <h4>Lịch sử cập nhật công việc</h4>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        loadWorkLogs(assignmentId)
                                                    }
                                                >
                                                    Làm mới
                                                </button>
                                            </div>

                                            {!workLogs[assignmentId] && (
                                                <p>
                                                    Nhấn xem thông tin để tải lịch sử công việc.
                                                </p>
                                            )}

                                            {workLogs[assignmentId]?.length === 0 && (
                                                <p>Chưa có nhật ký công việc.</p>
                                            )}

                                            {workLogs[assignmentId]?.length > 0 && (
                                                <div className="cj-log-list">
                                                    {workLogs[assignmentId].map((log) => {
                                                        const imageUrls = getImageUrls(log);
                                                        const isIncident =
                                                            String(log.type || '').toUpperCase() === 'INCIDENT';

                                                        return (
                                                            <div
                                                                className={`cj-log-item ${isIncident ? 'incident' : ''}`}
                                                                key={log.id}
                                                            >
                                                                <div className="cj-log-item-heading">
                                                                    <strong>
                                                                        {isIncident
                                                                            ? 'Báo cáo sự cố'
                                                                            : 'Cập nhật tiến độ'}
                                                                    </strong>

                                                                    {isIncident && (
                                                                        <span>
                                                                            {SEVERITY_LABELS[
                                                                                String(log.severity || '').toUpperCase()
                                                                                ] || log.severity || 'Chưa xác định'}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {isIncident && (
                                                                    <p className="cj-log-category">
                                                                        Loại sự cố:{' '}
                                                                        {CATEGORY_LABELS[
                                                                            String(log.category || '').toUpperCase()
                                                                            ] || log.category || 'Khác'}
                                                                    </p>
                                                                )}

                                                                <p>{log.note}</p>

                                                                {imageUrls.length > 0 && (
                                                                    <div className="cj-log-images">
                                                                        {imageUrls.map(
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
                                                                    {formatDate(log.createdAt)}
                                                                </small>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
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
