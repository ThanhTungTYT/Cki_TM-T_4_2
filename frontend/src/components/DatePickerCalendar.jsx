import { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChevronLeft,
    faChevronRight,
    faCalendarDays
} from '@fortawesome/free-solid-svg-icons';
import './DatePickerCalendar.css';

const DAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTH_NAMES = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
    'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
    'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

function padZero(num) {
    return num < 10 ? `0${num}` : `${num}`;
}

function formatDateString(year, monthIndex, day) {
    return `${year}-${padZero(monthIndex + 1)}-${padZero(day)}`;
}

function DatePickerCalendar({ value, onChange, minDate }) {
    const initialDate = useMemo(() => {
        if (value) {
            const [y, m, d] = value.split('-').map(Number);
            return new Date(y, m - 1, d);
        }
        return new Date();
    }, [value]);

    const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());

    const todayStr = useMemo(() => {
        const now = new Date();
        return formatDateString(now.getFullYear(), now.getMonth(), now.getDate());
    }, []);

    const effectiveMinDate = minDate || todayStr;

    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(y => y - 1);
        } else {
            setCurrentMonth(m => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(y => y + 1);
        } else {
            setCurrentMonth(m => m + 1);
        }
    };

    // Calculate calendar grid
    const calendarDays = useMemo(() => {
        // Monday = 0, Sunday = 6
        const rawDay = new Date(currentYear, currentMonth, 1).getDay();
        const startOffset = (rawDay + 6) % 7;
        const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

        const cells = [];
        // Empty placeholder cells before 1st of month
        for (let i = 0; i < startOffset; i++) {
            cells.push({ isEmpty: true, key: `empty-${i}` });
        }

        // Days 1..totalDays
        for (let day = 1; day <= totalDays; day++) {
            const dateStr = formatDateString(currentYear, currentMonth, day);
            const isPast = dateStr < effectiveMinDate;
            const isSelected = dateStr === value;
            const isToday = dateStr === todayStr;

            cells.push({
                isEmpty: false,
                day,
                dateStr,
                isPast,
                isSelected,
                isToday,
                key: dateStr
            });
        }

        return cells;
    }, [currentYear, currentMonth, effectiveMinDate, value, todayStr]);

    // Format human readable label for selected date
    const selectedDateLabel = useMemo(() => {
        if (!value) return '';
        const [y, m, d] = value.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const dayOfWeekIndex = (dateObj.getDay() + 6) % 7;
        const fullDayName = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'][dayOfWeekIndex];
        return `${fullDayName}, ${padZero(d)}/${padZero(m)}/${y}`;
    }, [value]);

    return (
        <div className="custom-calendar-container">
            <div className="calendar-header">
                <button
                    type="button"
                    className="cal-nav-btn"
                    onClick={handlePrevMonth}
                    title="Tháng trước"
                >
                    <FontAwesomeIcon icon={faChevronLeft} />
                </button>

                <div className="cal-current-month">
                    <strong>{MONTH_NAMES[currentMonth]}</strong>
                    <span>{currentYear}</span>
                </div>

                <button
                    type="button"
                    className="cal-nav-btn"
                    onClick={handleNextMonth}
                    title="Tháng sau"
                >
                    <FontAwesomeIcon icon={faChevronRight} />
                </button>
            </div>

            <div className="calendar-grid">
                {DAY_NAMES.map(name => (
                    <div key={name} className="cal-day-name">
                        {name}
                    </div>
                ))}

                {calendarDays.map(cell => {
                    if (cell.isEmpty) {
                        return <div key={cell.key} className="cal-cell empty" />;
                    }

                    return (
                        <button
                            key={cell.key}
                            type="button"
                            className={`cal-cell day-btn ${cell.isSelected ? 'selected' : ''} ${cell.isToday ? 'today' : ''} ${cell.isPast ? 'disabled' : ''}`}
                            disabled={cell.isPast}
                            onClick={() => onChange(cell.dateStr)}
                        >
                            <span>{cell.day}</span>
                            {cell.isToday && !cell.isSelected && <span className="today-dot" />}
                        </button>
                    );
                })}
            </div>

            {selectedDateLabel && (
                <div className="cal-selected-badge">
                    <FontAwesomeIcon icon={faCalendarDays} />
                    <span>Ngày đã chọn: <strong>{selectedDateLabel}</strong></span>
                </div>
            )}
        </div>
    );
}

export default DatePickerCalendar;
