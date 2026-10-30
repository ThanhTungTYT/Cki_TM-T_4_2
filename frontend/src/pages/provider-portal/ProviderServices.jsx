import { useEffect, useState } from 'react';
import { providerServicesApi, providerChangeRequestApi } from '../../services/providerApi';

const VND = (v) => (v != null ? `${Number(v).toLocaleString('vi-VN')}đ` : '—');

function ProviderServices() {
    const [activeTab, setActiveTab] = useState('OFFERING'); // OFFERING, CATALOG, REQUESTS
    const [offering, setOffering] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [msg, setMsg] = useState('');

    // Modal Đổi giá
    const [showPriceModal, setShowPriceModal] = useState(false);
    const [selectedService, setSelectedService] = useState(null);
    const [newPrice, setNewPrice] = useState('');
    const [priceReason, setPriceReason] = useState('');

    // Modal Đăng ký dịch vụ mới
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
                // Filter requests related to services
                const sReqs = (Array.isArray(reqList) ? reqList : []).filter(
                    (r) => r.requestType === 'SERVICE_REGISTER' || r.requestType === 'SERVICE_UPDATE'
                );
                setRequests(sReqs);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        loadData();
    }, []);

    async function handleTogglePause(item) {
        const isPaused = item.status === 'PAUSED';
        const actionName = isPaused ? 'mở lại nhận đơn' : 'tạm dừng nhận đơn';
        if (!window.confirm(`Bạn có chắc muốn ${actionName} cho dịch vụ "${item.name}"?`)) return;

        try {
            if (isPaused) {
                await providerServicesApi.resume(item.id);
                setMsg(`✅ Đã mở lại nhận đơn cho dịch vụ "${item.name}".`);
            } else {
                await providerServicesApi.pause(item.id);
                setMsg(`⏸️ Đã tạm dừng nhận đơn cho dịch vụ "${item.name}".`);
            }
            loadData();
        } catch (e) {
            setError(e.message);
        }
    }

    function openPriceModal(item) {
        setSelectedService(item);
        setNewPrice(item.price ? String(item.price) : '');
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
        const pNum = parseFloat(newPrice);
        if (isNaN(pNum) || pNum <= 0) {
            setModalError('Giá đề xuất phải là số lớn hơn 0.');
            return;
        }

        setSubmitting(true);
        try {
            await providerChangeRequestApi.create({
                type: 'SERVICE_UPDATE',
                targetId: selectedService.id,
                targetName: selectedService.name,
                oldSnapshot: `serviceId=${selectedService.serviceId};price=${selectedService.price}`,
                proposedSnapshot: `serviceId=${selectedService.serviceId};price=${pNum}`,
                reason: priceReason.trim(),
            });
            setMsg('✅ Đã gửi đề nghị điều chỉnh giá thành công! Vui lòng chờ Admin duyệt.');
            setShowPriceModal(false);
            loadData();
        } catch (e) {
            setModalError(e.message);
        } finally {
            setSubmitting(false);
        }
    }

    function openRegisterModal(catItem) {
        setTargetCatalogItem(catItem);
        setRegisterPrice(catItem.basePrice ? String(catItem.basePrice) : '');
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
        const pNum = parseFloat(registerPrice);
        if (isNaN(pNum) || pNum <= 0) {
            setModalError('Giá đề xuất phải lớn hơn 0.');
            return;
        }

        setSubmitting(true);
        try {
            await providerServicesApi.requestService({
                type: 'SERVICE_REGISTER',
                serviceId: targetCatalogItem.id,
                proposedPrice: pNum,
                reason: registerReason.trim(),
            });
            setMsg(`✅ Đã gửi yêu cầu đăng ký cung cấp "${targetCatalogItem.name}"! Vui lòng chờ Admin duyệt.`);
            setShowRegisterModal(false);
            loadData();
        } catch (e) {
            setModalError(e.message);
        } finally {
            setSubmitting(false);
        }
    }

    function statusBadge(s) {
        const map = {
            ACTIVE: { cls: 'pp-badge-active', label: 'Đang hoạt động' },
            PAUSED: { cls: 'pp-badge-warning', label: 'Tạm dừng nhận đơn' },
            INACTIVE: { cls: 'pp-badge-inactive', label: 'Ngừng hoạt động' },
            PENDING: { cls: 'pp-badge-pending', label: 'Chờ duyệt' },
            APPROVED: { cls: 'pp-badge-completed', label: 'Đã duyệt' },
            REJECTED: { cls: 'pp-badge-cancelled', label: 'Bị từ chối' },
        };
        const cfg = map[(s || '').toUpperCase()] || { cls: '', label: s || '—' };
        return <span className={`pp-badge ${cfg.cls}`}>{cfg.label}</span>;
    }

    return (
        <>
            <div className="pp-page-header">
                <div>
                    <h1 className="pp-page-title">Quản lý dịch vụ</h1>
                    <span style={{ fontSize: 13, color: 'var(--pp-muted)' }}>
                        Quản lý các dịch vụ đang cung cấp và đăng ký dịch vụ mới từ sàn
                    </span>
                </div>
            </div>

            {msg && <div className="pp-alert pp-alert-success">{msg}</div>}
            {error && <div className="pp-alert pp-alert-error">⚠️ {error}</div>}

            {/* Navigation Tabs */}
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
                    ➕ Đăng ký dịch vụ mới ({catalog.filter((c) => !c.registered).length})
                </button>
                <button
                    className={`pp-tab ${activeTab === 'REQUESTS' ? 'active' : ''}`}
                    onClick={() => setActiveTab('REQUESTS')}
                >
                    📋 Lịch sử đề nghị ({requests.length})
                </button>
            </div>

            {loading && <div className="pp-loading">Đang tải dữ liệu dịch vụ...</div>}

            {/* TAB 1: DỊCH VỤ ĐANG CUNG CẤP */}
            {!loading && activeTab === 'OFFERING' && (
                <div className="pp-card" style={{ padding: 0 }}>
                    {offering.length === 0 ? (
                        <div className="pp-empty">
                            <p>Bạn chưa đăng ký dịch vụ nào. Hãy chuyển sang tab "Đăng ký dịch vụ mới" để bắt đầu chào bán dịch vụ trên CleanMate.</p>
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
                                    {offering.map((item) => (
                                        <tr key={item.id}>
                                            <td style={{ width: 60 }}>
                                                {item.thumbnailUrl ? (
                                                    <img
                                                        src={item.thumbnailUrl}
                                                        alt={item.name}
                                                        style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }}
                                                    />
                                                ) : (
                                                    <div style={{ width: 44, height: 44, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        🧹
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <strong>{item.name}</strong>
                                                {item.description && (
                                                    <div style={{ fontSize: 12, color: 'var(--pp-muted)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {item.description}
                                                    </div>
                                                )}
                                            </td>
                                            <td>{item.category || '—'}</td>
                                            <td>{item.estimatedMinutes ? `${item.estimatedMinutes} phút` : '—'}</td>
                                            <td>
                                                <strong style={{ color: 'var(--pp-navy)' }}>{VND(item.price)}</strong>
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
                                                        className={`pp-btn pp-btn-sm ${item.status === 'PAUSED' ? 'pp-btn-success' : 'pp-btn-ghost'}`}
                                                        onClick={() => handleTogglePause(item)}
                                                    >
                                                        {item.status === 'PAUSED' ? '▶ Mở lại' : '⏸ Tạm dừng'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: ĐĂNG KÝ TỪ CATALOG SÀN */}
            {!loading && activeTab === 'CATALOG' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {catalog.map((item) => (
                        <div key={item.id} className="pp-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                                {item.thumbnailUrl && (
                                    <img
                                        src={item.thumbnailUrl}
                                        alt={item.name}
                                        style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }}
                                    />
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--pp-navy)' }}>
                                        {item.name}
                                    </h3>
                                    <span style={{ fontSize: 11, background: '#f1f5f9', padding: '2px 8px', borderRadius: 999, color: 'var(--pp-muted)' }}>
                                        {item.category}
                                    </span>
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--pp-muted)', margin: '4px 0 12px', minHeight: 40 }}>
                                    {item.description || 'Dịch vụ tiêu chuẩn trên sàn CleanMate.'}
                                </p>
                                <div style={{ fontSize: 13, marginBottom: 12 }}>
                                    Giá gốc sàn: <strong>{VND(item.basePrice)}</strong>
                                    {item.estimatedMinutes && ` • ${item.estimatedMinutes} phút`}
                                </div>
                            </div>

                            <div>
                                {item.registered ? (
                                    <span className="pp-badge pp-badge-active" style={{ width: '100%', justifyContent: 'center', padding: '8px 0' }}>
                                        ✓ Đang cung cấp ({VND(item.partnerPrice)})
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

            {/* TAB 3: LỊCH SỬ ĐỀ NGHỊ DỊCH VỤ */}
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
                                    {requests.map((r) => (
                                        <tr key={r.id}>
                                            <td><strong>#{r.id}</strong></td>
                                            <td>
                                                {r.requestType === 'SERVICE_REGISTER' ? '➕ Đăng ký mới' : '💵 Điều chỉnh giá'}
                                            </td>
                                            <td><strong>{r.targetName || '—'}</strong></td>
                                            <td>{r.reason}</td>
                                            <td>{r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '—'}</td>
                                            <td>{statusBadge(r.status)}</td>
                                            <td>
                                                {r.status === 'APPROVED' && (
                                                    <span style={{ color: 'var(--pp-success)', fontSize: 12 }}>
                                                        Đã phê duyệt
                                                    </span>
                                                )}
                                                {r.status === 'REJECTED' && (
                                                    <span style={{ color: 'var(--pp-danger)', fontSize: 12 }}>
                                                        Từ chối: {r.rejectReason || 'Không chấp thuận'}
                                                    </span>
                                                )}
                                                {r.status === 'PENDING_REVIEW' && (
                                                    <span style={{ color: 'var(--pp-warning)', fontSize: 12 }}>
                                                        Đang chờ duyệt
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL ĐIỀU CHỈNH GIÁ */}
            {showPriceModal && selectedService && (
                <div className="pp-modal-overlay">
                    <div className="pp-modal">
                        <div className="pp-modal-header">
                            <span className="pp-modal-title">Yêu cầu điều chỉnh giá dịch vụ</span>
                            <button className="pp-modal-close" onClick={() => setShowPriceModal(false)}>×</button>
                        </div>
                        <div className="pp-modal-body">
                            {modalError && <div className="pp-alert pp-alert-error">{modalError}</div>}
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
                            <p style={{ fontSize: 12, color: 'var(--pp-muted)', background: '#eff6ff', padding: '8px 12px', borderRadius: 6 }}>
                                ℹ️ Đơn hàng đã đặt trước đó vẫn giữ nguyên mức giá cũ; giá mới chỉ áp dụng cho các đơn đặt mới sau khi Admin duyệt.
                            </p>
                        </div>
                        <div className="pp-modal-footer">
                            <button className="pp-btn pp-btn-ghost" onClick={() => setShowPriceModal(false)}>Hủy</button>
                            <button className="pp-btn pp-btn-primary" onClick={handleSubmitPriceChange} disabled={submitting}>
                                {submitting ? 'Đang gửi...' : 'Gửi yêu cầu xét duyệt'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ĐĂNG KÝ CUNG CẤP DỊCH VỤ MỚI */}
            {showRegisterModal && targetCatalogItem && (
                <div className="pp-modal-overlay">
                    <div className="pp-modal">
                        <div className="pp-modal-header">
                            <span className="pp-modal-title">Đăng ký cung cấp dịch vụ</span>
                            <button className="pp-modal-close" onClick={() => setShowRegisterModal(false)}>×</button>
                        </div>
                        <div className="pp-modal-body">
                            {modalError && <div className="pp-alert pp-alert-error">{modalError}</div>}
                            <p style={{ margin: '0 0 12px', fontSize: 14 }}>
                                Dịch vụ đăng ký: <strong>{targetCatalogItem.name}</strong> ({targetCatalogItem.category})
                            </p>
                            <div className="pp-form-group">
                                <label className="pp-label">Giá chào bán đề xuất (VNĐ) *</label>
                                <input
                                    className="pp-input"
                                    type="number"
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
                            <p style={{ fontSize: 12, color: 'var(--pp-muted)', background: '#eff6ff', padding: '8px 12px', borderRadius: 6 }}>
                                ℹ️ Dịch vụ chỉ hiển thị trên sàn và AI Chatbot sau khi Admin phê duyệt đề nghị của bạn.
                            </p>
                        </div>
                        <div className="pp-modal-footer">
                            <button className="pp-btn pp-btn-ghost" onClick={() => setShowRegisterModal(false)}>Hủy</button>
                            <button className="pp-btn pp-btn-primary" onClick={handleSubmitRegister} disabled={submitting}>
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
