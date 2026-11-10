package org.ckitmdt.backend.dto.booking;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class BookingRefundSummaryResponse {
    private Long id;
    private BigDecimal requestedAmount;
    private BigDecimal approvedAmount;
    private String status;
    private LocalDateTime requestedAt;
    private LocalDateTime reviewedAt;
    private LocalDateTime transferredAt;
}
