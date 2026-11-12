
package org.ckitmdt.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.ckitmdt.backend.entity.*;
import org.ckitmdt.backend.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingRewardLifecycleService {

    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final RewardPolicyRepository rewardPolicyRepository;
    private final RewardAccountRepository rewardAccountRepository;
    private final RewardTransactionRepository rewardTransactionRepository;
    private final BookingPromotionRepository bookingPromotionRepository;
    private final PromotionRepository promotionRepository;
    private final RewardRedemptionRepository rewardRedemptionRepository;
    private final UserRepository userRepository;

    @Transactional
    public void processBooking(Long bookingId) {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElse(null);

        if (booking == null || booking.getStatus() == null) {
            return;
        }

        String status = booking.getStatus().trim().toUpperCase();

        if ("CANCELLED".equals(status)
                || "REJECTED".equals(status)
                || "EXPIRED".equals(status)) {
            refundRedeemedPoints(booking);
            releasePromotionUsage(booking);
            releaseHeldVouchers(booking);
            return;
        }

        if (paymentRepository.existsByBooking_IdAndStatus(
                booking.getId(),
                "SUCCESS"
        )) {
            consumeHeldVouchers(booking);
        }

        if ("COMPLETED".equals(status)) {
            earnPointsIfEligible(booking);
        }
    }

    private void consumeHeldVouchers(Booking booking) {
        List<RewardRedemption> held = rewardRedemptionRepository
                .findByBookingAndStatusForUpdate(
                        booking.getId(),
                        "HELD"
                );

        for (RewardRedemption voucher : held) {
            voucher.setStatus("USED");
            rewardRedemptionRepository.save(voucher);
        }
    }

    private void releaseHeldVouchers(Booking booking) {
        LocalDateTime now = LocalDateTime.now();

        for (String voucherStatus : List.of("HELD", "USED")) {
            List<RewardRedemption> vouchers = rewardRedemptionRepository
                    .findByBookingAndStatusForUpdate(
                            booking.getId(),
                            voucherStatus
                    );

            for (RewardRedemption voucher : vouchers) {
                boolean expired = voucher.getExpiresAt() != null
                        && !now.isBefore(voucher.getExpiresAt());

                if (!expired
                        && voucher.getPromotion() != null
                        && voucher.getPromotion().getEndAt() != null) {
                    expired = !now.isBefore(
                            voucher.getPromotion().getEndAt()
                    );
                }

                voucher.setStatus(expired ? "EXPIRED" : "AVAILABLE");
                voucher.setBooking(null);

                rewardRedemptionRepository.save(voucher);
            }
        }
    }

    private void earnPointsIfEligible(Booking booking) {
        String eventKey = "BOOKING_EARN_" + booking.getId();

        if (rewardTransactionRepository.existsByEventKey(eventKey)) {
            return;
        }

        if (booking.getCustomer() == null) {
            return;
        }

        RewardPolicy policy = rewardPolicyRepository.findById(1L)
                .orElse(null);

        Integer expiryMonths = policy == null
                ? 12
                : policy.getExpiryMonths();

        int earnedPoints;

        try {
            earnedPoints = CcoinRules.earned(booking.getTotalAmount());
        } catch (IllegalArgumentException exception) {
            log.error(
                    "Không thể tính điểm cho booking {}: {}",
                    booking.getBookingCode(),
                    exception.getMessage()
            );
            return;
        }

        if (earnedPoints <= 0) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();

        userRepository.findByIdForUpdate(booking.getCustomer().getId())
                .orElseThrow();

        RewardAccount account = rewardAccountRepository
                .findByUserIdForUpdate(booking.getCustomer().getId())
                .orElseGet(() -> rewardAccountRepository.save(
                        RewardAccount.builder()
                                .user(booking.getCustomer())
                                .balance(0)
                                .totalEarned(0)
                                .totalRedeemed(0)
                                .createdAt(now)
                                .updatedAt(now)
                                .build()
                ));

        long nextBalance = (long) zero(account.getBalance()) + earnedPoints;
        long nextTotalEarned =
                (long) zero(account.getTotalEarned()) + earnedPoints;

        if (nextBalance > Integer.MAX_VALUE
                || nextTotalEarned > Integer.MAX_VALUE) {
            log.error(
                    "Số dư điểm vượt giới hạn cho tài khoản {}.",
                    account.getId()
            );
            return;
        }

        LocalDateTime expiresAt = expiryMonths != null && expiryMonths > 0
                ? now.plusMonths(expiryMonths)
                : null;

        account.setBalance((int) nextBalance);
        account.setTotalEarned((int) nextTotalEarned);
        account.setUpdatedAt(now);

        rewardAccountRepository.save(account);

        rewardTransactionRepository.save(RewardTransaction.builder()
                .rewardAccount(account)
                .booking(booking)
                .type("EARN")
                .points(earnedPoints)
                .description(
                        "Tích điểm từ đơn hàng hoàn thành "
                                + booking.getBookingCode()
                )
                .eventKey(eventKey)
                .createdAt(now)
                .expiresAt(expiresAt)
                .build());

        log.info(
                "Đã cộng {} điểm cho đơn {}.",
                earnedPoints,
                booking.getBookingCode()
        );
    }

    private void refundRedeemedPoints(Booking booking) {
        String eventKey = "BOOKING_REDEEM_REFUND_" + booking.getId();

        if (rewardTransactionRepository.existsByEventKey(eventKey)) {
            return;
        }

        List<RewardTransaction> redemptions =
                rewardTransactionRepository.findByBooking_IdAndType(
                        booking.getId(),
                        "REDEEM"
                );

        long refundLong = redemptions.stream()
                .map(RewardTransaction::getPoints)
                .filter(points -> points != null && points < 0)
                .mapToLong(points -> Math.abs((long) points))
                .sum();

        if (refundLong <= 0 || refundLong > Integer.MAX_VALUE) {
            return;
        }

        if (booking.getCustomer() == null) {
            log.error(
                    "Booking {} không có customer để hoàn điểm.",
                    booking.getId()
            );
            return;
        }

        int pointsToRefund = (int) refundLong;

        RewardAccount account = rewardAccountRepository
                .findByUserIdForUpdate(booking.getCustomer().getId())
                .orElse(null);

        if (account == null) {
            log.error(
                    "Không tìm thấy tài khoản điểm để hoàn điểm cho booking {}.",
                    booking.getId()
            );
            return;
        }

        long nextBalance = (long) zero(account.getBalance())
                + pointsToRefund;

        if (nextBalance > Integer.MAX_VALUE) {
            log.error(
                    "Số dư điểm sau hoàn vượt giới hạn cho booking {}.",
                    booking.getId()
            );
            return;
        }

        LocalDateTime now = LocalDateTime.now();

        RewardPolicy policy = rewardPolicyRepository.findById(1L)
                .orElse(null);

        Integer expiryMonths = policy == null
                ? 12
                : policy.getExpiryMonths();

        LocalDateTime expiresAt = expiryMonths != null && expiryMonths > 0
                ? now.plusMonths(expiryMonths)
                : null;

        account.setBalance((int) nextBalance);
        account.setTotalRedeemed(Math.max(
                0,
                zero(account.getTotalRedeemed()) - pointsToRefund
        ));
        account.setUpdatedAt(now);

        rewardAccountRepository.save(account);

        rewardTransactionRepository.save(RewardTransaction.builder()
                .rewardAccount(account)
                .booking(booking)
                .type("REDEEM_REFUND")
                .points(pointsToRefund)
                .description(
                        "Hoàn điểm do đơn hàng "
                                + booking.getBookingCode()
                                + " bị " + booking.getStatus()
                )
                .eventKey(eventKey)
                .createdAt(now)
                .expiresAt(expiresAt)
                .build());

        log.info(
                "Đã hoàn {} điểm cho đơn {}.",
                pointsToRefund,
                booking.getBookingCode()
        );
    }

    private void releasePromotionUsage(Booking booking) {
        List<BookingPromotion> bookingPromotions =
                bookingPromotionRepository.findByBooking_Id(
                        booking.getId()
                );

        for (BookingPromotion bookingPromotion : bookingPromotions) {
            if (Boolean.TRUE.equals(bookingPromotion.getReleased())) {
                continue;
            }

            if (bookingPromotion.getPromotion() == null) {
                bookingPromotion.setReleased(true);
                bookingPromotionRepository.save(bookingPromotion);
                continue;
            }

            Promotion promotion = promotionRepository
                    .findByIdForUpdate(
                            bookingPromotion.getPromotion().getId()
                    )
                    .orElse(null);

            if (promotion != null) {
                int usageCount = zero(promotion.getUsageCount());

                promotion.setUsageCount(Math.max(0, usageCount - 1));
                promotionRepository.save(promotion);
            }

            bookingPromotion.setReleased(true);
            bookingPromotionRepository.save(bookingPromotion);
        }
    }

    private int zero(Integer value) {
        return value == null ? 0 : value;
    }
}
