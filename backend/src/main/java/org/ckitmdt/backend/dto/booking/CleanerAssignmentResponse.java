
package org.ckitmdt.backend.dto.booking;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CleanerAssignmentResponse {

    private Long assignmentId;

    private String assignmentStatus;

    private LocalDateTime assignedAt;

    private LocalDateTime acceptedAt;

    private LocalDateTime startedAt;

    private LocalDateTime completedAt;

    private String assignmentNote;

    private BookingResponse booking;
}
