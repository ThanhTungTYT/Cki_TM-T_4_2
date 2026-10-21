package org.ckitmdt.backend.service.booking;

import org.ckitmdt.backend.dto.booking.BookingHistoryResponseDto;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.repository.BookingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CustomerBookingHistoryService {

    @Autowired
    private BookingRepository bookingRepository;

    public List<BookingHistoryResponseDto> getCustomerBookings(Long customerId, String status) {
        // Lấy danh sách đơn theo customerId sử dụng hàm sẵn có trong Repository
        List<Booking> bookings = bookingRepository.findByCustomerIdOrderByCreatedAtDesc(customerId);

        // Nếu người dùng chọn lọc theo status thì tiến hành lọc
        if (status != null && !status.trim().isEmpty()) {
            bookings = bookings.stream()
                    .filter(b -> status.equalsIgnoreCase(b.getStatus()))
                    .collect(Collectors.toList());
        }

        // Chuyển đổi sang DTO để trả về cho Frontend
        return bookings.stream().map(b -> BookingHistoryResponseDto.builder()
                .id(b.getId())
                .bookingCode(b.getBookingCode())
                .partnerName(b.getPartner() != null ? b.getPartner().getCompanyName() : "Đang tìm đối tác")
                .addressDetail(b.getAddress() != null ? b.getAddress().getStreetAddress() : "N/A")
                .totalAmount(b.getTotalAmount())
                .status(b.getStatus())
                .scheduledStart(b.getScheduledStart())
                .scheduledEnd(b.getScheduledEnd())
                .createdAt(b.getCreatedAt())
                .customerNote(b.getCustomerNote())
                .build()
        ).collect(Collectors.toList());
    }

    public Booking getBookingDetail(Long bookingId, Long customerId) {
        return bookingRepository.findByIdAndCustomerId(bookingId, customerId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng hoặc bạn không có quyền xem đơn này"));
    }
}