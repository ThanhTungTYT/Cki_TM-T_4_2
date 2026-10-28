package org.ckitmdt.backend.service.booking;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.booking.BookingStatusEnum;
import org.ckitmdt.backend.repository.BookingRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class BookingExpirationScheduler {

    private final BookingRepository bookingRepository;
    private final BookingStateEngine bookingStateEngine;

    @Scheduled(fixedDelay = 60_000)
    public void expireUnpaidBookings() {
        bookingRepository.findByStatusAndHoldExpiresAtBefore(
                        BookingStatusEnum.PENDING_PAYMENT.name(), LocalDateTime.now())
                .forEach(booking -> bookingStateEngine.expirePendingPayment(booking.getId()));
    }
}
