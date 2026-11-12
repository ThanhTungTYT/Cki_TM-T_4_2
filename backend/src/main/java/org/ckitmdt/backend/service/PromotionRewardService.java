
package org.ckitmdt.backend.service;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.*;
import org.ckitmdt.backend.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PromotionRewardService {

    private final PromotionRepository promotionRepository;
    private final PromotionServiceRepository promotionServiceRepository;
    private final BookingPromotionRepository bookingPromotionRepository;
    private final RewardAccountRepository rewardAccountRepository;
    private final RewardPolicyRepository rewardPolicyRepository;
    private final RewardTransactionRepository rewardTransactionRepository;
    private final RewardExpiryService rewardExpiryService;
    private final RewardRedemptionRepository rewardRedemptionRepository;

    public Pricing calculate(
            Long userId,
            BigDecimal subtotal,
            Map<Long, BigDecimal> serviceSubtotals,
            String voucherCode,
            Integer requestedPoints,
            boolean lockForUpdate
    ) {
        BigDecimal discount = BigDecimal.ZERO;
        BigDecimal pointsDiscount = BigDecimal.ZERO;

        Promotion promotion = null;
        RewardRedemption voucher = null;
        RewardAccount account = null;
        RewardPolicy policy = null;

        int pointsUsed = 0;
        int balance = 0;

        LocalDateTime now = LocalDateTime.now();
        int requested = requestedPoints == null ? 0 : requestedPoints;

        if (subtotal == null || subtotal.signum() < 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Giá trị đơn hàng không hợp lệ."
            );
        }

        if (requested < 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Số điểm sử dụng không hợp lệ."
            );
        }

        if (requested == 0) {
            account = rewardAccountRepository
                    .findByUser_Id(userId)
                    .orElse(null);

            balance = account == null
                    ? 0
                    : zero(account.getBalance());
        }

        if (voucherCode != null && !voucherCode.isBlank()) {
            String code = voucherCode.trim().toUpperCase();

            promotion = lockForUpdate
                    ? promotionRepository.findByCodeForUpdate(code).orElse(null)
                    : promotionRepository.findByCodeIgnoreCase(code).orElse(null);

            if (promotion == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Mã khuyến mãi không tồn tại."
                );
            }

            if (!"ACTIVE".equalsIgnoreCase(promotion.getStatus())) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Mã khuyến mãi hiện không hoạt động."
                );
            }

            if (promotion.getStartAt() == null
                    || promotion.getEndAt() == null
                    || now.isBefore(promotion.getStartAt())
                    || now.isAfter(promotion.getEndAt())) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Mã khuyến mãi chưa đến thời gian áp dụng hoặc đã hết hạn."
                );
            }

            if (promotion.getUsageLimit() != null
                    && zero(promotion.getUsageCount()) >= promotion.getUsageLimit()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Mã khuyến mãi đã hết lượt sử dụng."
                );
            }

            BigDecimal minimum = promotion.getMinBookingValue() == null
                    ? BigDecimal.ZERO
                    : promotion.getMinBookingValue();

            if (subtotal.compareTo(minimum) < 0) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Đơn hàng chưa đạt giá trị tối thiểu để sử dụng mã này."
                );
            }

            Set<Long> allowedServiceIds = promotionServiceRepository
                    .findByPromotion_Id(promotion.getId())
                    .stream()
                    .map(link -> link.getService().getId())
                    .collect(Collectors.toSet());

            BigDecimal eligibleSubtotal = subtotal;

            if (!allowedServiceIds.isEmpty()) {
                eligibleSubtotal = serviceSubtotals.entrySet()
                        .stream()
                        .filter(entry -> allowedServiceIds.contains(entry.getKey()))
                        .map(Map.Entry::getValue)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);

                if (eligibleSubtotal.signum() <= 0) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Mã khuyến mãi không áp dụng cho dịch vụ trong đơn hàng."
                    );
                }
            }

            String discountType = promotion.getDiscountType() == null
                    ? ""
                    : promotion.getDiscountType().toUpperCase();

            BigDecimal discountValue = promotion.getDiscountValue() == null
                    ? BigDecimal.ZERO
                    : promotion.getDiscountValue();

            if ("PERCENT".equals(discountType)) {
                discount = eligibleSubtotal
                        .multiply(discountValue)
                        .divide(
                                BigDecimal.valueOf(100),
                                2,
                                RoundingMode.HALF_UP
                        );
            } else if ("FIXED".equals(discountType)) {
                discount = discountValue.min(eligibleSubtotal);
            } else {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Loại giảm giá của mã khuyến mãi không hợp lệ."
                );
            }

            if (promotion.getMaxDiscount() != null
                    && promotion.getMaxDiscount().signum() >= 0) {
                discount = discount.min(promotion.getMaxDiscount());
            }

            discount = discount.min(eligibleSubtotal);
        }

        /*
         * Voucher được kiểm tra độc lập với việc đổi Ccoin.
         * Không chuyển khối này vào điều kiện requested > 0.
         */
        if (promotion != null
                && rewardRedemptionRepository.existsByPromotion_Id(promotion.getId())) {

            var ownedVouchers = lockForUpdate
                    ? rewardRedemptionRepository
                    .findAvailableByUserAndPromotionForUpdate(
                            userId,
                            promotion.getId()
                    )
                    : rewardRedemptionRepository
                    .findByUser_IdAndPromotion_IdAndStatusOrderByRedeemedAtAsc(
                            userId,
                            promotion.getId(),
                            "AVAILABLE"
                    );

            voucher = ownedVouchers.stream()
                    .filter(item -> item.getExpiresAt() == null
                            || now.isBefore(item.getExpiresAt()))
                    .findFirst()
                    .orElse(null);
        }

        if (requested > 0) {
            policy = rewardPolicyRepository.findById(1L)
                    .orElse(null);

            if (policy == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Chính sách Ccoin chưa được cấu hình."
                );
            }

            if (!Boolean.TRUE.equals(policy.getEnabled())) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Chương trình sử dụng Ccoin hiện đang tạm khóa."
                );
            }

            if (promotion != null
                    && (!Boolean.TRUE.equals(promotion.getCombinableWithPoints())
                    || !Boolean.TRUE.equals(policy.getAllowCombineWithPromotion()))) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Mã khuyến mãi này không được kết hợp với điểm thưởng."
                );
            }

            if (lockForUpdate) {
                rewardExpiryService.processAccount(userId);
            }

            account = (lockForUpdate
                    ? rewardAccountRepository.findByUserIdForUpdate(userId)
                    : rewardAccountRepository.findByUser_Id(userId))
                    .orElse(null);

            if (account == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Bạn chưa có tài khoản điểm thưởng hoặc không có điểm để đổi."
                );
            }

            balance = zero(account.getBalance());

            if (requested > balance) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Số điểm hiện có không đủ để thực hiện đổi điểm."
                );
            }

            BigDecimal amountAfterPromotion = subtotal
                    .subtract(discount)
                    .max(BigDecimal.ZERO);

            try {
                pointsUsed = CcoinRules.discountPoints(
                        requested,
                        amountAfterPromotion,
                        policy.getPointValue(),
                        policy.getMaxRedeemPercent(),
                        policy.getMaxRedeemPoints(),
                        policy.getMinRedeemPoints()
                );

                pointsDiscount = CcoinRules.pointsToMoney(
                        pointsUsed,
                        policy.getPointValue()
                );
            } catch (IllegalArgumentException exception) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        exception.getMessage()
                );
            }
        }

        BigDecimal platformFee = BigDecimal.valueOf(10000);

        BigDecimal total = subtotal
                .subtract(discount)
                .subtract(pointsDiscount)
                .add(platformFee)
                .max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);

        return new Pricing(
                promotion,
                account,
                discount,
                pointsDiscount,
                platformFee,
                total,
                pointsUsed,
                balance,
                voucher
        );
    }

    public void reserve(
            Booking booking,
            User customer,
            Pricing pricing
    ) {
        LocalDateTime now = LocalDateTime.now();

        if (pricing.promotion() != null) {
            Promotion promotion = pricing.promotion();

            int usageCount = zero(promotion.getUsageCount());

            if (promotion.getUsageLimit() != null
                    && usageCount >= promotion.getUsageLimit()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Mã khuyến mãi vừa hết lượt sử dụng. Vui lòng báo giá lại."
                );
            }

            promotion.setUsageCount(usageCount + 1);
            promotionRepository.save(promotion);

            bookingPromotionRepository.save(BookingPromotion.builder()
                    .booking(booking)
                    .promotion(promotion)
                    .discountAmount(pricing.discount())
                    .createdAt(now)
                    .released(false)
                    .build());
        }

        if (pricing.voucher() != null) {
            RewardRedemption voucher = pricing.voucher();

            if (!"AVAILABLE".equalsIgnoreCase(voucher.getStatus())
                    || (voucher.getExpiresAt() != null
                    && !now.isBefore(voucher.getExpiresAt()))
                    || (voucher.getExpiresAt() != null
                    && booking.getHoldExpiresAt() != null
                    && voucher.getExpiresAt().isBefore(booking.getHoldExpiresAt()))) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Voucher vừa được sử dụng, hết hạn hoặc không còn đủ thời gian giữ đơn. Vui lòng báo giá lại."
                );
            }

            voucher.setStatus("HELD");
            voucher.setBooking(booking);
            rewardRedemptionRepository.save(voucher);
        }

        if (pricing.pointsUsed() > 0) {
            RewardAccount account = pricing.account();

            if (account == null
                    || account.getBalance() == null
                    || account.getBalance() < pricing.pointsUsed()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Số dư điểm đã thay đổi. Vui lòng tải lại báo giá."
                );
            }

            String eventKey = "BOOKING_REDEEM_" + booking.getId();

            if (!rewardTransactionRepository.existsByEventKey(eventKey)) {
                account.setBalance(
                        account.getBalance() - pricing.pointsUsed()
                );

                account.setTotalRedeemed(
                        zero(account.getTotalRedeemed()) + pricing.pointsUsed()
                );

                account.setUpdatedAt(now);

                rewardAccountRepository.save(account);

                rewardTransactionRepository.save(RewardTransaction.builder()
                        .rewardAccount(account)
                        .booking(booking)
                        .type("REDEEM")
                        .points(-pricing.pointsUsed())
                        .description(
                                "Đổi điểm khi đặt đơn " + booking.getBookingCode()
                        )
                        .eventKey(eventKey)
                        .createdAt(now)
                        .performedBy(customer)
                        .build());
            }
        }
    }

    private int zero(Integer value) {
        return value == null ? 0 : value;
    }

    public record Pricing(
            Promotion promotion,
            RewardAccount account,
            BigDecimal discount,
            BigDecimal pointsDiscount,
            BigDecimal platformFee,
            BigDecimal total,
            int pointsUsed,
            int rewardBalance,
            RewardRedemption voucher
    ) {
    }
}