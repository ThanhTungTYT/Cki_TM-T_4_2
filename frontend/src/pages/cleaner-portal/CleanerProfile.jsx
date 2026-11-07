import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CleanerProfile.css';

const EMPTY_PROFILE = {
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: ''
};

function CleanerProfile() {
    const navigate = useNavigate();

    const [profile, setProfile] = useState(EMPTY_PROFILE);
    const [originalProfile, setOriginalProfile] = useState(EMPTY_PROFILE);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        let active = true;

        const fetchProfile = async () => {
            const token =
                sessionStorage.getItem('accessToken') ||
                localStorage.getItem('accessToken');

            if (!token) {
                navigate('/login', { replace: true });
                return;
            }

            try {
                const response = await fetch(
                    'http://localhost:8080/api/users/me',
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if (response.status === 401) {
                    navigate('/login', { replace: true });
                    return;
                }

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        data.detail ||
                        'Không thể tải thông tin cá nhân.'
                    );
                }

                const result = {
                    fullName: data.fullName || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    dateOfBirth: data.dateOfBirth || '',
                    gender: data.gender || ''
                };

                if (active) {
                    setProfile(result);
                    setOriginalProfile(result);
                }
            } catch (err) {
                if (active) {
                    setError(err.message);
                }
            } finally {
                if (active) setLoading(false);
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

        setError('');
        setMessage('');

        if (!profile.fullName.trim()) {
            setError('Vui lòng nhập họ và tên.');
            return;
        }

        const phone = profile.phone.trim();

        if (phone && !/^[0-9+().\-\s]{8,15}$/.test(phone)) {
            setError('Số điện thoại không hợp lệ.');
            return;
        }

        if (
            profile.dateOfBirth &&
            new Date(profile.dateOfBirth) > new Date()
        ) {
            setError('Ngày sinh không được lớn hơn ngày hiện tại.');
            return;
        }

        const token =
            sessionStorage.getItem('accessToken') ||
            localStorage.getItem('accessToken');

        setSaving(true);

        try {
            const response = await fetch(
                'http://localhost:8080/api/users/me',
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        fullName: profile.fullName.trim(),
                        phone: phone,
                        dateOfBirth: profile.dateOfBirth || null,
                        gender: profile.gender || null
                    })
                }
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    data.detail ||
                    'Cập nhật thông tin thất bại.'
                );
            }

            const updated = {
                fullName: data.fullName || '',
                email: data.email || '',
                phone: data.phone || '',
                dateOfBirth: data.dateOfBirth || '',
                gender: data.gender || ''
            };

            setProfile(updated);
            setOriginalProfile(updated);

            const storage = sessionStorage.getItem('user')
                ? sessionStorage
                : localStorage;

            const savedUser = storage.getItem('user');

            if (savedUser) {
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
            }

            setMessage('Cập nhật thông tin thành công!');
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <section className="cp-page">
                <p className="cp-muted">Đang tải thông tin hồ sơ...</p>
            </section>
        );
    }

    return (
        <section className="cp-page">
            <header className="cp-heading">
                <div>
                    <span className="cp-eyebrow">TÀI KHOẢN NHÂN VIÊN</span>
                    <h1>Hồ sơ của tôi</h1>
                    <p>Quản lý thông tin cá nhân của bạn trên CleanMate.</p>
                </div>

                <div className="cp-avatar">
                    {(profile.fullName || 'N').trim().charAt(0).toUpperCase()}
                </div>
            </header>

            {error && (
                <div className="cp-alert error">{error}</div>
            )}

            {message && (
                <div className="cp-alert success">{message}</div>
            )}

            <form className="cp-card" onSubmit={handleSave}>
                <div className="cp-card-heading">
                    <div>
                        <h2>Thông tin cá nhân</h2>
                        <p>Cập nhật thông tin liên hệ và cá nhân.</p>
                    </div>
                </div>

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
                            required
                        />
                    </div>

                    <div className="cp-field">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            value={profile.email}
                            disabled
                        />
                        <small>Email tài khoản không thể thay đổi tại đây.</small>
                    </div>

                    <div className="cp-field">
                        <label htmlFor="phone">Số điện thoại</label>
                        <input
                            id="phone"
                            name="phone"
                            value={profile.phone}
                            onChange={handleChange}
                            placeholder="Nhập số điện thoại"
                            maxLength={15}
                        />
                    </div>

                    <div className="cp-field">
                        <label htmlFor="dateOfBirth">Ngày sinh</label>
                        <input
                            id="dateOfBirth"
                            name="dateOfBirth"
                            type="date"
                            value={profile.dateOfBirth}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="cp-field">
                        <label htmlFor="gender">Giới tính</label>
                        <select
                            id="gender"
                            name="gender"
                            value={profile.gender}
                            onChange={handleChange}
                        >
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
                        disabled={saving}
                    >
                        Hủy thay đổi
                    </button>

                    <button
                        type="submit"
                        className="cp-button primary"
                        disabled={saving}
                    >
                        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                </div>
            </form>
        </section>
    );
}

export default CleanerProfile;