package org.ckitmdt.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.ckitmdt.backend.entity.*;
import org.ckitmdt.backend.repository.*;
import java.math.BigDecimal;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class BookingRewardLifecycleServiceTest {
    private final BookingRepository bookings = mock(BookingRepository.class);
    private final PaymentRepository payments = mock(PaymentRepository.class);
    private final RewardAccountRepository accounts = mock(RewardAccountRepository.class);
    private final RewardTransactionRepository transactions = mock(RewardTransactionRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final BookingRewardLifecycleService service = new BookingRewardLifecycleService(bookings, payments,
            mock(RewardPolicyRepository.class), accounts, transactions, mock(BookingPromotionRepository.class), mock(PromotionRepository.class), users);
    private RewardAccount wallet;
    private Booking booking;

    @BeforeEach void setup() {
        User user = User.builder().id(7L).role("CUSTOMER").build();
        booking = Booking.builder().id(1L).customer(user).bookingCode("TEST").status("COMPLETED").totalAmount(new BigDecimal("125999")).build();
        wallet = RewardAccount.builder().balance(100).totalEarned(100).totalRedeemed(0).build();
        when(bookings.findByIdForUpdate(1L)).thenReturn(Optional.of(booking));
        when(users.findByIdForUpdate(7L)).thenReturn(Optional.of(user));
        when(accounts.findByUserIdForUpdate(7L)).thenReturn(Optional.of(wallet));
    }
    @Test void completedAndPaidEarnsOnceEvenWithoutPolicy() {
        when(payments.existsByBooking_IdAndStatus(1L, "SUCCESS")).thenReturn(true);
        when(transactions.existsByEventKey("BOOKING_EARN_1")).thenReturn(false, true);
        service.processBooking(1L);
        service.processBooking(1L);
        assertEquals(225, wallet.getBalance());
        verify(transactions, times(1)).save(argThat(t -> t.getPoints() == 125 && "EARN".equals(t.getType())));
    }
    @Test void completedButUnpaidDoesNotEarn() {
        service.processBooking(1L);
        verify(transactions, never()).save(any());
        assertEquals(100, wallet.getBalance());
    }
    @Test void paidButNotCompletedDoesNotEarn() {
        booking.setStatus("PENDING_COMPLETION");
        service.processBooking(1L);
        verify(transactions, never()).save(any());
    }
}
