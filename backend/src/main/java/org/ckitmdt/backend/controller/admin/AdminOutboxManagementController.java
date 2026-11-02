package org.ckitmdt.backend.controller.admin;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.AdminAuditLog;
import org.ckitmdt.backend.entity.AdminOutboxEvent;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.AdminAuditLogRepository;
import org.ckitmdt.backend.repository.AdminOutboxEventRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/outbox")
@RequiredArgsConstructor
public class AdminOutboxManagementController {
    private final AdminOutboxEventRepository outboxRepository;
    private final AdminAuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @GetMapping("/failed")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getFailedEvents(Authentication authentication) {
        requireAdmin(authentication);
        return outboxRepository.findTop100ByStatusOrderByCreatedAtDesc("FAILED")
                .stream()
                .map(this::toRow)
                .toList();
    }

    @PostMapping("/{id}/retry")
    @Transactional
    public Map<String, Object> retryEvent(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body,
            Authentication authentication
    ) {
        User admin = requireAdmin(authentication);
        String reason = body == null || body.get("reason") == null
                ? ""
                : String.valueOf(body.get("reason")).trim();

        if (reason.isBlank() || reason.length() > 2000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập lý do retry từ 1 đến 2000 ký tự.");
        }

        AdminOutboxEvent event = outboxRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy sự kiện Outbox."));

        if (!"FAILED".equalsIgnoreCase(event.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Chỉ sự kiện FAILED mới được retry thủ công.");
        }

        String previousStatus = event.getStatus();
        event.setStatus("PENDING");
        event.setAttempts(0);
        event.setLastError(null);
        event.setNextAttemptAt(LocalDateTime.now());
        event.setProcessedAt(null);
        outboxRepository.save(event);

        auditLogRepository.save(AdminAuditLog.builder()
                .actor(admin)
                .action("OUTBOX_MANUAL_RETRY")
                .entityType("ADMIN_OUTBOX_EVENT")
                .entityId(event.getId())
                .reason(reason)
                .beforeValue(previousStatus)
                .afterValue("PENDING")
                .createdAt(LocalDateTime.now())
                .build());

        return toRow(event);
    }

    private User requireAdmin(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập.");
        }

        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Không tìm thấy tài khoản."));

        if (!"ADMIN".equalsIgnoreCase(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ Admin được quản lý Outbox.");
        }

        return user;
    }

    private Map<String, Object> toRow(AdminOutboxEvent event) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", event.getId());
        row.put("eventKey", event.getEventKey());
        row.put("eventType", event.getEventType());
        row.put("title", event.getTitle());
        row.put("message", event.getMessage());
        row.put("referenceType", event.getReferenceType());
        row.put("referenceId", event.getReferenceId());
        row.put("status", event.getStatus());
        row.put("attempts", event.getAttempts());
        row.put("nextAttemptAt", event.getNextAttemptAt());
        row.put("lastError", event.getLastError());
        row.put("createdAt", event.getCreatedAt());
        row.put("processedAt", event.getProcessedAt());
        return row;
    }
}