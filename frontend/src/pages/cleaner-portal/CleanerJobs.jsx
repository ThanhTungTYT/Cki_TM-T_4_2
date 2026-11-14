
import { useCallback, useEffect, useMemo, useState } from 'react';
import { bookingApi } from '../../services/api';
import './CleanerJobs.css';
import { useNavigate } from 'react-router-dom';

const STATUS_CONFIG = {
    ASSIGNED: { label: 'Chờ nhận việc', type: 'assigned' },
    ACCEPTED: { label: 'Đã nhận việc', type: 'confirmed' },
    ON_THE_WAY: { label: 'Đang di chuyển', type: 'progress' },
    EN_ROUTE: { label: 'Đang di chuyển', type: 'progress' },
    IN_PROGRESS: { label: 'Đang thực hiện', type: 'progress' },
    WORK_SUBMITTED: { label: 'Đã gửi kết quả', type: 'completed' },
    DECLINED: { label: 'Đã từ chối', type: 'cancelled' },
    EXPIRED: { label: 'Đã hết hạn', type: 'cancelled' },
    CANCELLED: { label: 'Đã hủy', type: 'cancelled' }
};

const INCIDENT_CATEGORIES = [
    { value: 'CUSTOMER_REQUEST', label: 'Yêu cầu từ khách hàng' },
    { value: 'PROPERTY_DAMAGE', label: 'Hư hỏng tài sản' },
    { value: 'SAFETY', label: 'Vấn đề an toàn' },
    { value: 'EQUIPMENT', label: 'Thiết bị / dụng cụ' },
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

const CATEGORY_LABELS = {
    CUSTOMER_REQUEST: 'Yêu cầu từ khách hàng',
    PROPERTY_DAMAGE: 'Hư hỏng tài sản',
    SAFETY: 'Vấn đề an toàn',
    EQUIPMENT: 'Thiết bị / dụng cụ',
    OTHER: 'Khác'
};

function formatDate(value) {
    if (!value) return 'Chưa cập nhật';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short'
    });
}

function formatCurrency(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) return 'Chưa cập nhật';

    return amount.toLocaleString('vi-VN') + 'đ';
}

function getStatus(status) {
    return STATUS_CONFIG[String(status || '').toUpperCase()] || {
        label: status || 'Chưa xác định',
        type: 'assigned'
    };
}

function hasReportedUnable(assignment) {
    return String(assignment?.assignmentNote || '').includes(
        'BÁO KHÔNG THỂ THỰC HIỆN ['
    );
}

