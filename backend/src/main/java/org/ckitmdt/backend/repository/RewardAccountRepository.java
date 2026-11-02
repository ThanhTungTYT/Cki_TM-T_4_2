
package org.ckitmdt.backend.repository;

import jakarta.persistence.LockModeType;
import org.ckitmdt.backend.entity.RewardAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RewardAccountRepository extends JpaRepository<RewardAccount, Long> {
    Optional<RewardAccount> findByUser_Id(Long userId);
    List<RewardAccount> findAllByOrderByUpdatedAtDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM RewardAccount r WHERE r.user.id = :userId")
    Optional<RewardAccount> findByUserIdForUpdate(@Param("userId") Long userId);
}
