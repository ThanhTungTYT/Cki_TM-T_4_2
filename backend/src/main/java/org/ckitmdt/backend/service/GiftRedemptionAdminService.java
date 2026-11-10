package org.ckitmdt.backend.service;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.GiftRedemption;
import org.ckitmdt.backend.repository.GiftRedemptionRepository;
import org.ckitmdt.backend.service.CustomerNotificationService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GiftRedemptionAdminService {
    private final GiftRedemptionRepository redemptions;
    private final CustomerNotificationService notifications;

    @Transactional(readOnly = true)
    public List<AdminRedemptionView> list() {
        return redemptions.findAllByOrderByCreatedAtDesc().stream()
                .map(this::view)
                .toList();
    }

    @Transactional
    public AdminRedemptionView markShipped(Long id) {
        GiftRedemption redemption = redemptions.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng quà tặng."));
        if ("SHIPPED".equalsIgnoreCase(redemption.getStatus())) return view(redemption);
        if (!"PENDING".equalsIgnoreCase(redemption.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Chỉ đơn đang xử lý mới có thể xuất hóa đơn và chuyển sang đang giao.");
        }
        redemption.setStatus("SHIPPED");
        AdminRedemptionView shipped = view(redemptions.save(redemption));
        notifications.notifyCustomer(redemption.getUser(), "GIFT_ORDER_SHIPPED", "Quà tặng đang được giao",
                "Đơn đổi " + redemption.getGiftName() + " (#" + redemption.getId() + ") đã được bàn giao vận chuyển.",
                "GIFT_REDEMPTION", redemption.getId());
        return shipped;
    }

    private AdminRedemptionView view(GiftRedemption redemption) {
        return new AdminRedemptionView(
                redemption.getId(),
                redemption.getUser().getId(),
                redemption.getUser().getFullName(),
                redemption.getUser().getEmail(),
                redemption.getGiftName(),
                redemption.getPointsUsed() == null ? 0 : redemption.getPointsUsed(),
                redemption.getRecipientName(),
                redemption.getPhone(),
                redemption.getAddress(),
                redemption.getStatus(),
                redemption.getCreatedAt(),
                redemption.getCancelledAt()
        );
    }

    public record AdminRedemptionView(
            Long id,
            Long customerId,
            String customerName,
            String customerEmail,
            String giftName,
            Integer pointsUsed,
            String recipientName,
            String phone,
            String address,
            String status,
            LocalDateTime createdAt,
            LocalDateTime cancelledAt
    ) {}
}
