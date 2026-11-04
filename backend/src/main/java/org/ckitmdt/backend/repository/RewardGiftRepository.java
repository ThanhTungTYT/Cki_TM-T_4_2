package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.RewardGift;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;

public interface RewardGiftRepository extends JpaRepository<RewardGift, Long> {
    List<RewardGift> findByActiveTrueOrderByPointsCostAscIdAsc();
    boolean existsByCode(String code);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from RewardGift g where g.id = :id")
    Optional<RewardGift> findForUpdate(@Param("id") Long id);
}
