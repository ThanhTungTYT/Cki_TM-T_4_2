package org.ckitmdt.backend.dto.booking;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class BookingPaymentSummaryResponse {
    private Long id;
    private String method;
    private String provider;
    private BigDecimal amount;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime paidAt;
}
