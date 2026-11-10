
package org.ckitmdt.backend.controller.auth;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.AdminNotification;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.entity.PartnerService;
import org.ckitmdt.backend.entity.Service;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.AdminNotificationRepository;
import org.ckitmdt.backend.repository.PartnerServiceRepository;
import org.ckitmdt.backend.service.admin.AdminAuditLogService;
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
import java.util.Set;

@RestController
@RequestMapping("/api/admin/provider-service-approvals")
@RequiredArgsConstructor
public class AdminProviderServiceApprovalController {

    private final PartnerServiceRepository partnerServiceRepository;
    private final AdminNotificationRepository notificationRepository;
    private final AdminAuditLogService auditLogService;

    private static final Set<String> VALID_FILTERS = Set.of(
            "ALL",
            "PENDING",
            "ACTIVE",
            "REJECTED",
            "INACTIVE",
            "PAUSED"
    );

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getServices(
            @RequestParam(required = false, defaultValue = "PENDING") String status,
            @RequestParam(required = false) String keyword) {

        String filter = normalize(status);
        String search = keyword == null
                ? ""
                : keyword.trim().toLowerCase(Locale.ROOT);

        if (!VALID_FILTERS.contains(filter)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Bộ lọc trạng thái không hợp lệ."
            );
        }

        List<PartnerService> services = filter.equals("ALL")
                ? partnerServiceRepository.findAll()
                : partnerServiceRepository.findByStatusIgnoreCaseOrderByCreatedAtAsc(filter);

        return services.stream()
                .filter(item -> matchesKeyword(item, search))
                .map(this::toResponse)
                .toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Map<String, Object> getService(@PathVariable Long id) {
        return toResponse(findPartnerService(id));
    }

