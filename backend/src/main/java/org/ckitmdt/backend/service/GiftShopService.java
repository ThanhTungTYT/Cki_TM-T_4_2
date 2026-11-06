package org.ckitmdt.backend.service;

import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.*;
import org.ckitmdt.backend.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@Service @RequiredArgsConstructor
public class GiftShopService {
    private final RewardGiftRepository gifts;
    private final GiftRedemptionRepository redemptions;
    private final UserRepository users;
    private final RewardAccountRepository accounts;
    private final RewardTransactionRepository transactions;
    private final RewardExpiryService expiry;

    @Transactional(readOnly = true)
    public List<GiftView> catalog() {
        return gifts.findByActiveTrueOrderByPointsCostAscIdAsc().stream()
                .map(g -> new GiftView(g.getId(), g.getName(), g.getDescription(), g.getIcon(), g.getPointsCost(), g.getStock())).toList();
    }

    @Transactional(readOnly = true)
    public List<RedemptionView> history(String email) {
        return redemptions.findByUser_IdOrderByCreatedAtDesc(customer(email).getId()).stream().map(this::view).toList();
    }

    @Transactional
    public RedemptionView redeem(String email, RedeemRequest request) {
        User user = customer(email);
        if (request.address().trim().length() < 10) throw bad("Vui lòng nhập địa chỉ nhận quà đầy đủ (tối thiểu 10 ký tự).");
        // Serialize all spending against this wallet, including checkout and expiry.
        RewardAccount account = accounts.findByUserIdForUpdate(user.getId())
                .orElseThrow(() -> bad("Bạn chưa có Ccoin để đổi quà."));
        var previous = redemptions.findByUser_IdAndRequestKey(user.getId(), request.requestKey());
        if (previous.isPresent()) {
            GiftRedemption old = previous.get();
            if (!Objects.equals(old.getGift().getId(), request.giftId())
                    || !old.getRecipientName().equals(request.recipientName().trim())
                    || !old.getPhone().equals(request.phone().trim())
                    || !old.getAddress().equals(request.address().trim())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Yêu cầu đổi quà đã được sử dụng với thông tin khác.");
            }
            return view(old);
        }
        expiry.processAccount(user.getId());
        RewardGift gift = gifts.findForUpdate(request.giftId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy quà."));
        if (!Boolean.TRUE.equals(gift.getActive()) || gift.getStock() <= 0) throw bad("Phần quà đã hết hoặc ngừng đổi.");
        if (gift.getPointsCost() <= 0 || account.getBalance() < gift.getPointsCost()) throw bad("Bạn không đủ Ccoin để đổi phần quà này.");
        LocalDateTime now = LocalDateTime.now();
        account.setBalance(account.getBalance() - gift.getPointsCost());
        account.setTotalRedeemed(Math.addExact(account.getTotalRedeemed() == null ? 0 : account.getTotalRedeemed(), gift.getPointsCost()));
        account.setUpdatedAt(now);
        gift.setStock(gift.getStock() - 1);
        GiftRedemption redemption = redemptions.save(GiftRedemption.builder()
                .user(user).gift(gift).giftName(gift.getName()).pointsUsed(gift.getPointsCost())
                .recipientName(request.recipientName().trim()).phone(request.phone().trim()).address(request.address().trim())
                .requestKey(request.requestKey()).status("PENDING").createdAt(now).build());
        transactions.save(RewardTransaction.builder().rewardAccount(account).performedBy(user)
                .type("GIFT_REDEEM").points(-gift.getPointsCost()).description("Đổi quà: " + gift.getName())
                .eventKey("GIFT_REDEEM_" + redemption.getId()).createdAt(now).build());
        return view(redemption);
    }

    @Transactional
    public RedemptionView confirmReceived(String email, Long redemptionId) {
        User user = customer(email);
        GiftRedemption redemption = redemptions.findByIdForUpdate(redemptionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng quà tặng."));
        if (!Objects.equals(redemption.getUser().getId(), user.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng quà tặng.");
        }
        if ("DELIVERED".equalsIgnoreCase(redemption.getStatus())) return view(redemption);
        if (!"SHIPPED".equalsIgnoreCase(redemption.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Đơn hàng chưa được chuyển sang trạng thái đang giao.");
        }
        redemption.setStatus("DELIVERED");
        return view(redemptions.save(redemption));
    }

    private User customer(String email) {
        User user = users.findByEmail(email).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!"CUSTOMER".equalsIgnoreCase(user.getRole())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ khách hàng được đổi quà.");
        return user;
    }
    private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private RedemptionView view(GiftRedemption r) {
        return new RedemptionView(r.getId(), r.getGiftName(), r.getPointsUsed(), r.getRecipientName(), r.getPhone(), r.getAddress(), r.getStatus(), r.getCreatedAt());
    }
    public record RedeemRequest(@NotNull Long giftId, @NotBlank @Size(max=100) String recipientName,
            @NotBlank @Pattern(regexp="[+]?[0-9]{9,15}") String phone,
            @NotBlank @Size(min=10, max=500) String address,
            @NotBlank @Pattern(regexp="[a-zA-Z0-9-]{16,80}") String requestKey) {}
    public record GiftView(Long id, String name, String description, String icon, int pointsCost, int stock) {}
    public record RedemptionView(Long id, String giftName, int pointsUsed, String recipientName, String phone, String address, String status, LocalDateTime createdAt) {}
}
