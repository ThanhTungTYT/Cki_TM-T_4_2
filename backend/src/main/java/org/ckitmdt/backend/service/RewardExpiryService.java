package org.ckitmdt.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.ckitmdt.backend.entity.RewardAccount;
import org.ckitmdt.backend.entity.RewardPolicy;
import org.ckitmdt.backend.entity.RewardTransaction;
import org.ckitmdt.backend.repository.RewardAccountRepository;
import org.ckitmdt.backend.repository.RewardPolicyRepository;
import org.ckitmdt.backend.repository.RewardTransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RewardExpiryService {
    private final RewardAccountRepository rewardAccountRepository;
    private final RewardPolicyRepository rewardPolicyRepository;
    private final RewardTransactionRepository rewardTransactionRepository;

    @Transactional
    public void processAccount(Long userId) {
        RewardAccount account = rewardAccountRepository
                .findByUserIdForUpdate(userId)
                .orElse(null);

        if (account == null) {
            return;
        }

        RewardPolicy policy = rewardPolicyRepository.findById(1L).orElse(null);

        List<RewardTransaction> transactions =
                new ArrayList<>(
                        rewardTransactionRepository
                                .findByRewardAccount_IdOrderByCreatedAtAsc(account.getId())
                );

        transactions.sort(
                Comparator.comparing(
                        RewardTransaction::getCreatedAt,
                        Comparator.nullsFirst(Comparator.naturalOrder())
                ).thenComparing(
                        RewardTransaction::getId,
                        Comparator.nullsFirst(Comparator.naturalOrder())
                )
        );

        Deque<RewardLot> lots = new ArrayDeque<>();
        LocalDateTime now = LocalDateTime.now();
        boolean changed = false;

        for (RewardTransaction transaction : transactions) {
            Integer points = transaction.getPoints();

            if (points == null || points == 0) {
                continue;
            }

            if (points > 0) {
                LocalDateTime expiresAt = transaction.getExpiresAt();
                String type = transaction.getType() == null
                        ? ""
                        : transaction.getType().trim().toUpperCase();

                boolean shouldExpire = "EARN".equals(type)
                        || "REDEEM_REFUND".equals(type);

                if (expiresAt == null
                        && shouldExpire
                        && policy != null
                        && policy.getExpiryMonths() != null
                        && policy.getExpiryMonths() > 0
                        && transaction.getCreatedAt() != null) {
                    expiresAt = transaction.getCreatedAt()
                            .plusMonths(policy.getExpiryMonths());

                    transaction.setExpiresAt(expiresAt);
                    rewardTransactionRepository.save(transaction);
                    changed = true;
                }

                lots.addLast(new RewardLot(
                        transaction.getId(),
                        points,
                        expiresAt
                ));

                continue;
            }

            consumeOldestLots(lots, Math.abs((long) points));
        }

        int balance = zero(account.getBalance());
        int totalExpired = 0;

        for (RewardLot lot : lots) {
            if (lot.remaining <= 0
                    || lot.expiresAt == null
                    || now.isBefore(lot.expiresAt)) {
                continue;
            }

            String eventKey = "REWARD_EXPIRE_EARN_" + lot.transactionId;

            if (rewardTransactionRepository.existsByEventKey(eventKey)) {
                continue;
            }

            int expiredPoints = (int) Math.min(
                    lot.remaining,
                    Math.max(0, balance - totalExpired)
            );

            if (expiredPoints <= 0) {
                continue;
            }

            rewardTransactionRepository.save(RewardTransaction.builder()
                    .rewardAccount(account)
                    .type("EXPIRE")
                    .points(-expiredPoints)
                    .description("Điểm thưởng hết hạn từ giao dịch tích điểm #" + lot.transactionId)
                    .eventKey(eventKey)
                    .createdAt(now)
                    .build());

            totalExpired += expiredPoints;

            log.info(
                    "Đã hết hạn {} điểm của tài khoản {} từ giao dịch {}.",
                    expiredPoints,
                    userId,
                    lot.transactionId
            );

            changed = true;
        }

        if (totalExpired > 0) {
            account.setBalance(Math.max(0, balance - totalExpired));
            account.setUpdatedAt(now);
            rewardAccountRepository.save(account);
        } else if (changed) {
            account.setUpdatedAt(now);
            rewardAccountRepository.save(account);
        }
    }

    private void consumeOldestLots(
            Deque<RewardLot> lots,
            long pointsToConsume
    ) {
        long remaining = pointsToConsume;

        while (remaining > 0 && !lots.isEmpty()) {
            RewardLot lot = lots.peekFirst();

            if (lot.remaining <= remaining) {
                remaining -= lot.remaining;
                lots.removeFirst();
            } else {
                lot.remaining -= remaining;
                remaining = 0;
            }
        }
    }

    private int zero(Integer value) {
        return value == null ? 0 : value;
    }

    private static class RewardLot {
        private final Long transactionId;
        private long remaining;
        private final LocalDateTime expiresAt;

        private RewardLot(
                Long transactionId,
                long remaining,
                LocalDateTime expiresAt
        ) {
            this.transactionId = transactionId;
            this.remaining = remaining;
            this.expiresAt = expiresAt;
        }
    }
}