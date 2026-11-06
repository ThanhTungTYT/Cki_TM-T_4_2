package org.ckitmdt.backend.service.booking;

import org.ckitmdt.backend.dto.booking.BookingHistoryResponseDto;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.BookingAssignmentRepository;
import org.ckitmdt.backend.entity.BookingAssignment;
import org.ckitmdt.backend.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CustomerBookingHistoryService {

    @Autowired
    private BookingRepository bookingRepository;
    @Autowired
    private BookingAssignmentRepository bookingAssignmentRepository;

    public List<BookingHistoryResponseDto> getCustomerBookings(
            Long customerId,
            String status
    ) {
        List<Booking> bookings =
                bookingRepository.findByCustomerIdOrderByCreatedAtDesc(customerId);

        // Lọc danh sách theo trạng thái nếu có
        if (status != null && !status.trim().isEmpty()) {
            bookings = bookings.stream()
                    .filter(b -> status.equalsIgnoreCase(b.getStatus()))
                    .collect(Collectors.toList());
        }

        // Chuyển Booking Entity thành DTO
        return bookings.stream()
                .map(b -> {
                    String cleanerName = null;
                    String cleanerPhone = null;
                    List<BookingAssignment> asgList = bookingAssignmentRepository.findByBooking_IdOrderByIdAsc(b.getId());
                    BookingAssignment activeAsg = asgList.stream()
                            .filter(a -> !"CANCELLED".equalsIgnoreCase(a.getStatus()) && !"DECLINED".equalsIgnoreCase(a.getStatus()))
                            .findFirst().orElse(null);
                    if (activeAsg != null && activeAsg.getEmployee() != null && activeAsg.getEmployee().getUser() != null) {
                        User cUser = activeAsg.getEmployee().getUser();
                        cleanerName = cUser.getFullName();
                        cleanerPhone = cUser.getPhone();
                    }
                    return BookingHistoryResponseDto.builder()
                            .cleanerName(cleanerName)
                            .cleanerPhone(cleanerPhone)
                        .id(b.getId())
                        .bookingCode(b.getBookingCode())
                        .partnerName(
                                b.getPartner() != null
                                        ? b.getPartner().getBusinessName()
                                        : "Đang tìm đối tác"
                        )
                        .addressDetail(
                                b.getAddress() != null
                                        ? b.getAddress().getStreetAddress()
                                        : "N/A"
                        )
                        .totalAmount(b.getTotalAmount())
                        .status(b.getStatus())
                        .scheduledStart(b.getScheduledStart())
                        .scheduledEnd(b.getScheduledEnd())
                        .createdAt(b.getCreatedAt())
                        .customerNote(b.getCustomerNote())
                        .build();
                })
                .collect(Collectors.toList());
    }

    public Booking getBookingDetail(Long bookingId, Long customerId) {
        return bookingRepository
                .findByIdAndCustomerId(bookingId, customerId)
                .orElseThrow(() -> new RuntimeException(
                        "Không tìm thấy đơn hàng hoặc bạn không có quyền xem đơn này"
                ));
    }
}