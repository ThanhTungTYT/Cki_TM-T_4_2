package org.ckitmdt.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.repository.BookingRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class BookingRewardLifecycleScheduler {
    private final BookingRepository bookingRepository;
    private final BookingRewardLifecycleService lifecycleService;

    @Scheduled(fixedDelay = 60000)
    public void processRewardLifecycle() {
        // Chỉ quét các đơn có cập nhật trong 14 ngày gần nhất để tránh khóa toàn bảng lịch sử mỗi phút
        LocalDateTime lookback = LocalDateTime.now().minusDays(14);
        List<Booking> bookings = bookingRepository.findByStatusInAndUpdatedAtGreaterThanEqual(
                List.of("COMPLETED", "CANCELLED", "REJECTED", "EXPIRED"),
                lookback
        );

        for (Booking booking : bookings) {
            try {
                lifecycleService.processBooking(booking.getId());
            } catch (Exception exception) {
                log.error(
                        "Không thể xử lý điểm thưởng cho booking {}: {}",
                        booking.getId(),
                        exception.getMessage(),
                        exception
                );
            }
        }
    }
}