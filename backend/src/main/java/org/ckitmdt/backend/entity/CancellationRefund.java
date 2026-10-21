
package org.ckitmdt.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "cancellation_refunds")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CancellationRefund {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Đơn đặt dịch vụ cần hủy hoặc hoàn tiền
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    // Người gửi yêu cầu
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by", nullable = false)
    private User requestedBy;

    // Số tiền khách yêu cầu hoàn
    @Column(name = "requested_amount", precision = 12, scale = 2)
    private BigDecimal requestedAmount;

    // Số tiền được duyệt hoàn
    @Column(name = "approved_amount", precision = 12, scale = 2)
    private BigDecimal approvedAmount;

    // PENDING_REVIEW, APPROVED, REJECTED
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "PENDING_REVIEW";

    // Lý do khách yêu cầu hủy/hoàn tiền
    @Column(name = "cancellation_reason", columnDefinition = "TEXT")
    private String cancellationReason;

    // Ghi chú của Admin/Staff khi xử lý
    @Column(name = "decision_note", columnDefinition = "TEXT")
    private String decisionNote;

    // Email của người xử lý yêu cầu
    @Column(name = "reviewed_by", length = 255)
    private String reviewedBy;

    // Thời điểm gửi yêu cầu
    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;

    // Thời điểm Admin/Staff xử lý
    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @PrePersist
    protected void onCreate() {
        if (requestedAt == null) {
            requestedAt = LocalDateTime.now();
        }

        if (status == null || status.trim().isEmpty()) {
            status = "PENDING_REVIEW";
        }
    }
}
