package org.ckitmdt.backend.service;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

class CcoinRulesTest {
    @Test void earnsWholeCoinsFromFinalTotal() {
        assertEquals(125, CcoinRules.earned(new BigDecimal("125999.99")));
        assertEquals(0, CcoinRules.earned(new BigDecimal("999")));
        assertEquals(0, CcoinRules.earned(null));
    }
    @Test void convertsOneCoinToOneDongInThousandCoinSteps() {
        assertEquals(3000, CcoinRules.discountPoints(3000, new BigDecimal("40000")));
        assertEquals(2000, CcoinRules.discountPoints(5000, new BigDecimal("2999")));
    }
    @Test void rejectsBelowMinimumAndPartialSteps() {
        assertThrows(IllegalArgumentException.class, () -> CcoinRules.discountPoints(999, new BigDecimal("10000")));
        assertThrows(IllegalArgumentException.class, () -> CcoinRules.discountPoints(1500, new BigDecimal("10000")));
        assertThrows(IllegalArgumentException.class, () -> CcoinRules.discountPoints(1000, new BigDecimal("999")));
    }
}
