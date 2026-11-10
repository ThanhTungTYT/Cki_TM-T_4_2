
package org.ckitmdt.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "provider_settlements", indexes = {
        @Index(name = "idx_provider_settlement_partner_period", columnList = "partner_id, period_start, period_end"),
        @Index(name = "idx_provider_settlement_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProviderSettlement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "partner_id", nullable = false)
    private Partner partner;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Column(name = "booking_count", nullable = false)
    private Integer bookingCount;

    @Column(name = "gross_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal grossAmount;

    @Column(name = "platform_fee_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal platformFeeAmount;

    @Column(name = "refund_deduction_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal refundDeductionAmount;

    @Column(name = "payout_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal payoutAmount;

    @Column(name = "status", nullable = false, length = 30)
    private String status;

    @Column(name = "transfer_reference", length = 150)
    private String transferReference;

    @Column(name = "transfer_evidence_url", length = 1000)
    private String transferEvidenceUrl;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @Column(name = "created_by", nullable = false, length = 255)
    private String createdBy;

    @Column(name = "approved_by", length = 255)
    private String approvedBy;

    @Column(name = "paid_by", length = 255)
    private String paidBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (status == null || status.isBlank()) status = "DRAFT";
    }
}
