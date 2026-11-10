import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBoxArchive,
    faClockRotateLeft,
    faUser,
    faHeadset,
    faRightFromBracket,
    faPaperPlane,
    faRotate,
    faCircleCheck,
    faClock,
    faFileCircleExclamation,
    faComments,
    faChevronDown,
    faChevronUp
} from '@fortawesome/free-solid-svg-icons';
import Header from '../components/Header';
import Footer from '../components/Footer';
import './profile.css';
import './customer-bookings.css';
import './customer-reports-conversation.css';

const API_URL = 'http://localhost:8080/api/reports';
const MAX_EVIDENCE_SIZE = 5 * 1024 * 1024;

const CATEGORIES = [
    { value: 'SERVICE_QUALITY', label: 'Chất lượng dịch vụ' },
    { value: 'PARTNER_BEHAVIOR', label: 'Thái độ đối tác vệ sinh' },
    { value: 'PAYMENT', label: 'Thanh toán' },
    { value: 'BOOKING', label: 'Đặt lịch dịch vụ' },
    { value: 'OTHER', label: 'Khác' }
];

const STATUS_LABELS = {
    OPEN: 'Đang chờ xử lý',
    IN_PROGRESS: 'Đang xử lý',
    RESOLVED: 'Đã giải quyết',
    REJECTED: 'Đã từ chối'
};

function getToken() {
    return sessionStorage.getItem('accessToken') ||
        localStorage.getItem('accessToken') || '';
}

function formatDate(value) {
    if (!value) return 'Chưa có dữ liệu';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu';

    return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getErrorMessage(status, data) {
    const message = data?.detail || data?.message || data?.error;

    if (status === 401) {
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }

    if (status === 403) {
        return message ||
            'Bạn không có quyền thực hiện thao tác này.';
    }

    if (status === 400) {
        return message ||
            'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.';
    }

    if (status === 404) {
        return message || 'Không tìm thấy dữ liệu yêu cầu.';
    }

    return message || `Yêu cầu thất bại (${status}).`;
}

async function requestApi(url, options = {}) {
    const token = getToken();

    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
            Authorization: `Bearer ${token}`,
            ...options.headers
        }
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        const error = new Error(getErrorMessage(response.status, data));
        error.status = response.status;
        throw error;
    }

    return data;
}

