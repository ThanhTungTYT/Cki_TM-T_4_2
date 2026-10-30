import { useEffect, useState } from 'react';
import { providerEmployeeApi } from '../../services/providerApi';

function ProviderEmployees() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [msg, setMsg] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({
        fullName: '', email: '', phone: '', password: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    function loadEmployees() {
        setLoading(true);
        providerEmployeeApi
            .list()
            .then((data) => setEmployees(Array.isArray(data) ? data : []))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }

    useEffect(() => { loadEmployees(); }, []);

    async function handleAdd() {
        setFormError('');
        if (!form.fullName.trim()) { setFormError('Họ tên không được để trống.'); return; }
        if (!form.email.trim())    { setFormError('Email không được để trống.'); return; }

        setSubmitting(true);
        try {
            await providerEmployeeApi.create(form);
            setMsg('✅ Thêm nhân viên thành công!');
            setShowAdd(false);
            setForm({ fullName: '', email: '', phone: '', password: '' });
            loadEmployees();
        } catch (e) {
            setFormError(e.message);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleStatusChange(id, status) {
        try {
            await providerEmployeeApi.updateStatus(id, status);
            setMsg('Đã cập nhật trạng thái nhân viên.');
            loadEmployees();
        } catch (e) {
            setError(e.message);
        }
    }

    function statusBadge(s) {
        const map = {
            ACTIVE:   { cls: 'pp-badge-active',   label: 'Hoạt động' },
            INACTIVE: { cls: 'pp-badge-inactive',  label: 'Ngừng HĐ' },
            ON_LEAVE: { cls: 'pp-badge-on_leave',  label: 'Nghỉ phép' },
        };
        const cfg = map[(s || '').toUpperCase()] || { cls: '', label: s };
        return <span className={`pp-badge ${cfg.cls}`}>{cfg.label}</span>;
    }

    return (
        <>
            <div className="pp-page-header">
                <h1 className="pp-page-title">Nhân viên ({employees.length})</h1>
                <button
                    className="pp-btn pp-btn-primary"
                    onClick={() => setShowAdd(true)}
                >
                    + Thêm nhân viên
                </button>
            </div>

            {msg   && <div className="pp-alert pp-alert-success">{msg}</div>}
            {error && <div className="pp-alert pp-alert-error">⚠️ {error}</div>}

            {loading && <div className="pp-loading">Đang tải danh sách nhân viên...</div>}

            {!loading && (
                <div className="pp-card" style={{ padding: 0 }}>
                    {employees.length === 0 ? (
                        <div className="pp-empty">
                            <p>Chưa có nhân viên nào. Thêm nhân viên để bắt đầu phân công.</p>
                        </div>
                    ) : (
                        <div className="pp-table-wrap">
                            <table className="pp-table">
                                <thead>
                                    <tr>
                                        <th>Mã NV</th>
                                        <th>Họ tên</th>
                                        <th>Email</th>
                                        <th>SĐT</th>
                                        <th>Đánh giá</th>
                                        <th>Đã hoàn thành</th>
                                        <th>Trạng thái</th>
                                        <th>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.map((emp) => (
                                        <tr key={emp.id}>
                                            <td><strong>{emp.employeeCode}</strong></td>
                                            <td>{emp.fullName}</td>
                                            <td>{emp.email}</td>
                                            <td>{emp.phone || '—'}</td>
                                            <td>
                                                {emp.ratingAverage != null
                                                    ? `⭐ ${Number(emp.ratingAverage).toFixed(1)}`
                                                    : '—'}
                                            </td>
                                            <td>{emp.totalCompletedJobs ?? 0}</td>
                                            <td>{statusBadge(emp.status)}</td>
                                            <td>
                                                <select
                                                    className="pp-select"
                                                    style={{ width: 130, fontSize: 12, padding: '4px 8px' }}
                                                    value={emp.status}
                                                    onChange={(e) =>
                                                        handleStatusChange(emp.id, e.target.value)
                                                    }
                                                >
                                                    <option value="ACTIVE">Hoạt động</option>
                                                    <option value="INACTIVE">Ngừng HĐ</option>
                                                    <option value="ON_LEAVE">Nghỉ phép</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Add employee modal */}
            {showAdd && (
                <div className="pp-modal-overlay">
                    <div className="pp-modal">
                        <div className="pp-modal-header">
                            <span className="pp-modal-title">Thêm nhân viên mới</span>
                            <button
                                className="pp-modal-close"
                                onClick={() => { setShowAdd(false); setFormError(''); }}
                            >×</button>
                        </div>
                        <div className="pp-modal-body">
                            {formError && <div className="pp-alert pp-alert-error">{formError}</div>}
                            <div className="pp-form-group">
                                <label className="pp-label">Họ và tên *</label>
                                <input
                                    className="pp-input"
                                    placeholder="Nguyễn Văn A"
                                    value={form.fullName}
                                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                                />
                            </div>
                            <div className="pp-form-group">
                                <label className="pp-label">Email *</label>
                                <input
                                    className="pp-input"
                                    type="email"
                                    placeholder="nhanvien@email.com"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                />
                            </div>
                            <div className="pp-form-group">
                                <label className="pp-label">Số điện thoại</label>
                                <input
                                    className="pp-input"
                                    placeholder="0901234567"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                />
                            </div>
                            <div className="pp-form-group">
                                <label className="pp-label">Mật khẩu</label>
                                <input
                                    className="pp-input"
                                    type="password"
                                    placeholder="Để trống sẽ dùng mật khẩu mặc định"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="pp-modal-footer">
                            <button
                                className="pp-btn pp-btn-ghost"
                                onClick={() => { setShowAdd(false); setFormError(''); }}
                            >
                                Hủy
                            </button>
                            <button
                                className="pp-btn pp-btn-primary"
                                onClick={handleAdd}
                                disabled={submitting}
                            >
                                {submitting ? 'Đang lưu...' : 'Thêm nhân viên'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default ProviderEmployees;
