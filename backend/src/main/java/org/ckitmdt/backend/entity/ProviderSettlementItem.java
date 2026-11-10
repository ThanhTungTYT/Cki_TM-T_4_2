
package org.ckitmdt.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "provider_settlement_items", uniqueConstraints = {
        @UniqueConstraint(name = "uk_provider_settlement_booking", columnNames = "booking_id")
}, indexes = {
        @Index(name = "idx_provider_settlement_item_settlement", columnList = "settlement_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProviderSettlementItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "settlement_id", nullable = false)
    private ProviderSettlement settlement;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false, unique = true)
    private Booking booking;

    @Column(name = "service_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal serviceAmount;

    @Column(name = "booking_completed_at")
    private LocalDateTime bookingCompletedAt;
}
