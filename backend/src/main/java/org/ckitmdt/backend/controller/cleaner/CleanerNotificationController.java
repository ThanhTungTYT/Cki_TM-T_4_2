
package org.ckitmdt.backend.controller.cleaner;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.AdminNotification;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.AdminNotificationRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/cleaner/notifications")
@RequiredArgsConstructor
public class CleanerNotificationController {

    private final UserRepository userRepository;
    private final AdminNotificationRepository notificationRepository;

    private User currentCleaner(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Vui lòng đăng nhập."
            );
        }

        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Không tìm thấy tài khoản."
                ));

        String role = user.getRole() == null
                ? ""
                : user.getRole().trim().toUpperCase(Locale.ROOT);

        if (role.startsWith("ROLE_")) {
            role = role.substring(5);
        }

        if (!"CLEANER".equals(role)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Chỉ nhân viên vệ sinh mới được xem thông báo này."
            );
        }

        return user;
    }

    // GET: Danh sách thông báo và số lượng chưa đọc
    @GetMapping
    @Transactional(readOnly = true)
    public Map<String, Object> getNotifications(Authentication authentication) {
        User cleaner = currentCleaner(authentication);

        List<AdminNotification> notifications =
                notificationRepository.findTop100ByRecipient_IdOrderByCreatedAtDesc(
                        cleaner.getId()
                );

        Map<String, Object> response = new LinkedHashMap<>();
        response.put(
                "unreadCount",
                notificationRepository.countByRecipient_IdAndReadAtIsNull(
                        cleaner.getId()
                )
        );
        response.put(
                "items",
                notifications.stream()
                        .map(this::notificationRow)
                        .toList()
        );

        return response;
    }

    // PATCH: Đánh dấu một thông báo đã đọc
    @PatchMapping("/{id}/read")
    @Transactional
    public Map<String, Object> markNotificationRead(
            @PathVariable Long id,
            Authentication authentication
    ) {
        User cleaner = currentCleaner(authentication);

        AdminNotification notification =
                notificationRepository.findByIdAndRecipient_Id(
                                id,
                                cleaner.getId()
                        )
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Không tìm thấy thông báo."
                        ));

        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
            notificationRepository.save(notification);
        }

        return notificationRow(notification);
    }

    private Map<String, Object> notificationRow(
            AdminNotification notification
    ) {
        Map<String, Object> row = new LinkedHashMap<>();

        row.put("id", notification.getId());
        row.put("type", notification.getType());
        row.put("title", notification.getTitle());
        row.put("message", notification.getMessage());
        row.put("referenceType", notification.getReferenceType());
        row.put("referenceId", notification.getReferenceId());
        row.put("read", notification.getReadAt() != null);
        row.put("readAt", notification.getReadAt());
        row.put("createdAt", notification.getCreatedAt());

        return row;
    }
}
