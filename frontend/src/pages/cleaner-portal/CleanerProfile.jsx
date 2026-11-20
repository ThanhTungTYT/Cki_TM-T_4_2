import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { expireStoredAuth } from '../../utils/authSession';
import './CleanerProfile.css';

const BASE_URL = 'http://localhost:8080/api';

const EMPTY_PROFILE = {
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: ''
};

function getToken() {
    return (
        sessionStorage.getItem('accessToken') ||
        localStorage.getItem('accessToken')
    );
}

function getTodayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDate(value) {
    if (!value) return 'Chưa cập nhật';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

async function readResponse(response) {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        if (response.status === 401) {
            expireStoredAuth('expired');
        }

        throw new Error(
            data.message ||
            data.detail ||
            data.error ||
            'Có lỗi xảy ra khi xử lý yêu cầu.'
        );
    }

    return data;
}

function normalizeProfile(data) {
    return {
        fullName: data?.fullName || '',
        email: data?.email || '',
        phone: data?.phone || '',
        dateOfBirth: data?.dateOfBirth || '',
        gender: data?.gender || ''
    };
}

function CleanerProfile() {
    const navigate = useNavigate();

    const [profile, setProfile] = useState(EMPTY_PROFILE);
    const [originalProfile, setOriginalProfile] = useState(EMPTY_PROFILE);
    const [summary, setSummary] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const [pwdForm, setPwdForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [showPwd, setShowPwd] = useState({
        current: false,
        next: false,
        confirm: false
    });
    const [pwdSaving, setPwdSaving] = useState(false);
    const [pwdError, setPwdError] = useState('');
    const [pwdMsg, setPwdMsg] = useState('');

    const isDirty = useMemo(
        () =>
            Object.keys(EMPTY_PROFILE).some(
                (key) => profile[key] !== originalProfile[key]
            ),
        [profile, originalProfile]
    );

    const isPwdFilled = Boolean(
        pwdForm.currentPassword || pwdForm.newPassword || pwdForm.confirmPassword
    );

    useEffect(() => {
        let active = true;

        const fetchProfile = async () => {
            const token = getToken();

            if (!token) {
                navigate('/login', { replace: true });
                return;
            }

            try {
                const headers = { Authorization: `Bearer ${token}` };
                const [profileRes, summaryRes] = await Promise.all([
                    fetch(`${BASE_URL}/users/me`, { method: 'GET', headers }),
                    fetch(`${BASE_URL}/users/me/cleaner-summary`, { method: 'GET', headers }).catch(() => null)
                ]);

                const data = await readResponse(profileRes);
                const summaryData = summaryRes && summaryRes.ok
                    ? await summaryRes.json().catch(() => null)
                    : null;

                if (!active) return;

                const result = normalizeProfile(data);
                setProfile(result);
                setOriginalProfile(result);
                setSummary(summaryData);
            } catch (err) {
                if (!active) return;

                setError(err.message);
                if (err.message && !getToken()) {
                    navigate('/login', { replace: true });
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        fetchProfile();

        return () => {
            active = false;
        };
    }, [navigate]);

    const handleChange = (event) => {
        const { name, value } = event.target;

        setProfile((previous) => ({
            ...previous,
            [name]: value
        }));

        setMessage('');
        setError('');
    };

    const handleCancel = () => {
        setProfile({ ...originalProfile });
        setError('');
        setMessage('');
    };

    const handleSave = async (event) => {
        event.preventDefault();
        if (saving) return;

        setError('');
        setMessage('');

        const fullName = profile.fullName.trim();
        const phone = profile.phone.trim();

        if (!fullName) {
            setError('Vui lòng nhập họ và tên.');
            return;
        }

        if (fullName.length > 100) {
            setError('Họ và tên không được quá 100 ký tự.');
            return;
        }

        if (phone && !/^0[0-9]{9}$/.test(phone)) {
            setError('Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.');
            return;
        }

        if (profile.dateOfBirth && profile.dateOfBirth > getTodayString()) {
            setError('Ngày sinh không được lớn hơn ngày hiện tại.');
            return;
        }

        if (profile.gender && !['MALE', 'FEMALE', 'OTHER'].includes(profile.gender)) {
            setError('Giới tính không hợp lệ.');
            return;
        }

        const token = getToken();
        if (!token) {
            navigate('/login', { replace: true });
            return;
        }

        setSaving(true);

        try {
            const response = await fetch(`${BASE_URL}/users/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    fullName,
                    phone: phone || null,
                    dateOfBirth: profile.dateOfBirth || null,
                    gender: profile.gender || null
                })
            });

            const data = await readResponse(response);
            const updated = normalizeProfile(data);

            setProfile(updated);
            setOriginalProfile(updated);

            [sessionStorage, localStorage].forEach((storage) => {
                const savedUser = storage.getItem('user');
                if (!savedUser) return;
                try {
                    const currentUser = JSON.parse(savedUser);
                    storage.setItem(
                        'user',
                        JSON.stringify({
                            ...currentUser,
                            fullName: updated.fullName
                        })
                    );
                } catch {
                    // ignore storage error
                }
            });

            window.dispatchEvent(
                new CustomEvent('cleanmate:user-updated', {
                    detail: { fullName: updated.fullName }
                })
            );

            setMessage('Cập nhật thông tin cá nhân thành công!');
        } catch (err) {
            setError(err.message || 'Cập nhật thông tin thất bại.');
            if (!getToken()) {
                navigate('/login', { replace: true });
            }
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordSubmit = async (event) => {
        event.preventDefault();
        if (pwdSaving) return;

        setPwdError('');
        setPwdMsg('');

        if (!pwdForm.currentPassword) {
            setPwdError('Vui lòng nhập mật khẩu hiện tại.');
            return;
        }
        if (pwdForm.newPassword.length < 6) {
            setPwdError('Mật khẩu mới phải có ít nhất 6 ký tự.');
            return;
        }
        if (pwdForm.newPassword !== pwdForm.confirmPassword) {
            setPwdError('Mật khẩu xác nhận không khớp.');
            return;
        }

        setPwdSaving(true);
        try {
            const response = await fetch(`${BASE_URL}/users/me/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    currentPassword: pwdForm.currentPassword,
                    newPassword: pwdForm.newPassword
                })
            });
            await readResponse(response);
            setPwdMsg('Đổi mật khẩu thành công!');
            setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            setPwdError(err.message || 'Không thể đổi mật khẩu.');
        } finally {
            setPwdSaving(false);
        }
    };

    if (loading) {
        return (
            <section className="cp-page">
                <p className="cp-muted">Đang tải thông tin hồ sơ...</p>
            </section>
        );
    }

    const employeeActive = String(summary?.employeeStatus || summary?.accountStatus || 'ACTIVE').toUpperCase() === 'ACTIVE';

    return (
        <section className="cp-page">
            <header className="cp-heading">
                <div>
                    <span className="cp-eyebrow">TÀI KHOẢN NHÂN VIÊN VỆ SINH</span>
                    <h1>Hồ sơ của tôi</h1>
                    <p>Quản lý thông tin công việc, hồ sơ cá nhân và bảo mật tài khoản CleanMate.</p>
                </div>

                <div className="cp-avatar">
                    {(profile.fullName || 'N').trim().charAt(0).toUpperCase()}
                </div>
            </header>

            {summary && (
                <section className="cp-card">
                    <div className="cp-card-heading">
                        <div>
                            <h2>Thông tin nhân viên &amp; Đơn vị chủ quản</h2>
                            <p>Dữ liệu hồ sơ nhân sự do Doanh nghiệp đối tác quản lý (chỉ xem).</p>
                        </div>

                        <span className={`cp-badge ${employeeActive ? 'active' : 'inactive'}`}>
                            {employeeActive ? '● Đang hoạt động' : '● Tạm ngừng'}
                        </span>
                    </div>

                    <div className="cp-summary-grid">
                        <div className="cp-summary-item">
                            <span>Mã nhân viên</span>
                            <strong>{summary.employeeCode || 'Chưa cấp mã'}</strong>
                        </div>

                        <div className="cp-summary-item">
                            <span>Đánh giá trung bình</span>
                            <strong className="cp-rating">
                                {summary.ratingAverage != null
                                    ? `★ ${Number(summary.ratingAverage).toFixed(1)} / 5.0`
                                    : 'Chưa có đánh giá'}
                            </strong>
                        </div>

                        <div className="cp-summary-item">
                            <span>Đơn đã hoàn thành</span>
                            <strong>{summary.totalCompletedJobs ?? 0} đơn</strong>
                        </div>

                        <div className="cp-summary-item wide">
                            <span>Đơn vị đối tác chủ quản</span>
                            <strong>{summary.partnerName || 'Chưa liên kết đối tác'}</strong>
                        </div>

                        <div className="cp-summary-item">
                            <span>Ngày tham gia</span>
                            <strong>{formatDate(summary.joinedAt)}</strong>
                        </div>

                        {(summary.partnerPhone || summary.partnerAddress) && (
                            <>
                                <div className="cp-summary-item">
                                    <span>Hotline đơn vị</span>
                                    <strong>{summary.partnerPhone || 'Chưa cập nhật'}</strong>
                                </div>
                                <div className="cp-summary-item wide">
                                    <span>Địa chỉ trụ sở đơn vị</span>
                                    <strong>{summary.partnerAddress || 'Chưa cập nhật'}</strong>
                                </div>
                            </>
                        )}
                    </div>
                </section>
            )}

            <form className="cp-card" onSubmit={handleSave}>
                <div className="cp-card-heading">
                    <div>
                        <h2>Thông tin cá nhân</h2>
                        <p>Cập nhật họ tên và thông tin liên hệ hiển thị trong hệ thống.</p>
                    </div>
                </div>

                {error && <div className="cp-alert error" role="alert">{error}</div>}
                {message && <div className="cp-alert success" role="status">{message}</div>}

                <div className="cp-form-grid">
                    <div className="cp-field">
                        <label htmlFor="fullName">Họ và tên *</label>
                        <input
                            id="fullName"
                            name="fullName"
                            value={profile.fullName}
                            onChange={handleChange}
                            placeholder="Nhập họ và tên"
                            maxLength={100}
                            autoComplete="name"
                            required
                        />
                    </div>

                    <div className="cp-field">
                        <label htmlFor="email">Email đăng nhập</label>
                        <input id="email" type="email" value={profile.email} disabled />
                        <small>Email tài khoản không thể thay đổi tại đây.</small>
                    </div>

                    <div className="cp-field">
                        <label htmlFor="phone">Số điện thoại</label>
                        <input
                            id="phone"
                            name="phone"
                            type="tel"
                            value={profile.phone}
                            onChange={handleChange}
                            placeholder="Ví dụ: 0912345678"
                            maxLength={10}
                            autoComplete="tel"
                        />
                        <small>Nhập 10 chữ số, bắt đầu bằng số 0.</small>
                    </div>

                    <div className="cp-field">
                        <label htmlFor="dateOfBirth">Ngày sinh</label>
                        <input
                            id="dateOfBirth"
                            name="dateOfBirth"
                            type="date"
                            value={profile.dateOfBirth}
                            max={getTodayString()}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="cp-field">
                        <label htmlFor="gender">Giới tính</label>
                        <select id="gender" name="gender" value={profile.gender} onChange={handleChange}>
                            <option value="">Chưa cập nhật</option>
                            <option value="MALE">Nam</option>
                            <option value="FEMALE">Nữ</option>
                            <option value="OTHER">Khác</option>
                        </select>
                    </div>
                </div>

                <div className="cp-actions">
                    <button
                        type="button"
                        className="cp-button secondary"
                        onClick={handleCancel}
                        disabled={saving || !isDirty}
                    >
                        Hủy thay đổi
                    </button>

                    <button
                        type="submit"
                        className="cp-button primary"
                        disabled={saving || !isDirty}
                    >
                        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                </div>
            </form>

            <form className="cp-card" onSubmit={handlePasswordSubmit}>
                <div className="cp-card-heading">
                    <div>
                        <h2>Bảo mật &amp; Đổi mật khẩu</h2>
                        <p>Nên đổi mật khẩu định kỳ hoặc ngay sau lần đầu đăng nhập bằng mật khẩu tạm.</p>
                    </div>
                </div>

                {pwdError && <div className="cp-alert error" role="alert">{pwdError}</div>}
                {pwdMsg && <div className="cp-alert success" role="status">{pwdMsg}</div>}

                <div className="cp-form-grid">
                    <div className="cp-field full">
                        <label htmlFor="clCurrentPwd">Mật khẩu hiện tại *</label>
                        <div className="cp-password-wrap">
                            <input
                                id="clCurrentPwd"
                                type={showPwd.current ? 'text' : 'password'}
                                value={pwdForm.currentPassword}
                                onChange={(e) => {
                                    setPwdForm({ ...pwdForm, currentPassword: e.target.value });
                                    setPwdError('');
                                    setPwdMsg('');
                                }}
                                placeholder="Nhập mật khẩu đang sử dụng"
                                autoComplete="current-password"
                                required
                            />
                            <button
                                type="button"
                                className="cp-eye-btn"
                                onClick={() => setShowPwd((p) => ({ ...p, current: !p.current }))}
                            >
                                {showPwd.current ? 'Ẩn' : 'Hiện'}
                            </button>
                        </div>
                    </div>

                    <div className="cp-field">
                        <label htmlFor="clNewPwd">Mật khẩu mới (tối thiểu 6 ký tự) *</label>
                        <div className="cp-password-wrap">
                            <input
                                id="clNewPwd"
                                type={showPwd.next ? 'text' : 'password'}
                                value={pwdForm.newPassword}
                                onChange={(e) => {
                                    setPwdForm({ ...pwdForm, newPassword: e.target.value });
                                    setPwdError('');
                                    setPwdMsg('');
                                }}
                                placeholder="Nhập mật khẩu mới"
                                autoComplete="new-password"
                                required
                            />
                            <button
                                type="button"
                                className="cp-eye-btn"
                                onClick={() => setShowPwd((p) => ({ ...p, next: !p.next }))}
                            >
                                {showPwd.next ? 'Ẩn' : 'Hiện'}
                            </button>
                        </div>
                    </div>

                    <div className="cp-field">
                        <label htmlFor="clConfirmPwd">Xác nhận mật khẩu mới *</label>
                        <div className="cp-password-wrap">
                            <input
                                id="clConfirmPwd"
                                type={showPwd.confirm ? 'text' : 'password'}
                                value={pwdForm.confirmPassword}
                                onChange={(e) => {
                                    setPwdForm({ ...pwdForm, confirmPassword: e.target.value });
                                    setPwdError('');
                                    setPwdMsg('');
                                }}
                                placeholder="Nhập lại mật khẩu mới"
                                autoComplete="new-password"
                                required
                            />
                            <button
                                type="button"
                                className="cp-eye-btn"
                                onClick={() => setShowPwd((p) => ({ ...p, confirm: !p.confirm }))}
                            >
                                {showPwd.confirm ? 'Ẩn' : 'Hiện'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="cp-actions">
                    <button
                        type="button"
                        className="cp-button secondary"
                        disabled={pwdSaving || !isPwdFilled}
                        onClick={() => {
                            setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                            setPwdError('');
                            setPwdMsg('');
                        }}
                    >
                        Xóa nhập
                    </button>
                    <button
                        type="submit"
                        className="cp-button primary"
                        disabled={pwdSaving || !isPwdFilled}
                    >
                        {pwdSaving ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                    </button>
                </div>
            </form>
        </section>
    );
}

export default CleanerProfile;
