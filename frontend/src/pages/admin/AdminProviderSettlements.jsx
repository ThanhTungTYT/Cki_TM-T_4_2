
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faRotate,
    faFileInvoiceDollar,
    faEye,
    faCheck,
    faMoneyBillTransfer,
    faPlus,
    faXmark
} from "@fortawesome/free-solid-svg-icons";
import "./AdminProviderSettlements.css";

const API = "http://localhost:8080/api";

function getToken() {
    return localStorage.getItem("accessToken") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("accessToken") ||
        sessionStorage.getItem("token") ||
        "";
}

async function request(url, options = {}) {
    const token = getToken();

    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers
        }
    });

    const raw = await response.text();
    let data = null;

    if (raw) {
        try {
            data = JSON.parse(raw);
        } catch {
            data = { message: raw };
        }
    }

    if (!response.ok) {
        throw new Error(
            data?.message ||
            data?.detail ||
            data?.error ||
            `Yêu cầu thất bại (HTTP ${response.status}).`
        );
    }

    return data;
}

const money = value => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const dateTime = value => value
    ? new Date(value).toLocaleString("vi-VN")
    : "—";

const statusText = value => ({
    DRAFT: "Bản nháp",
    APPROVED: "Đã duyệt",
    PAID: "Đã chuyển tiền"
}[String(value || "").toUpperCase()] || value || "—");

