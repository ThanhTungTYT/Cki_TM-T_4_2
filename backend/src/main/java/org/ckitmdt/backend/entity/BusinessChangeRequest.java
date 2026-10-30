package org.ckitmdt.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "business_change_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BusinessChangeRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "partner_id", nullable = false)
    private Partner partner;

    @Column(name = "request_type", nullable = false, length = 50)
    private String requestType; // LOCATION_UPDATE, PROFILE_UPDATE, SERVICE_UPDATE, SERVICE_REGISTER, SERVICE_PAUSE, SERVICE_RETIRE

    @Builder.Default
    @Column(nullable = false, length = 30)
    private String status = "PENDING_REVIEW"; // PENDING_REVIEW, APPROVED, REJECTED, WITHDRAWN, NEEDS_INFORMATION

    @Column(name = "target_id")
    private Long targetId;

    @Column(name = "target_name")
    private String targetName;

    @Column(name = "old_snapshot", columnDefinition = "TEXT")
    private String oldSnapshot;

    @Column(name = "proposed_snapshot", columnDefinition = "TEXT")
    private String proposedSnapshot;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(name = "evidence_url", length = 1000)
    private String evidenceUrl;

    @Column(name = "reject_reason", columnDefinition = "TEXT")
    private String rejectReason;

    @Column(name = "submitted_by", length = 150)
    private String submittedBy;

    @Column(name = "reviewed_by", length = 150)
    private String reviewedBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        updatedAt = LocalDateTime.now();
        if (status == null || status.isBlank()) {
            status = "PENDING_REVIEW";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
