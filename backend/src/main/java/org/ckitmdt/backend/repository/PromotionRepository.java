package org.ckitmdt.backend.repository;

import jakarta.persistence.LockModeType;
import org.ckitmdt.backend.entity.Promotion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

public interface PromotionRepository extends JpaRepository<Promotion, Long> {
    Optional<Promotion> findByCodeIgnoreCase(String code);
    boolean existsByCodeIgnoreCase(String code);
    List<Promotion> findAllByOrderByCreatedAtDesc();

    @Query("SELECT p FROM Promotion p WHERE UPPER(p.status) = 'ACTIVE' "
            + "AND p.startAt <= :now AND p.endAt >= :now "
            + "AND (p.usageLimit IS NULL OR COALESCE(p.usageCount, 0) < p.usageLimit) "
            + "ORDER BY p.endAt ASC")
    List<Promotion> findCurrentlyAvailable(@Param("now") LocalDateTime now);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Promotion p WHERE p.id = :id")
    Optional<Promotion> findByIdForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Promotion p WHERE UPPER(p.code) = UPPER(:code)")
    Optional<Promotion> findByCodeForUpdate(@Param("code") String code);
}
