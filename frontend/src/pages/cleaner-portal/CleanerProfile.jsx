
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

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const isDirty = useMemo(
        () =>
            Object.keys(EMPTY_PROFILE).some(
                (key) => profile[key] !== originalProfile[key]
            ),
        [profile, originalProfile]
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
                const response = await fetch(
                    `${BASE_URL}/users/me`,
                    {
                        method: 'GET',
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                const data = await readResponse(response);

                if (!active) return;

                const result = normalizeProfile(data);

                setProfile(result);
                setOriginalProfile(result);
            } catch (err) {
                if (!active) return;

                setError(err.message);

                if (
                    err.message &&
                    !getToken()
                ) {
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
            setError(
                'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0.'
            );
            return;
        }

        if (
            profile.dateOfBirth &&
            profile.dateOfBirth > getTodayString()
        ) {
            setError('Ngày sinh không được lớn hơn ngày hiện tại.');
            return;
        }

        if (
            profile.gender &&
            !['MALE', 'FEMALE', 'OTHER'].includes(profile.gender)
        ) {
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
            const response = await fetch(
                `${BASE_URL}/users/me`,
                {
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
                }
            );

            const data = await readResponse(response);

            const updated = normalizeProfile(data);

            setProfile(updated);
            setOriginalProfile(updated);

            // Đồng bộ tên hiển thị với thông tin tài khoản đang đăng nhập.
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
                    // Không ảnh hưởng đến kết quả cập nhật hồ sơ.
                }
            });

            setMessage('Cập nhật thông tin thành công!');
        } catch (err) {
            setError(err.message || 'Cập nhật thông tin thất bại.');

            if (!getToken()) {
                navigate('/login', { replace: true });
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <section className="cp-page">
                <p className="cp-muted">
                    Đang tải thông tin hồ sơ...
                </p>
            </section>
        );
    }

    return (
        <section className="cp-page">
            <header className="cp-heading">
                <div>
                    <span className="cp-eyebrow">
                        TÀI KHOẢN NHÂN VIÊN
                    </span>

                    <h1>Hồ sơ của tôi</h1>

                    <p>
                        Quản lý thông tin cá nhân của bạn trên CleanMate.
                    </p>
                </div>

                <div className="cp-avatar">
                    {(profile.fullName || 'N')
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                </div>
            </header>

            {error && (
                <div
                    className="cp-alert error"
                    role="alert"
                >
                    {error}
                </div>
            )}

            {message && (
                <div
                    className="cp-alert success"
                    role="status"
                >
                    {message}
                </div>
            )}

            <form
                className="cp-card"
                onSubmit={handleSave}
            >
                <div className="cp-card-heading">
                    <div>
                        <h2>Thông tin cá nhân</h2>

                        <p>
                            Cập nhật thông tin liên hệ và cá nhân.
                        </p>
                    </div>
                </div>

                <div className="cp-form-grid">
                    <div className="cp-field">
                        <label htmlFor="fullName">
                            Họ và tên *
                        </label>

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
                        <label htmlFor="email">
                            Email
                        </label>

                        <input
                            id="email"
                            type="email"
                            value={profile.email}
                            disabled
                        />

                        <small>
                            Email tài khoản không thể thay đổi tại đây.
                        </small>
                    </div>

                    <div className="cp-field">
                        <label htmlFor="phone">
                            Số điện thoại
                        </label>

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

                        <small>
                            Nhập 10 chữ số, bắt đầu bằng số 0.
                        </small>
                    </div>

                    <div className="cp-field">
                        <label htmlFor="dateOfBirth">
                            Ngày sinh
                        </label>

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
                        <label htmlFor="gender">
                            Giới tính
                        </label>

                        <select
                            id="gender"
                            name="gender"
                            value={profile.gender}
                            onChange={handleChange}
                        >
                            <option value="">
                                Chưa cập nhật
                            </option>

                            <option value="MALE">
                                Nam
                            </option>

                            <option value="FEMALE">
                                Nữ
                            </option>

                            <option value="OTHER">
                                Khác
                            </option>
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
                        {saving
                            ? 'Đang lưu...'
                            : 'Lưu thay đổi'}
                    </button>
                </div>
            </form>
        </section>
    );
}

export default CleanerProfile;
