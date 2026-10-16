package org.ckitmdt.backend.dto.booking;

public enum BookingStatusEnum {
    PENDING_PAYMENT,     // Chờ thanh toán (giữ chỗ 15 phút)
    PENDING_PROVIDER,    // Chờ Provider tiếp nhận (sau khi thanh toán)
    CONFIRMED,           // Provider đã chấp nhận
    ASSIGNED,            // Đã phân công Cleaner
    EN_ROUTE,            // Cleaner đang di chuyển
    IN_PROGRESS,         // Đang thực hiện công việc
    PENDING_COMPLETION,  // Chờ khách hàng nghiệm thu
    COMPLETED,           // Đã hoàn thành (khách nghiệm thu)
    REJECTED,            // Provider từ chối
    EXPIRED,             // Hết hạn giữ chỗ do không thanh toán
    CANCELLED            // Đã hủy theo chính sách
}
