
package org.ckitmdt.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "cleaner_work_logs",
        indexes = {
                @Index(
                        name = "idx_cleaner_work_logs_assignment",
                        columnList = "assignment_id, created_at"
                ),
                @Index(
                        name = "idx_cleaner_work_logs_booking",
                        columnList = "booking_id"
                ),
                @Index(
                        name = "idx_cleaner_work_logs_type_status",
                        columnList = "log_type, incident_status"
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CleanerWorkLog {

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
    @JoinColumn(name = "cleaner_id", nullable = false)
    private User cleaner;

    /**
     * PROGRESS hoặc INCIDENT.
     */
    @Column(nullable = false, length = 30)
    private String logType;

    /**
     * Nội dung nhật ký hoặc mô tả sự cố.
     */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String note;

    /**
     * Danh sách URL ảnh minh chứng, mỗi URL một dòng.
     */
    @Column(name = "image_urls", columnDefinition = "TEXT")
    private String imageUrls;

    /**
     * Mức độ sự cố:
     * LOW, MEDIUM, HIGH, CRITICAL.
     *
     * Chỉ sử dụng khi logType = INCIDENT.
     */
    @Column(name = "incident_severity", length = 20)
    private String incidentSeverity;

    /**
     * Nhóm sự cố:
     * PROPERTY_DAMAGE, MISSING_EQUIPMENT, SAFETY,
     * CUSTOMER_ISSUE, OTHER.
     */
    @Column(name = "incident_category", length = 40)
    private String incidentCategory;

    /**
     * Trạng thái xử lý:
     * OPEN, IN_PROGRESS, RESOLVED, REJECTED.
     */
    @Column(name = "incident_status", length = 20)
    private String incidentStatus;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }

        if ("INCIDENT".equalsIgnoreCase(logType)) {
            if (incidentSeverity == null || incidentSeverity.isBlank()) {
                incidentSeverity = "MEDIUM";
            }

            if (incidentCategory == null || incidentCategory.isBlank()) {
                incidentCategory = "OTHER";
            }

            if (incidentStatus == null || incidentStatus.isBlank()) {
                incidentStatus = "OPEN";
            }
        }
    }
}
