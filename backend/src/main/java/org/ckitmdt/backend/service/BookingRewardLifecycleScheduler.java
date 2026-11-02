package org.ckitmdt.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.repository.BookingRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class BookingRewardLifecycleScheduler {
    private final BookingRepository bookingRepository;
    private final BookingRewardLifecycleService lifecycleService;

    @Scheduled(fixedDelay = 60000)
    public void processRewardLifecycle() {
        List<Booking> bookings = bookingRepository.findByStatusIn(
                List.of("COMPLETED", "CANCELLED", "REJECTED", "EXPIRED")
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