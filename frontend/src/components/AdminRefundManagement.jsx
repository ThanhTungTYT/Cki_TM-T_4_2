
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faRotate,
    faSearch,
    faEye,
    faCheck,
    faXmark,
    faMoneyBillWave,
    faClock,
    faFileInvoiceDollar
} from '@fortawesome/free-solid-svg-icons';

import AdminLayout from "../pages/admin/AdminLayout";
import { refundApi } from '../services/api';
import './AdminRefundManagement.css';

const STATUS_OPTIONS = [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'PENDING_REVIEW', label: 'Chờ duyệt' },
    { value: 'APPROVED', label: 'Đã duyệt' },
    { value: 'REJECTED', label: 'Đã từ chối' }
];

const STATUS_LABELS = {
    PENDING_REVIEW: 'Chờ duyệt',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Đã từ chối'
};

function formatMoney(value) {
    return `${Number(value || 0).toLocaleString('vi-VN')} đ`;
}

function formatDate(value) {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString('vi-VN');
}

export default function AdminRefundManagement() {
    const [refunds, setRefunds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const [keyword, setKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    const [selectedRefund, setSelectedRefund] = useState(null);
    const [decision, setDecision] = useState('APPROVED');
    const [approvedAmount, setApprovedAmount] = useState('');
    const [decisionNote, setDecisionNote] = useState('');

    const loadRefunds = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);

        setError('');

        try {
            const data = await refundApi.getAdminRefunds();
            setRefunds(data);
        } catch (err) {
            setError(err.message || 'Không thể tải danh sách hoàn tiền.');
        } finally {
            if (showLoading) setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRefunds();
    }, [loadRefunds]);

    const filteredRefunds = useMemo(() => {
        const search = keyword.trim().toLowerCase();

        return refunds.filter(refund => {
            const matchesStatus =
                statusFilter === 'ALL' ||
                refund.status === statusFilter;

            const searchText = [
                refund.bookingCode,
                refund.requestedByName,
                refund.requestedByEmail,
                refund.cancellationReason
            ].filter(Boolean).join(' ').toLowerCase();

            return matchesStatus &&
                (!search || searchText.includes(search));
        });
    }, [refunds, keyword, statusFilter]);

    const stats = useMemo(() => ({
        total: refunds.length,
        pending: refunds.filter(
            r => r.status === 'PENDING_REVIEW'
        ).length,
        approved: refunds.filter(
            r => r.status === 'APPROVED'
        ).length,
        rejected: refunds.filter(
            r => r.status === 'REJECTED'
        ).length
    }), [refunds]);

    function openReview(refund, nextDecision) {
        setSelectedRefund(refund);
        setDecision(nextDecision);
        setApprovedAmount(
            String(refund.requestedAmount ?? '')
        );
        setDecisionNote('');
        setError('');
        setNotice('');
    }

    async function handleSubmitReview(event) {
        event.preventDefault();

        if (!selectedRefund) return;

        if (!decisionNote.trim()) {
            setError('Vui lòng nhập ghi chú xử lý.');
            return;
        }

        if (
            decision === 'APPROVED' &&
            (
                approvedAmount.trim() === '' ||
                !Number.isFinite(Number(approvedAmount)) ||
                Number(approvedAmount) <= 0
            )
        ) {
            setError('Số tiền duyệt phải lớn hơn 0.');
            return;
        }

        if (
            decision === 'APPROVED' &&
            Number(approvedAmount) >
            Number(selectedRefund.requestedAmount)
        ) {
            setError(
                'Số tiền duyệt không được lớn hơn số tiền yêu cầu.'
            );
            return;
        }

        const payload = {
            status: decision,
            decisionNote: decisionNote.trim()
        };

        if (decision === 'APPROVED') {
            payload.approvedAmount = Number(approvedAmount);
        }

        setSubmitting(true);
        setError('');

        try {
            await refundApi.reviewRefund(
                selectedRefund.id,
                payload
            );

            setSelectedRefund(null);
            setNotice(
                decision === 'APPROVED'
                    ? 'Đã duyệt yêu cầu hoàn tiền.'
                    : 'Đã từ chối yêu cầu hoàn tiền.'
            );

            await loadRefunds(false);
        } catch (err) {
            setError(
                err.message || 'Không thể xử lý yêu cầu hoàn tiền.'
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <AdminLayout>
            <div className="refund-page">
                <div className="refund-page-header">
                    <div>
                        <h1>Quản lý hoàn tiền</h1>
                        <p>
                            Theo dõi, xem xét và xử lý yêu cầu hoàn tiền
                            của khách hàng.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="refund-refresh-btn"
                        onClick={() => loadRefunds()}
                        disabled={loading}
                    >
                        <FontAwesomeIcon icon={faRotate} />
                        {' '}Làm mới
                    </button>
                </div>

                {error && !selectedRefund && (
                    <div className="refund-alert refund-alert-error">
                        {error}
                    </div>
                )}

                {notice && (
                    <div className="refund-alert refund-alert-success">
                        {notice}
                    </div>
                )}

                <div className="refund-stats">
                    <div className="refund-stat-card">
                        <span>Tổng yêu cầu</span>
                        <strong>{stats.total}</strong>
                        <FontAwesomeIcon icon={faFileInvoiceDollar} />
                    </div>

                    <div className="refund-stat-card pending">
                        <span>Chờ duyệt</span>
                        <strong>{stats.pending}</strong>
                        <FontAwesomeIcon icon={faClock} />
                    </div>

                    <div className="refund-stat-card approved">
                        <span>Đã duyệt</span>
                        <strong>{stats.approved}</strong>
                        <FontAwesomeIcon icon={faCheck} />
                    </div>

                    <div className="refund-stat-card rejected">
                        <span>Đã từ chối</span>
                        <strong>{stats.rejected}</strong>
                        <FontAwesomeIcon icon={faXmark} />
                    </div>
                </div>

                <div className="refund-toolbar">
                    <div className="refund-search">
                        <FontAwesomeIcon icon={faSearch} />

                        <input
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                            placeholder="Tìm mã đơn, khách hàng, email..."
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        {STATUS_OPTIONS.map(option => (
                            <option
                                key={option.value}
                                value={option.value}
                            >
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="refund-table-wrapper">
                    {loading ? (
                        <div className="refund-empty">
                            Đang tải danh sách yêu cầu hoàn tiền...
                        </div>
                    ) : filteredRefunds.length === 0 ? (
                        <div className="refund-empty">
                            Không tìm thấy yêu cầu hoàn tiền phù hợp.
                        </div>
                    ) : (
                        <table className="refund-table">
                            <thead>
                            <tr>
                                <th>Mã đơn</th>
                                <th>Khách hàng</th>
                                <th>Số tiền yêu cầu</th>
                                <th>Ngày gửi</th>
                                <th>Trạng thái</th>
                                <th>Thao tác</th>
                            </tr>
                            </thead>

                            <tbody>
                            {filteredRefunds.map(refund => (
                                <tr key={refund.id}>
                                    <td>
                                        <strong>
                                            {refund.bookingCode ||
                                                `Đơn #${refund.bookingId}`}
                                        </strong>
                                        <small>
                                            Yêu cầu #{refund.id}
                                        </small>
                                    </td>

                                    <td>
                                        <strong>
                                            {refund.requestedByName ||
                                                'Chưa cập nhật'}
                                        </strong>
                                        <small>
                                            {refund.requestedByEmail || ''}
                                        </small>
                                    </td>

                                    <td>
                                        <strong>
                                            {formatMoney(
                                                refund.requestedAmount
                                            )}
                                        </strong>

                                        {refund.status === 'APPROVED' && (
                                            <small>
                                                Duyệt:{' '}
                                                {formatMoney(
                                                    refund.approvedAmount
                                                )}
                                            </small>
                                        )}
                                    </td>

                                    <td>
                                        {formatDate(refund.requestedAt)}
                                    </td>

                                    <td>
                                            <span
                                                className={
                                                    `refund-status status-${String(
                                                        refund.status || ''
                                                    ).toLowerCase()}`
                                                }
                                            >
                                                {STATUS_LABELS[refund.status] ||
                                                    refund.status}
                                            </span>
                                    </td>

                                    <td>
                                        <div className="refund-actions">
                                            <button
                                                type="button"
                                                className="refund-view-btn"
                                                onClick={() => {
                                                    setSelectedRefund(refund);
                                                    setDecision(
                                                        refund.status === 'REJECTED'
                                                            ? 'REJECTED'
                                                            : 'APPROVED'
                                                    );
                                                    setApprovedAmount(
                                                        String(
                                                            refund.requestedAmount ?? ''
                                                        )
                                                    );
                                                    setDecisionNote('');
                                                    setError('');
                                                }}
                                                title="Xem chi tiết"
                                            >
                                                <FontAwesomeIcon icon={faEye} />
                                            </button>

                                            {refund.status ===
                                                'PENDING_REVIEW' && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="refund-approve-btn"
                                                            onClick={() =>
                                                                openReview(
                                                                    refund,
                                                                    'APPROVED'
                                                                )
                                                            }
                                                            title="Duyệt yêu cầu"
                                                        >
                                                            <FontAwesomeIcon icon={faCheck} />
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="refund-reject-btn"
                                                            onClick={() =>
                                                                openReview(
                                                                    refund,
                                                                    'REJECTED'
                                                                )
                                                            }
                                                            title="Từ chối yêu cầu"
                                                        >
                                                            <FontAwesomeIcon icon={faXmark} />
                                                        </button>
                                                    </>
                                                )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {selectedRefund && (
                    <div
                        className="refund-modal-overlay"
                        onMouseDown={event => {
                            if (
                                event.target === event.currentTarget &&
                                !submitting
                            ) {
                                setSelectedRefund(null);
                                setError('');
                            }
                        }}
                    >
                        <div
                            className="refund-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="refund-modal-title"
                        >
                            <div className="refund-modal-header">
                                <h2 id="refund-modal-title">
                                    Chi tiết yêu cầu hoàn tiền
                                </h2>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!submitting) {
                                            setSelectedRefund(null);
                                            setError('');
                                        }
                                    }}
                                    disabled={submitting}
                                    aria-label="Đóng"
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>

                            <div className="refund-detail-list">
                                <div>
                                    <span>Mã đơn</span>
                                    <strong>
                                        {selectedRefund.bookingCode ||
                                            `#${selectedRefund.bookingId}`}
                                    </strong>
                                </div>

                                <div>
                                    <span>Khách hàng</span>
                                    <strong>
                                        {selectedRefund.requestedByName ||
                                            'Chưa cập nhật'}
                                    </strong>
                                </div>

                                <div>
                                    <span>Email</span>
                                    <strong>
                                        {selectedRefund.requestedByEmail || '—'}
                                    </strong>
                                </div>

                                <div>
                                    <span>Trạng thái đơn</span>
                                    <strong>
                                        {selectedRefund.bookingStatus || '—'}
                                    </strong>
                                </div>

                                <div>
                                    <span>Số tiền yêu cầu</span>
                                    <strong>
                                        {formatMoney(
                                            selectedRefund.requestedAmount
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>Ngày gửi</span>
                                    <strong>
                                        {formatDate(selectedRefund.requestedAt)}
                                    </strong>
                                </div>
                            </div>

                            <div className="refund-reason-box">
                                <strong>Lý do khách yêu cầu</strong>
                                <p>
                                    {selectedRefund.cancellationReason ||
                                        'Không có nội dung.'}
                                </p>
                            </div>

                            {selectedRefund.status !== 'PENDING_REVIEW' && (
                                <div className="refund-reason-box">
                                    <strong>Kết quả xử lý</strong>
                                    <p>
                                        {selectedRefund.decisionNote || '—'}
                                    </p>
                                    <p>
                                        Người xử lý:{' '}
                                        {selectedRefund.reviewedBy || '—'}
                                    </p>
                                    <p>
                                        Thời gian xử lý:{' '}
                                        {formatDate(selectedRefund.reviewedAt)}
                                    </p>
                                </div>
                            )}

                            {selectedRefund.status === 'PENDING_REVIEW' ? (
                                <form onSubmit={handleSubmitReview}>
                                    <div className="refund-form-group">
                                        <label htmlFor="refund-decision">
                                            Quyết định
                                        </label>

                                        <select
                                            id="refund-decision"
                                            value={decision}
                                            onChange={e =>
                                                setDecision(e.target.value)
                                            }
                                            disabled={submitting}
                                        >
                                            <option value="APPROVED">
                                                Duyệt hoàn tiền
                                            </option>
                                            <option value="REJECTED">
                                                Từ chối yêu cầu
                                            </option>
                                        </select>
                                    </div>

                                    {decision === 'APPROVED' && (
                                        <div className="refund-form-group">
                                            <label htmlFor="approved-amount">
                                                Số tiền duyệt (VNĐ)
                                            </label>

                                            <input
                                                id="approved-amount"
                                                type="number"
                                                min="1"
                                                max={Number(
                                                    selectedRefund.requestedAmount
                                                )}
                                                step="1"
                                                value={approvedAmount}
                                                onChange={e =>
                                                    setApprovedAmount(
                                                        e.target.value
                                                    )
                                                }
                                                disabled={submitting}
                                                required
                                            />

                                            <small>
                                                Không được vượt quá số tiền yêu cầu.
                                            </small>
                                        </div>
                                    )}

                                    <div className="refund-form-group">
                                        <label htmlFor="decision-note">
                                            Ghi chú xử lý
                                        </label>

                                        <textarea
                                            id="decision-note"
                                            rows="3"
                                            value={decisionNote}
                                            onChange={e =>
                                                setDecisionNote(e.target.value)
                                            }
                                            placeholder="Nhập lý do duyệt hoặc từ chối..."
                                            disabled={submitting}
                                            required
                                        />
                                    </div>

                                    {error && (
                                        <div className="refund-alert refund-alert-error">
                                            {error}
                                        </div>
                                    )}

                                    <div className="refund-modal-footer">
                                        <button
                                            type="button"
                                            className="refund-cancel-btn"
                                            onClick={() => {
                                                if (!submitting) {
                                                    setSelectedRefund(null);
                                                    setError('');
                                                }
                                            }}
                                            disabled={submitting}
                                        >
                                            Đóng
                                        </button>

                                        <button
                                            type="submit"
                                            className="refund-submit-btn"
                                            disabled={submitting}
                                        >
                                            <FontAwesomeIcon
                                                icon={
                                                    decision === 'APPROVED'
                                                        ? faMoneyBillWave
                                                        : faXmark
                                                }
                                            />
                                            {' '}
                                            {submitting
                                                ? 'Đang xử lý...'
                                                : decision === 'APPROVED'
                                                    ? 'Xác nhận duyệt'
                                                    : 'Xác nhận từ chối'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="refund-modal-footer">
                                    <button
                                        type="button"
                                        className="refund-cancel-btn"
                                        onClick={() => setSelectedRefund(null)}
                                    >
                                        Đóng
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
