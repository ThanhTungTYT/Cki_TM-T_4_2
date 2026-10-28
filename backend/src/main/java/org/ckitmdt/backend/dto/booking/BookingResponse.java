package org.ckitmdt.backend.dto.booking;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingResponse {

    private Long id;
    private String bookingCode;
    private Long customerId;
    private String customerName;
    private String customerPhone;

    private Long partnerId;
    private String partnerName;

    private Long addressId;
    private String receiverName;
    private String receiverPhone;
    private String fullAddress;
    private BigDecimal latitude;
    private BigDecimal longitude;

    private LocalDateTime scheduledStart;
    private LocalDateTime scheduledEnd;

    private BigDecimal subtotal;
    private BigDecimal discountAmount;
    private BigDecimal totalAmount;

    private String status;
    private String paymentMethod;
    private String paymentStatus;
    private String customerNote;
    private String cancelReason;

    private LocalDateTime holdExpiresAt;
    private Long version;

    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
    private LocalDateTime cancelledAt;

    private List<BookingItemResponse> items;
    private List<BookingStatusHistoryResponse> statusHistory;
}
