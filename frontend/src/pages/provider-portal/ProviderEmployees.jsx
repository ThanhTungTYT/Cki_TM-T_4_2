import { useEffect, useState } from 'react';
import { providerEmployeeApi } from '../../services/providerApi';

function ProviderEmployees() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [msg, setMsg] = useState('');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    // Add employee state
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({
        fullName: '', email: '', phone: '', password: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    // Edit employee state
    const [editEmp, setEditEmp] = useState(null);
    const [editForm, setEditForm] = useState({ fullName: '', phone: '' });
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [editError, setEditError] = useState('');

    // Reset password state
    const [resetEmp, setResetEmp] = useState(null);
    const [resetPasswordVal, setResetPasswordVal] = useState('');
    const [resetResult, setResetResult] = useState(null);
    const [resetSubmitting, setResetSubmitting] = useState(false);
    const [resetError, setResetError] = useState('');

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

    function openEdit(emp) {
        setError('');
        setMsg('');
        setEditEmp(emp);
        setEditForm({ fullName: emp.fullName || '', phone: emp.phone || '' });
        setEditError('');
    }

    async function handleEdit() {
        if (!editForm.fullName.trim()) {
            setEditError('Họ tên không được để trống.');
            return;
        }
        setEditSubmitting(true);
        setEditError('');
        try {
            await providerEmployeeApi.update(editEmp.id, editForm);
            setMsg(`✅ Đã cập nhật thông tin nhân viên ${editEmp.employeeCode} thành công!`);
            setEditEmp(null);
            loadEmployees();
        } catch (e) {
            setEditError(e.message);
        } finally {
            setEditSubmitting(false);
        }
    }

    function openReset(emp) {
        setError('');
        setMsg('');
        setResetEmp(emp);
        setResetPasswordVal('');
        setResetResult(null);
        setResetError('');
    }

    async function handleResetPassword() {
        setResetSubmitting(true);
        setResetError('');
        try {
            const res = await providerEmployeeApi.resetPassword(resetEmp.id, resetPasswordVal);
            setResetResult(res);
            setMsg(`✅ Đã đặt lại mật khẩu cho nhân viên ${resetEmp.employeeCode}!`);
        } catch (e) {
            setResetError(e.message);
        } finally {
            setResetSubmitting(false);
        }
    }

    async function handleStatusChange(emp, newStatus) {
        if (emp.status === newStatus) return;
        setError('');
        setMsg('');

        if (newStatus === 'INACTIVE') {
            const confirmMsg = `Bạn có chắc muốn ngừng hoạt động của nhân viên ${emp.fullName} (${emp.employeeCode})?`;
            if (!window.confirm(confirmMsg)) return;
        }

        try {
            await providerEmployeeApi.updateStatus(emp.id, newStatus);
            setMsg(`✅ Đã cập nhật trạng thái nhân viên ${emp.employeeCode} sang "${newStatus}".`);
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

    const filtered = employees.filter((emp) => {
        const matchStatus = !statusFilter || (emp.status || '').toUpperCase() === statusFilter;
        const s = search.toLowerCase().trim();
        const matchSearch = !s ||
            (emp.fullName || '').toLowerCase().includes(s) ||
            (emp.employeeCode || '').toLowerCase().includes(s) ||
            (emp.email || '').toLowerCase().includes(s) ||
            (emp.phone || '').toLowerCase().includes(s);
        return matchStatus && matchSearch;
    });

    return (
        <>
            <div className="pp-page-header">
                <h1 className="pp-page-title">Quản lý nhân viên ({employees.length})</h1>
                <button
                    className="pp-btn pp-btn-primary"
                    onClick={() => { setError(''); setMsg(''); setShowAdd(true); }}
                >
                    + Thêm nhân viên
                </button>
            </div>

            {/* Filters */}
            <div className="pp-card" style={{ marginBottom: 16, padding: '14px 20px' }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        className="pp-input"
                        style={{ maxWidth: 260 }}
                        placeholder="Tìm mã NV, họ tên, SĐT, email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <select
                        className="pp-select"
                        style={{ maxWidth: 180 }}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">Tất cả trạng thái</option>
                        <option value="ACTIVE">Hoạt động</option>
                        <option value="INACTIVE">Ngừng hoạt động</option>
                        <option value="ON_LEAVE">Nghỉ phép</option>
                    </select>
                    {filtered.length !== employees.length && (
                        <span style={{ fontSize: 13, color: 'var(--pp-muted)' }}>
                            Hiển thị {filtered.length}/{employees.length} nhân viên
                        </span>
                    )}
                </div>
            </div>

            {msg   && <div className="pp-alert pp-alert-success">{msg}</div>}
            {error && <div className="pp-alert pp-alert-error">⚠️ {error}</div>}

            {loading && <div className="pp-loading">Đang tải danh sách nhân viên...</div>}

            {!loading && (
                <div className="pp-card" style={{ padding: 0 }}>
                    {filtered.length === 0 ? (
                        <div className="pp-empty">
                            <p>
                                {employees.length === 0
                                    ? 'Chưa có nhân viên nào. Thêm nhân viên để bắt đầu phân công.'
                                    : 'Không tìm thấy nhân viên phù hợp với bộ lọc.'}
                            </p>
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
                                        <th>Đã xong</th>
                                        <th>Trạng thái</th>
                                        <th>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((emp) => (
                                        <tr key={emp.id}>
                                            <td><strong>{emp.employeeCode}</strong></td>
                                            <td>
                                                <strong>{emp.fullName}</strong>
                                            </td>
                                            <td>{emp.email}</td>
                                            <td>{emp.phone || '—'}</td>
                                            <td>
                                                {emp.ratingAverage != null
                                                    ? `⭐ ${Number(emp.ratingAverage).toFixed(1)}`
                                                    : '—'}
                                            </td>
                                            <td><strong>{emp.totalCompletedJobs ?? 0}</strong> đơn</td>
                                            <td>{statusBadge(emp.status)}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <select
                                                        className="pp-select"
                                                        style={{ width: 115, fontSize: 12, padding: '4px 6px' }}
                                                        value={emp.status}
                                                        onChange={(e) =>
                                                            handleStatusChange(emp, e.target.value)
                                                        }
                                                        title="Đổi trạng thái nhân sự"
                                                    >
                                                        <option value="ACTIVE">Hoạt động</option>
                                                        <option value="INACTIVE">Ngừng HĐ</option>
                                                        <option value="ON_LEAVE">Nghỉ phép</option>
                                                    </select>
                                                    <button
                                                        className="pp-btn pp-btn-outline pp-btn-sm"
                                                        style={{ padding: '4px 8px', fontSize: 12 }}
                                                        onClick={() => openEdit(emp)}
                                                        title="Chỉnh sửa thông tin"
                                                    >
                                                        ✏️ Sửa
                                                    </button>
                                                    <button
                                                        className="pp-btn pp-btn-ghost pp-btn-sm"
                                                        style={{ padding: '4px 8px', fontSize: 12 }}
                                                        onClick={() => openReset(emp)}
                                                        title="Đặt lại mật khẩu"
                                                    >
                                                        🔑 Đổi MK
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
                                <label className="pp-label">Email tài khoản *</label>
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
                                <label className="pp-label">Mật khẩu đăng nhập</label>
                                <input
                                    className="pp-input"
                                    type="password"
                                    placeholder="Để trống sẽ dùng mật khẩu mặc định (Cleanmate@2024)"
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

            {/* Edit employee modal */}
            {editEmp && (
                <div className="pp-modal-overlay">
                    <div className="pp-modal">
                        <div className="pp-modal-header">
                            <span className="pp-modal-title">Cập nhật thông tin: {editEmp.employeeCode}</span>
                            <button className="pp-modal-close" onClick={() => setEditEmp(null)}>×</button>
                        </div>
                        <div className="pp-modal-body">
                            {editError && <div className="pp-alert pp-alert-error">{editError}</div>}
                            <div className="pp-form-group">
                                <label className="pp-label">Họ và tên *</label>
                                <input
                                    className="pp-input"
                                    value={editForm.fullName}
                                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                                />
                            </div>
                            <div className="pp-form-group">
                                <label className="pp-label">Số điện thoại</label>
                                <input
                                    className="pp-input"
                                    placeholder="0901234567"
                                    value={editForm.phone}
                                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                />
                            </div>
                            <div className="pp-form-group">
                                <label className="pp-label">Email tài khoản (không thay đổi)</label>
                                <input
                                    className="pp-input"
                                    disabled
                                    value={editEmp.email}
                                    style={{ background: '#f8fafc', color: '#64748b' }}
                                />
                            </div>
                        </div>
                        <div className="pp-modal-footer">
                            <button className="pp-btn pp-btn-ghost" onClick={() => setEditEmp(null)}>Hủy</button>
                            <button
                                className="pp-btn pp-btn-primary"
                                onClick={handleEdit}
                                disabled={editSubmitting}
                            >
                                {editSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset password modal */}
            {resetEmp && (
                <div className="pp-modal-overlay">
                    <div className="pp-modal" style={{ maxWidth: 460 }}>
                        <div className="pp-modal-header">
                            <span className="pp-modal-title">Đặt lại mật khẩu: {resetEmp.fullName}</span>
                            <button className="pp-modal-close" onClick={() => setResetEmp(null)}>×</button>
                        </div>
                        <div className="pp-modal-body">
                            {resetError && <div className="pp-alert pp-alert-error">{resetError}</div>}

                            {resetResult ? (
                                <div style={{
                                    background: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: 8,
                                    padding: '16px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
                                    <strong style={{ color: '#166534', fontSize: 15, display: 'block', marginBottom: 6 }}>
                                        Mật khẩu mới đã được cập nhật thành công!
                                    </strong>
                                    <p style={{ fontSize: 13, color: '#475569', margin: '4px 0' }}>
                                        Mật khẩu mới cho tài khoản <strong>{resetEmp.email}</strong>:
                                    </p>
                                    <div style={{
                                        background: '#fff',
                                        border: '2px dashed #16a34a',
                                        padding: '10px 14px',
                                        borderRadius: 6,
                                        fontSize: 18,
                                        fontWeight: 800,
                                        color: '#15803d',
                                        letterSpacing: '1px',
                                        margin: '10px 0',
                                        userSelect: 'all'
                                    }}>
                                        {resetResult.temporaryPassword}
                                    </div>
                                    <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                                        Vui lòng sao chép và gửi mật khẩu này cho nhân viên để họ đăng nhập.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <p style={{ fontSize: 13, color: 'var(--pp-muted)', marginTop: 0 }}>
                                        Đặt lại mật khẩu cho tài khoản nhân viên <strong>{resetEmp.email}</strong> ({resetEmp.employeeCode}).
                                    </p>
                                    <div className="pp-form-group">
                                        <label className="pp-label">Mật khẩu mới (tùy chọn)</label>
                                        <input
                                            className="pp-input"
                                            placeholder="Để trống để hệ thống tự tạo mật khẩu ngẫu nhiên"
                                            value={resetPasswordVal}
                                            onChange={(e) => setResetPasswordVal(e.target.value)}
                                        />
                                        <span style={{ fontSize: 11.5, color: 'var(--pp-muted)', display: 'block', marginTop: 4 }}>
                                            Nếu nhập thủ công, tối thiểu 6 ký tự.
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="pp-modal-footer">
                            <button className="pp-btn pp-btn-ghost" onClick={() => setResetEmp(null)}>
                                {resetResult ? 'Đóng' : 'Hủy'}
                            </button>
                            {!resetResult && (
                                <button
                                    className="pp-btn pp-btn-primary"
                                    onClick={handleResetPassword}
                                    disabled={resetSubmitting}
                                >
                                    {resetSubmitting ? 'Đang xử lý...' : 'Xác nhận đổi mật khẩu'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default ProviderEmployees;
