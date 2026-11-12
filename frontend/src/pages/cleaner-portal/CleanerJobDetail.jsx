
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { bookingApi } from '../../services/api';

function formatDate(value) {
    if (!value) return 'Chưa xác định';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 'Chưa xác định';

    return date.toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatTime(value) {
    if (!value) return '--:--';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '--:--';

    return date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatCurrency(value) {
    if (value === null || value === undefined) return '—';

    return Number(value).toLocaleString('vi-VN') + ' đ';
}

function getStatusInfo(status) {
    const statusMap = {
        ASSIGNED: ['Chờ nhận việc', 'assigned'],
        PENDING_ACCEPTANCE: ['Chờ nhận việc', 'assigned'],
        ACCEPTED: ['Đã nhận việc', 'confirmed'],
        EN_ROUTE: ['Đang di chuyển', 'in-progress'],
        ON_THE_WAY: ['Đang di chuyển', 'in-progress'],
        IN_PROGRESS: ['Đang thực hiện', 'in-progress'],
        WORK_SUBMITTED: ['Đã nộp kết quả', 'pending'],
        PENDING_COMPLETION: ['Chờ xác nhận', 'pending'],
        AWAITING_CONFIRMATION: ['Chờ khách xác nhận', 'pending'],
        COMPLETED: ['Đã hoàn thành', 'completed'],
        DECLINED: ['Đã từ chối', 'cancelled'],
        REJECTED: ['Bị từ chối', 'cancelled'],
        CANCELLED: ['Đã hủy', 'cancelled'],
        EXPIRED: ['Đã hết hạn', 'cancelled']
    };

    return statusMap[String(status || '').toUpperCase()] ||
        ['Chưa xác định', 'default'];
}

function getAssignmentId(assignment) {
    return assignment?.assignmentId || assignment?.id;
}

function getBooking(assignment) {
    return assignment?.booking || assignment;
}

function CleanerJobDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [assignment, setAssignment] = useState(null);
    const [workLogs, setWorkLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [logsLoading, setLogsLoading] = useState(false);
    const [error, setError] = useState('');

    const loadDetail = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const data = await bookingApi.getCleanerAssignments();
            const assignments = Array.isArray(data)
                ? data
                : Array.isArray(data?.items)
                    ? data.items
                    : [];

            const found = assignments.find((item) => {
                return String(getAssignmentId(item)) === String(id);
            });

            if (!found) {
                setAssignment(null);
                setError(
                    'Không tìm thấy phân công hoặc bạn không có quyền xem công việc này.'
                );
                return;
            }

            setAssignment(found);

            const assignmentId = getAssignmentId(found);

            if (assignmentId) {
                setLogsLoading(true);

                try {
                    const logs = await bookingApi.getCleanerWorkLogs(
                        assignmentId
                    );

                    setWorkLogs(Array.isArray(logs) ? logs : []);
                } catch {
                    setWorkLogs([]);
                } finally {
                    setLogsLoading(false);
                }
            }
        } catch (err) {
            setError(
                err.message || 'Không thể tải thông tin công việc.'
            );
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        let active = true;

        async function fetchDetail() {
            setLoading(true);
            setError('');

            try {
                const data = await bookingApi.getCleanerAssignments();

                const assignments = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.items)
                        ? data.items
                        : [];

                const found = assignments.find((item) => {
                    return String(getAssignmentId(item)) === String(id);
                });

                if (!active) return;

                if (!found) {
                    setAssignment(null);
                    setError(
                        'Không tìm thấy phân công hoặc bạn không có quyền xem công việc này.'
                    );
                    return;
                }

                setAssignment(found);

                const assignmentId = getAssignmentId(found);

                if (assignmentId) {
                    try {
                        const logs = await bookingApi.getCleanerWorkLogs(
                            assignmentId
                        );

                        if (active) {
                            setWorkLogs(Array.isArray(logs) ? logs : []);
                        }
                    } catch {
                        if (active) setWorkLogs([]);
                    }
                }
            } catch (err) {
                if (active) {
                    setError(
                        err.message || 'Không thể tải thông tin công việc.'
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                    setLogsLoading(false);
                }
            }
        }

        fetchDetail();

        return () => {
            active = false;
        };
    }, [id]);

    if (loading) {
        return (
            <div className="cl-page">
                <div className="cl-dashboard-message">
                    Đang tải thông tin công việc...
                </div>
            </div>
        );
    }

    if (error || !assignment) {
        return (
            <div className="cl-page">
                <div className="cl-page-heading">
                    <div>
                        <h1>Chi tiết công việc</h1>
                        <p>Thông tin phân công của bạn</p>
                    </div>
                </div>

                <section className="cl-panel">
                    <div className="cl-empty-state">
                        <div className="cl-empty-icon">⚠️</div>

                        <strong>Không thể mở công việc</strong>

                        <p>{error || 'Không tìm thấy thông tin phân công.'}</p>

                        <button
                            type="button"
                            className="cl-primary-button"
                            onClick={() => navigate('/cleaner/jobs')}
                        >
                            Quay lại danh sách công việc
                        </button>
                    </div>
                </section>
            </div>
        );
    }

    const booking = getBooking(assignment);

    const status = getStatusInfo(
        assignment.assignmentStatus || assignment.status
    );

    const items = Array.isArray(booking?.items)
        ? booking.items
        : [];

    const assignmentId = getAssignmentId(assignment);

    return (
        <div className="cl-page">
            <div className="cl-page-heading">
                <div>
                    <Link
                        to="/cleaner/jobs"
                        className="cl-text-link"
                    >
                        ← Quay lại công việc
                    </Link>

                    <h1>Chi tiết công việc</h1>

                    <p>
                        Theo dõi thông tin và tiến độ phân công của bạn.
                    </p>
                </div>

                <button
                    type="button"
                    className="cl-dashboard-refresh"
                    onClick={loadDetail}
                >
                    ↻ Làm mới
                </button>
            </div>

            <section className="cl-welcome">
                <div className="cl-welcome-content">
                    <span className="cl-welcome-label">
                        THÔNG TIN PHÂN CÔNG
                    </span>

                    <h2>
                        {booking.bookingCode || `Đơn hàng #${booking.id}`}
                    </h2>

                    <p>
                        Phân công #{assignmentId}
                    </p>

                    <span
                        className={`cl-today-status cl-today-status-${status[1]}`}
                    >
                        {status[0]}
                    </span>
                </div>

                <div className="cl-welcome-decoration">
                    <div className="cl-decoration-circle">
                        <span>📋</span>
                    </div>
                </div>
            </section>

            <div className="cl-dashboard-grid">
                <section className="cl-panel">
                    <div className="cl-panel-heading">
                        <div>
                            <h2>Thông tin lịch làm việc</h2>
                            <p>Thời gian thực hiện công việc</p>
                        </div>
                    </div>

                    <div className="cl-detail-info-list">
                        <div className="cl-detail-info-row">
                            <span>Ngày thực hiện</span>
                            <strong>
                                {formatDate(booking.scheduledStart)}
                            </strong>
                        </div>

                        <div className="cl-detail-info-row">
                            <span>Giờ bắt đầu</span>
                            <strong>
                                {formatTime(booking.scheduledStart)}
                            </strong>
                        </div>

                        <div className="cl-detail-info-row">
                            <span>Giờ kết thúc dự kiến</span>
                            <strong>
                                {formatTime(booking.scheduledEnd)}
                            </strong>
                        </div>

                        <div className="cl-detail-info-row">
                            <span>Thời gian đã nhận việc</span>
                            <strong>
                                {formatDate(assignment.acceptedAt)}
                            </strong>
                        </div>

                        <div className="cl-detail-info-row">
                            <span>Thời điểm bắt đầu làm</span>
                            <strong>
                                {formatDate(assignment.startedAt)}
                            </strong>
                        </div>

                        <div className="cl-detail-info-row">
                            <span>Thời điểm nộp kết quả</span>
                            <strong>
                                {formatDate(assignment.completedAt)}
                            </strong>
                        </div>
                    </div>
                </section>

                <section className="cl-panel">
                    <div className="cl-panel-heading">
                        <div>
                            <h2>Địa điểm phục vụ</h2>
                            <p>Địa chỉ của Booking được phân công</p>
                        </div>
                    </div>

                    <div className="cl-detail-address">
                        <div className="cl-shortcut-icon">📍</div>

                        <div>
                            <strong>
                                {booking.receiverName ||
                                    booking.customerName ||
                                    'Người nhận dịch vụ'}
                            </strong>

                            <p>
                                {booking.fullAddress ||
                                    'Chưa có thông tin địa chỉ'}
                            </p>

                            {(booking.receiverPhone ||
                                booking.customerPhone) && (
                                <p>
                                    Điện thoại:{' '}
                                    {booking.receiverPhone ||
                                        booking.customerPhone}
                                </p>
                            )}
                        </div>
                    </div>

                    {booking.customerNote && (
                        <div className="cl-detail-note">
                            <strong>Ghi chú từ khách hàng</strong>
                            <p>{booking.customerNote}</p>
                        </div>
                    )}
                </section>
            </div>

            <section className="cl-panel">
                <div className="cl-panel-heading">
                    <div>
                        <h2>Dịch vụ được phân công</h2>
                        <p>
                            Chi tiết dịch vụ và số lượng nhân viên
                        </p>
                    </div>
                </div>

                {items.length === 0 ? (
                    <div className="cl-dashboard-message">
                        Chưa có thông tin chi tiết dịch vụ.
                    </div>
                ) : (
                    <div className="cl-detail-service-list">
                        {items.map((item, index) => (
                            <div
                                className="cl-detail-service-item"
                                key={item.id || index}
                            >
                                <div className="cl-detail-service-icon">
                                    🧹
                                </div>

                                <div className="cl-detail-service-content">
                                    <strong>
                                        {item.serviceName ||
                                            'Dịch vụ vệ sinh'}
                                    </strong>

                                    <p>
                                        Gói dịch vụ:{' '}
                                        {item.packageName || 'Chưa xác định'}
                                    </p>

                                    <div className="cl-detail-service-meta">
                                        <span>
                                            Số lượng: {item.quantity || 1}
                                        </span>

                                        <span>
                                            Nhân viên yêu cầu:{' '}
                                            {item.employeeCount || 1}
                                        </span>

                                        <span>
                                            Thời lượng:{' '}
                                            {item.durationMinutes
                                                ? `${item.durationMinutes} phút`
                                                : 'Chưa xác định'}
                                        </span>
                                    </div>

                                    {item.note && (
                                        <p className="cl-detail-note">
                                            Ghi chú: {item.note}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <div className="cl-dashboard-grid">
                <section className="cl-panel">
                    <div className="cl-panel-heading">
                        <div>
                            <h2>Thông tin khách hàng</h2>
                            <p>Thông tin liên hệ phục vụ công việc</p>
                        </div>
                    </div>

                    <div className="cl-detail-info-list">
                        <div className="cl-detail-info-row">
                            <span>Người đặt</span>
                            <strong>
                                {booking.customerName || 'Chưa xác định'}
                            </strong>
                        </div>

                        <div className="cl-detail-info-row">
                            <span>Người nhận dịch vụ</span>
                            <strong>
                                {booking.receiverName ||
                                    booking.customerName ||
                                    'Chưa xác định'}
                            </strong>
                        </div>

                        <div className="cl-detail-info-row">
                            <span>Số điện thoại</span>
                            <strong>
                                {booking.receiverPhone ||
                                    booking.customerPhone ||
                                    'Chưa có thông tin'}
                            </strong>
                        </div>
                    </div>
                </section>

                <section className="cl-panel">
                    <div className="cl-panel-heading">
                        <div>
                            <h2>Thông tin phân công</h2>
                            <p>Thông tin nhân viên và nhà cung cấp</p>
                        </div>
                    </div>

                    <div className="cl-detail-info-list">
                        <div className="cl-detail-info-row">
                            <span>Mã phân công</span>
                            <strong>#{assignmentId}</strong>
                        </div>

                        <div className="cl-detail-info-row">
                            <span>Nhân viên</span>
                            <strong>
                                {assignment.employeeName ||
                                    'Tài khoản hiện tại'}
                            </strong>
                        </div>

                        <div className="cl-detail-info-row">
                            <span>Nhà cung cấp</span>
                            <strong>
                                {booking.partnerName || 'Chưa xác định'}
                            </strong>
                        </div>

                        <div className="cl-detail-info-row">
                            <span>Trạng thái Booking</span>
                            <strong>
                                {booking.status || 'Chưa xác định'}
                            </strong>
                        </div>
                    </div>
                </section>
            </div>

            <section className="cl-panel">
                <div className="cl-panel-heading">
                    <div>
                        <h2>Lịch sử cập nhật công việc</h2>
                        <p>
                            Các ghi chú tiến độ và báo cáo sự cố của bạn
                        </p>
                    </div>
                </div>

                {logsLoading ? (
                    <div className="cl-dashboard-message">
                        Đang tải lịch sử cập nhật...
                    </div>
                ) : workLogs.length === 0 ? (
                    <div className="cl-dashboard-message">
                        Chưa có ghi chú tiến độ hoặc báo cáo sự cố.
                    </div>
                ) : (
                    <div className="cl-detail-log-list">
                        {workLogs.map((log, index) => (
                            <div
                                className="cl-detail-log-item"
                                key={log.id || index}
                            >
                                <div className="cl-detail-log-dot" />

                                <div className="cl-detail-log-content">
                                    <strong>
                                        {(log.logType || log.type) === 'INCIDENT'
                                            ? 'Báo cáo sự cố'
                                            : 'Cập nhật tiến độ'}
                                    </strong>

                                    <span>
                                        {formatDate(log.createdAt)}
                                    </span>

                                    <p>
                                        {log.note || 'Không có nội dung ghi chú.'}
                                    </p>

                                    {Array.isArray(log.imageUrls) &&
                                        log.imageUrls.length > 0 && (
                                            <div className="cl-detail-log-images">
                                                {log.imageUrls.map(
                                                    (url, imageIndex) => (
                                                        <a
                                                            href={url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            key={imageIndex}
                                                        >
                                                            Ảnh bằng chứng{' '}
                                                            {imageIndex + 1}
                                                        </a>
                                                    )
                                                )}
                                            </div>
                                        )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <div className="cl-info-note">
                <span className="cl-info-note-icon">i</span>

                <p>
                    <strong>Lưu ý:</strong> Cleaner chỉ được cập nhật
                    tiến độ và nộp kết quả phần việc của mình. Việc nộp
                    kết quả không đồng nghĩa với Booking đã hoàn thành.
                    Khách hàng hoặc người có quyền mới xác nhận hoàn tất
                    Booking.
                </p>
            </div>
        </div>
    );
}

export default CleanerJobDetail;
