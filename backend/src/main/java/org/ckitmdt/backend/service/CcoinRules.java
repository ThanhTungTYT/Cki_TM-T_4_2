
package org.ckitmdt.backend.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class CcoinRules {

    public static final int MIN_REDEEM = 1000;

    private CcoinRules() {
    }

    public static int earned(BigDecimal total) {
        return earned(total, BigDecimal.valueOf(1000), 1);
    }

    public static int earned(
            BigDecimal total,
            BigDecimal earnAmountStep,
            Integer earnPoints
    ) {
        if (total == null || total.signum() <= 0) {
            return 0;
        }

        if (earnAmountStep == null || earnAmountStep.signum() <= 0) {
            throw new IllegalArgumentException(
                    "Mức tiền tích điểm phải lớn hơn 0."
            );
        }

        if (earnPoints == null || earnPoints <= 0) {
            throw new IllegalArgumentException(
                    "Số điểm tích được phải lớn hơn 0."
            );
        }

        BigDecimal steps = total.divideToIntegralValue(earnAmountStep);

        return steps.multiply(BigDecimal.valueOf(earnPoints))
                .min(BigDecimal.valueOf(Integer.MAX_VALUE))
                .intValue();
    }

    /**
     * Quy tắc tương thích cũ:
     * - Tối thiểu 1.000 Ccoin.
     * - Số điểm phải theo bậc 1.000.
     * - Số điểm được dùng không vượt quá giá trị đơn hàng theo bậc 1.000.
     */
    public static int discountPoints(
            int requested,
            BigDecimal availableAmount
    ) {
        if (requested < MIN_REDEEM) {
            throw new IllegalArgumentException(
                    "Cần ít nhất 1.000 Ccoin để sử dụng giảm giá."
            );
        }

        if (requested % 1000 != 0) {
            throw new IllegalArgumentException(
                    "Số điểm sử dụng phải theo bậc 1.000 Ccoin."
            );
        }

        if (availableAmount == null || availableAmount.signum() < 0) {
            availableAmount = BigDecimal.ZERO;
        }

        int limit = availableAmount
                .divideToIntegralValue(BigDecimal.valueOf(1000))
                .multiply(BigDecimal.valueOf(1000))
                .min(BigDecimal.valueOf(Integer.MAX_VALUE))
                .intValue();

        if (limit < MIN_REDEEM) {
            throw new IllegalArgumentException(
                    "Giá trị đơn hàng không đủ để đổi điểm."
            );
        }

        return Math.min(requested, limit);
    }

    /**
     * Quy tắc đổi điểm theo chính sách Admin.
     * pointValue là số tiền giảm tương ứng với 1 Ccoin.
     */
    public static int discountPoints(
            int requested,
            BigDecimal availableAmount,
            BigDecimal pointValue,
            BigDecimal maxRedeemPercent,
            Integer maxRedeemPoints,
            Integer minRedeemPoints
    ) {
        if (requested <= 0) {
            throw new IllegalArgumentException(
                    "Số điểm sử dụng phải lớn hơn 0."
            );
        }

        if (availableAmount == null || availableAmount.signum() <= 0) {
            throw new IllegalArgumentException(
                    "Đơn hàng không đủ giá trị để đổi điểm."
            );
        }

        if (pointValue == null || pointValue.signum() <= 0) {
            throw new IllegalArgumentException(
                    "Giá trị quy đổi mỗi điểm phải lớn hơn 0."
            );
        }

        if (maxRedeemPercent == null
                || maxRedeemPercent.signum() < 0
                || maxRedeemPercent.compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new IllegalArgumentException(
                    "Tỷ lệ đổi điểm phải nằm trong khoảng 0 đến 100%."
            );
        }

        int minimum = minRedeemPoints == null
                ? MIN_REDEEM
                : minRedeemPoints;

        int maximum = maxRedeemPoints == null
                ? Integer.MAX_VALUE
                : maxRedeemPoints;

        if (minimum < 0 || maximum < minimum) {
            throw new IllegalArgumentException(
                    "Giới hạn đổi điểm không hợp lệ."
            );
        }

        if (requested < minimum) {
            throw new IllegalArgumentException(
                    "Cần ít nhất " + minimum
                            + " Ccoin để sử dụng giảm giá."
            );
        }

        if (requested > maximum) {
            throw new IllegalArgumentException(
                    "Mỗi đơn hàng chỉ được sử dụng tối đa "
                            + maximum + " Ccoin."
            );
        }

        BigDecimal maxDiscountAmount = availableAmount
                .multiply(maxRedeemPercent)
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.DOWN);

        int pointsAllowedByAmount = maxDiscountAmount
                .divideToIntegralValue(pointValue)
                .min(BigDecimal.valueOf(Integer.MAX_VALUE))
                .intValue();

        if (requested > pointsAllowedByAmount) {
            throw new IllegalArgumentException(
                    "Số điểm sử dụng vượt giới hạn giảm giá của đơn hàng. "
                            + "Tối đa có thể sử dụng "
                            + pointsAllowedByAmount + " Ccoin."
            );
        }

        return requested;
    }

    public static BigDecimal pointsToMoney(
            int points,
            BigDecimal pointValue
    ) {
        if (points < 0) {
            throw new IllegalArgumentException(
                    "Số điểm không hợp lệ."
            );
        }

        if (pointValue == null || pointValue.signum() <= 0) {
            throw new IllegalArgumentException(
                    "Giá trị quy đổi mỗi điểm không hợp lệ."
            );
        }

        return pointValue.multiply(BigDecimal.valueOf(points))
                .setScale(2, RoundingMode.HALF_UP);
    }
}