import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxOpen, faFileInvoice, faRotateLeft } from "@fortawesome/free-solid-svg-icons";
import AdminLayout from "./AdminLayout";
import "./AdminRewardOrders.css";

const API_URL = "http://localhost:8080/api/admin/reward-orders";
const money = value => `${Number(value || 0).toLocaleString("vi-VN")} Ccoin`;
const dateTime = value => value ? new Date(value).toLocaleString("vi-VN") : "—";
const statusText = status => ({ PENDING: "Đang xử lý", SHIPPED: "Đang giao", DELIVERED: "Đã giao" })[status] || status;

function getToken() {
    return localStorage.getItem("accessToken") || sessionStorage.getItem("accessToken") || localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

async function request(path = "", options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || data.message || "Không thể xử lý đơn hàng quà tặng.");
    return data;
}

export default function AdminRewardOrders() {
    const [orders, setOrders] = useState([]);
    const [filter, setFilter] = useState("ALL");
    const [selected, setSelected] = useState(null);
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const dialog = useRef(null);
    const printedId = useRef(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try { setOrders(await request()); }
        catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        if (!invoice || printedId.current === invoice.id) return;
        printedId.current = invoice.id;
        const timer = window.setTimeout(() => window.print(), 350);
        return () => window.clearTimeout(timer);
    }, [invoice]);

    const counts = useMemo(() => ({
        ALL: orders.length,
        PENDING: orders.filter(order => order.status === "PENDING").length,
        SHIPPED: orders.filter(order => order.status === "SHIPPED").length,
        DELIVERED: orders.filter(order => order.status === "DELIVERED").length
    }), [orders]);
    const shownOrders = filter === "ALL" ? orders : orders.filter(order => order.status === filter);

    function openDetails(order) {
        setSelected(order);
        dialog.current?.showModal();
    }

    function printInvoice(order) {
        printedId.current = null;
        setInvoice({ ...order });
    }

    async function exportInvoice() {
        if (!selected || busy) return;
        setBusy(true);
        setError("");
        try {
            const updated = await request(`/${selected.id}/ship`, { method: "POST" });
            setOrders(current => current.map(order => order.id === updated.id ? updated : order));
            setSelected(updated);
            printInvoice(updated);
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    }

    return <AdminLayout>
        <div className="reward-orders-page">
            <div className="reward-orders-heading">
                <div><span>VẬN HÀNH CCOIN</span><h1><FontAwesomeIcon icon={faBoxOpen} /> Đơn hàng khuyến mãi</h1><p>Quản lý các đơn đổi quà từ cửa hàng Ccoin.</p></div>
                <button type="button" className="reward-orders-refresh" onClick={load} disabled={loading} aria-label="Tải lại"><FontAwesomeIcon icon={faRotateLeft} /></button>
            </div>

            <div className="reward-orders-stats">
                {[ ["Tất cả đơn", "ALL"], ["Đang xử lý", "PENDING"], ["Đang giao", "SHIPPED"], ["Đã giao", "DELIVERED"] ].map(([label, status]) =>
                    <button type="button" key={status} className={`reward-order-stat ${filter === status ? "selected" : ""}`} onClick={() => setFilter(status)}>
                        <span>{label}</span><strong>{counts[status]}</strong>
                    </button>
                )}
            </div>

            {error && <div className="reward-order-alert" role="alert">{error}</div>}
            <section className="reward-orders-table-card">
                <div className="reward-orders-table-title"><div><h2>Danh sách đơn đổi quà</h2><p>Chọn một đơn để xem thông tin người nhận và xuất hóa đơn.</p></div></div>
                <div className="reward-orders-table-wrap"><table className="reward-orders-table"><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Quà tặng</th><th>Điểm</th><th>Ngày đặt</th><th>Trạng thái</th><th></th></tr></thead>
                    <tbody>
                        {loading && <tr><td colSpan="7" className="reward-order-empty">Đang tải đơn hàng…</td></tr>}
                        {!loading && shownOrders.map(order => <tr key={order.id}>
                            <td><strong>#{order.id}</strong></td><td><strong>{order.customerName || `Khách hàng #${order.customerId}`}</strong><small>{order.customerEmail}</small></td>
                            <td>{order.giftName}</td><td>{money(order.pointsUsed)}</td><td>{dateTime(order.createdAt)}</td>
                            <td><span className={`reward-order-status ${order.status?.toLowerCase()}`}>{statusText(order.status)}</span></td>
                            <td><button type="button" className="reward-order-view" onClick={() => openDetails(order)}>Chi tiết</button></td>
                        </tr>)}
                        {!loading && shownOrders.length === 0 && <tr><td colSpan="7" className="reward-order-empty">Không có đơn hàng ở trạng thái này.</td></tr>}
                    </tbody>
                </table></div>
            </section>
        </div>

        <dialog className="reward-order-dialog" ref={dialog} onClose={() => setSelected(null)}>
            {selected && <>
                <div className="reward-order-dialog-heading"><div><span>ĐƠN ĐỔI QUÀ #{selected.id}</span><h2>{selected.giftName}</h2></div><button type="button" onClick={() => dialog.current?.close()} aria-label="Đóng">×</button></div>
                <div className="reward-order-detail-grid">
                    <div><small>Khách hàng</small><strong>{selected.customerName || `Khách hàng #${selected.customerId}`}</strong><span>{selected.customerEmail}</span></div>
                    <div><small>Người nhận</small><strong>{selected.recipientName}</strong><span>{selected.phone}</span></div>
                    <div className="wide"><small>Địa chỉ giao</small><strong>{selected.address}</strong></div>
                    <div><small>Điểm đã đổi</small><strong>{money(selected.pointsUsed)}</strong></div>
                    <div><small>Ngày đặt</small><strong>{dateTime(selected.createdAt)}</strong></div>
                    <div><small>Trạng thái</small><strong><span className={`reward-order-status ${selected.status?.toLowerCase()}`}>{statusText(selected.status)}</span></strong></div>
                </div>
                {error && <div className="reward-order-alert" role="alert">{error}</div>}
                <div className="reward-order-dialog-actions">
                    <button type="button" className="secondary" onClick={() => dialog.current?.close()}>Đóng</button>
                    {selected.status === "PENDING" && <button type="button" onClick={exportInvoice} disabled={busy}><FontAwesomeIcon icon={faFileInvoice} /> {busy ? "Đang xuất…" : "Xuất hóa đơn & chuyển sang đang giao"}</button>}
                    {selected.status !== "PENDING" && <button type="button" onClick={() => printInvoice(selected)}><FontAwesomeIcon icon={faFileInvoice} /> In hóa đơn</button>}
                </div>
            </>}
        </dialog>

        {invoice && <article className="gift-invoice-print" aria-hidden="true">
            <header><h1>CleanMate</h1><p>HÓA ĐƠN ĐƠN HÀNG ĐỔI QUÀ</p></header>
            <h2>Đơn hàng khuyến mãi #{invoice.id}</h2>
            <p><strong>Ngày tạo:</strong> {dateTime(invoice.createdAt)}</p>
            <p><strong>Khách hàng:</strong> {invoice.customerName} ({invoice.customerEmail})</p>
            <p><strong>Người nhận:</strong> {invoice.recipientName} · {invoice.phone}</p>
            <p><strong>Địa chỉ:</strong> {invoice.address}</p>
            <table><thead><tr><th>Sản phẩm quà tặng</th><th>Điểm Ccoin</th></tr></thead><tbody><tr><td>{invoice.giftName}</td><td>{money(invoice.pointsUsed)}</td></tr></tbody></table>
            <p className="invoice-status">Trạng thái giao hàng: Đang giao</p>
        </article>}
    </AdminLayout>;
}
