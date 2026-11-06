package org.ckitmdt.backend.service;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.CustomerNotification;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.CustomerNotificationRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CustomerNotificationService {
    private static final String DESTINATION = "/queue/customer-notifications";

    private final CustomerNotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public void notifyCustomer(User customer, String type, String title, String message,
                               String referenceType, Long referenceId) {
        if (customer == null || customer.getId() == null) return;
        CustomerNotification notification = notificationRepository.save(CustomerNotification.builder()
                .recipient(customer)
                .type(type)
                .title(title)
                .message(message)
                .referenceType(referenceType)
                .referenceId(referenceId)
                .build());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", notification.getId());
        payload.put("type", notification.getType());
        payload.put("title", notification.getTitle());
        payload.put("message", notification.getMessage());
        payload.put("referenceType", notification.getReferenceType());
        payload.put("referenceId", notification.getReferenceId());
        payload.put("createdAt", notification.getCreatedAt());
        payload.put("read", false);
        Runnable publish = () -> {
            try {
                messagingTemplate.convertAndSendToUser(customer.getEmail(), DESTINATION, payload);
            } catch (RuntimeException ignored) {
                // Notification is persisted; the UI refreshes from the API if realtime delivery fails.
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() { publish.run(); }
            });
        } else {
            publish.run();
        }
    }

    public void notifyBookingStatus(Booking booking) {
        if (booking == null || booking.getCustomer() == null) return;
        String status = booking.getStatus() == null ? "" : booking.getStatus().toUpperCase();
        Map<String, String[]> content = Map.of(
                "PENDING_PROVIDER", new String[]{"Đơn đang chờ đối tác", "Đơn " + booking.getBookingCode() + " đã được thanh toán và đang chờ đối tác xác nhận."},
                "CONFIRMED", new String[]{"Đơn đã được xác nhận", "Đối tác đã xác nhận đơn " + booking.getBookingCode() + "."},
                "ASSIGNED", new String[]{"Đã phân công nhân viên", "Đơn " + booking.getBookingCode() + " đã được phân công nhân viên."},
                "IN_PROGRESS", new String[]{"Dịch vụ đang thực hiện", "Dịch vụ của đơn " + booking.getBookingCode() + " đã bắt đầu."},
                "PENDING_COMPLETION", new String[]{"Chờ bạn xác nhận hoàn thành", "Đối tác đã báo hoàn tất đơn " + booking.getBookingCode() + "."},
                "COMPLETED", new String[]{"Đơn đã hoàn thành", "Đơn " + booking.getBookingCode() + " đã hoàn thành. Cảm ơn bạn đã sử dụng CleanMate!"},
                "CANCELLED", new String[]{"Đơn đã bị hủy", "Đơn " + booking.getBookingCode() + " đã được hủy."},
                "REJECTED", new String[]{"Đối tác từ chối đơn", "Đối tác không thể nhận đơn " + booking.getBookingCode() + "."},
                "EXPIRED", new String[]{"Đơn giữ chỗ đã hết hạn", "Đơn " + booking.getBookingCode() + " đã hết thời gian giữ chỗ."}
        );
        String[] details = content.get(status);
        if (details != null) notifyCustomer(booking.getCustomer(), "BOOKING_" + status,
                details[0], details[1], "BOOKING", booking.getId());
    }
}
