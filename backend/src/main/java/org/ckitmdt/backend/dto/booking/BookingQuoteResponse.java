package org.ckitmdt.backend.dto.booking;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingQuoteResponse {

    private Long partnerId;
    private String partnerName;
    private BigDecimal subtotal;
    private BigDecimal discountAmount;
    private BigDecimal platformFee;
    private BigDecimal totalAmount;
    private int estimatedMinutes;
    private LocalDateTime scheduledStart;
    private LocalDateTime scheduledEnd;
    private boolean capacityAvailable;
    private String capacityMessage;
}
