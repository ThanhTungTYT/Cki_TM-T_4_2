import { useEffect, useState } from 'react';
import { providerServicesApi, providerChangeRequestApi } from '../../services/providerApi';

const VND = (v) => (v != null ? `${Number(v).toLocaleString('vi-VN')}đ` : '—');

function ProviderServices() {
    const [activeTab, setActiveTab] = useState('OFFERING');
    const [offering, setOffering] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [msg, setMsg] = useState('');
    const [showPriceModal, setShowPriceModal] = useState(false);
    const [selectedService, setSelectedService] = useState(null);
    const [newPrice, setNewPrice] = useState('');
    const [priceReason, setPriceReason] = useState('');
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [targetCatalogItem, setTargetCatalogItem] = useState(null);
    const [registerPrice, setRegisterPrice] = useState('');
    const [registerReason, setRegisterReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [modalError, setModalError] = useState('');

    function loadData() {
        setLoading(true);
        setError('');

        Promise.all([
            providerServicesApi.list(),
            providerServicesApi.getCatalog(),
            providerChangeRequestApi.list(),
        ])
            .then(([offList, catList, reqList]) => {
                setOffering(Array.isArray(offList) ? offList : []);
                setCatalog(Array.isArray(catList) ? catList : []);

                const serviceRequests = (Array.isArray(reqList) ? reqList : []).filter(
                    (request) =>
                        [
                            'SERVICE_REGISTER',
                            'SERVICE_UPDATE',
                            'SERVICE_PAUSE',
                            'SERVICE_RETIRE',
                        ].includes(String(request.requestType || '').toUpperCase())
                );

                setRequests(serviceRequests);
            })
            .catch((e) => setError(e.message || 'Không thể tải dữ liệu dịch vụ.'))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        loadData();
    }, []);

    async function handleTogglePause(item) {
        const isPaused = String(item.status || '').toUpperCase() === 'PAUSED';

        const actionName = isPaused
            ? 'gửi yêu cầu mở lại dịch vụ'
            : 'gửi yêu cầu tạm ngừng dịch vụ';

        if (!window.confirm(`Bạn có chắc muốn ${actionName} "${item.name}"?`)) {
            return;
        }

        setError('');
        setMsg('');

        try {
            await providerChangeRequestApi.create({
                type: isPaused ? 'SERVICE_UPDATE' : 'SERVICE_PAUSE',
                targetId: item.id,
                targetName: item.name,
                oldSnapshot: `serviceId=${item.serviceId};status=${item.status}`,
                proposedSnapshot: `serviceId=${item.serviceId};status=${isPaused ? 'ACTIVE' : 'PAUSED'}`,
                reason: isPaused
                    ? 'Provider đề nghị mở lại dịch vụ sau thời gian tạm ngừng.'
                    : 'Provider đề nghị tạm ngừng nhận đơn cho dịch vụ này.',
            });

            setMsg(
                isPaused
                    ? `Đã gửi yêu cầu mở lại dịch vụ "${item.name}". Vui lòng chờ Admin duyệt.`
                    : `Đã gửi yêu cầu tạm ngừng dịch vụ "${item.name}". Vui lòng chờ Admin duyệt.`
            );

            loadData();
        } catch (e) {
            setError(e.message || 'Không thể gửi yêu cầu thay đổi trạng thái dịch vụ.');
        }
    }

    function openPriceModal(item) {
        setSelectedService(item);
        setNewPrice(item.price != null ? String(item.price) : '');
        setPriceReason('');
        setModalError('');
        setShowPriceModal(true);
    }

    async function handleSubmitPriceChange() {
        setModalError('');

        if (!priceReason.trim()) {
            setModalError('Vui lòng nhập lý do điều chỉnh giá.');
            return;
        }

        const priceNumber = Number(newPrice);

        if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
            setModalError('Giá đề xuất phải là số lớn hơn 0.');
            return;
        }

        if (!selectedService) {
            setModalError('Không tìm thấy dịch vụ cần điều chỉnh.');
            return;
        }

        setSubmitting(true);

        try {
            await providerChangeRequestApi.create({
                type: 'SERVICE_UPDATE',
                targetId: selectedService.id,
                targetName: selectedService.name,
                oldSnapshot: `serviceId=${selectedService.serviceId};price=${selectedService.price}`,
                proposedSnapshot: `serviceId=${selectedService.serviceId};price=${priceNumber}`,
                reason: priceReason.trim(),
            });

            setMsg('Đã gửi đề nghị điều chỉnh giá thành công. Vui lòng chờ Admin duyệt.');
            setShowPriceModal(false);
            setSelectedService(null);
            loadData();
        } catch (e) {
            setModalError(e.message || 'Không thể gửi yêu cầu điều chỉnh giá.');
        } finally {
            setSubmitting(false);
        }
    }

    function openRegisterModal(item) {
        setTargetCatalogItem(item);
        setRegisterPrice(item.basePrice != null ? String(item.basePrice) : '');
        setRegisterReason('');
        setModalError('');
        setShowRegisterModal(true);
    }

    async function handleSubmitRegister() {
        setModalError('');

        if (!registerReason.trim()) {
            setModalError('Vui lòng nhập lý do hoặc kinh nghiệm cung cấp dịch vụ.');
            return;
        }

        const priceNumber = Number(registerPrice);

        if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
            setModalError('Giá đề xuất phải lớn hơn 0.');
            return;
        }

        if (!targetCatalogItem) {
            setModalError('Không tìm thấy dịch vụ trong danh mục sàn.');
            return;
        }

        setSubmitting(true);

        try {
            await providerServicesApi.requestService({
                type: 'SERVICE_REGISTER',
                serviceId: targetCatalogItem.id,
                proposedPrice: priceNumber,
                reason: registerReason.trim(),
            });

            setMsg(
                `Đã gửi yêu cầu đăng ký cung cấp "${targetCatalogItem.name}". Vui lòng chờ Admin duyệt.`
            );

            setShowRegisterModal(false);
            setTargetCatalogItem(null);
            loadData();
        } catch (e) {
            setModalError(e.message || 'Không thể gửi yêu cầu đăng ký dịch vụ.');
        } finally {
            setSubmitting(false);
        }
    }

    function statusBadge(status) {
        const value = String(status || '').toUpperCase();

        const map = {
            ACTIVE: { cls: 'pp-badge-active', label: 'Đang hoạt động' },
            PAUSED: { cls: 'pp-badge-warning', label: 'Tạm dừng nhận đơn' },
            INACTIVE: { cls: 'pp-badge-inactive', label: 'Ngừng hoạt động' },
            PENDING: { cls: 'pp-badge-pending', label: 'Chờ duyệt' },
            PENDING_REVIEW: { cls: 'pp-badge-pending', label: 'Chờ Admin duyệt' },
            NEEDS_INFORMATION: { cls: 'pp-badge-warning', label: 'Cần bổ sung thông tin' },
            APPROVED: { cls: 'pp-badge-completed', label: 'Đã duyệt' },
            REJECTED: { cls: 'pp-badge-cancelled', label: 'Bị từ chối' },
            WITHDRAWN: { cls: 'pp-badge-inactive', label: 'Đã rút yêu cầu' },
        };

        const config = map[value] || { cls: '', label: status || '—' };

        return <span className={`pp-badge ${config.cls}`}>{config.label}</span>;
    }

    function requestTypeLabel(type) {
        const map = {
            SERVICE_REGISTER: '➕ Đăng ký mới',
            SERVICE_UPDATE: '📝 Cập nhật / mở lại dịch vụ',
            SERVICE_PAUSE: '⏸️ Tạm ngừng dịch vụ',
            SERVICE_RETIRE: '🗑️ Ngừng cung cấp dịch vụ',
        };

        return map[String(type || '').toUpperCase()] || type || '—';
    }

    function requestDecision(request) {
        if (request.status === 'APPROVED') {
            return (
                <span style={{ color: 'var(--pp-success)', fontSize: 12 }}>
                    Đã phê duyệt
                </span>
            );
        }

        if (request.status === 'REJECTED') {
            return (
                <span style={{ color: 'var(--pp-danger)', fontSize: 12 }}>
                    Từ chối: {request.rejectReason || 'Không chấp thuận'}
                </span>
            );
        }

        if (request.status === 'PENDING_REVIEW') {
            return (
                <span style={{ color: 'var(--pp-warning)', fontSize: 12 }}>
                    Đang chờ Admin duyệt
                </span>
            );
        }

        if (request.status === 'NEEDS_INFORMATION') {
            return (
                <span style={{ color: 'var(--pp-warning)', fontSize: 12 }}>
                    Cần bổ sung: {request.rejectReason || 'Vui lòng kiểm tra yêu cầu.'}
                </span>
            );
        }

        if (request.status === 'WITHDRAWN') {
            return (
                <span style={{ color: 'var(--pp-muted)', fontSize: 12 }}>
                    Đã rút yêu cầu
                </span>
            );
        }

        return statusBadge(request.status);
    }

    return (
        <>
            <div className="pp-page-header">
                <div>
                    <h1 className="pp-page-title">Quản lý dịch vụ</h1>
                    <span style={{ fontSize: 13, color: 'var(--pp-muted)' }}>
                        Quản lý dịch vụ đang cung cấp và gửi đề nghị thay đổi để Admin xét duyệt.
                    </span>
                </div>
            </div>

            {msg && <div className="pp-alert pp-alert-success">{msg}</div>}
            {error && <div className="pp-alert pp-alert-error">⚠️ {error}</div>}

            <div className="pp-tabs">
                <button
                    className={`pp-tab ${activeTab === 'OFFERING' ? 'active' : ''}`}
                    onClick={() => setActiveTab('OFFERING')}
                >
                    🧹 Dịch vụ đang cung cấp ({offering.length})
                </button>

                <button
                    className={`pp-tab ${activeTab === 'CATALOG' ? 'active' : ''}`}
                    onClick={() => setActiveTab('CATALOG')}
                >
                    ➕ Đăng ký dịch vụ mới ({catalog.filter((item) => !item.registered).length})
                </button>

                <button
                    className={`pp-tab ${activeTab === 'REQUESTS' ? 'active' : ''}`}
                    onClick={() => setActiveTab('REQUESTS')}
                >
                    📋 Lịch sử đề nghị ({requests.length})
                </button>
            </div>

            {loading && <div className="pp-loading">Đang tải dữ liệu dịch vụ...</div>}

            {!loading && activeTab === 'OFFERING' && (
                <div className="pp-card" style={{ padding: 0 }}>
                    {offering.length === 0 ? (
                        <div className="pp-empty">
                            <p>
                                Bạn chưa đăng ký dịch vụ nào. Hãy chuyển sang tab
                                "Đăng ký dịch vụ mới" để bắt đầu chào bán dịch vụ trên CleanMate.
                            </p>
                        </div>
                    ) : (
                        <div className="pp-table-wrap">
                            <table className="pp-table">
                                <thead>
                                <tr>
                                    <th>Ảnh</th>
                                    <th>Tên dịch vụ</th>
                                    <th>Danh mục</th>
                                    <th>Thời lượng</th>
                                    <th>Giá niêm yết</th>
                                    <th>Trạng thái</th>
                                    <th>Thao tác</th>
                                </tr>
                                </thead>

                                <tbody>
                                {offering.map((item) => {
                                    const isPaused = String(item.status || '').toUpperCase() === 'PAUSED';

                                    return (
                                        <tr key={item.id}>
                                            <td style={{ width: 60 }}>
                                                {item.thumbnailUrl ? (
                                                    <img
                                                        src={item.thumbnailUrl}
                                                        alt={item.name}
                                                        style={{
                                                            width: 44,
                                                            height: 44,
                                                            borderRadius: 8,
                                                            objectFit: 'cover',
                                                        }}
                                                    />
                                                ) : (
                                                    <div
                                                        style={{
                                                            width: 44,
                                                            height: 44,
                                                            borderRadius: 8,
                                                            background: '#f1f5f9',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                        }}
                                                    >
                                                        🧹
                                                    </div>
                                                )}
                                            </td>

                                            <td>
                                                <strong>{item.name}</strong>
                                                {item.description && (
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            color: 'var(--pp-muted)',
                                                            maxWidth: 260,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {item.description}
                                                    </div>
                                                )}
                                            </td>

                                            <td>{item.category || '—'}</td>
                                            <td>
                                                {item.estimatedMinutes
                                                    ? `${item.estimatedMinutes} phút`
                                                    : '—'}
                                            </td>

                                            <td>
                                                <strong style={{ color: 'var(--pp-navy)' }}>
                                                    {VND(item.price)}
                                                </strong>
                                            </td>

                                            <td>{statusBadge(item.status)}</td>

                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button
                                                        className="pp-btn pp-btn-outline pp-btn-sm"
                                                        onClick={() => openPriceModal(item)}
                                                    >
                                                        Đổi giá
                                                    </button>

                                                    <button
                                                        className={`pp-btn pp-btn-sm ${isPaused ? 'pp-btn-success' : 'pp-btn-ghost'}`}
                                                        onClick={() => handleTogglePause(item)}
                                                        disabled={!['ACTIVE', 'PAUSED'].includes(String(item.status || '').toUpperCase())}
                                                    >
                                                        {isPaused ? '▶ Yêu cầu mở lại' : '⏸ Yêu cầu tạm dừng'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {!loading && activeTab === 'CATALOG' && (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: 16,
                    }}
                >
                    {catalog.map((item) => (
                        <div
                            key={item.id}
                            className="pp-card"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                            }}
                        >
                            <div>
                                {item.thumbnailUrl && (
                                    <img
                                        src={item.thumbnailUrl}
                                        alt={item.name}
                                        style={{
                                            width: '100%',
                                            height: 140,
                                            objectFit: 'cover',
                                            borderRadius: 8,
                                            marginBottom: 12,
                                        }}
                                    />
                                )}

                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: 6,
                                    }}
                                >
                                    <h3
                                        style={{
                                            fontSize: 15,
                                            fontWeight: 700,
                                            margin: 0,
                                            color: 'var(--pp-navy)',
                                        }}
                                    >
                                        {item.name}
                                    </h3>

                                    <span
                                        style={{
                                            fontSize: 11,
                                            background: '#f1f5f9',
                                            padding: '2px 8px',
                                            borderRadius: 999,
                                            color: 'var(--pp-muted)',
                                        }}
                                    >
                                        {item.category}
                                    </span>
                                </div>

                                <p
                                    style={{
                                        fontSize: 13,
                                        color: 'var(--pp-muted)',
                                        margin: '4px 0 12px',
                                        minHeight: 40,
                                    }}
                                >
                                    {item.description || 'Dịch vụ tiêu chuẩn trên sàn CleanMate.'}
                                </p>

                                <div style={{ fontSize: 13, marginBottom: 12 }}>
                                    Giá gốc sàn: <strong>{VND(item.basePrice)}</strong>
                                    {item.estimatedMinutes && ` • ${item.estimatedMinutes} phút`}
                                </div>
                            </div>

                            <div>
                                {item.registered ? (
                                    <span
                                        className="pp-badge pp-badge-active"
                                        style={{
                                            width: '100%',
                                            justifyContent: 'center',
                                            padding: '8px 0',
                                        }}
                                    >
                                        ✓ Đã đăng ký ({VND(item.partnerPrice)})
                                    </span>
                                ) : (
                                    <button
                                        className="pp-btn pp-btn-primary"
                                        style={{ width: '100%', justifyContent: 'center' }}
                                        onClick={() => openRegisterModal(item)}
                                    >
                                        + Đăng ký cung cấp
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!loading && activeTab === 'REQUESTS' && (
                <div className="pp-card" style={{ padding: 0 }}>
                    {requests.length === 0 ? (
                        <div className="pp-empty">
                            <p>Chưa có đề nghị dịch vụ nào được ghi nhận.</p>
                        </div>
                    ) : (
                        <div className="pp-table-wrap">
                            <table className="pp-table">
                                <thead>
                                <tr>
                                    <th>Mã #</th>
                                    <th>Loại đề nghị</th>
                                    <th>Tên dịch vụ</th>
                                    <th>Lý do đề nghị</th>
                                    <th>Thời gian gửi</th>
                                    <th>Trạng thái</th>
                                    <th>Quyết định Admin</th>
                                </tr>
                                </thead>

                                <tbody>
                                {requests.map((request) => (
                                    <tr key={request.id}>
                                        <td>
                                            <strong>#{request.id}</strong>
                                        </td>

                                        <td>{requestTypeLabel(request.requestType)}</td>

                                        <td>
                                            <strong>{request.targetName || '—'}</strong>
                                        </td>

                                        <td>{request.reason || '—'}</td>

                                        <td>
                                            {request.createdAt
                                                ? new Date(request.createdAt).toLocaleString('vi-VN')
                                                : '—'}
                                        </td>

                                        <td>{statusBadge(request.status)}</td>
                                        <td>{requestDecision(request)}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {showPriceModal && selectedService && (
                <div className="pp-modal-overlay">
                    <div className="pp-modal">
                        <div className="pp-modal-header">
                            <span className="pp-modal-title">Yêu cầu điều chỉnh giá dịch vụ</span>
                            <button
                                className="pp-modal-close"
                                onClick={() => setShowPriceModal(false)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="pp-modal-body">
                            {modalError && (
                                <div className="pp-alert pp-alert-error">{modalError}</div>
                            )}

                            <p style={{ margin: '0 0 12px', fontSize: 14 }}>
                                Dịch vụ: <strong>{selectedService.name}</strong>
                            </p>

                            <table className="pp-diff-table" style={{ marginBottom: 14 }}>
                                <thead>
                                <tr>
                                    <th>Giá hiện tại (VNĐ)</th>
                                    <th>Giá đề xuất mới (VNĐ)</th>
                                </tr>
                                </thead>

                                <tbody>
                                <tr>
                                    <td className="pp-diff-old">{VND(selectedService.price)}</td>
                                    <td className="pp-diff-new">{VND(newPrice)}</td>
                                </tr>
                                </tbody>
                            </table>

                            <div className="pp-form-group">
                                <label className="pp-label">Giá đề xuất mới (VNĐ) *</label>
                                <input
                                    className="pp-input"
                                    type="number"
                                    min="1"
                                    step="1000"
                                    placeholder="250000"
                                    value={newPrice}
                                    onChange={(e) => setNewPrice(e.target.value)}
                                />
                            </div>

                            <div className="pp-form-group">
                                <label className="pp-label">Lý do điều chỉnh *</label>
                                <textarea
                                    className="pp-textarea"
                                    placeholder="Nêu rõ lý do thay đổi giá (chi phí nguyên vật liệu, chính sách giá mới...)"
                                    value={priceReason}
                                    onChange={(e) => setPriceReason(e.target.value)}
                                />
                            </div>

                            <p
                                style={{
                                    fontSize: 12,
                                    color: 'var(--pp-muted)',
                                    background: '#eff6ff',
                                    padding: '8px 12px',
                                    borderRadius: 6,
                                }}
                            >
                                ℹ️ Đơn hàng đã đặt trước đó vẫn giữ nguyên mức giá cũ; giá mới chỉ áp dụng
                                cho các đơn đặt mới sau khi Admin duyệt.
                            </p>
                        </div>

                        <div className="pp-modal-footer">
                            <button
                                className="pp-btn pp-btn-ghost"
                                onClick={() => setShowPriceModal(false)}
                                disabled={submitting}
                            >
                                Hủy
                            </button>

                            <button
                                className="pp-btn pp-btn-primary"
                                onClick={handleSubmitPriceChange}
                                disabled={submitting}
                            >
                                {submitting ? 'Đang gửi...' : 'Gửi yêu cầu xét duyệt'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showRegisterModal && targetCatalogItem && (
                <div className="pp-modal-overlay">
                    <div className="pp-modal">
                        <div className="pp-modal-header">
                            <span className="pp-modal-title">Đăng ký cung cấp dịch vụ</span>
                            <button
                                className="pp-modal-close"
                                onClick={() => setShowRegisterModal(false)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="pp-modal-body">
                            {modalError && (
                                <div className="pp-alert pp-alert-error">{modalError}</div>
                            )}

                            <p style={{ margin: '0 0 12px', fontSize: 14 }}>
                                Dịch vụ đăng ký: <strong>{targetCatalogItem.name}</strong> ({targetCatalogItem.category})
                            </p>

                            <div className="pp-form-group">
                                <label className="pp-label">Giá chào bán đề xuất (VNĐ) *</label>
                                <input
                                    className="pp-input"
                                    type="number"
                                    min="1"
                                    step="1000"
                                    placeholder="Giá mong muốn..."
                                    value={registerPrice}
                                    onChange={(e) => setRegisterPrice(e.target.value)}
                                />

                                <span style={{ fontSize: 11, color: 'var(--pp-muted)' }}>
                                    Giá gốc sàn tham khảo: {VND(targetCatalogItem.basePrice)}
                                </span>
                            </div>

                            <div className="pp-form-group">
                                <label className="pp-label">Lý do & Kinh nghiệm cung cấp *</label>
                                <textarea
                                    className="pp-textarea"
                                    placeholder="Nêu trang thiết bị, nhân lực hoặc kinh nghiệm thực hiện dịch vụ này..."
                                    value={registerReason}
                                    onChange={(e) => setRegisterReason(e.target.value)}
                                />
                            </div>

                            <p
                                style={{
                                    fontSize: 12,
                                    color: 'var(--pp-muted)',
                                    background: '#eff6ff',
                                    padding: '8px 12px',
                                    borderRadius: 6,
                                }}
                            >
                                ℹ️ Dịch vụ chỉ được đưa vào danh sách cung cấp sau khi Admin phê duyệt đề nghị.
                            </p>
                        </div>

                        <div className="pp-modal-footer">
                            <button
                                className="pp-btn pp-btn-ghost"
                                onClick={() => setShowRegisterModal(false)}
                                disabled={submitting}
                            >
                                Hủy
                            </button>

                            <button
                                className="pp-btn pp-btn-primary"
                                onClick={handleSubmitRegister}
                                disabled={submitting}
                            >
                                {submitting ? 'Đang gửi...' : 'Gửi đề nghị đăng ký'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default ProviderServices;