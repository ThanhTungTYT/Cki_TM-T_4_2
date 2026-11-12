
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

    /**
     * Lấy tài khoản Cleaner hiện tại từ thông tin xác thực.
     * Không nhận userId từ Frontend để tránh xem thông báo người khác.
     */
    private User currentCleaner(Authentication authentication) {

        if (authentication == null
                || authentication.getName() == null
                || authentication.getName().isBlank()) {

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

        String role = normalize(user.getRole());

        if (role.startsWith("ROLE_")) {
            role = role.substring(5);
        }

        boolean isCleaner =
                "CLEANER".equals(role)
                        || "EMPLOYEE".equals(role);

        if (!isCleaner) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Chỉ nhân viên vệ sinh mới được xem thông báo này."
            );
        }

        if (!"ACTIVE".equals(normalize(user.getStatus()))) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Tài khoản nhân viên hiện không hoạt động."
            );
        }

        return user;
    }

    /**
     * GET /api/cleaner/notifications
     *
     * Lấy tối đa 100 thông báo mới nhất của tài khoản Cleaner.
     */
    @GetMapping
    @Transactional(readOnly = true)
    public Map<String, Object> getNotifications(
            Authentication authentication
    ) {

        User cleaner = currentCleaner(authentication);

        List<AdminNotification> notifications =
                notificationRepository
                        .findTop100ByRecipient_IdOrderByCreatedAtDesc(
                                cleaner.getId()
                        );

        long unreadCount =
                notificationRepository
                        .countByRecipient_IdAndReadAtIsNull(
                                cleaner.getId()
                        );

        Map<String, Object> response = new LinkedHashMap<>();

        response.put("unreadCount", unreadCount);

        response.put(
                "items",
                notifications.stream()
                        .map(this::notificationRow)
                        .toList()
        );

        return response;
    }

    /**
     * PATCH /api/cleaner/notifications/{id}/read
     *
     * Chỉ được đánh dấu đã đọc thông báo thuộc chính tài khoản đăng nhập.
     */
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

    /**
     * Chuyển thông báo thành dữ liệu trả về Frontend.
     */
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

    private String normalize(String value) {

        return value == null
                ? ""
                : value.trim().toUpperCase(Locale.ROOT);
    }
}
