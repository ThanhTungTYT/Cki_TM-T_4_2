
import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faXmark,
    faClock,
    faUserGroup,
    faRulerCombined,
    faPlus,
    faMinus,
    faCartPlus,
    faCalendarDays
} from '@fortawesome/free-solid-svg-icons';
import DatePickerCalendar from './DatePickerCalendar';
import './ServicePackageModal.css';

const QUICK_TIME_SLOTS = ['08:00', '09:30', '11:00', '13:30', '15:00', '17:00'];

function formatPrice(amount) {
    return `${Number(amount || 0).toLocaleString('vi-VN')}đ`;
}

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTomorrowString() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return getLocalDateString(date);
}

function ServicePackageModal({ service, isOpen, onClose, onConfirm }) {
    const packages = Array.isArray(service?.packages) ? service.packages : [];
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [scheduledDate, setScheduledDate] = useState(getTomorrowString());
    const [scheduledTime, setScheduledTime] = useState('08:00');
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!service) return;

        setQuantity(1);
        setScheduledDate(getTomorrowString());
        setScheduledTime('08:00');
        setNote('');
        setError('');
        setIsSubmitting(false);
        setSelectedPackage(packages[0] || null);
    }, [service?.id]);

    if (!isOpen || !service) return null;

    const unitPrice = Number(selectedPackage?.price ?? service.basePrice ?? 0);
    const totalPrice = unitPrice * quantity;
    const today = getLocalDateString();

    const handleConfirm = async () => {
        setError('');

        if (!service.id) {
            setError('Không xác định được dịch vụ.');
            return;
        }

        if (!service.providerId) {
            setError('Dịch vụ này chưa có thông tin đối tác. Vui lòng chọn dịch vụ khác.');
            return;
        }

        if (packages.length > 0 && !selectedPackage?.id) {
            setError('Vui lòng chọn gói dịch vụ.');
            return;
        }

        if (!scheduledDate || scheduledDate < today) {
            setError('Vui lòng chọn ngày vệ sinh hợp lệ.');
            return;
        }

        if (!scheduledTime) {
            setError('Vui lòng chọn giờ bắt đầu.');
            return;
        }

        const item = {
            serviceId: service.id,
            serviceName: service.name || '',
            serviceThumbnail: service.thumbnailUrl || '',
            providerId: service.providerId,
            providerName: service.providerName || '',
            packageId: selectedPackage?.id ?? null,
            packageName: selectedPackage?.name || '',
            quantity,
            unitPrice,
            estimatedPrice: totalPrice,
            scheduledDate,
            scheduledTime,
            scheduledStart: `${scheduledDate}T${scheduledTime}:00`,
            note: note.trim()
        };

        try {
            setIsSubmitting(true);
            await onConfirm(item);
            onClose();
        } catch (submitError) {
            setError(submitError?.message || 'Không thể thêm dịch vụ vào giỏ hàng.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-dialog" onClick={event => event.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h3>Chọn gói & Lịch vệ sinh</h3>
                        <p className="modal-service-name">{service.name}</p>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Đóng">
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <div className="modal-body modal-body-horizontal">
                    <div className="modal-col modal-col-left">
                        {packages.length > 0 ? (
                            <div className="package-section">
                                <label className="section-title">CHỌN GÓI DỊCH VỤ</label>
                                <div className="package-list">
                                    {packages.map(pkg => {
                                        const isSelected = selectedPackage?.id === pkg.id;

                                        return (
                                            <button
                                                type="button"
                                                key={pkg.id}
                                                className={`package-card ${isSelected ? 'selected' : ''}`}
                                                onClick={() => setSelectedPackage(pkg)}
                                            >
                                                <div className="package-card-header">
                                                    <div className="package-radio">
                                                        <span className={`radio-dot ${isSelected ? 'active' : ''}`} />
                                                        <strong>{pkg.name}</strong>
                                                    </div>
                                                    <span className="package-price">{formatPrice(pkg.price)}</span>
                                                </div>

                                                <div className="package-meta">
                                                    {pkg.durationMinutes != null && (
                                                        <span>
                                                            <FontAwesomeIcon icon={faClock} /> {Number(pkg.durationMinutes) / 60} giờ
                                                        </span>
                                                    )}
                                                    {pkg.employeeCount != null && (
                                                        <span>
                                                            <FontAwesomeIcon icon={faUserGroup} /> {pkg.employeeCount} nhân viên
                                                        </span>
                                                    )}
                                                    {pkg.minArea != null && pkg.maxArea != null && (
                                                        <span>
                                                            <FontAwesomeIcon icon={faRulerCombined} /> {pkg.minArea} - {pkg.maxArea} m²
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="single-service-info">
                                <div className="price-tag">
                                    <span>Đơn giá cơ bản:</span>
                                    <strong>{formatPrice(service.basePrice)}</strong>
                                </div>
                                {service.description && <p className="single-desc">{service.description}</p>}
                            </div>
                        )}

                        <div className="modal-row">
                            <label className="section-title">SỐ LƯỢNG</label>
                            <div className="modal-qty-control">
                                <button
                                    type="button"
                                    onClick={() => setQuantity(current => Math.max(1, current - 1))}
                                    disabled={quantity <= 1 || isSubmitting}
                                    aria-label="Giảm số lượng"
                                >
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <span>{quantity}</span>
                                <button
                                    type="button"
                                    onClick={() => setQuantity(current => current + 1)}
                                    disabled={isSubmitting}
                                    aria-label="Tăng số lượng"
                                >
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                        </div>

                        <div className="modal-row">
                            <label className="section-title">GHI CHÚ CHO ĐỐI TÁC (TÙY CHỌN)</label>
                            <textarea
                                className="modal-note-input"
                                rows="2"
                                placeholder="Nhập yêu cầu riêng cho buổi vệ sinh..."
                                value={note}
                                onChange={event => setNote(event.target.value)}
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <div className="modal-col modal-col-right">
                        <div className="modal-row">
                            <label className="section-title">
                                <FontAwesomeIcon icon={faCalendarDays} /> CHỌN NGÀY VỆ SINH
                            </label>
                            <DatePickerCalendar
                                value={scheduledDate}
                                onChange={setScheduledDate}
                                minDate={today}
                            />
                        </div>

                        <div className="modal-row">
                            <label className="section-title">
                                <FontAwesomeIcon icon={faClock} /> KHUNG GIỜ BẮT ĐẦU
                            </label>
                            <div className="quick-time-chips">
                                {QUICK_TIME_SLOTS.map(slot => (
                                    <button
                                        key={slot}
                                        type="button"
                                        className={`time-chip ${scheduledTime === slot ? 'active' : ''}`}
                                        onClick={() => setScheduledTime(slot)}
                                        disabled={isSubmitting}
                                    >
                                        {slot}
                                    </button>
                                ))}
                                <div className="custom-time-wrapper">
                                    <span className="custom-time-label">Tùy chọn:</span>
                                    <input
                                        type="time"
                                        className="custom-time-input"
                                        value={scheduledTime}
                                        onChange={event => setScheduledTime(event.target.value)}
                                        disabled={isSubmitting}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="modal-row">
                            <span className="section-title">ĐỐI TÁC</span>
                            <p>{service.providerName || 'Chưa có tên đối tác'}</p>
                            {service.location && <p>{service.location}</p>}
                        </div>
                    </div>
                </div>

                {error && <div className="modal-error-message" role="alert">{error}</div>}

                <div className="modal-footer">
                    <div className="modal-total">
                        <span>Tạm tính:</span>
                        <strong>{formatPrice(totalPrice)}</strong>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn-cancel" onClick={onClose} disabled={isSubmitting}>
                            Hủy
                        </button>
                        <button type="button" className="btn-confirm" onClick={handleConfirm} disabled={isSubmitting}>
                            <FontAwesomeIcon icon={faCartPlus} /> {isSubmitting ? 'Đang xử lý...' : 'Thêm vào giỏ'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ServicePackageModal;
