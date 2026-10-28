package org.ckitmdt.backend.dto.booking;

public enum BookingActionEnum {
    CUSTOMER_PAY_SUCCESS,      // IPN VNPAY hoặc thanh toán thành công
    PROVIDER_ACCEPT,           // Provider chấp nhận đơn
    PROVIDER_REJECT,           // Provider từ chối đơn
    ASSIGN_CLEANER,            // Giao việc cho nhân sự dọn dẹp
    START_TRAVEL,              // Nhân sự bắt đầu di chuyển
    START_JOB,                 // Nhân sự bắt đầu làm (check-in GPS)
    SUBMIT_COMPLETION,         // Nhân sự báo hoàn thành
    CUSTOMER_ACCEPT,           // Khách hàng nghiệm thu & xác nhận hoàn thành
    PROVIDER_CONFIRM_CASH_PAYMENT, // Đối tác xác nhận đã thu tiền mặt
    CANCEL                     // Hủy đơn theo chính sách
}
