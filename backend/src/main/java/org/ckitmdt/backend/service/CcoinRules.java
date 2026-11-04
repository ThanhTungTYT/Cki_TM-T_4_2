package org.ckitmdt.backend.service;

import java.math.BigDecimal;

public final class CcoinRules {
    public static final int MIN_REDEEM = 1000;
    private CcoinRules() {}

    public static int earned(BigDecimal total) {
        if (total == null || total.signum() <= 0) return 0;
        return total.divideToIntegralValue(BigDecimal.valueOf(1000)).intValueExact();
    }

    public static int discountPoints(int requested, BigDecimal availableAmount) {
        if (requested < MIN_REDEEM) {
            throw new IllegalArgumentException("Cần ít nhất 1.000 Ccoin để sử dụng giảm giá.");
        }
        int limit = availableAmount.max(BigDecimal.ZERO)
                .min(BigDecimal.valueOf(Integer.MAX_VALUE)).intValue();
        return Math.min(requested, limit);
    }
}
