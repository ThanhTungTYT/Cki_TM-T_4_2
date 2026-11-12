
package org.ckitmdt.backend.controller.reward;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.RewardAccount;
import org.ckitmdt.backend.entity.RewardPolicy;
import org.ckitmdt.backend.entity.RewardTransaction;
import org.ckitmdt.backend.entity.RewardRedemption;
import org.ckitmdt.backend.entity.Promotion;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.RewardAccountRepository;
import org.ckitmdt.backend.repository.RewardPolicyRepository;
import org.ckitmdt.backend.repository.RewardTransactionRepository;
import org.ckitmdt.backend.repository.RewardRedemptionRepository;
import org.ckitmdt.backend.repository.PromotionRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.ckitmdt.backend.service.RewardExpiryService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;

@RestController
@RequestMapping("/api/rewards")
@RequiredArgsConstructor
public class RewardController {

    private final UserRepository userRepository;
    private final RewardAccountRepository rewardAccountRepository;
    private final RewardPolicyRepository rewardPolicyRepository;
    private final RewardTransactionRepository rewardTransactionRepository;
    private final RewardRedemptionRepository rewardRedemptionRepository;
    private final RewardExpiryService rewardExpiryService;
    private final PromotionRepository promotionRepository;

    @GetMapping("/me")
    public ResponseEntity<RewardWalletResponse> getMyWallet(
            Authentication authentication
    ) {
        if (authentication == null
                || authentication.getName() == null
                || authentication.getName().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Vui lòng đăng nhập để xem ví điểm."
            );
        }

        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Không tìm thấy tài khoản đăng nhập."
                ));

        rewardExpiryService.processAccount(user.getId());

        RewardAccount account = rewardAccountRepository
                .findByUser_Id(user.getId())
                .orElse(null);

        RewardPolicy policy = rewardPolicyRepository.findById(1L)
                .orElse(null);

        List<RewardTransactionResponse> transactions = account == null
                ? List.of()
                : rewardTransactionRepository
                .findByRewardAccount_IdOrderByCreatedAtDesc(account.getId())
                .stream()
                .map(this::toTransactionResponse)
                .toList();

        RewardWalletResponse response = new RewardWalletResponse(
                account == null ? 0 : zero(account.getBalance()),
                account == null ? 0 : zero(account.getTotalEarned()),
                account == null ? 0 : zero(account.getTotalRedeemed()),
                toPolicyResponse(policy),
                transactions
        );

        return ResponseEntity.ok(response);
    }

    @GetMapping("/vouchers")
    public ResponseEntity<List<VoucherResponse>> getMyVouchers(
            Authentication authentication
    ) {
        User user = requireCustomer(authentication);

        List<RewardRedemption> redemptions = rewardRedemptionRepository
                .findByUser_IdOrderByRedeemedAtDesc(user.getId());
        Set<Long> personallyAvailablePromotionIds = new HashSet<>();
        LocalDateTime now = LocalDateTime.now();
        List<VoucherResponse> vouchers = new ArrayList<>(redemptions.stream()
                .map(redemption -> {
                    var promotion = redemption.getPromotion();
                    if ("AVAILABLE".equalsIgnoreCase(redemption.getStatus())
                            && (redemption.getExpiresAt() == null
                            || now.isBefore(redemption.getExpiresAt()))) {
                        personallyAvailablePromotionIds.add(promotion.getId());
                    }

                    return new VoucherResponse(
                            redemption.getId(),
                            promotion.getCode(),
                            promotion.getName(),
                            promotion.getDescription(),
                            promotion.getDiscountType(),
                            promotion.getDiscountValue(),
                            redemption.getPointsUsed() == null
                                    ? 0
                                    : redemption.getPointsUsed(),
                            redemption.getStatus(),
                            redemption.getRedeemedAt(),
                            redemption.getExpiresAt(),
                            redemption.getBooking() == null
                                    ? null
                                    : redemption.getBooking().getId(),
                            false
                    );
                })
                .toList());

        for (Promotion promotion : promotionRepository.findCurrentlyAvailable(now)) {
            if (personallyAvailablePromotionIds.contains(promotion.getId())) continue;
            vouchers.add(new VoucherResponse(
                    -promotion.getId(), promotion.getCode(), promotion.getName(),
                    promotion.getDescription(), promotion.getDiscountType(),
                    promotion.getDiscountValue(), 0, "AVAILABLE", null,
                    promotion.getEndAt(), null, true
            ));
        }

        return ResponseEntity.ok(vouchers);
    }

    private User requireCustomer(Authentication authentication) {
        if (authentication == null
                || authentication.getName() == null
                || authentication.getName().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Vui lòng đăng nhập để xem voucher."
            );
        }

        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Không tìm thấy tài khoản đăng nhập."
                ));

        if (!"CUSTOMER".equalsIgnoreCase(user.getRole())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Chỉ khách hàng được xem ví voucher."
            );
        }

        return user;
    }

    private RewardTransactionResponse toTransactionResponse(
            RewardTransaction transaction
    ) {
        return new RewardTransactionResponse(
                transaction.getId(),
                transaction.getType(),
                transaction.getPoints(),
                transaction.getDescription(),
                transaction.getCreatedAt(),
                transaction.getExpiresAt()
        );
    }

    private RewardPolicyResponse toPolicyResponse(RewardPolicy policy) {
        if (policy == null) {
            return new RewardPolicyResponse(
                    BigDecimal.valueOf(1000),
                    1,
                    BigDecimal.valueOf(100),
                    BigDecimal.valueOf(20),
                    100,
                    5000,
                    12,
                    true,
                    false
            );
        }

        return new RewardPolicyResponse(
                policy.getEarnAmountStep(),
                policy.getEarnPoints(),
                policy.getPointValue(),
                policy.getMaxRedeemPercent(),
                policy.getMinRedeemPoints(),
                policy.getMaxRedeemPoints(),
                policy.getExpiryMonths(),
                Boolean.TRUE.equals(policy.getEnabled()),
                Boolean.TRUE.equals(policy.getAllowCombineWithPromotion())
        );
    }

    private int zero(Integer value) {
        return value == null ? 0 : value;
    }

    public record RewardWalletResponse(
            int balance,
            int totalEarned,
            int totalRedeemed,
            RewardPolicyResponse policy,
            List<RewardTransactionResponse> transactions
    ) {
    }

    public record RewardPolicyResponse(
            BigDecimal earnAmountStep,
            Integer earnPoints,
            BigDecimal pointValue,
            BigDecimal maxRedeemPercent,
            Integer minRedeemPoints,
            Integer maxRedeemPoints,
            Integer expiryMonths,
            Boolean enabled,
            Boolean allowCombineWithPromotion
    ) {
    }

    public record RewardTransactionResponse(
            Long id,
            String type,
            Integer points,
            String description,
            LocalDateTime createdAt,
            LocalDateTime expiresAt
    ) {
    }

    public record VoucherResponse(
            Long id,
            String code,
            String name,
            String description,
            String discountType,
            BigDecimal discountValue,
            Integer pointsUsed,
            String status,
            LocalDateTime redeemedAt,
            LocalDateTime expiresAt,
            Long bookingId,
            boolean shared
    ) {
    }
}
