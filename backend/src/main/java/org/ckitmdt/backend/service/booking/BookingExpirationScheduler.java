package org.ckitmdt.backend.service.booking;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.ckitmdt.backend.dto.booking.BookingStatusEnum;
import org.ckitmdt.backend.repository.BookingRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class BookingExpirationScheduler {

    private final BookingRepository bookingRepository;
    private final BookingStateEngine bookingStateEngine;

    @Scheduled(fixedDelay = 60_000)
    public void expireUnpaidBookings() {
        bookingRepository.findByStatusAndHoldExpiresAtBefore(
                        BookingStatusEnum.PENDING_PAYMENT.name(), LocalDateTime.now())
                .forEach(booking -> {
                    try {
                        bookingStateEngine.expirePendingPayment(booking.getId());
                    } catch (Exception ex) {
                        log.error("Lỗi tự động hết hạn PENDING_PAYMENT cho bookingId={}", booking.getId(), ex);
                    }
                });
    }

    @Scheduled(fixedDelay = 60_000)
    public void expirePendingProviderBookings() {
        LocalDateTime now = LocalDateTime.now();
        String pendingProvider = BookingStatusEnum.PENDING_PROVIDER.name();
        Set<Long> expiredBookingIds = new LinkedHashSet<>();

        bookingRepository.findByStatusAndProviderDeadlineAtBefore(pendingProvider, now)
                .forEach(booking -> expiredBookingIds.add(booking.getId()));
        bookingRepository.findByStatusAndProviderDeadlineAtIsNull(pendingProvider)
                .forEach(booking -> expiredBookingIds.add(booking.getId()));
        bookingRepository.findByStatusAndScheduledStartBefore(pendingProvider, now)
                .forEach(booking -> expiredBookingIds.add(booking.getId()));

        expiredBookingIds.forEach(bookingId -> {
            try {
                bookingStateEngine.expirePendingProvider(bookingId);
            } catch (Exception ex) {
                log.error("Lỗi tự động hết hạn PENDING_PROVIDER cho bookingId={}", bookingId, ex);
            }
        });
    }
}
