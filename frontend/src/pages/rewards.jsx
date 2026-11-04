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
    const [loading, setLoading] = useState(Boolean(token));
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [selected, setSelected] = useState(null);
    const [form, setForm] = useState(initialForm);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [pending, setPending] = useState(null);
    const dialog = useRef(null);
    const busy = useRef(false);

    async function refresh() {
        const [nextWallet, nextGifts, nextHistory] = await Promise.all([rewardApi.wallet(), rewardApi.gifts(), rewardApi.history()]);
        setWallet(nextWallet); setGifts(nextGifts); setHistory(nextHistory);
    }

    useEffect(() => {
        if (!token) return;
        let active = true;
        Promise.all([rewardApi.wallet(), rewardApi.gifts(), rewardApi.history()])
            .then(([w, g, h]) => { if (active) { setWallet(w); setGifts(g); setHistory(h); } })
            .catch(e => { if (active) setError(e.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [token]);

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

    return <div className="rewards-shell"><Header /><main className="rewards-page">
        <div className="rewards-heading"><span>CLEANMATE REWARDS</span><h1>Cửa hàng Ccoin</h1><p>Đổi điểm chăm nhà, nhận quà thiết thực.</p></div>
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
            <section className="rewards-panel"><h2>Quà đã đổi</h2>{!history.length ? <p>Bạn chưa có yêu cầu đổi quà.</p> : history.map(item => <article className="rewards-history" key={item.id}><div><strong>#{item.id} · {item.giftName}</strong><p>{item.recipientName} · {item.phone}</p><p>{item.address}</p><small>{new Date(item.createdAt).toLocaleString('vi-VN')}</small></div><div><strong>−{number(item.pointsUsed)} Ccoin</strong><p>{({ PENDING: 'Chờ xử lý giao quà', SHIPPED: 'Đang giao', DELIVERED: 'Đã giao' })[item.status] || item.status}</p></div></article>)}</section>
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
    </main><Footer /></div>;
}
