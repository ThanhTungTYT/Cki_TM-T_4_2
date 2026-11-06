package org.ckitmdt.backend.controller;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.CustomerNotification;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.CustomerNotificationRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/customer/notifications")
@RequiredArgsConstructor
public class CustomerNotificationController {
    private final CustomerNotificationRepository notificationRepository;
    private final UserRepository userRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public Map<String, Object> list(Authentication authentication) {
        User customer = currentCustomer(authentication);
        var items = notificationRepository.findTop100ByRecipient_IdOrderByCreatedAtDesc(customer.getId());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("unreadCount", notificationRepository.countByRecipient_IdAndReadAtIsNull(customer.getId()));
        result.put("items", items.stream().map(this::row).toList());
        return result;
    }

    @PatchMapping("/{id}/read")
    @Transactional
    public Map<String, Object> markRead(@PathVariable Long id, Authentication authentication) {
        User customer = currentCustomer(authentication);
        CustomerNotification notification = notificationRepository.findByIdAndRecipient_Id(id, customer.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy thông báo."));
        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
            notificationRepository.save(notification);
        }
        return row(notification);
    }

    private User currentCustomer(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập.");
        }
        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Không tìm thấy tài khoản."));
        if (user.getRole() == null || !user.getRole().replace("ROLE_", "").equalsIgnoreCase("CUSTOMER")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ khách hàng được xem thông báo này.");
        }
        return user;
    }

    private Map<String, Object> row(CustomerNotification notification) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", notification.getId());
        result.put("type", notification.getType());
        result.put("title", notification.getTitle());
        result.put("message", notification.getMessage());
        result.put("referenceType", notification.getReferenceType());
        result.put("referenceId", notification.getReferenceId());
        result.put("createdAt", notification.getCreatedAt());
        result.put("read", notification.getReadAt() != null);
        result.put("readAt", notification.getReadAt());
        return result;
    }
}
