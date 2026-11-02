package org.ckitmdt.backend.service.admin;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.AdminNotification;
import org.ckitmdt.backend.entity.AdminOutboxEvent;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.AdminNotificationRepository;
import org.ckitmdt.backend.repository.AdminOutboxEventRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminOutboxDeliveryService {
    private static final int MAX_ATTEMPTS = 10;
    private static final String NOTIFICATION_DESTINATION = "/queue/admin-notifications";

    private final AdminOutboxEventRepository outboxRepository;
    private final AdminNotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional(readOnly = true)
    public List<Long> findDueEventIds() {
        return outboxRepository
                .findTop50ByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc("PENDING", LocalDateTime.now())
                .stream()
                .map(AdminOutboxEvent::getId)
                .toList();
    }

    @Transactional
    public void deliver(Long eventId) {
        AdminOutboxEvent event = outboxRepository.findByIdForUpdate(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy sự kiện Outbox."));

        if (!"PENDING".equalsIgnoreCase(event.getStatus())) return;

        List<User> admins = userRepository.findByRoleIgnoreCaseAndStatusIgnoreCase("ADMIN", "ACTIVE");

        if (admins.isEmpty()) {
            throw new IllegalStateException("Không có tài khoản Admin đang hoạt động để nhận thông báo.");
        }

        LocalDateTime now = LocalDateTime.now();

        for (User admin : admins) {
            AdminNotification notification = notificationRepository.save(AdminNotification.builder()
                    .recipient(admin)
                    .type(event.getEventType())
                    .title(event.getTitle())
                    .message(event.getMessage())
                    .referenceType(event.getReferenceType())
                    .referenceId(event.getReferenceId())
                    .createdAt(now)
                    .build());

            publishAfterCommit(admin, notification);
        }

        event.setStatus("PROCESSED");
        event.setProcessedAt(now);
        event.setLastError(null);
        outboxRepository.save(event);
    }

    @Transactional
    public void recordFailure(Long eventId, Exception exception) {
        AdminOutboxEvent event = outboxRepository.findByIdForUpdate(eventId).orElse(null);

        if (event == null || !"PENDING".equalsIgnoreCase(event.getStatus())) return;

        int attempts = (event.getAttempts() == null ? 0 : event.getAttempts()) + 1;
        String error = exception.getMessage() == null
                ? exception.getClass().getSimpleName()
                : exception.getMessage();

        event.setAttempts(attempts);
        event.setLastError(error.length() > 1000 ? error.substring(0, 1000) : error);

        if (attempts >= MAX_ATTEMPTS) {
            event.setStatus("FAILED");
        } else {
            long delayMinutes = Math.min(360L, 1L << Math.min(attempts, 8));
            event.setNextAttemptAt(LocalDateTime.now().plusMinutes(delayMinutes));
        }

        outboxRepository.save(event);
    }

    private void publishAfterCommit(User recipient, AdminNotification notification) {
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
                messagingTemplate.convertAndSendToUser(
                        recipient.getEmail(),
                        NOTIFICATION_DESTINATION,
                        payload
                );
            } catch (RuntimeException exception) {
                org.slf4j.LoggerFactory.getLogger(AdminOutboxDeliveryService.class)
                        .warn("Không thể đẩy thông báo realtime đến tài khoản {}.", recipient.getEmail(), exception);
            }
        };

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    publish.run();
                }
            });
        } else {
            publish.run();
        }
    }
}