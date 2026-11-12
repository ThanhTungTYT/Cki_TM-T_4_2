
package org.ckitmdt.backend.controller.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Promotion;
import org.ckitmdt.backend.entity.PromotionService;
import org.ckitmdt.backend.entity.PromotionServiceId;
import org.ckitmdt.backend.entity.RewardAccount;
import org.ckitmdt.backend.entity.RewardPolicy;
import org.ckitmdt.backend.entity.RewardTransaction;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.PromotionRepository;
import org.ckitmdt.backend.repository.PromotionServiceRepository;
import org.ckitmdt.backend.repository.RewardAccountRepository;
import org.ckitmdt.backend.repository.RewardPolicyRepository;
import org.ckitmdt.backend.repository.RewardTransactionRepository;
import org.ckitmdt.backend.repository.ServiceRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class AdminPromotionController {

    private static final Long REWARD_POLICY_ID = 1L;

    private static final BigDecimal DEFAULT_EARN_AMOUNT_STEP =
            BigDecimal.valueOf(1000);
    private static final int DEFAULT_EARN_POINTS = 1;
    private static final BigDecimal DEFAULT_POINT_VALUE =
            BigDecimal.valueOf(100);
    private static final BigDecimal DEFAULT_MAX_REDEEM_PERCENT =
            BigDecimal.valueOf(20);
    private static final int DEFAULT_MIN_REDEEM_POINTS = 100;
    private static final int DEFAULT_MAX_REDEEM_POINTS = 5000;
    private static final int DEFAULT_EXPIRY_MONTHS = 12;

    private final PromotionRepository promotionRepository;
    private final PromotionServiceRepository promotionServiceRepository;
    private final ServiceRepository serviceRepository;
    private final RewardPolicyRepository rewardPolicyRepository;
    private final RewardAccountRepository rewardAccountRepository;
    private final RewardTransactionRepository rewardTransactionRepository;
    private final UserRepository userRepository;

    @GetMapping("/api/admin/promotions")
    @Transactional(readOnly = true)
    public List<PromotionResponse> getPromotions() {
        return promotionRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toPromotionResponse)
                .toList();
    }

    @PostMapping("/api/admin/promotions")
    @Transactional
    public PromotionResponse createPromotion(
            @Valid @RequestBody PromotionRequest request
    ) {
        String code = normalizeCode(request.code());

        if (promotionRepository.existsByCodeIgnoreCase(code)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Mã khuyến mãi đã tồn tại."
            );
        }

        validatePromotion(request);

        Promotion promotion = new Promotion();
        applyPromotionRequest(promotion, request, code);

        Promotion saved = promotionRepository.save(promotion);
        replacePromotionServices(saved, request.serviceIds());

        return toPromotionResponse(saved);
    }

    @PutMapping("/api/admin/promotions/{id}")
    @Transactional
    public PromotionResponse updatePromotion(
            @PathVariable Long id,
            @Valid @RequestBody PromotionRequest request
    ) {
        Promotion promotion = promotionRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy chương trình khuyến mãi."
                ));

        String code = normalizeCode(request.code());

        promotionRepository.findByCodeIgnoreCase(code).ifPresent(existing -> {
            if (!existing.getId().equals(id)) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Mã khuyến mãi đã được sử dụng."
                );
            }
        });

        validatePromotion(request);
        applyPromotionRequest(promotion, request, code);

        Promotion saved = promotionRepository.save(promotion);
        replacePromotionServices(saved, request.serviceIds());

        return toPromotionResponse(saved);
    }

    @PatchMapping("/api/admin/promotions/{id}/status")
    @Transactional
    public PromotionResponse updatePromotionStatus(
            @PathVariable Long id,
            @Valid @RequestBody PromotionStatusRequest request
    ) {
        Promotion promotion = promotionRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy chương trình khuyến mãi."
                ));

        String status = request.status().trim().toUpperCase(Locale.ROOT);

        if (!List.of("DRAFT", "ACTIVE", "INACTIVE").contains(status)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trạng thái khuyến mãi không hợp lệ."
            );
        }

        if ("ACTIVE".equals(status)) {
            validatePromotionDates(
                    promotion.getStartAt(),
                    promotion.getEndAt()
            );
        }

        promotion.setStatus(status);

        return toPromotionResponse(promotionRepository.save(promotion));
    }

    @GetMapping("/api/admin/rewards/policy")
    @Transactional(readOnly = true)
    public RewardPolicyResponse getRewardPolicy() {
        RewardPolicy policy = rewardPolicyRepository
                .findById(REWARD_POLICY_ID)
                .orElse(null);

        return toRewardPolicyResponse(policy);
    }

    @PutMapping("/api/admin/rewards/policy")
    @Transactional
    public RewardPolicyResponse updateRewardPolicy(
            @Valid @RequestBody RewardPolicyRequest request,
            Authentication authentication
    ) {
        validateRewardPolicy(request);

        User actor = getActor(authentication);

        RewardPolicy policy = rewardPolicyRepository
                .findById(REWARD_POLICY_ID)
                .orElseGet(() -> {
                    RewardPolicy created = new RewardPolicy();
                    created.setId(REWARD_POLICY_ID);
                    return created;
                });

        // Booking earnings follow the fixed customer rule: 1 Ccoin per 1,000 VND.
        policy.setEarnAmountStep(DEFAULT_EARN_AMOUNT_STEP);
        policy.setEarnPoints(DEFAULT_EARN_POINTS);
        policy.setPointValue(request.pointValue());
        policy.setMaxRedeemPercent(request.maxRedeemPercent());
        policy.setMinRedeemPoints(request.minRedeemPoints());
        policy.setMaxRedeemPoints(request.maxRedeemPoints());
        policy.setExpiryMonths(request.expiryMonths());
        policy.setEnabled(true);
        policy.setAllowCombineWithPromotion(
                Boolean.TRUE.equals(request.allowCombineWithPromotion())
        );
        policy.setUpdatedAt(LocalDateTime.now());
        policy.setUpdatedBy(actor.getId());

        RewardPolicy saved = rewardPolicyRepository.save(policy);

        return toRewardPolicyResponse(saved);
    }

    @GetMapping("/api/admin/rewards/accounts")
    @Transactional(readOnly = true)
    public List<RewardAccountResponse> getRewardAccounts() {
        return rewardAccountRepository.findAllByOrderByUpdatedAtDesc()
                .stream()
                .map(account -> new RewardAccountResponse(
                        account.getId(),
                        account.getUser().getId(),
                        account.getUser().getFullName(),
                        account.getUser().getEmail(),
                        zero(account.getBalance()),
                        zero(account.getTotalEarned()),
                        zero(account.getTotalRedeemed()),
                        account.getUpdatedAt()
                ))
                .toList();
    }

    @PostMapping("/api/admin/rewards/accounts/{userId}/adjustments")
    @Transactional
    public RewardAccountResponse adjustRewardPoints(
            @PathVariable Long userId,
            @Valid @RequestBody RewardAdjustmentRequest request,
            Authentication authentication
    ) {
        User actor = getActor(authentication);

        User target = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy tài khoản khách hàng."
                ));

        if (!"CUSTOMER".equalsIgnoreCase(target.getRole())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Chỉ được điều chỉnh điểm cho tài khoản khách hàng."
            );
        }

        RewardAccount account = rewardAccountRepository
                .findByUserIdForUpdate(userId)
                .orElseGet(() -> RewardAccount.builder()
                        .user(target)
                        .balance(0)
                        .totalEarned(0)
                        .totalRedeemed(0)
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build()
                );

        int currentBalance = zero(account.getBalance());
        long nextBalance = (long) currentBalance + request.points();

        if (nextBalance < 0 || nextBalance > Integer.MAX_VALUE) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Số dư điểm không hợp lệ hoặc không đủ điểm để trừ."
            );
        }

        long nextTotalEarned = zero(account.getTotalEarned());
        long nextTotalRedeemed = zero(account.getTotalRedeemed());

        if (request.points() > 0) {
            nextTotalEarned += request.points();
        } else {
            nextTotalRedeemed += Math.abs((long) request.points());
        }

        if (nextTotalEarned > Integer.MAX_VALUE
                || nextTotalRedeemed > Integer.MAX_VALUE) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tổng điểm tích lũy hoặc điểm đã đổi vượt giới hạn."
            );
        }

        account.setBalance((int) nextBalance);
        account.setTotalEarned((int) nextTotalEarned);
        account.setTotalRedeemed((int) nextTotalRedeemed);
        account.setUpdatedAt(LocalDateTime.now());

        RewardAccount saved = rewardAccountRepository.save(account);

        rewardTransactionRepository.save(RewardTransaction.builder()
                .rewardAccount(saved)
                .type("ADMIN_ADJUSTMENT")
                .points(request.points())
                .description(request.reason().trim())
                .eventKey("ADMIN_ADJUST_" + UUID.randomUUID())
                .performedBy(actor)
                .createdAt(LocalDateTime.now())
                .build());

        return new RewardAccountResponse(
                saved.getId(),
                target.getId(),
                target.getFullName(),
                target.getEmail(),
                zero(saved.getBalance()),
                zero(saved.getTotalEarned()),
                zero(saved.getTotalRedeemed()),
                saved.getUpdatedAt()
        );
    }

    private void applyPromotionRequest(
            Promotion promotion,
            PromotionRequest request,
            String code
    ) {
        promotion.setCode(code);
        promotion.setName(request.name().trim());
        promotion.setDescription(request.description());
        promotion.setDiscountType(
                request.discountType().trim().toUpperCase(Locale.ROOT)
        );
        promotion.setDiscountValue(request.discountValue());
        promotion.setMaxDiscount(request.maxDiscount());
        promotion.setMinBookingValue(
                request.minBookingValue() == null
                        ? BigDecimal.ZERO
                        : request.minBookingValue()
        );
        promotion.setStartAt(request.startAt());
        promotion.setEndAt(request.endAt());
        promotion.setUsageLimit(request.usageLimit());
        promotion.setSponsor(
                request.sponsor().trim().toUpperCase(Locale.ROOT)
        );
        promotion.setCombinableWithPoints(
                Boolean.TRUE.equals(request.combinableWithPoints())
        );

        if (promotion.getUsageCount() == null) {
            promotion.setUsageCount(0);
        }

        if (promotion.getStatus() == null) {
            promotion.setStatus("DRAFT");
        }
    }

    private void validatePromotion(PromotionRequest request) {
        String type = request.discountType()
                .trim()
                .toUpperCase(Locale.ROOT);

        String sponsor = request.sponsor()
                .trim()
                .toUpperCase(Locale.ROOT);

        if (!List.of("PERCENT", "FIXED").contains(type)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Loại giảm giá phải là PERCENT hoặc FIXED."
            );
        }

        if ("PERCENT".equals(type)
                && request.discountValue()
                .compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Mức giảm phần trăm không được vượt quá 100%."
            );
        }

        if (!List.of("PLATFORM", "PROVIDER", "SHARED").contains(sponsor)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Bên tài trợ không hợp lệ."
            );
        }

        if (request.maxDiscount() != null
                && request.maxDiscount().signum() < 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Mức giảm tối đa không được âm."
            );
        }

        if (request.minBookingValue() != null
                && request.minBookingValue().signum() < 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Giá trị đơn tối thiểu không được âm."
            );
        }

        if (request.usageLimit() != null && request.usageLimit() < 1) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Giới hạn lượt sử dụng phải lớn hơn 0."
            );
        }

        validatePromotionDates(
                request.startAt(),
                request.endAt()
        );
    }

    private void validatePromotionDates(
            LocalDateTime startAt,
            LocalDateTime endAt
    ) {
        if (startAt == null
                || endAt == null
                || !endAt.isAfter(startAt)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thời gian kết thúc phải sau thời gian bắt đầu."
            );
        }
    }

    private void replacePromotionServices(
            Promotion promotion,
            List<Long> serviceIds
    ) {
        promotionServiceRepository.deleteByPromotion_Id(promotion.getId());

        if (serviceIds == null || serviceIds.isEmpty()) {
            return;
        }

        List<org.ckitmdt.backend.entity.Service> services =
                serviceRepository.findAllById(serviceIds);

        if (services.size() != serviceIds.stream().distinct().count()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Danh sách dịch vụ áp dụng có dịch vụ không tồn tại."
            );
        }

        for (org.ckitmdt.backend.entity.Service service : services) {
            PromotionService link = new PromotionService();
            link.setId(new PromotionServiceId(
                    promotion.getId(),
                    service.getId()
            ));
            link.setPromotion(promotion);
            link.setService(service);

            promotionServiceRepository.save(link);
        }
    }

    private PromotionResponse toPromotionResponse(Promotion promotion) {
        List<Long> serviceIds = promotionServiceRepository
                .findByPromotion_Id(promotion.getId())
                .stream()
                .map(link -> link.getService().getId())
                .toList();

        return new PromotionResponse(
                promotion.getId(),
                promotion.getCode(),
                promotion.getName(),
                promotion.getDescription(),
                promotion.getDiscountType(),
                promotion.getDiscountValue(),
                promotion.getMaxDiscount(),
                promotion.getMinBookingValue(),
                promotion.getStartAt(),
                promotion.getEndAt(),
                promotion.getUsageLimit(),
                promotion.getUsageCount(),
                promotion.getStatus(),
                promotion.getSponsor(),
                Boolean.TRUE.equals(promotion.getCombinableWithPoints()),
                serviceIds,
                promotion.getCreatedAt(),
                promotion.getUpdatedAt()
        );
    }

    private void validateRewardPolicy(RewardPolicyRequest request) {
        if (request.earnAmountStep() == null
                || request.earnAmountStep().signum() <= 0
                || request.earnPoints() == null
                || request.earnPoints() < 1) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Quy tắc tích điểm phải lớn hơn 0."
            );
        }

        if (request.pointValue() == null
                || request.pointValue().signum() <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Giá trị quy đổi mỗi điểm phải lớn hơn 0."
            );
        }

        if (request.maxRedeemPercent() == null
                || request.maxRedeemPercent().signum() < 0
                || request.maxRedeemPercent()
                .compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tỷ lệ dùng điểm phải nằm trong khoảng 0 đến 100%."
            );
        }

        if (request.minRedeemPoints() == null
                || request.maxRedeemPoints() == null
                || request.minRedeemPoints() < 0
                || request.maxRedeemPoints() < request.minRedeemPoints()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Giới hạn điểm đổi không hợp lệ."
            );
        }

        if (request.expiryMonths() == null
                || request.expiryMonths() < 0
                || request.expiryMonths() > 120) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thời hạn điểm phải từ 0 đến 120 tháng."
            );
        }
    }

    private RewardPolicyResponse toRewardPolicyResponse(RewardPolicy policy) {
        if (policy == null) {
            return new RewardPolicyResponse(
                    DEFAULT_EARN_AMOUNT_STEP,
                    DEFAULT_EARN_POINTS,
                    DEFAULT_POINT_VALUE,
                    DEFAULT_MAX_REDEEM_PERCENT,
                    DEFAULT_MIN_REDEEM_POINTS,
                    DEFAULT_MAX_REDEEM_POINTS,
                    DEFAULT_EXPIRY_MONTHS,
                    true,
                    false,
                    null
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
                Boolean.TRUE.equals(policy.getAllowCombineWithPromotion()),
                policy.getUpdatedAt()
        );
    }

    private User getActor(Authentication authentication) {
        if (authentication == null
                || authentication.getName() == null
                || authentication.getName().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Không xác định được người thực hiện."
            );
        }

        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Tài khoản không tồn tại."
                ));
    }

    private int zero(Integer value) {
        return value == null ? 0 : value;
    }

    private String normalizeCode(String code) {
        String normalized = code.trim().toUpperCase(Locale.ROOT);

        if (!normalized.matches("[A-Z0-9_-]{3,40}")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Mã khuyến mãi chỉ gồm chữ in hoa, số, dấu gạch ngang hoặc gạch dưới (3-40 ký tự)."
            );
        }

        return normalized;
    }

    public record PromotionRequest(
            @NotBlank @Size(max = 150) String name,
            @NotBlank @Size(min = 3, max = 40) String code,
            String description,
            @NotBlank String discountType,
            @NotNull @DecimalMin("0.01") BigDecimal discountValue,
            @DecimalMin("0.00") BigDecimal maxDiscount,
            @DecimalMin("0.00") BigDecimal minBookingValue,
            @NotNull LocalDateTime startAt,
            @NotNull LocalDateTime endAt,
            @Min(1) Integer usageLimit,
            @NotBlank String sponsor,
            Boolean combinableWithPoints,
            List<Long> serviceIds
    ) {
    }

    public record PromotionStatusRequest(
            @NotBlank String status
    ) {
    }

    public record PromotionResponse(
            Long id,
            String code,
            String name,
            String description,
            String discountType,
            BigDecimal discountValue,
            BigDecimal maxDiscount,
            BigDecimal minBookingValue,
            LocalDateTime startAt,
            LocalDateTime endAt,
            Integer usageLimit,
            Integer usageCount,
            String status,
            String sponsor,
            boolean combinableWithPoints,
            List<Long> serviceIds,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record RewardPolicyRequest(
            @NotNull @DecimalMin("0.01") BigDecimal earnAmountStep,
            @NotNull @Min(1) Integer earnPoints,
            @NotNull @DecimalMin("0.01") BigDecimal pointValue,
            @NotNull BigDecimal maxRedeemPercent,
            @NotNull @Min(0) Integer minRedeemPoints,
            @NotNull @Min(0) Integer maxRedeemPoints,
            @NotNull @Min(0) Integer expiryMonths,
            Boolean enabled,
            Boolean allowCombineWithPromotion
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
            boolean enabled,
            boolean allowCombineWithPromotion,
            LocalDateTime updatedAt
    ) {
    }

    public record RewardAdjustmentRequest(
            @NotNull @Min(-1000000) @Max(1000000) Integer points,
            @NotBlank @Size(max = 500) String reason
    ) {
    }

    public record RewardAccountResponse(
            Long id,
            Long userId,
            String fullName,
            String email,
            Integer balance,
            Integer totalEarned,
            Integer totalRedeemed,
            LocalDateTime updatedAt
    ) {
    }
}