function AdminProviderSettlements() {
    const [settlements, setSettlements] = useState([]);
    const [providers, setProviders] = useState([]);
    const [eligible, setEligible] = useState([]);

    const [partnerId, setPartnerId] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [fee, setFee] = useState("0");
    const [deduction, setDeduction] = useState("0");
    const [note, setNote] = useState("");

    const [detail, setDetail] = useState(null);
    const [paidTarget, setPaidTarget] = useState(null);
    const [transferReference, setTransferReference] = useState("");
    const [evidenceUrl, setEvidenceUrl] = useState("");
    const [paidNote, setPaidNote] = useState("");

    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const [settlementData, providerData] = await Promise.all([
                request(`${API}/admin/provider-settlements`),
                request(`${API}/admin/providers`)
            ]);

            setSettlements(Array.isArray(settlementData) ? settlementData : []);
            setProviders(Array.isArray(providerData) ? providerData : []);
        } catch (e) {
            setError(e.message || "Không thể tải dữ liệu đối soát.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const eligibleTotal = useMemo(
        () => eligible.reduce((sum, item) => sum + Number(item.subtotal || 0), 0),
        [eligible]
    );

    const summary = useMemo(() => ({
        count: settlements.length,
        draft: settlements.filter(x => x.status === "DRAFT").length,
        approved: settlements.filter(x => x.status === "APPROVED").length,
        paid: settlements.filter(x => x.status === "PAID").length,
        paidTotal: settlements
            .filter(x => x.status === "PAID")
            .reduce((sum, x) => sum + Number(x.payoutAmount || 0), 0)
    }), [settlements]);

    const loadEligible = async () => {
        setError("");
        setMessage("");
        setEligible([]);

        if (!partnerId || !fromDate || !toDate) {
            setError("Chọn Provider, ngày bắt đầu và ngày kết thúc trước khi tải đơn.");
            return;
        }

        try {
            const params = new URLSearchParams({
                partnerId,
                fromDate,
                toDate
            });

            const data = await request(
                `${API}/admin/provider-settlements/eligible-bookings?${params}`
            );

            setEligible(Array.isArray(data) ? data : []);

            if (!data?.length) {
                setMessage("Không có đơn COMPLETED chưa được đưa vào kỳ đối soát trong khoảng thời gian này.");
            }
        } catch (e) {
            setError(e.message);
        }
    };

    const createSettlement = async event => {
        event.preventDefault();
        setBusy(true);
        setError("");
        setMessage("");

        try {
            const result = await request(`${API}/admin/provider-settlements`, {
                method: "POST",
                body: JSON.stringify({
                    partnerId: Number(partnerId),
                    fromDate,
                    toDate,
                    platformFeeAmount: Number(fee || 0),
                    refundDeductionAmount: Number(deduction || 0),
                    note
                })
            });

            setMessage(`Đã tạo kỳ đối soát #${result.id}. Kỳ đang ở trạng thái Bản nháp.`);
            setEligible([]);
            setFee("0");
            setDeduction("0");
            setNote("");

            await loadData();
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const openDetail = async id => {
        try {
            const data = await request(`${API}/admin/provider-settlements/${id}`);
            setDetail(data);
        } catch (e) {
            setError(e.message);
        }
    };

    const approve = async id => {
        if (!window.confirm("Xác nhận duyệt kỳ đối soát này? Duyệt không có nghĩa là đã chuyển tiền.")) {
            return;
        }

        setBusy(true);
        setError("");

        try {
            await request(`${API}/admin/provider-settlements/${id}/approve`, {
                method: "PATCH",
                body: JSON.stringify({
                    note: "Admin duyệt kỳ đối soát."
                })
            });

            setMessage(`Đã duyệt kỳ đối soát #${id}. Chưa ghi nhận đã chuyển tiền.`);
            await loadData();

            if (detail?.id === id) {
                await openDetail(id);
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const submitPaid = async event => {
        event.preventDefault();

        if (!paidTarget) return;

        setBusy(true);
        setError("");

        try {
            await request(`${API}/admin/provider-settlements/${paidTarget.id}/paid`, {
                method: "PATCH",
                body: JSON.stringify({
                    transferReference,
                    evidenceUrl,
                    note: paidNote
                })
            });

            setMessage(`Đã ghi nhận chuyển tiền cho kỳ #${paidTarget.id} kèm chứng từ.`);
            setPaidTarget(null);
            setTransferReference("");
            setEvidenceUrl("");
            setPaidNote("");

            await loadData();

            if (detail?.id === paidTarget.id) {
                await openDetail(paidTarget.id);
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <AdminLayout>
            <div className="settlements-page">
                <div className="settlements-heading">
                    <div>
                        <span className="settlements-eyebrow">TÀI CHÍNH PROVIDER</span>
                        <h1>
                            <FontAwesomeIcon icon={faFileInvoiceDollar} />
                            Đối soát & chi trả Provider
                        </h1>
                        <p>
                            Quản lý kỳ đối soát, phê duyệt và lưu chứng từ chuyển tiền cho nhà cung cấp.
                        </p>
                    </div>

                    <button
                        className="settlement-refresh"
                        onClick={loadData}
                        disabled={loading}
                    >
                        <FontAwesomeIcon icon={faRotate} />
                        Làm mới
                    </button>
                </div>

                {error && (
                    <div className="settlement-alert error">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="settlement-alert success">
                        {message}
                    </div>
                )}

                <div className="settlement-stats">
                    <div>
                        <span>Tổng kỳ đối soát</span>
                        <strong>{summary.count}</strong>
                    </div>
                    <div>
                        <span>Bản nháp</span>
                        <strong>{summary.draft}</strong>
                    </div>
                    <div>
                        <span>Chờ chuyển tiền</span>
                        <strong>{summary.approved}</strong>
                    </div>
                    <div>
                        <span>Đã chuyển tiền</span>
                        <strong>{summary.paid}</strong>
                    </div>
                    <div>
                        <span>Tổng đã chi</span>
                        <strong>{money(summary.paidTotal)}</strong>
                    </div>
                </div>

                <section className="settlement-panel">
                    <div className="settlement-panel-heading">
                        <div>
                            <h2>
                                <FontAwesomeIcon icon={faPlus} />
                                Tạo kỳ đối soát
                            </h2>
                            <p>
                                Chỉ lấy các đơn đã COMPLETED và chưa thuộc kỳ đối soát nào.
                            </p>
                        </div>
                    </div>

                    <div className="settlement-form-grid">
                        <label>
                            Nhà cung cấp
                            <select
                                value={partnerId}
                                onChange={e => {
                                    setPartnerId(e.target.value);
                                    setEligible([]);
                                }}
                            >
                                <option value="">-- Chọn Provider --</option>
                                {providers.map(provider => (
                                    <option key={provider.id} value={provider.id}>
                                        {provider.name} (#{provider.id}) - {provider.partnerStatus}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Từ ngày
                            <input
                                type="date"
                                value={fromDate}
                                onChange={e => {
                                    setFromDate(e.target.value);
                                    setEligible([]);
                                }}
                            />
                        </label>

                        <label>
                            Đến ngày
                            <input
                                type="date"
                                value={toDate}
                                onChange={e => {
                                    setToDate(e.target.value);
                                    setEligible([]);
                                }}
                            />
                        </label>

                        <div className="settlement-form-action">
                            <button type="button" onClick={loadEligible}>
                                Tải đơn đủ điều kiện
                            </button>
                        </div>
                    </div>

                    {eligible.length > 0 && (
                        <>
                            <div className="eligible-summary">
                                <strong>{eligible.length} đơn đủ điều kiện</strong>
                                <span>Tổng giá trị dịch vụ: {money(eligibleTotal)}</span>
                            </div>

                            <div className="settlement-table-wrap">
                                <table className="settlement-table">
                                    <thead>
                                    <tr>
                                        <th>Mã đơn</th>
                                        <th>Khách hàng</th>
                                        <th>Hoàn thành</th>
                                        <th>Giá trị dịch vụ</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {eligible.map(item => (
                                        <tr key={item.bookingId}>
                                            <td>{item.bookingCode}</td>
                                            <td>{item.customerName || "—"}</td>
                                            <td>{dateTime(item.completedAt)}</td>
                                            <td>{money(item.subtotal)}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>

                            <form className="settlement-create-form" onSubmit={createSettlement}>
                                <label>
                                    Phí sàn (VNĐ)
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={fee}
                                        onChange={e => setFee(e.target.value)}
                                        required
                                    />
                                </label>

                                <label>
                                    Khấu trừ hoàn tiền (VNĐ)
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={deduction}
                                        onChange={e => setDeduction(e.target.value)}
                                        required
                                    />
                                </label>

                                <label className="settlement-note-field">
                                    Ghi chú / căn cứ tính phí
                                    <textarea
                                        rows="2"
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                        placeholder="Ghi rõ căn cứ phí sàn và khoản khấu trừ đã xác minh"
                                    />
                                </label>

                                <div className="settlement-calculation">
                                    <span>
                                        Giá trị dịch vụ: <b>{money(eligibleTotal)}</b>
                                    </span>
                                    <span>
                                        Chi Provider dự kiến:{" "}
                                        <b>
                                            {money(
                                                eligibleTotal -
                                                Number(fee || 0) -
                                                Number(deduction || 0)
                                            )}
                                        </b>
                                    </span>
                                </div>

                                <button
                                    className="settlement-primary"
                                    type="submit"
                                    disabled={busy}
                                >
                                    {busy ? "Đang tạo..." : "Tạo kỳ đối soát bản nháp"}
                                </button>
                            </form>
                        </>
                    )}
                </section>

                <section className="settlement-panel">
                    <div className="settlement-panel-heading">
                        <div>
                            <h2>Danh sách kỳ đối soát</h2>
                            <p>
                                Lịch sử được lưu độc lập với giao dịch thanh toán của khách hàng.
                            </p>
                        </div>
                    </div>

                    <div className="settlement-table-wrap">
                        <table className="settlement-table">
                            <thead>
                            <tr>
                                <th>Mã kỳ</th>
                                <th>Provider</th>
                                <th>Kỳ đối soát</th>
                                <th>Số đơn</th>
                                <th>Giá trị dịch vụ</th>
                                <th>Phí sàn</th>
                                <th>Khấu trừ</th>
                                <th>Thực chi</th>
                                <th>Trạng thái</th>
                                <th>Thao tác</th>
                            </tr>
                            </thead>

                            <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="10" className="settlement-empty">
                                        Đang tải dữ liệu...
                                    </td>
                                </tr>
                            ) : settlements.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="settlement-empty">
                                        Chưa có kỳ đối soát nào.
                                    </td>
                                </tr>
                            ) : settlements.map(item => (
                                <tr key={item.id}>
                                    <td>#{item.id}</td>
                                    <td>{item.partnerName}</td>
                                    <td>{item.periodStart} → {item.periodEnd}</td>
                                    <td>{item.bookingCount}</td>
                                    <td>{money(item.grossAmount)}</td>
                                    <td>{money(item.platformFeeAmount)}</td>
                                    <td>{money(item.refundDeductionAmount)}</td>
                                    <td><b>{money(item.payoutAmount)}</b></td>
                                    <td>
                                            <span className={`settlement-status ${String(item.status).toLowerCase()}`}>
                                                {statusText(item.status)}
                                            </span>
                                    </td>
                                    <td>
                                        <div className="settlement-actions">
                                            <button
                                                title="Chi tiết"
                                                onClick={() => openDetail(item.id)}
                                            >
                                                <FontAwesomeIcon icon={faEye} />
                                            </button>

                                            {item.status === "DRAFT" && (
                                                <button
                                                    title="Duyệt"
                                                    onClick={() => approve(item.id)}
                                                    disabled={busy}
                                                >
                                                    <FontAwesomeIcon icon={faCheck} />
                                                </button>
                                            )}

                                            {item.status === "APPROVED" && (
                                                <button
                                                    title="Ghi nhận chuyển tiền"
                                                    onClick={() => setPaidTarget(item)}
                                                >
                                                    <FontAwesomeIcon icon={faMoneyBillTransfer} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {detail && (
                    <div
                        className="settlement-modal-backdrop"
                        onClick={() => setDetail(null)}
                    >
                        <div
                            className="settlement-modal"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="settlement-modal-head">
                                <h2>Chi tiết kỳ đối soát #{detail.id}</h2>
                                <button onClick={() => setDetail(null)}>
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>

                            <div className="settlement-detail-grid">
                                <div>
                                    <span>Provider</span>
                                    <b>{detail.partnerName}</b>
                                </div>
                                <div>
                                    <span>Trạng thái</span>
                                    <b>{statusText(detail.status)}</b>
                                </div>
                                <div>
                                    <span>Giá trị dịch vụ</span>
                                    <b>{money(detail.grossAmount)}</b>
                                </div>
                                <div>
                                    <span>Phí sàn</span>
                                    <b>{money(detail.platformFeeAmount)}</b>
                                </div>
                                <div>
                                    <span>Khấu trừ</span>
                                    <b>{money(detail.refundDeductionAmount)}</b>
                                </div>
                                <div>
                                    <span>Thực chi</span>
                                    <b>{money(detail.payoutAmount)}</b>
                                </div>
                                <div>
                                    <span>Mã giao dịch</span>
                                    <b>{detail.transferReference || "Chưa chuyển"}</b>
                                </div>
                                <div>
                                    <span>Thời điểm chuyển</span>
                                    <b>{dateTime(detail.paidAt)}</b>
                                </div>
                            </div>

                            {detail.transferEvidenceUrl && (
                                <p className="settlement-evidence">
                                    Chứng từ:{" "}
                                    <a
                                        href={detail.transferEvidenceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Mở chứng từ chuyển tiền
                                    </a>
                                </p>
                            )}

                            <h3>Đơn hàng trong kỳ</h3>

                            <div className="settlement-table-wrap">
                                <table className="settlement-table">
                                    <thead>
                                    <tr>
                                        <th>Mã đơn</th>
                                        <th>Khách hàng</th>
                                        <th>Hoàn thành</th>
                                        <th>Giá trị dịch vụ</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {(detail.items || []).map(item => (
                                        <tr key={item.bookingId}>
                                            <td>{item.bookingCode}</td>
                                            <td>{item.customerName || "—"}</td>
                                            <td>{dateTime(item.completedAt)}</td>
                                            <td>{money(item.serviceAmount)}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {paidTarget && (
                    <div
                        className="settlement-modal-backdrop"
                        onClick={() => setPaidTarget(null)}
                    >
                        <form
                            className="settlement-modal settlement-paid-form"
                            onSubmit={submitPaid}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="settlement-modal-head">
                                <h2>Xác nhận đã chuyển tiền #{paidTarget.id}</h2>
                                <button
                                    type="button"
                                    onClick={() => setPaidTarget(null)}
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>

                            <p>
                                Số tiền thực chi: <b>{money(paidTarget.payoutAmount)}</b>.
                                Chỉ xác nhận sau khi giao dịch chuyển tiền thực tế hoàn tất.
                            </p>

                            <label>
                                Mã giao dịch chuyển tiền
                                <input
                                    value={transferReference}
                                    onChange={e => setTransferReference(e.target.value)}
                                    maxLength="150"
                                    required
                                />
                            </label>

                            <label>
                                URL chứng từ (ảnh/PDF đã tải lên)
                                <input
                                    type="url"
                                    value={evidenceUrl}
                                    onChange={e => setEvidenceUrl(e.target.value)}
                                    placeholder="https://..."
                                    maxLength="1000"
                                    required
                                />
                            </label>

                            <label>
                                Ghi chú
                                <textarea
                                    rows="2"
                                    value={paidNote}
                                    onChange={e => setPaidNote(e.target.value)}
                                />
                            </label>

                            <button
                                className="settlement-primary"
                                type="submit"
                                disabled={busy}
                            >
                                {busy ? "Đang lưu..." : "Xác nhận đã chuyển tiền"}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

export default AdminProviderSettlements;