    @PostMapping("/{id}/approve")
    @Transactional
    public Map<String, Object> approve(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication) {

        PartnerService partnerService = findPartnerService(id);
        Partner partner = partnerService.getPartner();
        Service service = partnerService.getService();

        if (!"PENDING".equals(normalize(partnerService.getStatus()))) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Chỉ dịch vụ đang chờ duyệt mới được phê duyệt."
            );
        }

        if (partner == null || !"ACTIVE".equals(normalize(partner.getStatus()))) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Provider chưa được phê duyệt hoặc đang bị khóa."
            );
        }

        User providerUser = partner.getUser();

        if (providerUser == null
                || !"ACTIVE".equals(normalize(providerUser.getStatus()))) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Tài khoản Provider không hoạt động."
            );
        }

        if (service == null || service.getCategory() == null
                || !"ACTIVE".equals(normalize(service.getCategory().getStatus()))) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Dịch vụ hoặc danh mục dịch vụ đã ngừng hoạt động."
            );
        }

        if (partnerService.getPrice() == null
                || partnerService.getPrice().signum() <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Giá dịch vụ phải lớn hơn 0 trước khi duyệt."
            );
        }

        String reason = optionalText(body == null ? null : body.get("reason"));
        String oldStatus = normalize(partnerService.getStatus());

        partnerService.setStatus("ACTIVE");
        partnerService.setUpdatedAt(LocalDateTime.now());

        partnerServiceRepository.save(partnerService);

        auditLogService.record(
                authentication,
                "PROVIDER_SERVICE_APPROVED",
                "PARTNER_SERVICE",
                partnerService.getId(),
                reason.isBlank()
                        ? "Admin phê duyệt dịch vụ Provider."
                        : reason,
                "status=" + oldStatus,
                "status=ACTIVE"
        );

        sendNotification(
                partner,
                "PROVIDER_SERVICE_APPROVED",
                "Dịch vụ đã được phê duyệt",
                "Dịch vụ \"" + service.getName()
                        + "\" đã được Admin phê duyệt và có thể được cung cấp theo trạng thái hoạt động."
        );

        Map<String, Object> result = toResponse(partnerService);
        result.put("message", "Đã phê duyệt dịch vụ Provider.");

        return result;
    }

    @PostMapping("/{id}/reject")
    @Transactional
    public Map<String, Object> reject(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            Authentication authentication) {

        PartnerService partnerService = findPartnerService(id);

        if (!"PENDING".equals(normalize(partnerService.getStatus()))) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Chỉ dịch vụ đang chờ duyệt mới được từ chối."
            );
        }

        String reason = requiredReason(
                body == null ? null : body.get("reason")
        );

        String oldStatus = normalize(partnerService.getStatus());

        partnerService.setStatus("REJECTED");
        partnerService.setUpdatedAt(LocalDateTime.now());

        partnerServiceRepository.save(partnerService);

        auditLogService.record(
                authentication,
                "PROVIDER_SERVICE_REJECTED",
                "PARTNER_SERVICE",
                partnerService.getId(),
                reason,
                "status=" + oldStatus,
                "status=REJECTED;reason=" + reason
        );

        sendNotification(
                partnerService.getPartner(),
                "PROVIDER_SERVICE_REJECTED",
                "Dịch vụ chưa được phê duyệt",
                "Dịch vụ \""
                        + partnerService.getService().getName()
                        + "\" chưa được phê duyệt. Lý do: "
                        + reason
        );

        Map<String, Object> result = toResponse(partnerService);
        result.put("message", "Đã từ chối dịch vụ Provider.");

        return result;
    }

    private PartnerService findPartnerService(Long id) {
        return partnerServiceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy dịch vụ đăng ký của Provider."
                ));
    }

    private boolean matchesKeyword(PartnerService item, String keyword) {
        if (keyword.isBlank()) {
            return true;
        }

        Partner partner = item.getPartner();
        Service service = item.getService();
        User user = partner == null ? null : partner.getUser();

        return contains(service == null ? null : service.getName(), keyword)
                || contains(partner == null ? null : partner.getBusinessName(), keyword)
                || contains(user == null ? null : user.getFullName(), keyword)
                || contains(user == null ? null : user.getEmail(), keyword)
                || contains(user == null ? null : user.getPhone(), keyword);
    }

    private Map<String, Object> toResponse(PartnerService item) {
        Partner partner = item.getPartner();
        Service service = item.getService();
        User user = partner == null ? null : partner.getUser();

        Map<String, Object> row = new LinkedHashMap<>();

        row.put("id", item.getId());
        row.put("partnerId", partner == null ? null : partner.getId());
        row.put("providerName", partner == null ? "" : partner.getBusinessName());
        row.put("providerEmail", user == null ? "" : user.getEmail());
        row.put("providerPhone", user == null ? "" : user.getPhone());
        row.put("providerStatus", partner == null ? "" : partner.getStatus());
        row.put("serviceId", service == null ? null : service.getId());
        row.put("serviceName", service == null ? "" : service.getName());
        row.put("categoryName", service == null || service.getCategory() == null
                ? ""
                : service.getCategory().getName());
        row.put("description", service == null ? "" : service.getDescription());
        row.put("thumbnailUrl", service == null ? "" : service.getThumbnailUrl());
        row.put("basePrice", service == null ? null : service.getBasePrice());
        row.put("price", item.getPrice());
        row.put("estimatedMinutes", service == null
                ? null
                : service.getEstimatedMinutes());
        row.put("status", normalize(item.getStatus()));
        row.put("createdAt", item.getCreatedAt());
        row.put("updatedAt", item.getUpdatedAt());

        return row;
    }

    private void sendNotification(
            Partner partner,
            String type,
            String title,
            String message) {

        if (partner == null || partner.getUser() == null) {
            return;
        }

        notificationRepository.save(AdminNotification.builder()
                .recipient(partner.getUser())
                .type(type)
                .title(title)
                .message(message.length() > 1000
                        ? message.substring(0, 1000)
                        : message)
                .referenceType("PARTNER_SERVICE")
                .referenceId(partner.getId())
                .createdAt(LocalDateTime.now())
                .build());
    }

    private String requiredReason(String value) {
        String reason = optionalText(value);

        if (reason.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng nhập lý do từ chối."
            );
        }

        if (reason.length() > 1000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Lý do từ chối không được vượt quá 1000 ký tự."
            );
        }

        return reason;
    }

    private String optionalText(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalize(String value) {
        return value == null
                ? ""
                : value.trim().toUpperCase(Locale.ROOT);
    }

    private boolean contains(String value, String keyword) {
        return value != null
                && value.toLowerCase(Locale.ROOT).contains(keyword);
    }
}
