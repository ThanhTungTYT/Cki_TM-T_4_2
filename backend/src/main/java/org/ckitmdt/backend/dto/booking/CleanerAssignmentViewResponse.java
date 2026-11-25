package org.ckitmdt.backend.dto.booking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CleanerAssignmentViewResponse {

    private Long assignmentId;

    private String assignmentStatus;

    private LocalDateTime assignedAt;

    private LocalDateTime acceptedAt;

    private LocalDateTime startedAt;

    private LocalDateTime completedAt;

    private String assignmentNote;

    private Long employeeId;

    private String employeeName;

    private String employeeCode;

    private String employeePhone;

    private boolean hasFinalReport;

    private String latestOvertimeStatus;

    private CleanerBookingViewResponse booking;
}