package org.ckitmdt.backend.controller.auth;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.entity.PartnerService;
import org.ckitmdt.backend.entity.PartnerStatusHistory;
import org.ckitmdt.backend.entity.AdminNotification;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.PartnerRepository;
import org.ckitmdt.backend.repository.PartnerServiceRepository;
import org.ckitmdt.backend.repository.PartnerStatusHistoryRepository;
import org.ckitmdt.backend.repository.AdminNotificationRepository;
import org.ckitmdt.backend.service.admin.AdminAuditLogService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/providers")
@RequiredArgsConstructor
public class AdminProviderController {

    private final PartnerRepository partnerRepository;
    private final PartnerServiceRepository partnerServiceRepository;
    private final PartnerStatusHistoryRepository historyRepository;
    private final AdminNotificationRepository notificationRepository;
    private final AdminAuditLogService auditLogService;

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_TIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
    private static final List<String> PARTNER_STATUSES = List.of("ACTIVE", "PENDING", "LOCKED", "REJECTED");

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getProviders(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {

        String search = keyword == null ? "" : keyword.trim().toLowerCase(Locale.ROOT);
        String statusFilter = normalize(status);

        if (!statusFilter.isEmpty() && !PARTNER_STATUSES.contains(statusFilter)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái không hợp lệ.");
        }

        return partnerRepository.findAll().stream()
                .filter(partner -> {
                    User user = partner.getUser();
                    return search.isEmpty()
                            || contains(partner.getBusinessName(), search)
                            || contains(partner.getAddress(), search)
                            || contains(partner.getDescription(), search)
                            || contains(partner.getTaxCode(), search)
                            || user != null && (contains(user.getFullName(), search)
                            || contains(user.getEmail(), search)
                            || contains(user.getPhone(), search));
                })
                .filter(partner -> statusFilter.isEmpty() || statusFilter.equals(normalizePartnerStatus(partner)))
                .sorted(Comparator.comparing(Partner::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Map<String, Object> getProvider(@PathVariable Long id) {
        return toResponse(findPartner(id));
    }

    @GetMapping("/{id}/history")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getProviderHistory(@PathVariable Long id) {
        findPartner(id);

        return historyRepository.findByPartnerIdOrderByChangedAtDesc(id).stream().map(item -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", item.getId());
            row.put("oldStatus", item.getOldStatus());
            row.put("newStatus", item.getNewStatus());
            row.put("reason", item.getReason());
            row.put("actionType", item.getActionType());
            row.put("changedBy", item.getChangedByEmail());
            row.put("changedAt", item.getChangedAt() == null ? "" : item.getChangedAt().format(DATE_TIME_FORMAT));
            return row;
        }).collect(Collectors.toList());
    }

    @PostMapping("/{id}/approve")
    @Transactional
    public Map<String, Object> approveProvider(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> request,
            Authentication authentication) {

        Partner partner = findPartnerForUpdate(id);
        User user = requireLinkedUser(partner);
        String reason = requireReason(request == null ? null : request.get("reason"), "lý do duyệt");

        if (!"PENDING".equals(normalizePartnerStatus(partner))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Chỉ hồ sơ đang chờ duyệt mới được duyệt lần đầu.");
        }

        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tài khoản người dùng đang bị khóa. Hãy xử lý tài khoản riêng trước.");
        }

        validateApprovedCoordinates(partner);

        String oldStatus = normalizePartnerStatus(partner);

        partner.setStatus("ACTIVE");
        partner.setVersion(partner.getVersion() == null ? 1 : partner.getVersion() + 1);

        partnerRepository.save(partner);

        saveHistory(partner, oldStatus, "ACTIVE", reason, "APPROVE", authentication);

        auditLogService.record(
                authentication,
                "PROVIDER_APPROVED",
                "PARTNER",
                partner.getId(),
                reason,
                "status=" + oldStatus,
                "status=ACTIVE;version=" + partner.getVersion()
        );

        sendProviderNotification(
                partner,
                "PROVIDER_APPROVED",
                "Hồ sơ doanh nghiệp đã được duyệt",
                "Hồ sơ doanh nghiệp của bạn đã được Admin phê duyệt. Bạn có thể tiếp tục thiết lập dịch vụ theo quy trình."
        );

        Map<String, Object> result = toResponse(partner);
        result.put("message", "Duyệt nhà cung cấp thành công.");

        return result;
    }

    @PostMapping("/{id}/reject")
    @Transactional
    public Map<String, Object> rejectProvider(
            @PathVariable Long id,
            @RequestBody Map<String, String> request,
            Authentication authentication) {

        Partner partner = findPartnerForUpdate(id);

        requireLinkedUser(partner);

        String reason = requireReason(request == null ? null : request.get("reason"), "lý do từ chối");
        String oldStatus = normalizePartnerStatus(partner);

        if (!"PENDING".equals(oldStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Chỉ hồ sơ đang chờ duyệt mới được từ chối.");
        }

        partner.setStatus("REJECTED");
        partner.setVersion(partner.getVersion() == null ? 1 : partner.getVersion() + 1);

        partnerRepository.save(partner);

        saveHistory(partner, oldStatus, "REJECTED", reason, "REJECT", authentication);

        auditLogService.record(
                authentication,
                "PROVIDER_REJECTED",
                "PARTNER",
                partner.getId(),
                reason,
                "status=" + oldStatus,
                "status=REJECTED;version=" + partner.getVersion()
        );

        sendProviderNotification(
                partner,
                "PROVIDER_REJECTED",
                "Hồ sơ doanh nghiệp chưa được duyệt",
                "Hồ sơ doanh nghiệp của bạn đã bị từ chối. Lý do: " + reason
        );

        Map<String, Object> result = toResponse(partner);
        result.put("message", "Đã từ chối hồ sơ nhà cung cấp.");

        return result;
    }

    @PutMapping("/{id}/status")
    @Transactional
    public Map<String, Object> updateProviderStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> request,
            Authentication authentication) {

        Partner partner = findPartnerForUpdate(id);
        User user = requireLinkedUser(partner);

        String requestedStatus = normalize(request == null ? null : request.get("status"));
        String reason = requireReason(request == null ? null : request.get("reason"), "lý do thay đổi trạng thái");

        if (!List.of("ACTIVE", "LOCKED").contains(requestedStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chỉ được chuyển nhà cung cấp sang ACTIVE hoặc LOCKED.");
        }

        String oldStatus = normalizePartnerStatus(partner);

        if ("PENDING".equals(oldStatus) || "REJECTED".equals(oldStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Hồ sơ chưa được duyệt hoặc đã bị từ chối. Không thể mở khóa bằng thao tác trạng thái.");
        }

        if (oldStatus.equals(requestedStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nhà cung cấp đã ở trạng thái được chọn.");
        }

        if ("ACTIVE".equals(requestedStatus) && !"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tài khoản người dùng đang bị khóa. Mở khóa tài khoản riêng trước.");
        }

        partner.setStatus(requestedStatus);
        partner.setVersion(partner.getVersion() == null ? 1 : partner.getVersion() + 1);

        partnerRepository.save(partner);

        saveHistory(partner, oldStatus, requestedStatus, reason, "STATUS_CHANGE", authentication);

        auditLogService.record(
                authentication,
                "PROVIDER_STATUS_CHANGED",
                "PARTNER",
                partner.getId(),
                reason,
                "status=" + oldStatus,
                "status=" + requestedStatus + ";version=" + partner.getVersion()
        );

        sendProviderNotification(
                partner,
                "LOCKED".equals(requestedStatus) ? "PROVIDER_SUSPENDED" : "PROVIDER_REACTIVATED",
                "LOCKED".equals(requestedStatus) ? "Doanh nghiệp tạm ngừng hoạt động" : "Doanh nghiệp được kích hoạt lại",
                "LOCKED".equals(requestedStatus)
                        ? "Tài khoản doanh nghiệp đã bị đình chỉ nhận đơn mới. Lý do: " + reason
                        : "Tài khoản doanh nghiệp đã được kích hoạt lại."
        );

        Map<String, Object> result = toResponse(partner);
        result.put("message", "LOCKED".equals(requestedStatus) ? "Đã đình chỉ nhà cung cấp." : "Đã kích hoạt lại nhà cung cấp.");

        return result;
    }

    private void sendProviderNotification(Partner partner, String type, String title, String message) {
        if (partner.getUser() == null) {
            return;
        }

        String safeMessage = message == null ? "" : message;

        if (safeMessage.length() > 1000) {
            safeMessage = safeMessage.substring(0, 997) + "...";
        }

        notificationRepository.save(AdminNotification.builder()
                .recipient(partner.getUser())
                .type(type)
                .title(title)
                .message(safeMessage)
                .referenceType("PARTNER")
                .referenceId(partner.getId())
                .build());
    }

    private Partner findPartner(Long id) {
        return partnerRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy nhà cung cấp."));
    }

    private Partner findPartnerForUpdate(Long id) {
        return partnerRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy nhà cung cấp."));
    }

    private User requireLinkedUser(Partner partner) {
        if (partner.getUser() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nhà cung cấp chưa được liên kết với tài khoản người dùng.");
        }

        return partner.getUser();
    }

    private void validateApprovedCoordinates(Partner partner) {
        if (partner.getLatitude() == null || partner.getLongitude() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Chưa có tọa độ doanh nghiệp để thẩm định.");
        }

        double latitude = partner.getLatitude().doubleValue();
        double longitude = partner.getLongitude().doubleValue();

        if (latitude < -90 || latitude > 90
                || longitude < -180 || longitude > 180
                || latitude == 0.0 && longitude == 0.0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tọa độ không hợp lệ hoặc đang là vị trí mặc định (0,0).");
        }
    }

    private String requireReason(String value, String label) {
        String reason = value == null ? "" : value.trim();

        if (reason.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập " + label + ".");
        }

        if (reason.length() > 2000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lý do không được vượt quá 2000 ký tự.");
        }

        return reason;
    }

    private void saveHistory(
            Partner partner,
            String oldStatus,
            String newStatus,
            String reason,
            String actionType,
            Authentication authentication) {

        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Không xác định được người thực hiện.");
        }

        historyRepository.save(PartnerStatusHistory.builder()
                .partner(partner)
                .oldStatus(oldStatus)
                .newStatus(newStatus)
                .reason(reason)
                .actionType(actionType)
                .changedByEmail(authentication.getName())
                .build());
    }

    private Map<String, Object> toResponse(Partner partner) {
        User user = partner.getUser();
        List<PartnerService> services = partnerServiceRepository.findByPartner_Id(partner.getId());

        String partnerStatus = normalizePartnerStatus(partner);
        String accountStatus = user == null ? "UNKNOWN" : normalize(user.getStatus());

        Map<String, Object> result = new LinkedHashMap<>();

        result.put("id", partner.getId());
        result.put("userId", user == null ? null : user.getId());
        result.put("name", partner.getBusinessName() == null ? "" : partner.getBusinessName());
        result.put("email", user == null || user.getEmail() == null ? "" : user.getEmail());
        result.put("phone", user == null || user.getPhone() == null ? "" : user.getPhone());
        result.put("address", partner.getAddress() == null ? "" : partner.getAddress());
        result.put("latitude", partner.getLatitude());
        result.put("longitude", partner.getLongitude());
        result.put("version", partner.getVersion());
        result.put("services", services.size());
        result.put("status", toVietnameseStatus(partnerStatus));
        result.put("databaseStatus", partnerStatus);
        result.put("partnerStatus", partnerStatus);
        result.put("accountStatus", accountStatus);
        result.put("effectiveStatus", "ACTIVE".equals(partnerStatus) && "ACTIVE".equals(accountStatus) ? "ACTIVE" : "INACTIVE");
        result.put("joinedAt", partner.getCreatedAt() == null ? "" : partner.getCreatedAt().format(DATE_FORMAT));
        result.put("description", partner.getDescription());
        result.put("taxCode", partner.getTaxCode());
        result.put("ratingAverage", partner.getRatingAverage());
        result.put("totalCompletedJobs", partner.getTotalCompletedJobs());

        return result;
    }

    private String normalizePartnerStatus(Partner partner) {
        String status = normalize(partner.getStatus());
        return PARTNER_STATUSES.contains(status) ? status : "PENDING";
    }

    private String toVietnameseStatus(String status) {
        return switch (status) {
            case "ACTIVE" -> "Đang hoạt động";
            case "PENDING" -> "Chờ duyệt";
            case "REJECTED" -> "Đã từ chối";
            default -> "Đã đình chỉ";
        };
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private boolean contains(String value, String keyword) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(keyword);
    }
}