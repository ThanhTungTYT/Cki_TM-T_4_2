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
    return (amount || 0).toLocaleString('vi-VN') + 'đ';
}

function getTodayString() {
    const d = new Date();
    return d.toISOString().split('T')[0];
}

function getTomorrowString() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

function ServicePackageModal({ service, isOpen, onClose, onConfirm }) {
    const packages = service?.packages || [];
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [scheduledDate, setScheduledDate] = useState(getTomorrowString());
    const [scheduledTime, setScheduledTime] = useState('08:30');
    const [note, setNote] = useState('');

    useEffect(() => {
        if (service) {
            setQuantity(1);
            setScheduledDate(getTomorrowString());
            setScheduledTime('08:30');
            setNote('');
            if (service.packages && service.packages.length > 0) {
                setSelectedPackage(service.packages[0]);
            } else {
                setSelectedPackage(null);
            }
        }
    }, [service]);

    if (!isOpen || !service) return null;

    const unitPrice = selectedPackage ? selectedPackage.price : (service.basePrice || 0);
    const totalPrice = unitPrice * quantity;

    const handleConfirm = () => {
        onConfirm({
            serviceId: service.id,
            serviceName: service.name,
            packageId: selectedPackage ? selectedPackage.id : null,
            packageName: selectedPackage ? selectedPackage.name : null,
            quantity: quantity,
            unitPrice: unitPrice,
            estimatedPrice: totalPrice,
            scheduledDate: scheduledDate,
            scheduledTime: scheduledTime,
            scheduledStart: `${scheduledDate}T${scheduledTime}:00`,
            note: note.trim()
        });
        onClose();
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h3>Chọn gói & Lịch vệ sinh</h3>
                        <p className="modal-service-name">{service.name}</p>
                    </div>
                    <button className="modal-close-btn" onClick={onClose} aria-label="Đóng">
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <div className="modal-body modal-body-horizontal">
                    {/* CỘT TRÁI: Gói dịch vụ, Số lượng, Ghi chú */}
                    <div className="modal-col modal-col-left">
                        {packages.length > 0 ? (
                            <div className="package-section">
                                <label className="section-title">CHỌN GÓI DỊCH VỤ</label>
                                <div className="package-list">
                                    {packages.map((pkg) => {
                                        const isSelected = selectedPackage?.id === pkg.id;
                                        return (
                                            <div
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
                                                    {pkg.durationMinutes && (
                                                        <span>
                                                            <FontAwesomeIcon icon={faClock} /> {pkg.durationMinutes / 60} giờ
                                                        </span>
                                                    )}
                                                    {pkg.employeeCount && (
                                                        <span>
                                                            <FontAwesomeIcon icon={faUserGroup} /> {pkg.employeeCount} nhân viên
                                                        </span>
                                                    )}
                                                    {pkg.minArea && pkg.maxArea && (
                                                        <span>
                                                            <FontAwesomeIcon icon={faRulerCombined} /> {pkg.minArea} - {pkg.maxArea} m²
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
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
                                <p className="single-desc">
                                    Dịch vụ tiêu chuẩn theo yêu cầu thực tế của quý khách.
                                </p>
                            </div>
                        )}

                        <div className="modal-row">
                            <label className="section-title">SỐ LƯỢNG</label>
                            <div className="modal-qty-control">
                                <button
                                    type="button"
                                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                    disabled={quantity <= 1}
                                >
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <span>{quantity}</span>
                                <button
                                    type="button"
                                    onClick={() => setQuantity((q) => q + 1)}
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
                                placeholder="Ví dụ: Nhà có thú cưng, căn hộ lầu 5, cần mang thêm thang..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* CỘT PHẢI: Lịch ngày & Giờ dọn dẹp */}
                    <div className="modal-col modal-col-right">
                        <div className="modal-row">
                            <label className="section-title">
                                <FontAwesomeIcon icon={faCalendarDays} /> CHỌN NGÀY VỆ SINH
                            </label>
                            <DatePickerCalendar
                                value={scheduledDate}
                                onChange={setScheduledDate}
                                minDate={getTodayString()}
                            />
                        </div>

                        <div className="modal-row">
                            <label className="section-title">
                                <FontAwesomeIcon icon={faClock} /> KHUNG GIỜ BẮT ĐẦU
                            </label>
                            <div className="quick-time-chips">
                                {QUICK_TIME_SLOTS.map((slot) => (
                                    <button
                                        key={slot}
                                        type="button"
                                        className={`time-chip ${scheduledTime === slot ? 'active' : ''}`}
                                        onClick={() => setScheduledTime(slot)}
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
                                        onChange={(e) => setScheduledTime(e.target.value)}
                                        title="Nhập giờ tùy chọn"
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="modal-total">
                        <span>Tạm tính:</span>
                        <strong>{formatPrice(totalPrice)}</strong>
                    </div>
                    <div className="modal-actions">
                        <button className="btn-cancel" onClick={onClose}>
                            Hủy
                        </button>
                        <button className="btn-confirm" onClick={handleConfirm}>
                            <FontAwesomeIcon icon={faCartPlus} /> Thêm vào giỏ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ServicePackageModal;
