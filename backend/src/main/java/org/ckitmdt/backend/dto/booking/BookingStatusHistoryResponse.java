package org.ckitmdt.backend.dto.booking;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingStatusHistoryResponse {

    private Long id;
    private String oldStatus;
    private String newStatus;
    private Long changedById;
    private String changedByName;
    private String note;
    private LocalDateTime createdAt;
}
