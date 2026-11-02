package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.RewardTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RewardTransactionRepository extends JpaRepository<RewardTransaction, Long> {
    List<RewardTransaction> findByRewardAccount_IdOrderByCreatedAtDesc(Long rewardAccountId);

    List<RewardTransaction> findByRewardAccount_IdOrderByCreatedAtAsc(Long rewardAccountId);

    List<RewardTransaction> findByBooking_IdAndType(Long bookingId, String type);

    boolean existsByEventKey(String eventKey);
}