function getImageUrls(log) {
    if (Array.isArray(log?.imageUrls)) {
        return log.imageUrls.filter(Boolean);
    }

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
    const navigate = useNavigate();

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
        loadBookings();
    }, [loadBookings]);

    const filteredBookings = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return bookings.filter((booking) => {
            const assignment = booking.cleanerAssignment || {};

            const status = String(
                assignment.assignmentStatus || booking.status || ''
            ).toUpperCase();

            const matchesFilter =
                filter === 'ALL' ||
                (filter === 'PENDING' &&
                    ['ASSIGNED', 'ACCEPTED'].includes(status)) ||
                (filter === 'IN_PROGRESS' &&
                    ['IN_PROGRESS', 'ON_THE_WAY', 'EN_ROUTE'].includes(status)) ||
                (filter === 'COMPLETED' &&
                    status === 'WORK_SUBMITTED');

            const matchesSearch =
                !keyword ||
                String(booking.bookingCode || '').toLowerCase().includes(keyword) ||
                String(booking.customerName || '').toLowerCase().includes(keyword) ||
                String(booking.address || '').toLowerCase().includes(keyword);

            return matchesFilter && matchesSearch;
        });
    }, [bookings, filter, search]);

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
                'Mỗi báo cáo chỉ được gửi tối đa 5 ảnh.'
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
                'Ảnh phải là JPG, PNG hoặc WEBP và không vượt quá 5MB mỗi ảnh.'
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

        const existingLogs = workLogs[assignmentId] || [];

        const hasFinalReport = existingLogs.some(
            (log) =>
                String(log.logType || log.type || '').toUpperCase() ===
                'FINAL_REPORT'
        );

        if (type === 'FINAL_REPORT' && hasFinalReport) {
            setLogMessage(
                assignmentId,
                'error',
                'Bạn đã gửi báo cáo tổng kết cho công việc này.'
            );
            return;
        }

        if (!note) {
            setLogMessage(
                assignmentId,
                'error',
                'Vui lòng nhập nội dung báo cáo.'
            );
            return;
        }

        if (type === 'FINAL_REPORT' && note.length < 10) {
            setLogMessage(
                assignmentId,
                'error',
                'Báo cáo tổng kết cần có ít nhất 10 ký tự.'
            );
            return;
        }

        if (images.length > 5) {
            setLogMessage(
                assignmentId,
                'error',
                'Mỗi báo cáo chỉ được gửi tối đa 5 ảnh.'
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
                    : type === 'FINAL_REPORT'
                        ? 'Đã gửi báo cáo tổng kết và ảnh minh chứng cho Provider.'
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

        if (action === 'SUBMIT_COMPLETION') {
            const logs = workLogs[assignmentId] || [];

            const hasFinalReport = logs.some(
                (log) =>
                    String(log.logType || log.type || '').toUpperCase() ===
                    'FINAL_REPORT'
            );

            if (!hasFinalReport) {
                setActionFeedback((prev) => ({
                    ...prev,
                    [booking.id]: {
                        type: 'error',
                        message:
                            'Vui lòng gửi báo cáo tổng kết trước khi nộp kết quả công việc.'
                    }
                }));
                return;
            }
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
                    message: 'Đã từ chối công việc.'
                }
            }));

            await loadBookings();
        } catch (err) {
            setActionFeedback((prev) => ({
                ...prev,
                [booking.id]: {
                    type: 'error',
                    message: err?.message || 'Không thể từ chối công việc.'
                }
            }));
        } finally {
            setProcessingId(null);
        }
    }

    async function handleReportUnable(booking) {
        if (processingId !== null) return;

        const assignment = booking.cleanerAssignment;
        const assignmentId =
            assignment?.assignmentId || assignment?.id;

        if (!assignmentId) return;

        if (hasReportedUnable(assignment)) {
            setActionFeedback((prev) => ({
                ...prev,
                [booking.id]: {
                    type: 'error',
                    message: 'Bạn đã gửi báo cáo không thể thực hiện công việc này.'
                }
            }));
            return;
        }

        const note = window.prompt(
            'Nhập lý do bạn không thể tiếp tục thực hiện công việc:'
        );

        if (note === null) return;

        if (!note.trim()) {
            window.alert('Vui lòng nhập lý do.');
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
                        'Đã gửi báo cáo. Vui lòng chờ Provider/Staff điều phối.'
                }
            }));

            await loadBookings();
        } catch (err) {
            setActionFeedback((prev) => ({
                ...prev,
                [booking.id]: {
                    type: 'error',
                    message:
                        err?.message || 'Không thể gửi báo cáo.'
                }
            }));
        } finally {
            setProcessingId(null);
        }
    }

    return (
        <div className="cj-page cleaner-jobs-page">
            <div className="cj-page-heading">
                <div>
                    <h2>Công việc của tôi</h2>
                    <p>
                        Theo dõi phân công, cập nhật tiến độ và gửi kết quả công việc.
                    </p>
                </div>

                <button
                    type="button"
                    className="cj-refresh-btn"
                    onClick={loadBookings}
                    disabled={loading}
                >
                    {loading ? 'Đang tải...' : 'Làm mới'}
                </button>
            </div>

            <div className="cj-toolbar">
                <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm theo mã đơn, khách hàng hoặc địa chỉ..."
                />

                <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                >
                    <option value="ALL">Tất cả công việc</option>
                    <option value="PENDING">Chờ nhận / Đã nhận</option>
                    <option value="IN_PROGRESS">Đang thực hiện</option>
                    <option value="COMPLETED">Đã gửi kết quả</option>
                </select>
            </div>

            {loading && (
                <div className="cj-state">
                    <p>Đang tải danh sách công việc...</p>
                </div>
            )}

            {!loading && error && (
                <div className="cj-state error">
                    <p>{error}</p>
                    <button type="button" onClick={loadBookings}>
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

                        const hasFinalReport = (
                            workLogs[assignmentId] || []
                        ).some(
                            (log) =>
                                String(log.logType || log.type || '').toUpperCase() ===
                                'FINAL_REPORT'
                        );

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
                                            {booking.address ||
                                                booking.serviceAddress ||
                                                'Chưa cập nhật'}
                                        </strong>
                                    </div>

                                    <div>
                                        <span className="cj-info-label">
                                            Giá trị đơn hàng
                                        </span>
                                        <strong>
                                            {formatCurrency(
                                                booking.totalAmount ||
                                                booking.totalPrice
                                            )}
                                        </strong>
                                    </div>
                                </div>

                                <div className="cj-card-toggle">
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
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/cleaner/jobs/${assignmentId}`)}
                                    >
                                        Chi tiết đầy đủ
                                        <span>→</span>
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
                                        hasFinalReport ? (
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
                                                {busy
                                                    ? 'Đang gửi...'
                                                    : 'Gửi kết quả hoàn thành'}
                                            </button>
                                        ) : (
                                            <p className="cj-action-feedback">
                                                Hãy mở thông tin công việc, gửi báo cáo
                                                tổng kết và ảnh minh chứng trước khi
                                                nộp kết quả.
                                            </p>
                                        )
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
                                                <h4>
                                                    {assignmentStatus === 'IN_PROGRESS'
                                                        ? 'Nhật ký và báo cáo công việc'
                                                        : 'Cập nhật tiến độ công việc'}
                                                </h4>

                                                <div className="cj-log-type">
                                                    <button
                                                        type="button"
                                                        className={
                                                            (logType[assignmentId] ||
                                                                'PROGRESS') === 'PROGRESS'
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
                                                            logType[assignmentId] ===
                                                            'INCIDENT'
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

                                                    {assignmentStatus === 'IN_PROGRESS' && (
                                                        <button
                                                            type="button"
                                                            className={
                                                                logType[assignmentId] ===
                                                                'FINAL_REPORT'
                                                                    ? 'active'
                                                                    : ''
                                                            }
                                                            disabled={hasFinalReport}
                                                            onClick={() =>
                                                                setLogType((prev) => ({
                                                                    ...prev,
                                                                    [assignmentId]: 'FINAL_REPORT'
                                                                }))
                                                            }
                                                        >
                                                            Báo cáo tổng kết
                                                        </button>
                                                    )}
                                                </div>

                                                {logType[assignmentId] === 'FINAL_REPORT' && (
                                                    <p className="cj-log-hint">
                                                        Báo cáo tổng kết sẽ được gửi cho
                                                        Provider kèm ảnh minh chứng. Sau
                                                        khi gửi, bạn mới có thể nộp kết
                                                        quả công việc.
                                                    </p>
                                                )}

                                                {hasFinalReport &&
                                                    assignmentStatus === 'IN_PROGRESS' && (
                                                        <p className="cj-log-feedback success">
                                                            Bạn đã gửi báo cáo tổng kết.
                                                            Có thể gửi kết quả hoàn thành.
                                                        </p>
                                                    )}

                                                {logType[assignmentId] === 'INCIDENT' && (
                                                    <div className="cj-incident-fields">
                                                        <label>
                                                            Loại sự cố
                                                            <select
                                                                value={
                                                                    incidentCategory[assignmentId] ||
                                                                    ''
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
                                                                <option value="">
                                                                    Chọn loại sự cố
                                                                </option>
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
                                                        </label>

                                                        <label>
                                                            Mức độ
                                                            <select
                                                                value={
                                                                    incidentSeverity[assignmentId] ||
                                                                    ''
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
                                                                <option value="">
                                                                    Chọn mức độ
                                                                </option>
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
                                                        </label>
                                                    </div>
                                                )}

                                                <label className="cj-log-note">
                                                    Nội dung
                                                    <textarea
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
                                                        placeholder={
                                                            logType[assignmentId] ===
                                                            'INCIDENT'
                                                                ? 'Mô tả sự cố, tình trạng và cách xử lý hiện tại...'
                                                                : logType[assignmentId] ===
                                                                'FINAL_REPORT'
                                                                    ? 'Tổng kết công việc đã thực hiện, kết quả, các hạng mục hoàn thành và lưu ý cho Provider...'
                                                                    : 'Mô tả tiến độ công việc đã thực hiện...'
                                                        }
                                                        rows={4}
                                                        maxLength={5000}
                                                    />
                                                </label>

                                                <div className="cj-image-upload">
                                                    <label>
                                                        {logType[assignmentId] ===
                                                        'FINAL_REPORT'
                                                            ? 'Ảnh minh chứng báo cáo tổng kết (tối đa 5 ảnh)'
                                                            : 'Ảnh minh chứng (tối đa 5 ảnh)'}

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

                                                    {(selectedImages[assignmentId] || [])
                                                        .length > 0 && (
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
                                                    disabled={
                                                        Boolean(logLoading[assignmentId]) ||
                                                        (
                                                            logType[assignmentId] ===
                                                            'FINAL_REPORT' &&
                                                            hasFinalReport
                                                        )
                                                    }
                                                    onClick={() =>
                                                        handleSubmitWorkLog(assignmentId)
                                                    }
                                                >
                                                    {logLoading[assignmentId]
                                                        ? 'Đang gửi...'
                                                        : logType[assignmentId] ===
                                                        'INCIDENT'
                                                            ? 'Gửi báo cáo sự cố'
                                                            : logType[assignmentId] ===
                                                            'FINAL_REPORT'
                                                                ? 'Gửi báo cáo tổng kết'
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

                                                        const currentLogType = String(
                                                            log.logType || log.type || ''
                                                        ).toUpperCase();

                                                        const isIncident =
                                                            currentLogType === 'INCIDENT';

                                                        const isFinalReport =
                                                            currentLogType === 'FINAL_REPORT';

                                                        return (
                                                            <div
                                                                className={`cj-log-item ${
                                                                    isIncident ? 'incident' : ''
                                                                } ${
                                                                    isFinalReport
                                                                        ? 'final-report'
                                                                        : ''
                                                                }`}
                                                                key={log.id}
                                                            >
                                                                <div className="cj-log-item-heading">
                                                                    <strong>
                                                                        {isIncident
                                                                            ? 'Báo cáo sự cố'
                                                                            : isFinalReport
                                                                                ? 'Báo cáo tổng kết'
                                                                                : 'Cập nhật tiến độ'}
                                                                    </strong>

                                                                    {isIncident && (
                                                                        <span>
                                                                            {SEVERITY_LABELS[
                                                                                    String(
                                                                                        log.severity || ''
                                                                                    ).toUpperCase()
                                                                                    ] ||
                                                                                log.severity ||
                                                                                'Chưa xác định'}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {isIncident && (
                                                                    <p className="cj-log-category">
                                                                        Loại sự cố:{' '}
                                                                        {CATEGORY_LABELS[
                                                                                String(
                                                                                    log.category || ''
                                                                                ).toUpperCase()
                                                                                ] ||
                                                                            log.category ||
                                                                            'Khác'}
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
