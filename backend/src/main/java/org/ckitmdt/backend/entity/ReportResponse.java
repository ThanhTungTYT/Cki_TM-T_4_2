
package org.ckitmdt.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "report_responses",
        indexes = {
                @Index(name = "idx_report_responses_ticket_created", columnList = "report_ticket_id, created_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReportResponse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "report_ticket_id", nullable = false)
    private ReportTicket report;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "responder_id", nullable = false)
    private User responder;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "attachment_url", length = 1000)
    private String attachmentUrl;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
