package org.ckitmdt.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "admin_staff_assignments", indexes = {
        @Index(name = "idx_admin_assignment_ticket_active", columnList = "ticket_id, active"),
        @Index(name = "idx_admin_assignment_staff_active", columnList = "staff_id, active")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminStaffAssignment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id", nullable = false)
    private ReportTicket ticket;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "staff_id", nullable = false)
    private User staff;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by", nullable = false)
    private User assignedBy;

    @Column(nullable = false, length = 2000)
    private String reason;

    @Column(name = "due_at")
    private LocalDateTime dueAt;

    @Column(name = "idempotency_key", unique = true, length = 100)
    private String idempotencyKey;

    @Builder.Default
    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "assigned_at", nullable = false)
    private LocalDateTime assignedAt;

    @PrePersist
    void onCreate() {
        if (assignedAt == null) assignedAt = LocalDateTime.now();
        if (active == null) active = true;
    }
}