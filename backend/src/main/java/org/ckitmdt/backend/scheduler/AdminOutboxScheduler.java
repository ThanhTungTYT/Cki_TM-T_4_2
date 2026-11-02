package org.ckitmdt.backend.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.ckitmdt.backend.service.admin.AdminOutboxDeliveryService;
import org.ckitmdt.backend.service.admin.AdminOutboxService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminOutboxScheduler {
    private final AdminOutboxService outboxService;
    private final AdminOutboxDeliveryService deliveryService;

    @Scheduled(fixedDelayString = "${app.admin-outbox.fixed-delay-ms:15000}")
    public void processOutbox() {
        try {
            outboxService.discoverEvents();
        } catch (Exception exception) {
            log.error("Không thể phát hiện sự kiện Admin Outbox.", exception);
        }

        List<Long> dueEventIds;
        try {
            dueEventIds = deliveryService.findDueEventIds();
        } catch (Exception exception) {
            log.error("Không thể lấy danh sách sự kiện Outbox đến hạn.", exception);
            return;
        }

        for (Long eventId : dueEventIds) {
            try {
                deliveryService.deliver(eventId);
            } catch (Exception exception) {
                log.error("Không thể xử lý Admin Outbox event {}.", eventId, exception);
                try {
                    deliveryService.recordFailure(eventId, exception);
                } catch (Exception retryException) {
                    log.error("Không thể ghi nhận lỗi retry cho Admin Outbox event {}.", eventId, retryException);
                }
            }
        }
    }
}