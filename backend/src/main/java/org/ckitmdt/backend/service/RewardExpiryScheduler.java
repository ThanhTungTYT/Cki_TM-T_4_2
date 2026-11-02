package org.ckitmdt.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.ckitmdt.backend.entity.RewardAccount;
import org.ckitmdt.backend.repository.RewardAccountRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RewardExpiryScheduler {
    private final RewardAccountRepository rewardAccountRepository;
    private final RewardExpiryService rewardExpiryService;

    @Scheduled(cron = "0 0 * * * *")
    public void expireRewardPoints() {
        for (RewardAccount account : rewardAccountRepository.findAllByOrderByUpdatedAtDesc()) {
            try {
                if (account.getUser() != null) {
                    rewardExpiryService.processAccount(account.getUser().getId());
                }
            } catch (Exception exception) {
                log.error(
                        "Không thể xử lý hết hạn điểm cho tài khoản {}: {}",
                        account.getId(),
                        exception.getMessage(),
                        exception
                );
            }
        }
    }
}