package org.ckitmdt.backend.service.admin;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.AdminAuditLog;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.AdminAuditLogRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AdminAuditLogService {

    private final AdminAuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @Transactional
    public void record(
            Authentication authentication,
            String action,
            String entityType,
            Long entityId,
            String reason,
            String beforeValue,
            String afterValue
    ) {
        if (authentication == null
                || authentication.getName() == null
                || authentication.getName().isBlank()) {
            throw new IllegalStateException("Không xác định được người thực hiện thao tác.");
        }

        if (entityId == null) {
            throw new IllegalArgumentException("Mã đối tượng không được để trống.");
        }

        User actor = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalStateException(
                        "Không tìm thấy tài khoản thực hiện thao tác."
                ));

        AdminAuditLog auditLog = AdminAuditLog.builder()
                .actor(actor)
                .action(limit(action, 100))
                .entityType(limit(entityType, 80))
                .entityId(entityId)
                .reason(limit(reason == null || reason.isBlank()
                        ? "Thao tác quản trị được ghi nhận tự động."
                        : reason, 2000))
                .beforeValue(beforeValue)
                .afterValue(afterValue)
                .createdAt(LocalDateTime.now())
                .build();

        auditLogRepository.save(auditLog);
    }

    private String limit(String value, int maxLength) {
        if (value == null) return "";
        return value.length() <= maxLength
                ? value
                : value.substring(0, maxLength);
    }
}