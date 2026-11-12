import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { rewardApi } from '../services/rewardApi';
import './rewards.css';

const number = value => Number(value || 0).toLocaleString('vi-VN');
const initialForm = { recipientName: '', phone: '', address: '' };

export default function Rewards() {
    const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
    const [wallet, setWallet] = useState(null);
    const [gifts, setGifts] = useState([]);
    const [history, setHistory] = useState([]);
    const [vouchers, setVouchers] = useState([]);
    const [loading, setLoading] = useState(Boolean(token));
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [selected, setSelected] = useState(null);
    const [form, setForm] = useState(initialForm);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [pending, setPending] = useState(null);
    const [editingAddress, setEditingAddress] = useState(null);
    const [addressDraft, setAddressDraft] = useState('');
    const [orderActionBusy, setOrderActionBusy] = useState(false);
    const [cancelOrderTarget, setCancelOrderTarget] = useState(null);
    const [copiedVoucher, setCopiedVoucher] = useState('');
    const dialog = useRef(null);
    const ordersDialog = useRef(null);
    const cancelDialog = useRef(null);
    const busy = useRef(false);

    async function refresh() {
        const [nextWallet, nextGifts, nextHistory, nextVouchers] = await Promise.all([rewardApi.wallet(), rewardApi.gifts(), rewardApi.history(), rewardApi.vouchers()]);
        setWallet(nextWallet); setGifts(nextGifts); setHistory(nextHistory); setVouchers(nextVouchers);
    }

    useEffect(() => {
        if (!token) return;
        let active = true;
        Promise.all([rewardApi.wallet(), rewardApi.gifts(), rewardApi.history(), rewardApi.vouchers()])
            .then(([w, g, h, v]) => { if (active) { setWallet(w); setGifts(g); setHistory(h); setVouchers(v); } })
            .catch(e => { if (active) setError(e.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [token]);

    useEffect(() => {
        const modal = cancelDialog.current;
        if (!modal) return;
        if (cancelOrderTarget && !modal.open) modal.showModal();
        if (!cancelOrderTarget && modal.open) modal.close();
    }, [cancelOrderTarget]);

    function openGift(gift) {
        setPending(null);
        setSelected(gift); setForm(initialForm); setFormError(''); setSuccess('');
        dialog.current.showModal();
    }

    async function redeem(event) {
        event.preventDefault();
        if (busy.current) return;
        busy.current = true; setSubmitting(true); setFormError('');
        // Keep the same key and payload after a network failure so retry cannot spend twice.
        try {
            const requestKey = pending?.requestKey || Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
            const payload = pending || { giftId: selected.id, ...form, requestKey };
            setPending(payload);
            const result = await rewardApi.redeem(payload);
            dialog.current.close(); setSelected(null); setPending(null);
            setSuccess(`Đổi ${result.giftName} thành công! Yêu cầu #${result.id} đang chờ xử lý giao quà.`);
            try { await refresh(); } catch { setError('Quà đã đổi thành công. Vui lòng tải lại trang để cập nhật số dư.'); }
        } catch (e) {
            setFormError(e.message);
            if (e.status >= 400 && e.status < 500) setPending(null);
        }
        finally { busy.current = false; setSubmitting(false); }
    }

    async function copyVoucher(code) {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedVoucher(code);
            window.setTimeout(() => setCopiedVoucher(current => current === code ? '' : current), 1800);
        } catch {
            setError('Không thể sao chép mã voucher. Bạn có thể chọn và sao chép mã trực tiếp.');
        }
    }

    async function confirmReceived(orderId) {
        try {
            const updated = await rewardApi.confirmReceived(orderId);
            setHistory(current => current.map(order => order.id === updated.id ? updated : order));
            setSuccess(`Đã xác nhận nhận quà cho đơn #${updated.id}.`);
        } catch (e) {
            setError(e.message);
        }
    }

    async function saveAddress(order) {
        if (!addressDraft.trim() || orderActionBusy) return;
        setOrderActionBusy(true);
        try {
            const updated = await rewardApi.updateRedemptionAddress(order.id, addressDraft.trim());
            setHistory(current => current.map(item => item.id === updated.id ? updated : item));
            setEditingAddress(null);
            setSuccess(`Đã cập nhật địa chỉ giao quà cho đơn #${updated.id}.`);
        } catch (e) {
            setError(e.message);
        } finally {
            setOrderActionBusy(false);
        }
    }

    function cancelOrder(order) {
        if (orderActionBusy) return;
        setCancelOrderTarget(order);
    }

    async function confirmCancelOrder() {
        const order = cancelOrderTarget;
        if (!order || orderActionBusy) return;
        setOrderActionBusy(true);
        try {
            const updated = await rewardApi.cancelRedemption(order.id);
            setHistory(current => current.map(item => item.id === updated.id ? updated : item));
            setWallet(await rewardApi.wallet());
            setSuccess(`Đã hủy đơn #${updated.id}; ${number(updated.pointsUsed)} Ccoin đã được hoàn lại.`);
            setCancelOrderTarget(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setOrderActionBusy(false);
        }
    }

    return <div className="rewards-shell"><Header /><main className="rewards-page">
        <div className="rewards-heading"><span>CLEANMATE REWARDS</span><h1>Cửa hàng Ccoin</h1><p>Đổi điểm chăm nhà, nhận quà thiết thực.</p></div>
        {token && <button type="button" className="rewards-orders-trigger" onClick={() => ordersDialog.current?.showModal()}>Đơn hàng khuyến mãi <span>{history.length}</span></button>}
        {!token ? <div className="rewards-panel"><p>Đăng nhập để xem Ccoin và đổi quà.</p><Link to="/login">Đăng nhập</Link></div> : <>
            <section className="rewards-wallet"><div><span>Số dư của bạn</span><strong>{number(wallet?.balance)} <small>Ccoin</small></strong></div><p>Mỗi 1.000đ trong tổng tiền đơn đã thanh toán và hoàn tất = 1 Ccoin.<br />Dùng Ccoin đổi quà hoặc giảm giá tại checkout: 1.000 Ccoin = 1.000đ.</p></section>
            {loading && <p role="status">Đang tải cửa hàng…</p>}
            {error && <p className="rewards-error" role="alert">{error} <button onClick={() => window.location.reload()}>Tải lại</button></p>}
            {success && <p className="rewards-success" role="status">{success}</p>}
            <section aria-label="Quà đổi thưởng" className="rewards-grid">{gifts.map(gift => <article className="rewards-gift" key={gift.id}>
                <div className="rewards-gift-icon" aria-hidden="true">{gift.icon || '🎁'}</div><h2>{gift.name}</h2><p>{gift.description}</p>
                <strong>{number(gift.pointsCost)} Ccoin</strong><small>{gift.stock > 0 ? `Còn ${gift.stock} phần quà` : 'Tạm hết quà'}</small>
                <button disabled={!wallet || wallet.balance < gift.pointsCost || gift.stock < 1} onClick={() => openGift(gift)}>{gift.stock < 1 ? 'Hết quà' : wallet?.balance < gift.pointsCost ? 'Chưa đủ Ccoin' : 'Đổi phần quà'}</button>
            </article>)}</section>
            {!loading && !error && !gifts.length && <p>Cửa hàng chưa có quà. Vui lòng quay lại sau.</p>}
            <section className="rewards-panel rewards-voucher-panel">
                <h2>Voucher khuyến mãi</h2>
                <p className="rewards-voucher-intro">Bao gồm voucher áp dụng chung và voucher đã nhận riêng. Sao chép mã để áp dụng tại checkout.</p>
                {!vouchers.length ? <p>Bạn chưa có voucher nào.</p> : vouchers.map(voucher => {
                    const expired = voucher.expiresAt && new Date(voucher.expiresAt) < new Date();
                    const status = String(voucher.status || '').toUpperCase();
                    const available = status === 'AVAILABLE' && !expired;
                    const statusLabel = available ? 'Có thể sử dụng'
                        : expired || status === 'EXPIRED' ? 'Đã hết hạn'
                            : status === 'USED' ? 'Đã sử dụng'
                                : status === 'HELD' ? `Đang giữ${voucher.bookingId ? ` cho đơn #${voucher.bookingId}` : ' cho đơn hàng'}`
                                    : 'Không khả dụng';
                    const discount = voucher.discountType === 'PERCENT'
                        ? `Giảm ${number(voucher.discountValue)}%`
                        : `Giảm ${number(voucher.discountValue)}đ`;
                    return <article className="rewards-voucher" key={voucher.id}>
                        <div className="rewards-voucher-main">
                            <strong>{voucher.name || 'Voucher CleanMate'}</strong>
                            {voucher.shared && <span className="rewards-voucher-shared">Áp dụng cho mọi khách hàng</span>}
                            <span>{discount}</span>
                            {voucher.description && <p>{voucher.description}</p>}
                            <small>{voucher.expiresAt ? `Hạn dùng: ${new Date(voucher.expiresAt).toLocaleDateString('vi-VN')}` : 'Không có hạn sử dụng riêng'}</small>
                        </div>
                        <div className="rewards-voucher-code"><code>{voucher.code}</code><span className={available ? 'is-available' : 'is-unavailable'}>{statusLabel}</span></div>
                        <button type="button" disabled={!available} onClick={() => copyVoucher(voucher.code)}>{available ? copiedVoucher === voucher.code ? 'Đã sao chép' : 'Sao chép mã' : 'Không khả dụng'}</button>
                    </article>;
                })}
            </section>
            <section className="rewards-panel"><h2>Lịch sử Ccoin</h2>{!wallet?.transactions?.length ? <p>Chưa có giao dịch Ccoin.</p> : wallet.transactions.slice(0, 30).map(item => <div className="rewards-history" key={item.id}><span>{item.description}<small>{new Date(item.createdAt).toLocaleString('vi-VN')}</small></span><strong>{item.points > 0 ? '+' : ''}{number(item.points)} Ccoin</strong></div>)}</section>
        </>}
        <dialog className="rewards-dialog" ref={dialog} onCancel={event => { if (submitting) event.preventDefault(); }}>
            {selected && <form onSubmit={redeem}><h2>Nhận {selected.name}</h2><p>Đổi bằng <strong>{number(selected.pointsCost)} Ccoin</strong>. Vui lòng nhập thông tin giao quà.</p>
                <label>Họ tên người nhận<input required maxLength={100} value={form.recipientName} disabled={submitting || Boolean(pending)} onChange={e => setForm({ ...form, recipientName: e.target.value })} /></label>
                <label>Số điện thoại<input required type="tel" pattern="[+]?[0-9]{9,15}" maxLength={20} value={form.phone} disabled={submitting || Boolean(pending)} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
                <label>Địa chỉ nhận quà<textarea required minLength={10} maxLength={500} rows={3} placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố" value={form.address} disabled={submitting || Boolean(pending)} onChange={e => setForm({ ...form, address: e.target.value })} /></label>
                {formError && <p role="alert" className="rewards-error">{formError}</p>}
                <div className="rewards-dialog-actions"><button type="button" disabled={submitting} onClick={() => dialog.current.close()}>Đóng</button><button type="submit" disabled={submitting}>{submitting ? 'Đang đổi…' : pending ? 'Thử lại yêu cầu' : 'Xác nhận đổi quà'}</button></div>
            </form>}
        </dialog>
        <dialog className="rewards-orders-dialog" ref={ordersDialog}>
            <div className="rewards-orders-header"><div><span>LỊCH SỬ MUA QUÀ</span><h2>Đơn hàng khuyến mãi</h2></div><button type="button" aria-label="Đóng" onClick={() => ordersDialog.current?.close()}>×</button></div>
            {!history.length ? <p className="rewards-orders-empty">Bạn chưa có đơn đổi quà nào.</p> : <div className="rewards-orders-list">{history.map(order => <article className="rewards-order-item" key={order.id}>
                <div className="rewards-order-title"><div><strong>{order.giftName}</strong><small>Đơn #{order.id} · {new Date(order.createdAt).toLocaleString('vi-VN')}</small></div><span className={`rewards-order-status ${String(order.status).toLowerCase()}`}>{({ PENDING: 'Đang xử lý', SHIPPED: 'Đang giao', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy' })[order.status] || order.status}</span></div>
                <div className="rewards-order-info"><span>Người nhận: <strong>{order.recipientName}</strong></span><span>Điện thoại: <strong>{order.phone}</strong></span><span>Địa chỉ: <strong>{order.address}</strong></span><span>Đã dùng: <strong>{number(order.pointsUsed)} Ccoin</strong></span>{order.cancelledAt && <span>Ngày hủy: <strong>{new Date(order.cancelledAt).toLocaleString('vi-VN')}</strong></span>}</div>
                {order.status === 'PENDING' && <div className="rewards-order-actions">
                    {editingAddress === order.id ? <div className="rewards-address-editor"><label htmlFor={`gift-address-${order.id}`}>Địa chỉ nhận quà<textarea id={`gift-address-${order.id}`} minLength={10} maxLength={500} value={addressDraft} onChange={event => setAddressDraft(event.target.value)} /></label><button type="button" disabled={orderActionBusy || addressDraft.trim().length < 10} onClick={() => saveAddress(order)}>{orderActionBusy ? 'Đang lưu…' : 'Lưu địa chỉ'}</button><button type="button" className="secondary" disabled={orderActionBusy} onClick={() => setEditingAddress(null)}>Đóng</button></div> : <button type="button" disabled={orderActionBusy} onClick={() => { setEditingAddress(order.id); setAddressDraft(order.address); }}>Sửa địa chỉ</button>}
                    <button type="button" className="secondary" disabled={orderActionBusy} onClick={() => cancelOrder(order)}>{orderActionBusy ? 'Đang xử lý…' : 'Hủy đơn và hoàn Ccoin'}</button>
                </div>}
                {order.status === 'SHIPPED' && <button type="button" className="rewards-order-received" disabled={orderActionBusy} onClick={() => confirmReceived(order.id)}>Đã nhận hàng</button>}
            </article>)}</div>}
        </dialog>
        <dialog className="rewards-confirm-dialog" ref={cancelDialog} onCancel={event => {
            if (orderActionBusy) event.preventDefault();
            else setCancelOrderTarget(null);
        }}>
            {cancelOrderTarget && <>
                <span className="rewards-confirm-icon" aria-hidden="true">!</span>
                <h2>Xác nhận hủy đơn</h2>
                <p>Bạn có chắc muốn hủy đơn đổi <strong>{cancelOrderTarget.giftName}</strong> không? {number(cancelOrderTarget.pointsUsed)} Ccoin sẽ được hoàn lại vào ví.</p>
                <div className="rewards-confirm-actions">
                    <button type="button" className="secondary" disabled={orderActionBusy} onClick={() => setCancelOrderTarget(null)}>Quay lại</button>
                    <button type="button" className="danger" disabled={orderActionBusy} onClick={confirmCancelOrder}>{orderActionBusy ? 'Đang xử lý…' : 'Xác nhận hủy'}</button>
                </div>
            </>}
        </dialog>
    </main><Footer /></div>;
}
