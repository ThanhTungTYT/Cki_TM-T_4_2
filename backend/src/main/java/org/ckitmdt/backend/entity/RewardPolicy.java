
package org.ckitmdt.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "reward_policies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RewardPolicy {
    @Id
    private Long id;

    @Column(name = "earn_amount_step", nullable = false, precision = 15, scale = 2)
    private BigDecimal earnAmountStep;

    @Column(name = "earn_points", nullable = false)
    private Integer earnPoints;

    @Column(name = "point_value", nullable = false, precision = 15, scale = 2)
    private BigDecimal pointValue;

    @Column(name = "max_redeem_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal maxRedeemPercent;

    @Column(name = "min_redeem_points", nullable = false)
    private Integer minRedeemPoints;

    @Column(name = "max_redeem_points", nullable = false)
    private Integer maxRedeemPoints;

    @Column(name = "expiry_months", nullable = false)
    private Integer expiryMonths;

    @Column(nullable = false)
    private Boolean enabled;

    @Column(name = "allow_combine_with_promotion", nullable = false)
    private Boolean allowCombineWithPromotion;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "updated_by")
    private Long updatedBy;
}
