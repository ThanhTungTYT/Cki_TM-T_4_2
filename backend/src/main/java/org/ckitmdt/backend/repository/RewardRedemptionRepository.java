package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.RewardRedemption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.List;

public interface RewardRedemptionRepository extends JpaRepository<RewardRedemption, Long> {
    @EntityGraph(attributePaths = {"promotion", "booking"})
    List<RewardRedemption> findByUser_IdOrderByRedeemedAtDesc(Long userId);

    boolean existsByPromotion_Id(Long promotionId);

    List<RewardRedemption> findByUser_IdAndPromotion_IdAndStatusOrderByRedeemedAtAsc(
            Long userId, Long promotionId, String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT redemption FROM RewardRedemption redemption "
            + "WHERE redemption.user.id = :userId "
            + "AND redemption.promotion.id = :promotionId "
            + "AND redemption.status = 'AVAILABLE' "
            + "ORDER BY redemption.redeemedAt ASC")
    List<RewardRedemption> findAvailableByUserAndPromotionForUpdate(
            @Param("userId") Long userId, @Param("promotionId") Long promotionId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT redemption FROM RewardRedemption redemption "
            + "WHERE redemption.booking.id = :bookingId AND redemption.status = :status")
    List<RewardRedemption> findByBookingAndStatusForUpdate(
            @Param("bookingId") Long bookingId, @Param("status") String status);
}
