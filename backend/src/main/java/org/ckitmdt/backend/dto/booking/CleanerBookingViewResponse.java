package org.ckitmdt.backend.dto.booking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CleanerBookingViewResponse {

    private Long id;

    private String bookingCode;

    private String customerName;

    private String customerPhone;

    private String partnerName;

    private Long addressId;

    private String receiverName;

    private String receiverPhone;

    private String fullAddress;

    private LocalDateTime scheduledStart;

    private LocalDateTime scheduledEnd;

    private String status;

    private String customerNote;

    private Long version;

    private LocalDateTime createdAt;

    private LocalDateTime completedAt;

    private List<CleanerBookingItemViewResponse> items;
}