
package org.ckitmdt.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "cleaner_overtime_requests",
        indexes = {
                @Index(
                        name = "idx_overtime_assignment_created",
                        columnList = "assignment_id, created_at"
                ),
                @Index(
                        name = "idx_overtime_partner_status",
                        columnList = "partner_id, status"
                ),
                @Index(
                        name = "idx_overtime_cleaner_status",
                        columnList = "cleaner_id, status"
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CleanerOvertimeRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assignment_id", nullable = false)
    private BookingAssignment assignment;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "partner_id", nullable = false)
    private Partner partner;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cleaner_id", nullable = false)
    private User cleaner;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(name = "requested_additional_minutes", nullable = false)
    private Integer requestedAdditionalMinutes;

    @Column(name = "original_scheduled_end")
    private LocalDateTime originalScheduledEnd;

    @Column(name = "status", nullable = false, length = 30)
    private String status;

    @Column(name = "provider_note", columnDefinition = "TEXT")
    private String providerNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }

        if (status == null || status.isBlank()) {
            status = "PENDING";
        }
    }
}
