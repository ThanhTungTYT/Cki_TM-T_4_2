package org.ckitmdt.backend.dto.booking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingHistoryResponseDto {
    private Long id;
    private String bookingCode;
    private String partnerName;
    private String addressDetail;
    private BigDecimal totalAmount;
    private String status;
    private LocalDateTime scheduledStart;
    private LocalDateTime scheduledEnd;
    private LocalDateTime createdAt;
    private String customerNote;
}