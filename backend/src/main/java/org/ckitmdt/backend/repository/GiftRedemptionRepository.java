package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.GiftRedemption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;

public interface GiftRedemptionRepository extends JpaRepository<GiftRedemption, Long> {
    Optional<GiftRedemption> findByUser_IdAndRequestKey(Long userId, String requestKey);
    List<GiftRedemption> findByUser_IdOrderByCreatedAtDesc(Long userId);

    @EntityGraph(attributePaths = "user")
    List<GiftRedemption> findAllByOrderByCreatedAtDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT redemption FROM GiftRedemption redemption JOIN FETCH redemption.user WHERE redemption.id = :id")
    Optional<GiftRedemption> findByIdForUpdate(@Param("id") Long id);
}
