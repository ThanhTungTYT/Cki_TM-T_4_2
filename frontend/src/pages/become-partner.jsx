import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import LocationPickerMap from '../components/map/LocationPickerMap';
import { DEFAULT_CENTER } from '../utils/geo';
import './become-partner.css';

const ENTITY_TYPES = [
    { value: 'SINGLE_MEMBER_LLC', label: 'Công ty TNHH Một thành viên (LLC)' },
    { value: 'MULTI_MEMBER_LLC', label: 'Công ty TNHH Hai thành viên trở lên' },
    { value: 'JOINT_STOCK_COMPANY', label: 'Công ty Cổ phần (JSC)' },
    { value: 'HOUSEHOLD_BUSINESS', label: 'Hộ kinh doanh cá thể' },
    { value: 'PRIVATE_ENTERPRISE', label: 'Doanh nghiệp tư nhân' }
];

export default function BecomePartner() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [submittedData, setSubmittedData] = useState(null);

    const [form, setForm] = useState({
        representativeName: '',
        representativeTitle: 'Giám đốc',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        countryCode: 'VN',
        entityType: 'SINGLE_MEMBER_LLC',
        businessName: '',
        taxCode: '',
        businessLicenseNumber: '',
        address: '',
        latitude: DEFAULT_CENTER.latitude,
        longitude: DEFAULT_CENTER.longitude,
        serviceRadiusKm: 10,
        bankName: '',
        bankAccountNumber: '',
        bankAccountHolder: '',
        description: '',
        termsAccepted: false
    });

    const [licenseFile, setLicenseFile] = useState(null);
    const [idCardFile, setIdCardFile] = useState(null);

    // Inline Email OTP verification state (Step 1)
    const [otpSent, setOtpSent] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [otpSending, setOtpSending] = useState(false);
    const [otpVerifying, setOtpVerifying] = useState(false);
    const [otpCooldown, setOtpCooldown] = useState(0);
    const [otpMessage, setOtpMessage] = useState('');
    const [otpError, setOtpError] = useState('');
    const [verifiedEmail, setVerifiedEmail] = useState('');
    const [emailVerificationToken, setEmailVerificationToken] = useState('');

    const isEmailVerified =
        Boolean(emailVerificationToken) &&
        verifiedEmail === form.email.trim().toLowerCase();

    useEffect(() => {
        if (otpCooldown <= 0) return;
        const timer = window.setInterval(() => {
            setOtpCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [otpCooldown]);

    const resetEmailVerification = () => {
        setVerifiedEmail('');
        setEmailVerificationToken('');
        setOtpSent(false);
        setOtpCode('');
        setOtpMessage('');
        setOtpError('');
    };

    const handleSendOtp = async () => {
        const cleanEmail = form.email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            setOtpError('Vui lòng nhập email doanh nghiệp hợp lệ trước khi gửi mã OTP.');
            return;
        }
        setOtpSending(true);
        setOtpError('');
        setOtpMessage('');
        setError('');
        try {
            const res = await fetch('/api/auth/register-partner/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: cleanEmail })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.message || data.detail || 'Không thể gửi mã OTP.');
            }
            setOtpSent(true);
            setOtpCode('');
            setOtpCooldown(Number(data.cooldownSeconds) || 60);
            setOtpMessage(data.message || `Đã gửi mã OTP 6 chữ số đến ${cleanEmail}.`);
        } catch (err) {
            setOtpError(err.message || 'Không thể gửi mã OTP.');
        } finally {
            setOtpSending(false);
        }
    };

    const handleVerifyOtp = async () => {
        const cleanEmail = form.email.trim().toLowerCase();
        const code = otpCode.trim();
        if (!/^[0-9]{6}$/.test(code)) {
            setOtpError('Vui lòng nhập đúng 6 chữ số OTP từ hộp thư của bạn.');
            return;
        }
        setOtpVerifying(true);
        setOtpError('');
        setError('');
        try {
            const res = await fetch('/api/auth/register-partner/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: cleanEmail, otp: code })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.message || data.detail || 'Xác thực OTP thất bại.');
            }
            setVerifiedEmail(cleanEmail);
            setEmailVerificationToken(data.emailVerificationToken || '');
            setOtpSent(false);
            setOtpCode('');
            setOtpMessage('');
        } catch (err) {
            setOtpError(err.message || 'Mã OTP không chính xác.');
        } finally {
            setOtpVerifying(false);
        }
    };

    const updateField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setError('');
        if (key === 'email') {
            setOtpError('');
            if (verifiedEmail && value.trim().toLowerCase() !== verifiedEmail) {
                resetEmailVerification();
            }
        }
    };

    const validateStep = (targetStep) => {
        if (targetStep === 1) {
            if (!form.representativeName.trim()) return 'Vui lòng nhập họ tên người đại diện pháp luật.';
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Email doanh nghiệp không hợp lệ.';
            if (!isEmailVerified) return 'Vui lòng bấm "Gửi mã OTP" và xác thực email doanh nghiệp trước khi tiếp tục.';
            if (!/^(0|\+84)[0-9]{9,10}$/.test(form.phone.trim())) return 'Số điện thoại cần theo định dạng 0xxxxxxxxx hoặc +84xxxxxxxxx.';
            if (form.password.length < 8) return 'Mật khẩu tài khoản phải có ít nhất 8 ký tự.';
            if (form.password !== form.confirmPassword) return 'Mật khẩu xác nhận không khớp.';
        }
        if (targetStep === 2) {
            if (!form.businessName.trim()) return 'Vui lòng nhập tên pháp lý doanh nghiệp.';
            if (!/^[0-9]{10}(-[0-9]{3})?$|^[0-9]{13}$/.test(form.taxCode.trim())) {
                return 'Mã số thuế cần gồm 10 hoặc 13 chữ số.';
            }
            if (!form.businessLicenseNumber.trim()) return 'Vui lòng nhập số Giấy phép đăng ký kinh doanh.';
            if (!form.address.trim()) return 'Vui lòng chọn hoặc nhập địa chỉ trụ sở doanh nghiệp trên bản đồ.';
            if (!form.latitude || !form.longitude) return 'Vui lòng ghim tọa độ trụ sở trên bản đồ.';
        }
        if (targetStep === 3) {
            if (!form.bankName.trim() || !form.bankAccountNumber.trim() || !form.bankAccountHolder.trim()) {
                return 'Vui lòng nhập đầy đủ tên ngân hàng, số tài khoản và chủ tài khoản nhận đối soát.';
            }
            if (!form.termsAccepted) {
                return 'Bạn cần xác nhận đồng ý Điều khoản Đối tác và Cam kết SLA CleanMate.';
            }
        }
        return '';
    };

    const handleNext = () => {
        const msg = validateStep(step);
        if (msg) {
            setError(msg);
            return;
        }
        setStep((s) => Math.min(3, s + 1));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        for (const s of [1, 2, 3]) {
            const msg = validateStep(s);
            if (msg) {
                setStep(s);
                setError(msg);
                return;
            }
        }

        setSubmitting(true);
        setError('');
        try {
            const fd = new FormData();
            Object.entries(form).forEach(([k, v]) => {
                if (k !== 'confirmPassword') {
                    fd.append(k, String(v ?? ''));
                }
            });
            fd.append('emailVerificationToken', emailVerificationToken);
            if (licenseFile) fd.append('businessLicenseFile', licenseFile);
            if (idCardFile) fd.append('representativeIdCardFile', idCardFile);

            const res = await fetch('/api/auth/register-partner', {
                method: 'POST',
                body: fd
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.message || data.detail || 'Đăng ký đối tác thất bại.');
            }
            setSubmittedData(data);
        } catch (err) {
            setError(err.message || 'Không thể gửi hồ sơ đăng ký.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bp-page">
            <Header />

            <section className="bp-hero">
                <span className="bp-hero-badge">KYB INTERNATIONAL PARTNER ONBOARDING</span>
                <h1>Đăng ký Đối tác Doanh nghiệp CleanMate</h1>
                <p>
                    Hồ sơ đăng ký chuẩn quốc tế (KYB — Know Your Business) gồm 3 bước gọn nhẹ:
                    Định danh người đại diện, Xác thực pháp nhân &amp; ghim bản đồ vùng phục vụ,
                    và Tài khoản đối soát thanh toán.
                </p>
            </section>

            <main className="bp-container">
                <div className="bp-card">
                    {submittedData ? (
                        <div className="bp-success-view">
                            <div className="bp-success-icon">🎉</div>
                            <h2>Nộp hồ sơ Đối tác thành công!</h2>
                            <p style={{ color: '#475569', maxWidth: 560, margin: '8px auto 18px', lineHeight: 1.6 }}>
                                Hồ sơ doanh nghiệp <strong>{submittedData.businessName}</strong> (MST:{' '}
                                <strong>{submittedData.taxCode}</strong>) đã được chuyển tới bộ phận thẩm định
                                CleanMate ở trạng thái <span className="bp-status-pill pending">Chờ duyệt (PENDING)</span>.
                            </p>
                            <p style={{ color: '#64748b', fontSize: 13.5, marginBottom: 24 }}>
                                Bạn có thể đăng nhập bằng email <strong>{submittedData.email}</strong> để theo dõi tiến độ
                                duyệt hoặc chỉnh sửa hồ sơ ngay tại trang <strong>Theo dõi hồ sơ đối tác</strong>.
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    className="bp-btn bp-btn-primary"
                                    onClick={() => navigate('/login')}
                                >
                                    Đăng nhập theo dõi hồ sơ
                                </button>
                                <Link to="/" className="bp-btn bp-btn-secondary" style={{ textDecoration: 'none' }}>
                                    Về trang chủ
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <div className="bp-stepper">
                                {[
                                    { id: 1, title: 'Tài khoản & Đại diện', sub: 'Representative & E.164' },
                                    { id: 2, title: 'Pháp nhân & Bản đồ', sub: 'KYB, GPKD & Location' },
                                    { id: 3, title: 'Đối soát & Cam kết', sub: 'Payout Bank & e-Consent' }
                                ].map((item) => (
                                    <div
                                        key={item.id}
                                        className={`bp-step ${step === item.id ? 'active' : step > item.id ? 'done' : ''}`}
                                        onClick={() => {
                                            if (item.id < step) setStep(item.id);
                                        }}
                                    >
                                        <div className="bp-step-num">{step > item.id ? '✓' : item.id}</div>
                                        <div className="bp-step-text">
                                            <strong>{item.title}</strong>
                                            <span>{item.sub}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {error && <div className="bp-alert error">⚠️ {error}</div>}

                            {step === 1 && (
                                <>
                                    <h2 className="bp-section-title">Bước 1: Tài khoản &amp; Người đại diện pháp luật</h2>
                                    <p className="bp-section-sub">
                                        Thông tin tài khoản quản trị cổng Đối tác và người đại diện ký kết hợp đồng.
                                    </p>

                                    <div className="bp-grid">
                                        <div className="bp-field">
                                            <label>
                                                Họ tên người đại diện <span className="req">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={form.representativeName}
                                                onChange={(e) => updateField('representativeName', e.target.value)}
                                                placeholder="VD: Nguyễn Văn An"
                                                required
                                            />
                                        </div>

                                        <div className="bp-field">
                                            <label>Chức danh đại diện</label>
                                            <input
                                                type="text"
                                                value={form.representativeTitle}
                                                onChange={(e) => updateField('representativeTitle', e.target.value)}
                                                placeholder="VD: Giám đốc / Chủ hộ kinh doanh"
                                            />
                                        </div>

                                        <div className="bp-field full">
                                            <label>
                                                Email doanh nghiệp (Tên đăng nhập &amp; xác thực OTP) <span className="req">*</span>
                                            </label>
                                            <div className="bp-email-row">
                                                <input
                                                    type="email"
                                                    value={form.email}
                                                    disabled={isEmailVerified}
                                                    onChange={(e) => updateField('email', e.target.value)}
                                                    placeholder="contact@congtyvesinh.vn"
                                                    required
                                                />
                                                {!isEmailVerified && (
                                                    <button
                                                        type="button"
                                                        className="bp-otp-trigger"
                                                        disabled={otpSending || otpCooldown > 0 || !form.email.trim()}
                                                        onClick={handleSendOtp}
                                                    >
                                                        {otpSending
                                                            ? 'Đang gửi...'
                                                            : otpCooldown > 0
                                                                ? `Gửi lại (${otpCooldown}s)`
                                                                : otpSent
                                                                    ? 'Gửi lại mã'
                                                                    : 'Gửi mã OTP'}
                                                    </button>
                                                )}
                                            </div>

                                            {isEmailVerified && (
                                                <div className="bp-email-verified-bar">
                                                    <span>✓ Email doanh nghiệp đã được xác thực OTP</span>
                                                    <button
                                                        type="button"
                                                        className="bp-email-change-btn"
                                                        onClick={resetEmailVerification}
                                                    >
                                                        Đổi email
                                                    </button>
                                                </div>
                                            )}

                                            {!isEmailVerified && otpSent && (
                                                <div className="bp-otp-panel">
                                                    <span className="bp-otp-hint">
                                                        {otpMessage || `Mã OTP 6 chữ số đã được gửi tới ${form.email}. Hiệu lực trong 5 phút.`}
                                                    </span>
                                                    <div className="bp-otp-panel-row">
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            maxLength={6}
                                                            className="bp-otp-input"
                                                            value={otpCode}
                                                            onChange={(e) => {
                                                                setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                                                                setOtpError('');
                                                            }}
                                                            placeholder="000000"
                                                            aria-label="Nhập mã OTP 6 chữ số"
                                                        />
                                                        <button
                                                            type="button"
                                                            className="bp-otp-verify-btn"
                                                            disabled={otpVerifying || otpCode.length !== 6}
                                                            onClick={handleVerifyOtp}
                                                        >
                                                            {otpVerifying ? 'Đang kiểm tra...' : '✓ Xác nhận OTP'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {otpError && <span className="bp-otp-error">⚠️ {otpError}</span>}
                                        </div>

                                        <div className="bp-field full">
                                            <label>
                                                Số điện thoại liên hệ (E.164 / VN) <span className="req">*</span>
                                            </label>
                                            <input
                                                type="tel"
                                                value={form.phone}
                                                onChange={(e) => updateField('phone', e.target.value)}
                                                placeholder="+84901234567 hoặc 0901234567"
                                                required
                                            />
                                        </div>

                                        <div className="bp-field">
                                            <label>
                                                Mật khẩu (tối thiểu 8 ký tự) <span className="req">*</span>
                                            </label>
                                            <input
                                                type="password"
                                                value={form.password}
                                                onChange={(e) => updateField('password', e.target.value)}
                                                placeholder="Nhập mật khẩu bảo mật"
                                                required
                                            />
                                        </div>

                                        <div className="bp-field">
                                            <label>
                                                Xác nhận mật khẩu <span className="req">*</span>
                                            </label>
                                            <input
                                                type="password"
                                                value={form.confirmPassword}
                                                onChange={(e) => updateField('confirmPassword', e.target.value)}
                                                placeholder="Nhập lại mật khẩu"
                                                required
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {step === 2 && (
                                <>
                                    <h2 className="bp-section-title">Bước 2: Pháp nhân, Giấy phép KYB &amp; Bản đồ trụ sở</h2>
                                    <p className="bp-section-sub">
                                        Thông tin pháp lý giúp Admin thẩm định nhanh và định vị chính xác phạm vi phục vụ của bạn.
                                    </p>

                                    <div className="bp-grid">
                                        <div className="bp-field full">
                                            <label>
                                                Tên pháp lý doanh nghiệp (theo GPKD) <span className="req">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={form.businessName}
                                                onChange={(e) => updateField('businessName', e.target.value)}
                                                placeholder="VD: Công ty TNHH Dịch vụ Vệ sinh An Khang"
                                                required
                                            />
                                        </div>

                                        <div className="bp-field">
                                            <label>
                                                Loại hình doanh nghiệp <span className="req">*</span>
                                            </label>
                                            <select
                                                value={form.entityType}
                                                onChange={(e) => updateField('entityType', e.target.value)}
                                            >
                                                {ENTITY_TYPES.map((t) => (
                                                    <option key={t.value} value={t.value}>
                                                        {t.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="bp-field">
                                            <label>Quốc gia đăng ký (ISO-3166)</label>
                                            <select
                                                value={form.countryCode}
                                                onChange={(e) => updateField('countryCode', e.target.value)}
                                            >
                                                <option value="VN">🇻🇳 Việt Nam (VN)</option>
                                                <option value="SG">🇸🇬 Singapore (SG)</option>
                                                <option value="TH">🇹🇭 Thailand (TH)</option>
                                            </select>
                                        </div>

                                        <div className="bp-field">
                                            <label>
                                                Mã số thuế / Mã số doanh nghiệp (10 hoặc 13 số) <span className="req">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={form.taxCode}
                                                onChange={(e) => updateField('taxCode', e.target.value)}
                                                placeholder="VD: 0316543210"
                                                required
                                            />
                                        </div>

                                        <div className="bp-field">
                                            <label>
                                                Số Giấy phép ĐKKD <span className="req">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={form.businessLicenseNumber}
                                                onChange={(e) => updateField('businessLicenseNumber', e.target.value)}
                                                placeholder="VD: GPKD-HCM-2026-0098"
                                                required
                                            />
                                        </div>

                                        <div className="bp-field">
                                            <label>Giấy chứng nhận ĐKKD (JPG/PNG/PDF, ≤ 5MB)</label>
                                            <div className={`bp-upload-box ${licenseFile ? 'has-file' : ''}`}>
                                                <div className="bp-upload-controls">
                                                    <label className="bp-upload-btn">
                                                        <span>{licenseFile ? '↻ Đổi tệp GPKD' : '📎 Chọn tệp GPKD'}</span>
                                                        <input
                                                            type="file"
                                                            className="bp-file-input-hidden"
                                                            accept=".jpg,.jpeg,.png,.webp,.pdf"
                                                            onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                                                        />
                                                    </label>
                                                    {licenseFile && (
                                                        <button
                                                            type="button"
                                                            className="bp-upload-clear-btn"
                                                            onClick={() => setLicenseFile(null)}
                                                        >
                                                            ✕ Bỏ chọn
                                                        </button>
                                                    )}
                                                </div>
                                                {licenseFile ? (
                                                    <div className="bp-upload-filename" title={licenseFile.name}>
                                                        ✓ {licenseFile.name}
                                                    </div>
                                                ) : (
                                                    <span className="bp-upload-hint">
                                                        Tải bản chụp hoặc PDF giấy phép đăng ký kinh doanh
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bp-field">
                                            <label>CCCD / Hộ chiếu Người đại diện (JPG/PNG/PDF, ≤ 5MB)</label>
                                            <div className={`bp-upload-box ${idCardFile ? 'has-file' : ''}`}>
                                                <div className="bp-upload-controls">
                                                    <label className="bp-upload-btn">
                                                        <span>{idCardFile ? '↻ Đổi tệp CCCD' : '📎 Chọn tệp CCCD'}</span>
                                                        <input
                                                            type="file"
                                                            className="bp-file-input-hidden"
                                                            accept=".jpg,.jpeg,.png,.webp,.pdf"
                                                            onChange={(e) => setIdCardFile(e.target.files?.[0] || null)}
                                                        />
                                                    </label>
                                                    {idCardFile && (
                                                        <button
                                                            type="button"
                                                            className="bp-upload-clear-btn"
                                                            onClick={() => setIdCardFile(null)}
                                                        >
                                                            ✕ Bỏ chọn
                                                        </button>
                                                    )}
                                                </div>
                                                {idCardFile ? (
                                                    <div className="bp-upload-filename" title={idCardFile.name}>
                                                        ✓ {idCardFile.name}
                                                    </div>
                                                ) : (
                                                    <span className="bp-upload-hint">
                                                        Tải ảnh CCCD/Hộ chiếu phục vụ đối chiếu KYB
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bp-field full">
                                            <label>
                                                Địa chỉ trụ sở vận hành &amp; Ghim tọa độ Bản đồ miễn phí (OpenStreetMap){' '}
                                                <span className="req">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={form.address}
                                                onChange={(e) => updateField('address', e.target.value)}
                                                placeholder="Địa chỉ sẽ tự điền khi bạn chọn hoặc kéo ghim trên bản đồ bên dưới"
                                                style={{ marginBottom: 8 }}
                                                required
                                            />
                                            <LocationPickerMap
                                                latitude={form.latitude}
                                                longitude={form.longitude}
                                                address={form.address}
                                                radiusKm={form.serviceRadiusKm}
                                                showRadius
                                                height={270}
                                                onChange={(loc) => {
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        latitude: loc.latitude,
                                                        longitude: loc.longitude,
                                                        address: loc.fullAddress || prev.address
                                                    }));
                                                }}
                                            />
                                        </div>

                                        <div className="bp-field full">
                                            <label>Bán kính phục vụ cam kết quanh trụ sở (km)</label>
                                            <div className="bp-radius-row">
                                                <input
                                                    type="range"
                                                    min={3}
                                                    max={30}
                                                    step={1}
                                                    value={form.serviceRadiusKm}
                                                    onChange={(e) => updateField('serviceRadiusKm', Number(e.target.value))}
                                                />
                                                <span className="bp-radius-badge">{form.serviceRadiusKm} km</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {step === 3 && (
                                <>
                                    <h2 className="bp-section-title">Bước 3: Tài khoản Đối soát &amp; Cam kết Pháp lý (e-Consent)</h2>
                                    <p className="bp-section-sub">
                                        Thông tin tài khoản ngân hàng để CleanMate chuyển khoản doanh thu đối soát các đơn VNPay.
                                    </p>

                                    <div className="bp-grid">
                                        <div className="bp-field">
                                            <label>
                                                Ngân hàng thụ hưởng <span className="req">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={form.bankName}
                                                onChange={(e) => updateField('bankName', e.target.value)}
                                                placeholder="VD: Vietcombank / Techcombank / BIDV"
                                                required
                                            />
                                        </div>

                                        <div className="bp-field">
                                            <label>
                                                Số tài khoản ngân hàng <span className="req">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={form.bankAccountNumber}
                                                onChange={(e) => updateField('bankAccountNumber', e.target.value)}
                                                placeholder="VD: 0071001234567"
                                                required
                                            />
                                        </div>

                                        <div className="bp-field full">
                                            <label>
                                                Tên chủ tài khoản (in hoa không dấu, khớp tên doanh nghiệp/đại diện){' '}
                                                <span className="req">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={form.bankAccountHolder}
                                                onChange={(e) => updateField('bankAccountHolder', e.target.value.toUpperCase())}
                                                placeholder="VD: CONG TY TNHH VE SINH AN KHANG"
                                                required
                                            />
                                        </div>

                                        <div className="bp-field full">
                                            <label>Giới thiệu doanh nghiệp &amp; thế mạnh dịch vụ</label>
                                            <textarea
                                                rows={3}
                                                value={form.description}
                                                onChange={(e) => updateField('description', e.target.value)}
                                                placeholder="Mô tả kinh nghiệm, đội ngũ nhân sự, trang thiết bị vệ sinh chuyên dụng..."
                                            />
                                        </div>

                                        <div className="bp-field full">
                                            <div className="bp-consent-box">
                                                <label className="bp-consent-check">
                                                    <input
                                                        type="checkbox"
                                                        checked={form.termsAccepted}
                                                        onChange={(e) => updateField('termsAccepted', e.target.checked)}
                                                    />
                                                    <span>
                                                        Tôi cam đoan mọi thông tin pháp nhân và tài liệu KYB cung cấp là chính xác,
                                                        đồng ý tuân thủ <strong>Điều khoản Đối tác CleanMate</strong>,{' '}
                                                        <strong>Quy chuẩn SLA tiếp nhận đơn (3 giờ / 12 giờ)</strong> và{' '}
                                                        <strong>Chính sách phí sàn &amp; đối soát thanh toán</strong>.
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="bp-actions">
                                {step > 1 ? (
                                    <button
                                        type="button"
                                        className="bp-btn bp-btn-secondary"
                                        onClick={() => setStep((s) => s - 1)}
                                    >
                                        ← Quay lại bước {step - 1}
                                    </button>
                                ) : (
                                    <Link to="/login" className="bp-login-link">
                                        Đã có tài khoản Đối tác? Đăng nhập
                                    </Link>
                                )}

                                {step < 3 ? (
                                    <button type="button" className="bp-btn bp-btn-primary" onClick={handleNext}>
                                        Tiếp tục bước {step + 1} →
                                    </button>
                                ) : (
                                    <button type="submit" className="bp-btn bp-btn-primary" disabled={submitting}>
                                        {submitting ? 'Đang gửi hồ sơ KYB...' : '✓ Hoàn tất & Gửi thẩm định'}
                                    </button>
                                )}
                            </div>
                        </form>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}
