package org.ckitmdt.backend.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.ckitmdt.backend.service.admin.AdminAuditLogService;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.util.ContentCachingRequestWrapper;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class AdminAuditInterceptor implements HandlerInterceptor {
    private static final Set<String> MUTATING_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");
    private static final Set<String> EXCLUDED_PATHS = Set.of(
            "/api/admin/accounts",
            "/api/admin/providers",
            "/api/admin/operations/assignments",
            "/api/admin/outbox"
    );

    private final AdminAuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    @Override
    public void afterCompletion(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler,
            Exception exception
    ) {
        String method = request.getMethod().toUpperCase(Locale.ROOT);
        String path = request.getRequestURI();

        if (!MUTATING_METHODS.contains(method)
                || response.getStatus() < 200
                || response.getStatus() >= 300
                || exception != null
                || !isAuditedPath(path)
                || isExcludedPath(path)) {
            return;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!isAdminOrStaff(authentication)) return;

        Long entityId = extractEntityId(path);
        if (entityId == null) {
            Object capturedId = request.getAttribute(AdminAuditResponseCaptureAdvice.ENTITY_ID_ATTRIBUTE);
            if (capturedId instanceof Long value) entityId = value;
        }
        if (entityId == null) return;

        String entityType = resolveEntityType(path);
        String action = resolveAction(method, path, entityType);
        String reason = resolveReason(request, path);
        Object capturedStatus = request.getAttribute(AdminAuditResponseCaptureAdvice.STATUS_ATTRIBUTE);
        String afterValue = "method=" + method + ";path=" + path + ";httpStatus=" + response.getStatus()
                + (capturedStatus == null ? "" : ";status=" + capturedStatus);

        try {
            auditLogService.record(
                    authentication,
                    action,
                    entityType,
                    entityId,
                    reason,
                    null,
                    afterValue
            );
        } catch (RuntimeException auditException) {
            log.error("Không thể ghi AdminAuditLog cho {} {}", method, path, auditException);
        }
    }

    private boolean isAuditedPath(String path) {
        return path.startsWith("/api/admin/")
                || path.matches("/api/refunds/\\d+/review/?");
    }

    private boolean isExcludedPath(String path) {
        if (path.startsWith("/api/admin/operations/notifications")) return true;
        return EXCLUDED_PATHS.stream().anyMatch(path::startsWith);
    }

    private boolean isAdminOrStaff(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return false;
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(role -> "ROLE_ADMIN".equals(role) || "ROLE_STAFF".equals(role));
    }

    private Long extractEntityId(String path) {
        return Arrays.stream(path.split("/"))
                .filter(segment -> segment.matches("\\d+"))
                .findFirst()
                .map(segment -> {
                    try {
                        return Long.valueOf(segment);
                    } catch (NumberFormatException exception) {
                        return null;
                    }
                })
                .orElse(null);
    }

    private String resolveEntityType(String path) {
        if (path.startsWith("/api/refunds/")) return "CANCELLATION_REFUND";
        if (path.contains("/provider-change-requests/")) return "PROVIDER_CHANGE_REQUEST";
        if (path.contains("/services/categories/")) return "SERVICE_CATEGORY";
        if (path.contains("/services/")) return "SERVICE";
        if (path.contains("/orders/")) return "BOOKING";
        if (path.contains("/promotions/")) return "PROMOTION";
        if (path.contains("/transactions/")) return "PAYMENT";
        String[] segments = path.split("/");
        return segments.length > 3
                ? segments[3].replace('-', '_').toUpperCase(Locale.ROOT)
                : "ADMIN_OPERATION";
    }

    private String resolveAction(String method, String path, String entityType) {
        String[] segments = path.split("/");
        String operation = segments.length == 0 ? "UPDATE" : segments[segments.length - 1];
        if (operation.matches("\\d+")) operation = method;
        operation = operation.replace('-', '_').toUpperCase(Locale.ROOT);

        if ("APPROVE".equals(operation)) return entityType + "_APPROVED";
        if ("REJECT".equals(operation)) return entityType + "_REJECTED";
        if ("REQUEST_INFO".equals(operation)) return entityType + "_INFO_REQUESTED";
        if ("STATUS".equals(operation)) return entityType + "_STATUS_CHANGED";
        if ("REVIEW".equals(operation)) return entityType + "_REVIEWED";
        if ("CANCEL".equals(operation)) return entityType + "_CANCELLED";
        return entityType + "_" + operation;
    }

    private String resolveReason(HttpServletRequest request, String path) {
        String[] reasonKeys = {"reason", "note", "rejectReason", "decisionNote", "requestInfo"};
        for (String key : reasonKeys) {
            String value = request.getParameter(key);
            if (value != null && !value.isBlank()) return limit(value.trim(), 2000);
        }

        if (request instanceof ContentCachingRequestWrapper wrapper) {
            byte[] content = wrapper.getContentAsByteArray();
            if (content.length > 0) {
                try {
                    JsonNode body = objectMapper.readTree(new String(content, StandardCharsets.UTF_8));
                    for (String key : reasonKeys) {
                        JsonNode value = body == null ? null : body.get(key);
                        if (value != null && !value.isNull() && !value.asText().isBlank()) {
                            return limit(value.asText().trim(), 2000);
                        }
                    }
                } catch (Exception exception) {
                    log.debug("Không đọc được nội dung lý do từ request audit {}", path);
                }
            }
        }

        if (path.contains("/approve")) return "Duyệt yêu cầu qua trang quản trị.";
        if (path.contains("/reject")) return "Từ chối yêu cầu qua trang quản trị.";
        if (path.contains("/request-info")) return "Yêu cầu bổ sung thông tin qua trang quản trị.";
        if (path.contains("/actions/cancel")) return "Hủy đơn hàng qua trang quản trị.";
        if (path.endsWith("/review")) return "Xét duyệt yêu cầu hoàn tiền qua trang quản trị.";
        return "Thao tác quản trị được ghi nhận tự động.";
    }

    private String limit(String value, int maxLength) {
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}