export default function CustomerReports() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const linkedReportId = searchParams.get('reportId');

    const [form, setForm] = useState({
        subject: '',
        category: 'SERVICE_QUALITY',
        bookingCode: '',
        description: ''
    });

    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [evidenceFile, setEvidenceFile] = useState(null);
    const [downloadingEvidenceId, setDownloadingEvidenceId] = useState(null);

    const [expandedReportId, setExpandedReportId] = useState(null);
    const [responses, setResponses] = useState({});
    const [responsesLoading, setResponsesLoading] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
    const [reopenReportId, setReopenReportId] = useState(null);
    const [reopenReason, setReopenReason] = useState('');
    const [reopeningReport, setReopeningReport] = useState(false);

    const handleLogout = () => {
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
    };

    const loadReports = async () => {
        const token = getToken();

        if (!token) {
            navigate('/login', { replace: true });
            return;
        }

        setLoading(true);
        setError('');

        try {
            const data = await requestApi(`${API_URL}/mine`);
            setReports(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message || 'Không thể tải lịch sử khiếu nại.');

            if (err.status === 401) {
                navigate('/login', { replace: true });
                return;
            }

            setReports([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, []);

    useEffect(() => {
        if (!linkedReportId || !reports.some(report => String(report.id) === String(linkedReportId))) return;
        setExpandedReportId(Number(linkedReportId));
        requestApi(`${API_URL}/${linkedReportId}/responses`)
            .then(data => setResponses(previous => ({
                ...previous,
                [linkedReportId]: Array.isArray(data) ? data : []
            })))
            .catch(err => setError(err.message || 'Không thể mở nội dung khiếu nại từ thông báo.'));
    }, [linkedReportId, reports]);

    const loadResponses = async (reportId) => {
        if (!reportId) return;

        setResponsesLoading(true);
        setError('');

        try {
            const data = await requestApi(
                `${API_URL}/${reportId}/responses`
            );

            setResponses(previous => ({
                ...previous,
                [reportId]: Array.isArray(data) ? data : []
            }));
        } catch (err) {
            setError(
                err.message ||
                'Không thể tải lịch sử trao đổi của khiếu nại.'
            );
        } finally {
            setResponsesLoading(false);
        }
    };

    const toggleConversation = async (reportId) => {
        setError('');
        setNotice('');
        setReplyContent('');

        if (expandedReportId === reportId) {
            setExpandedReportId(null);
            return;
        }

        setExpandedReportId(reportId);
        await loadResponses(reportId);
    };

    const handleChange = (event) => {
        const { name, value } = event.target;

        setForm(previous => ({
            ...previous,
            [name]: value
        }));
    };

    const handleEvidenceChange = event => {
        const file = event.target.files?.[0] || null;
        if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setEvidenceFile(null);
            setError('Tệp bằng chứng chỉ nhận ảnh JPG, PNG hoặc WEBP.');
            return;
        }
        if (file && file.size > MAX_EVIDENCE_SIZE) {
            setEvidenceFile(null);
            setError('Ảnh bằng chứng không được vượt quá 5 MB.');
            return;
        }
        setError('');
        setEvidenceFile(file);
    };

    const downloadEvidence = async reportId => {
        setDownloadingEvidenceId(reportId);
        setError('');
        try {
            const response = await fetch(`${API_URL}/${reportId}/evidence`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(getErrorMessage(response.status, data));
            }
            const blobUrl = URL.createObjectURL(await response.blob());
            const anchor = document.createElement('a');
            anchor.href = blobUrl;
            anchor.download = `bang-chung-khieu-nai-${reportId}`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        } catch (err) {
            setError(err.message || 'Không thể tải tệp bằng chứng.');
        } finally {
            setDownloadingEvidenceId(null);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setNotice('');

        const token = getToken();

        if (!token) {
            navigate('/login', { replace: true });
            return;
        }

        const subject = form.subject.trim();
        const description = form.description.trim();
        const bookingCode = form.bookingCode.trim();

        if (!subject) {
            setError('Vui lòng nhập tiêu đề khiếu nại.');
            return;
        }

        if (description.length < 10) {
            setError('Nội dung khiếu nại phải có ít nhất 10 ký tự.');
            return;
        }

        setSubmitting(true);

        try {
            const payload = {
                subject,
                category: form.category,
                description
            };

            if (bookingCode) {
                payload.bookingCode = bookingCode;
            }

            const formData = new FormData();
            formData.append('ticket', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
            if (evidenceFile) formData.append('evidence', evidenceFile);
            await requestApi(API_URL, {
                method: 'POST',
                body: formData
            });

            setNotice('Gửi khiếu nại thành công.');

            setForm({
                subject: '',
                category: 'SERVICE_QUALITY',
                bookingCode: '',
                description: ''
            });
            setEvidenceFile(null);

            await loadReports();
        } catch (err) {
            setError(err.message || 'Không thể gửi khiếu nại.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSendReply = async (event, reportId) => {
        event.preventDefault();

        const content = replyContent.trim();

        if (!content) {
            setError('Vui lòng nhập nội dung phản hồi.');
            return;
        }

        if (sendingReply) return;

        setSendingReply(true);
        setError('');
        setNotice('');

        try {
            await requestApi(`${API_URL}/${reportId}/responses`, {
                method: 'POST',
                body: JSON.stringify({ content })
            });

            setReplyContent('');
            await loadResponses(reportId);
            await loadReports();

            setNotice('Đã gửi phản hồi thành công.');
        } catch (err) {
            setError(err.message || 'Không thể gửi phản hồi.');
        } finally {
            setSendingReply(false);
        }
    };

    const handleReopenReport = async (event, reportId) => {
        event.preventDefault();
        const reason = reopenReason.trim();
        if (reason.length < 10) {
            setError('Vui lòng mô tả lý do mở lại khiếu nại (ít nhất 10 ký tự).');
            return;
        }
        setReopeningReport(true);
        setError('');
        setNotice('');
        try {
            const updated = await requestApi(`${API_URL}/${reportId}/reopen`, {
                method: 'POST',
                body: JSON.stringify({ reason })
            });
            setReports(current => current.map(report => report.id === updated.id ? updated : report));
            setReopenReportId(null);
            setReopenReason('');
            setNotice('Khiếu nại đã được mở lại và chuyển về hàng chờ xử lý.');
            setExpandedReportId(reportId);
            await loadResponses(reportId);
        } catch (err) {
            setError(err.message || 'Không thể mở lại khiếu nại.');
        } finally {
            setReopeningReport(false);
        }
    };

    return (
        <div className="home">
            <Header />

            <main className="profile-main">
                <div className="profile-container">
                    <aside className="profile-sidebar">
                        <ul className="sidebar-menu">
                            <li
                                className="sidebar-item"
                                onClick={() => navigate('/profile')}
                            >
                                <FontAwesomeIcon icon={faUser} />
                                Hồ sơ cá nhân
                            </li>

                            <li
                                className="sidebar-item"
                                onClick={() => navigate('/customer/bookings')}
                            >
                                <FontAwesomeIcon icon={faBoxArchive} />
                                Đơn hàng của tôi
                            </li>

                            <li
                                className="sidebar-item"
                                onClick={() => navigate('/customer/bookings/history')}
                            >
                                <FontAwesomeIcon icon={faClockRotateLeft} />
                                Lịch sử đơn hàng
                            </li>

                            <li className="sidebar-item active">
                                <FontAwesomeIcon icon={faHeadset} />
                                Hỗ trợ & Khiếu nại
                            </li>

                            <li
                                className="sidebar-item logout"
                                onClick={handleLogout}
                            >
                                <FontAwesomeIcon icon={faRightFromBracket} />
                                Đăng xuất
                            </li>
                        </ul>
                    </aside>

                    <div className="profile-content customer-reports-content">
                        <div className="profile-header-title">
                            <h2>Hỗ trợ & Khiếu nại</h2>
                            <p>
                                Gửi yêu cầu hỗ trợ và theo dõi tình trạng xử lý từ hệ thống.
                            </p>
                        </div>

                        {error && (
                            <div className="customer-report-alert error" role="alert">
                                {error}
                            </div>
                        )}

                        {notice && (
                            <div className="customer-report-alert success" role="status">
                                <FontAwesomeIcon icon={faCircleCheck} />
                                {notice}
                            </div>
                        )}

                        <section className="customer-report-card">
                            <h3>Thông tin khiếu nại</h3>

                            <form onSubmit={handleSubmit}>
                                <div className="customer-report-form-grid">
                                    <div className="customer-report-field">
                                        <label htmlFor="report-subject">
                                            Tiêu đề
                                        </label>
                                        <input
                                            id="report-subject"
                                            name="subject"
                                            type="text"
                                            value={form.subject}
                                            onChange={handleChange}
                                            maxLength={120}
                                            placeholder="Nhập tiêu đề khiếu nại"
                                            required
                                        />
                                    </div>

                                    <div className="customer-report-field">
                                        <label htmlFor="report-category">
                                            Loại khiếu nại
                                        </label>
                                        <select
                                            id="report-category"
                                            name="category"
                                            value={form.category}
                                            onChange={handleChange}
                                            required
                                        >
                                            {CATEGORIES.map(category => (
                                                <option
                                                    key={category.value}
                                                    value={category.value}
                                                >
                                                    {category.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="customer-report-field">
                                        <label htmlFor="report-booking-code">
                                            Mã đơn hàng (không bắt buộc)
                                        </label>
                                        <input
                                            id="report-booking-code"
                                            name="bookingCode"
                                            type="text"
                                            value={form.bookingCode}
                                            onChange={handleChange}
                                            placeholder="Nhập đúng mã đơn hàng nếu có"
                                        />
                                        <small>
                                            Nếu khiếu nại liên quan đến đơn hàng, hãy nhập mã đơn thực tế. Có thể để trống nếu cần hỗ trợ chung.
                                        </small>
                                    </div>

                                    <div className="customer-report-field full">
                                        <label htmlFor="report-description">
                                            Nội dung chi tiết
                                        </label>
                                        <textarea
                                            id="report-description"
                                            name="description"
                                            value={form.description}
                                            onChange={handleChange}
                                            minLength={10}
                                            maxLength={5000}
                                            rows={5}
                                            placeholder="Mô tả cụ thể vấn đề bạn gặp phải..."
                                            required
                                        />
                                        <small>
                                            {form.description.trim().length}/5000 ký tự
                                        </small>
                                    </div>
                                    <div className="customer-report-field full">
                                        <label htmlFor="report-evidence">Ảnh bằng chứng (không bắt buộc)</label>
                                        <input
                                            key={evidenceFile?.name || 'no-evidence'}
                                            id="report-evidence"
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            onChange={handleEvidenceChange}
                                            disabled={submitting}
                                        />
                                        <small>{evidenceFile ? `${evidenceFile.name} · ${(evidenceFile.size / (1024 * 1024)).toFixed(2)} MB` : 'JPG, PNG hoặc WEBP; tối đa 5 MB.'}</small>
                                    </div>
                                </div>

                                <div className="customer-report-actions">
                                    <button
                                        type="button"
                                        className="customer-report-secondary"
                                        onClick={() => {
                                            setForm({
                                                subject: '',
                                                category: 'SERVICE_QUALITY',
                                                bookingCode: '',
                                                description: ''
                                            });
                                            setEvidenceFile(null);
                                            setError('');
                                            setNotice('');
                                        }}
                                        disabled={submitting}
                                    >
                                        Xóa nội dung
                                    </button>

                                    <button
                                        type="submit"
                                        className="customer-report-primary"
                                        disabled={submitting}
                                    >
                                        <FontAwesomeIcon icon={faPaperPlane} />
                                        {submitting ? 'Đang gửi...' : 'Gửi khiếu nại'}
                                    </button>
                                </div>
                            </form>
                        </section>

                        <section className="customer-report-card customer-report-history">
                            <div className="customer-report-history-heading">
                                <div>
                                    <h3>Lịch sử khiếu nại</h3>
                                    <p>Các yêu cầu do tài khoản của bạn gửi.</p>
                                </div>

                                <button
                                    type="button"
                                    className="customer-report-refresh"
                                    onClick={loadReports}
                                    disabled={loading}
                                >
                                    <FontAwesomeIcon
                                        icon={faRotate}
                                        className={loading ? 'customer-report-spin' : ''}
                                    />
                                    Tải lại
                                </button>
                            </div>

                            {loading ? (
                                <div className="customer-report-empty">
                                    Đang tải lịch sử khiếu nại...
                                </div>
                            ) : reports.length === 0 ? (
                                <div className="customer-report-empty">
                                    <FontAwesomeIcon icon={faFileCircleExclamation} />
                                    <p>Chưa có khiếu nại nào trong tài khoản của bạn.</p>
                                </div>
                            ) : (
                                <div className="customer-report-list">
                                    {reports.map(report => {
                                        const isExpanded = expandedReportId === report.id;
                                        const reportResponses = responses[report.id] || [];

                                        return (
                                            <article
                                                className="customer-report-item"
                                                key={report.id}
                                            >
                                                <div className="customer-report-item-heading">
                                                    <div>
                                                        <span className="customer-report-id">
                                                            Khiếu nại #{report.id}
                                                        </span>
                                                        <h4>
                                                            {report.subject || 'Không có tiêu đề'}
                                                        </h4>
                                                    </div>

                                                    <span
                                                        className={`customer-report-status ${(report.status || 'OPEN').toLowerCase()}`}
                                                    >
                                                        <FontAwesomeIcon icon={faClock} />
                                                        {STATUS_LABELS[report.status] ||
                                                            report.status ||
                                                            'Chưa có trạng thái'}
                                                    </span>
                                                </div>

                                                <div className="customer-report-meta">
                                                    <span>
                                                        Loại: {CATEGORIES.find(item =>
                                                        item.value === report.category
                                                    )?.label || report.category || 'Khác'}
                                                    </span>
                                                    <span>
                                                        Mã đơn: {report.bookingCode || 'Không liên kết đơn hàng'}
                                                    </span>
                                                    <span>
                                                        Ngày gửi: {formatDate(report.createdAt)}
                                                    </span>
                                                </div>

                                                <p className={`customer-report-sla${report.responseOverdue ? ' overdue' : ''}`}>
                                                    {report.firstRespondedAt
                                                        ? `Phản hồi đầu tiên: ${formatDate(report.firstRespondedAt)}`
                                                        : report.responseDueAt
                                                            ? `${report.responseOverdue ? 'Đã quá hạn phản hồi' : 'Dự kiến phản hồi trước'}: ${formatDate(report.responseDueAt)} (${report.responseSlaHours || 24} giờ)`
                                                            : 'Thời hạn phản hồi đang được cập nhật.'}
                                                </p>

                                                <p className="customer-report-description">
                                                    {report.description || 'Không có nội dung'}
                                                </p>

                                                {report.evidenceUrl && (
                                                    <button
                                                        type="button"
                                                        className="customer-report-evidence-link"
                                                        onClick={() => downloadEvidence(report.id)}
                                                        disabled={downloadingEvidenceId === report.id}
                                                    >
                                                        {downloadingEvidenceId === report.id ? 'Đang tải bằng chứng...' : 'Tải ảnh bằng chứng'}
                                                    </button>
                                                )}

                                                {report.status === 'RESOLVED' && (
                                                    reopenReportId === report.id ? (
                                                        <form className="customer-report-reopen-form" onSubmit={event => handleReopenReport(event, report.id)}>
                                                            <label htmlFor={`reopen-reason-${report.id}`}>Lý do cần tiếp tục xử lý</label>
                                                            <textarea
                                                                id={`reopen-reason-${report.id}`}
                                                                minLength={10}
                                                                maxLength={10000}
                                                                rows={3}
                                                                value={reopenReason}
                                                                onChange={event => setReopenReason(event.target.value)}
                                                                required
                                                            />
                                                            <div>
                                                                <button type="button" className="customer-report-reopen-cancel" disabled={reopeningReport} onClick={() => { setReopenReportId(null); setReopenReason(''); }}>Đóng</button>
                                                                <button type="submit" disabled={reopeningReport || reopenReason.trim().length < 10}>{reopeningReport ? 'Đang mở lại...' : 'Gửi yêu cầu mở lại'}</button>
                                                            </div>
                                                        </form>
                                                    ) : (
                                                        <button type="button" className="customer-report-reopen-trigger" onClick={() => { setReopenReportId(report.id); setReopenReason(''); setError(''); }}>
                                                            Mở lại khiếu nại
                                                        </button>
                                                    )
                                                )}

                                                {report.resolution && (
                                                    <div className="customer-report-resolution">
                                                        <strong>Kết quả xử lý:</strong>
                                                        <p>{report.resolution}</p>
                                                    </div>
                                                )}

                                                <button
                                                    type="button"
                                                    className="customer-report-conversation-toggle"
                                                    onClick={() => toggleConversation(report.id)}
                                                >
                                                    <FontAwesomeIcon icon={faComments} />
                                                    {isExpanded
                                                        ? 'Thu gọn trao đổi'
                                                        : 'Xem lịch sử trao đổi'}
                                                    <span>
                                                        {isExpanded
                                                            ? <FontAwesomeIcon icon={faChevronUp} />
                                                            : <FontAwesomeIcon icon={faChevronDown} />}
                                                    </span>
                                                </button>

                                                {isExpanded && (
                                                    <div className="customer-report-conversation">
                                                        <div className="customer-report-conversation-heading">
                                                            <h5>Lịch sử phản hồi</h5>
                                                            <span>
                                                                {reportResponses.length} phản hồi
                                                            </span>
                                                        </div>

                                                        {responsesLoading ? (
                                                            <div className="customer-report-conversation-empty">
                                                                <FontAwesomeIcon
                                                                    icon={faRotate}
                                                                    className="customer-report-spin"
                                                                />
                                                                Đang tải nội dung trao đổi...
                                                            </div>
                                                        ) : reportResponses.length === 0 ? (
                                                            <div className="customer-report-conversation-empty">
                                                                Chưa có phản hồi nào. Bạn có thể gửi thêm thông tin bên dưới.
                                                            </div>
                                                        ) : (
                                                            <div className="customer-report-response-list">
                                                                {reportResponses.map(response => (
                                                                    <div
                                                                        className="customer-report-response"
                                                                        key={response.id}
                                                                    >
                                                                        <div className="customer-report-response-header">
                                                                            <div>
                                                                                <strong>
                                                                                    {response.responderName || 'Tài khoản hệ thống'}
                                                                                </strong>
                                                                                <span>
                                                                                    {response.responderRole || 'Người tham gia'}
                                                                                </span>
                                                                            </div>
                                                                            <time>
                                                                                {formatDate(response.createdAt)}
                                                                            </time>
                                                                        </div>

                                                                        <p>{response.content}</p>

                                                                        {response.attachmentUrl && (
                                                                            <a
                                                                                href={response.attachmentUrl}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                            >
                                                                                Xem tệp đính kèm
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <form
                                                            className="customer-report-reply-form"
                                                            onSubmit={(event) =>
                                                                handleSendReply(event, report.id)
                                                            }
                                                        >
                                                            <label htmlFor={`report-reply-${report.id}`}>
                                                                Gửi phản hồi bổ sung
                                                            </label>
                                                            <textarea
                                                                id={`report-reply-${report.id}`}
                                                                rows={3}
                                                                value={replyContent}
                                                                onChange={(event) =>
                                                                    setReplyContent(event.target.value)
                                                                }
                                                                placeholder="Nhập nội dung bạn muốn trao đổi thêm..."
                                                                disabled={sendingReply}
                                                            />

                                                            <div className="customer-report-reply-actions">
                                                                <small>
                                                                    Nội dung gửi đi sẽ được lưu trong lịch sử khiếu nại.
                                                                </small>
                                                                <button
                                                                    type="submit"
                                                                    className="customer-report-primary"
                                                                    disabled={
                                                                        sendingReply ||
                                                                        !replyContent.trim()
                                                                    }
                                                                >
                                                                    <FontAwesomeIcon
                                                                        icon={sendingReply ? faRotate : faPaperPlane}
                                                                        className={sendingReply ? 'customer-report-spin' : ''}
                                                                    />
                                                                    {sendingReply ? 'Đang gửi...' : 'Gửi phản hồi'}
                                                                </button>
                                                            </div>
                                                        </form>
                                                    </div>
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
