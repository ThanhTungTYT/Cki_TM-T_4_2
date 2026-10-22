package org.ckitmdt.backend.service;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class BookingPaymentService {

    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;

    private static final Set<String> INVALID_STATUSES =
            Set.of("CANCELLED", "EXPIRED", "REJECTED");

    private User getUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new IllegalArgumentException("User not found")
                );
    }

    public Booking getBookingForPayment(
            Long bookingId,
            String email
    ) {
        User user = getUser(email);
        Booking booking = bookingRepository
                .findByIdForUpdate(bookingId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Booking not found")
                );

        if (!booking.getCustomer().getId().equals(user.getId())) {
            throw new SecurityException("Access denied");
        }

        if (booking.getStatus() == null ||
                INVALID_STATUSES.contains(booking.getStatus())) {
            throw new IllegalStateException(
                    "Booking cannot be paid"
            );
        }

        if ("HELD".equals(booking.getStatus())
                && booking.getHoldExpiresAt() != null
                && LocalDateTime.now()
                .isAfter(booking.getHoldExpiresAt())) {
            throw new IllegalStateException(
                    "Booking reservation expired"
            );
        }

        BigDecimal amount = booking.getTotalAmount();

        if (amount == null ||
                amount.signum() <= 0 ||
                amount.stripTrailingZeros().scale() > 0) {
            throw new IllegalArgumentException(
                    "Invalid booking amount"
            );
        }

        return booking;
    }

    public void assertCanView(
            Long bookingId,
            String email
    ) {
        User user = getUser(email);

        bookingRepository
                .findByIdAndCustomerId(bookingId, user.getId())
                .orElseThrow(() ->
                        new SecurityException(
                                "Booking not found or access denied"
                        )
                );
    }
}