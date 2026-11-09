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

    // Phân công công việc cụ thể
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assignment_id", nullable = false)
    private BookingAssignment assignment;

    // Đơn hàng liên quan
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    // Cleaner tạo nhật ký
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cleaner_id", nullable = false)
    private User cleaner;

    // PROGRESS hoặc INCIDENT
    @Column(nullable = false, length = 30)
    private String logType;

    // Nội dung ghi chú
    @Column(nullable = false, columnDefinition = "TEXT")
    private String note;

    // Danh sách đường dẫn ảnh minh chứng
    @Column(name = "image_urls", columnDefinition = "TEXT")
    private String imageUrls;

    // Thời điểm tạo nhật ký
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}