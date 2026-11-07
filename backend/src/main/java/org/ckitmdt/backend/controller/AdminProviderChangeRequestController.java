package org.ckitmdt.backend.controller;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.BusinessChangeRequest;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.entity.PartnerService;
import org.ckitmdt.backend.entity.Service;
import org.ckitmdt.backend.entity.AdminNotification;
import org.ckitmdt.backend.repository.BusinessChangeRequestRepository;
import org.ckitmdt.backend.repository.PartnerRepository;
import org.ckitmdt.backend.repository.PartnerServiceRepository;
import org.ckitmdt.backend.repository.ServiceRepository;
import org.ckitmdt.backend.repository.AdminNotificationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/admin/provider-change-requests")
@RequiredArgsConstructor
public class AdminProviderChangeRequestController {

    private final BusinessChangeRequestRepository requestRepository;
    private final PartnerRepository partnerRepository;
    private final PartnerServiceRepository partnerServiceRepository;
    private final ServiceRepository serviceRepository;
    private final ObjectMapper objectMapper;
    private final AdminNotificationRepository notificationRepository;

    private static final Set<String> VALID_STATUSES = Set.of(
            "PENDING_REVIEW",
            "NEEDS_INFORMATION",
            "APPROVED",
            "REJECTED",
            "WITHDRAWN"
    );

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> listRequests(
            @RequestParam(required = false) String status) {

        List<BusinessChangeRequest> requests;

        if (status == null || status.isBlank()) {
            requests = requestRepository.findAllByOrderByCreatedAtDesc();
        } else {
            String normalizedStatus = status.trim().toUpperCase();

            if (!VALID_STATUSES.contains(normalizedStatus)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Trạng thái yêu cầu không hợp lệ."
                );
            }

            requests = requestRepository.findByStatusOrderByCreatedAtDesc(
                    normalizedStatus
            );
        }

        return requests.stream().map(this::toResponse).toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Map<String, Object> getRequest(@PathVariable Long id) {
        BusinessChangeRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy yêu cầu xét duyệt."
                ));

        return toResponse(request);
    }

    @PostMapping("/{id}/approve")
    @Transactional
    public Map<String, Object> approveRequest(
            @PathVariable Long id,
            Authentication authentication) {

        BusinessChangeRequest request = getRequestForUpdate(id);
        ensurePending(request);

        Partner partner = partnerRepository.findByIdForUpdate(
                request.getPartner().getId()
        ).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Không tìm thấy hồ sơ doanh nghiệp."
        ));

        String type = normalize(request.getRequestType());

        if (Set.of("LOCATION_UPDATE", "PROFILE_UPDATE").contains(type)
                && request.getBaseVersion() != null
                && !Objects.equals(
                request.getBaseVersion(),
                partner.getVersion() == null ? 1 : partner.getVersion()
        )) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Hồ sơ Provider đã thay đổi sau khi gửi yêu cầu. Yêu cầu này đã cũ, vui lòng yêu cầu Provider gửi lại."
            );
        }

        Map<String, String> oldValues =
                parseSnapshot(request.getOldSnapshot());

        Map<String, String> newValues =
                parseSnapshot(request.getProposedSnapshot());

        switch (type) {
            case "LOCATION_UPDATE" ->
                    applyLocationUpdate(partner, oldValues, newValues);

            case "PROFILE_UPDATE" ->
                    applyProfileUpdate(partner, oldValues, newValues);

            case "SERVICE_REGISTER" ->
                    applyServiceRegister(request, partner, newValues);

            case "SERVICE_UPDATE" ->
                    applyServiceUpdate(partner, oldValues, newValues);

            case "SERVICE_PAUSE" ->
                    applyServiceStatus(partner, newValues, "PAUSED");

            case "SERVICE_RETIRE" ->
                    applyServiceStatus(partner, newValues, "INACTIVE");

            default -> throw new ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "Loại yêu cầu chưa được hỗ trợ: " + type
            );
        }

        LocalDateTime now = LocalDateTime.now();

        request.setStatus("APPROVED");
        request.setRejectReason(null);
        request.setReviewedBy(getActor(authentication));
        request.setReviewedAt(now);
        request.setUpdatedAt(now);

        requestRepository.save(request);

        sendNotification(
                request,
                "CHANGE_REQUEST_APPROVED",
                "Yêu cầu cập nhật hồ sơ đã được phê duyệt",
                "Yêu cầu #" + request.getId()
                        + " (" + request.getRequestType()
                        + ") đã được phê duyệt thành công.",
                now
        );

        return toResponse(request);
    }

    @PostMapping("/{id}/reject")
    @Transactional
    public Map<String, Object> rejectRequest(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body,
            Authentication authentication) {

        BusinessChangeRequest request = getRequestForUpdate(id);
        ensurePending(request);

        String reason = body == null || body.get("rejectReason") == null
                ? ""
                : String.valueOf(body.get("rejectReason")).trim();

        if (reason.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng nhập lý do từ chối."
            );
        }

        LocalDateTime now = LocalDateTime.now();

        request.setStatus("REJECTED");
        request.setRejectReason(reason);
        request.setReviewedBy(getActor(authentication));
        request.setReviewedAt(now);
        request.setUpdatedAt(now);

        requestRepository.save(request);

        sendNotification(
                request,
                "CHANGE_REQUEST_REJECTED",
                "Yêu cầu cập nhật hồ sơ bị từ chối",
                "Yêu cầu #" + request.getId()
                        + " (" + request.getRequestType()
                        + ") đã bị từ chối: " + reason
                        + ". Vui lòng tạo yêu cầu mới kèm thông tin đầy đủ.",
                now
        );

        return toResponse(request);
    }

    @PostMapping("/{id}/request-info")
    @Transactional
    public Map<String, Object> requestMoreInformation(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body,
            Authentication authentication) {

        BusinessChangeRequest request = getRequestForUpdate(id);
        ensurePending(request);

        String note = body == null || body.get("requestInfo") == null
                ? ""
                : String.valueOf(body.get("requestInfo")).trim();

        if (note.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng ghi rõ thông tin hoặc tài liệu cần bổ sung."
            );
        }

        if (note.length() < 5) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Nội dung yêu cầu bổ sung phải có ít nhất 5 ký tự."
            );
        }

        if (note.length() > 2000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Nội dung yêu cầu bổ sung không được vượt quá 2000 ký tự."
            );
        }

        LocalDateTime now = LocalDateTime.now();

        request.setStatus("NEEDS_INFORMATION");
        request.setRejectReason(note);
        request.setReviewedBy(getActor(authentication));
        request.setReviewedAt(now);
        request.setUpdatedAt(now);

        requestRepository.save(request);

        sendNotification(
                request,
                "CHANGE_REQUEST_NEEDS_INFORMATION",
                "Yêu cầu cập nhật hồ sơ cần bổ sung thông tin",
                "Yêu cầu #" + request.getId()
                        + " (" + request.getRequestType()
                        + ") cần bổ sung: " + note
                        + ". Vui lòng gửi một yêu cầu mới kèm thông tin/tài liệu đầy đủ.",
                now
        );

        return toResponse(request);
    }

    private void sendNotification(
            BusinessChangeRequest request,
            String type,
            String title,
            String message,
            LocalDateTime now) {

        if (request.getPartner() == null
                || request.getPartner().getUser() == null) {
            return;
        }

        notificationRepository.save(
                AdminNotification.builder()
                        .recipient(request.getPartner().getUser())
                        .type(type)
                        .title(title)
                        .message(message)
                        .referenceType("CHANGE_REQUEST")
                        .referenceId(request.getId())
                        .createdAt(now)
                        .build()
        );
    }

    private BusinessChangeRequest getRequestForUpdate(Long id) {
        return requestRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy yêu cầu xét duyệt."
                ));
    }

    private void ensurePending(BusinessChangeRequest request) {
        if (!"PENDING_REVIEW".equalsIgnoreCase(request.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Yêu cầu không còn ở trạng thái chờ duyệt. Vui lòng tải lại danh sách."
            );
        }
    }

    private void applyLocationUpdate(
            Partner partner,
            Map<String, String> oldValues,
            Map<String, String> newValues) {

        checkOldValue(oldValues, "address", partner.getAddress());
        checkOldValue(oldValues, "latitude", partner.getLatitude());
        checkOldValue(oldValues, "longitude", partner.getLongitude());

        String address = newValues.get("address");
        String latitude = newValues.get("latitude");
        String longitude = newValues.get("longitude");

        if (address == null || address.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "Địa chỉ hoạt động không được để trống."
            );
        }

        BigDecimal lat = parseDecimal(latitude, "Latitude");
        BigDecimal lon = parseDecimal(longitude, "Longitude");

        if (lat.compareTo(BigDecimal.valueOf(-90)) < 0
                || lat.compareTo(BigDecimal.valueOf(90)) > 0) {
            throw new ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "Latitude phải nằm trong khoảng -90 đến 90."
            );
        }

        if (lon.compareTo(BigDecimal.valueOf(-180)) < 0
                || lon.compareTo(BigDecimal.valueOf(180)) > 0) {
            throw new ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "Longitude phải nằm trong khoảng -180 đến 180."
            );
        }

        if (lat.compareTo(BigDecimal.ZERO) == 0
                && lon.compareTo(BigDecimal.ZERO) == 0) {
            throw new ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "Tọa độ (0,0) không được chấp nhận."
            );
        }

        partner.setAddress(address.trim());
        partner.setLatitude(lat);
        partner.setLongitude(lon);

        updatePartnerVersion(partner);
    }

    private void applyProfileUpdate(
            Partner partner,
            Map<String, String> oldValues,
            Map<String, String> newValues) {

        checkOldValue(oldValues, "businessName", partner.getBusinessName());
        checkOldValue(oldValues, "description", partner.getDescription());
        checkOldValue(oldValues, "taxCode", partner.getTaxCode());

        String businessName = newValues.get("businessName");

        if (businessName == null || businessName.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "Tên doanh nghiệp không được để trống."
            );
        }

        partner.setBusinessName(businessName.trim());

        if (newValues.containsKey("description")) {
            partner.setDescription(newValues.get("description"));
        }

        if (newValues.containsKey("taxCode")) {
            partner.setTaxCode(newValues.get("taxCode"));
        }

        updatePartnerVersion(partner);
    }

    private void applyServiceRegister(
            BusinessChangeRequest request,
            Partner partner,
            Map<String, String> values) {

        Long serviceId = getServiceId(request, values);

        Service service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Dịch vụ sàn không tồn tại."
                ));

        if (!"ACTIVE".equalsIgnoreCase(service.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Dịch vụ sàn hiện không hoạt động nên không thể đăng ký."
            );
        }

        BigDecimal price = values.containsKey("price")
                ? parseDecimal(values.get("price"), "Giá dịch vụ")
                : service.getBasePrice();

        validatePrice(price);

        Optional<PartnerService> existing =
                findPartnerService(partner.getId(), serviceId);

        LocalDateTime now = LocalDateTime.now();

        if (existing.isPresent()) {
            PartnerService partnerService = existing.get();

            partnerService.setPrice(price);
            partnerService.setStatus("ACTIVE");
            partnerService.setUpdatedAt(now);

            partnerServiceRepository.save(partnerService);
            return;
        }

        PartnerService partnerService = PartnerService.builder()
                .partner(partner)
                .service(service)
                .price(price)
                .status("ACTIVE")
                .createdAt(now)
                .updatedAt(now)
                .build();

        partnerServiceRepository.save(partnerService);
    }

    private void applyServiceUpdate(
            Partner partner,
            Map<String, String> oldValues,
            Map<String, String> newValues) {

        Long serviceId = getServiceId(oldValues, newValues);

        PartnerService partnerService =
                findPartnerService(partner.getId(), serviceId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Provider không có dịch vụ tương ứng với yêu cầu này."
                        ));

        if (oldValues.containsKey("price")) {
            BigDecimal oldPrice =
                    parseDecimal(oldValues.get("price"), "Giá cũ");

            if (partnerService.getPrice() == null
                    || partnerService.getPrice().compareTo(oldPrice) != 0) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Giá dịch vụ đã thay đổi sau khi gửi yêu cầu. Không thể áp dụng yêu cầu cũ."
                );
            }
        }

        if (newValues.containsKey("price")) {
            BigDecimal newPrice =
                    parseDecimal(newValues.get("price"), "Giá đề xuất");

            validatePrice(newPrice);
            partnerService.setPrice(newPrice);
        }

        if (newValues.containsKey("status")) {
            String status = normalize(newValues.get("status"));

            if (!Set.of("ACTIVE", "PAUSED", "INACTIVE").contains(status)) {
                throw new ResponseStatusException(
                        HttpStatus.UNPROCESSABLE_ENTITY,
                        "Trạng thái dịch vụ đề xuất không hợp lệ."
                );
            }

            partnerService.setStatus(status);
        }

        partnerService.setUpdatedAt(LocalDateTime.now());
        partnerServiceRepository.save(partnerService);
    }

    private void applyServiceStatus(
            Partner partner,
            Map<String, String> values,
            String targetStatus) {

        Long serviceId = getServiceId(values, values);

        PartnerService partnerService =
                findPartnerService(partner.getId(), serviceId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Không tìm thấy dịch vụ Provider cần cập nhật."
                        ));

        partnerService.setStatus(targetStatus);
        partnerService.setUpdatedAt(LocalDateTime.now());

        partnerServiceRepository.save(partnerService);
    }

    private Optional<PartnerService> findPartnerService(
            Long partnerId,
            Long serviceId) {

        return partnerServiceRepository.findByPartner_Id(partnerId)
                .stream()
                .filter(item -> item.getService() != null
                        && Objects.equals(item.getService().getId(), serviceId))
                .findFirst();
    }

    private Long getServiceId(
            BusinessChangeRequest request,
            Map<String, String> values) {

        if (values.containsKey("serviceId")) {
            return parseLong(values.get("serviceId"), "Mã dịch vụ");
        }

        if (request.getTargetId() != null
                && !Objects.equals(
                request.getTargetId(),
                request.getPartner().getId()
        )) {
            return request.getTargetId();
        }

        throw new ResponseStatusException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "Yêu cầu không có mã dịch vụ hợp lệ."
        );
    }

    private Long getServiceId(
            Map<String, String> oldValues,
            Map<String, String> newValues) {

        String serviceId = newValues.get("serviceId");

        if (serviceId == null || serviceId.isBlank()) {
            serviceId = oldValues.get("serviceId");
        }

        if (serviceId == null || serviceId.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "Yêu cầu không có mã dịch vụ."
            );
        }

        return parseLong(serviceId, "Mã dịch vụ");
    }

    private void checkOldValue(
            Map<String, String> oldValues,
            String key,
            Object currentValue) {

        if (!oldValues.containsKey(key)) {
            return;
        }

        String expected = oldValues.get(key);
        String current = currentValue == null
                ? ""
                : String.valueOf(currentValue);

        if ("latitude".equals(key) || "longitude".equals(key)) {
            if (expected.isBlank() && current.isBlank()) {
                return;
            }

            try {
                if (new BigDecimal(expected)
                        .compareTo(new BigDecimal(current)) == 0) {
                    return;
                }
            } catch (Exception ignored) {
            }
        } else if (Objects.equals(expected, current)) {
            return;
        }

        throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Thông tin hiện tại đã thay đổi sau khi Provider gửi yêu cầu. Vui lòng kiểm tra lại."
        );
    }

    private void updatePartnerVersion(Partner partner) {
        partner.setVersion(
                partner.getVersion() == null
                        ? 2
                        : partner.getVersion() + 1
        );

        partner.setUpdatedAt(LocalDateTime.now());
        partnerRepository.save(partner);
    }

    private BigDecimal parseDecimal(
            String value,
            String fieldName) {

        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    fieldName + " không được để trống."
            );
        }

        try {
            return new BigDecimal(value.trim());
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    fieldName + " không hợp lệ."
            );
        }
    }

    private Long parseLong(
            String value,
            String fieldName) {

        try {
            return Long.parseLong(value.trim());
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    fieldName + " không hợp lệ."
            );
        }
    }

    private void validatePrice(BigDecimal price) {
        if (price == null
                || price.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "Giá dịch vụ phải lớn hơn 0."
            );
        }
    }

    private Map<String, String> parseSnapshot(String snapshot) {
        Map<String, String> values = new LinkedHashMap<>();

        if (snapshot == null || snapshot.isBlank()) {
            return values;
        }

        String clean = snapshot.trim();

        if (clean.startsWith("{") && clean.endsWith("}")) {
            try {
                JsonNode node = objectMapper.readTree(clean);

                if (node.isObject()) {
                    node.properties().forEach(entry -> {
                        JsonNode value = entry.getValue();

                        values.put(
                                entry.getKey(),
                                value == null || value.isNull()
                                        ? ""
                                        : value.isValueNode()
                                        ? value.asText()
                                        : value.toString()
                        );
                    });

                    return values;
                }
            } catch (Exception ignored) {
            }
        }

        String[] pairs = clean.split(";");

        for (String pair : pairs) {
            int separator = pair.indexOf('=');

            if (separator < 1) {
                continue;
            }

            String key = pair.substring(0, separator).trim();
            String value = pair.substring(separator + 1).trim();

            if (!key.isBlank()) {
                values.put(key, value);
            }
        }

        return values;
    }

    private String normalize(String value) {
        return value == null
                ? ""
                : value.trim().toUpperCase();
    }

    private String getActor(Authentication authentication) {
        return authentication == null
                ? "admin"
                : authentication.getName();
    }

    private Map<String, Object> toResponse(
            BusinessChangeRequest request) {

        Map<String, Object> result = new LinkedHashMap<>();

        result.put("id", request.getId());
        result.put("partnerId", request.getPartner().getId());
        result.put("businessName", request.getPartner().getBusinessName());
        result.put("requestType", request.getRequestType());
        result.put("status", request.getStatus());
        result.put("targetId", request.getTargetId());
        result.put("baseVersion", request.getBaseVersion());
        result.put("targetName", request.getTargetName());
        result.put("oldSnapshot", request.getOldSnapshot());
        result.put("proposedSnapshot", request.getProposedSnapshot());
        result.put("reason", request.getReason());
        result.put("evidenceUrl", request.getEvidenceUrl());
        result.put("rejectReason", request.getRejectReason());
        result.put("submittedBy", request.getSubmittedBy());
        result.put("reviewedBy", request.getReviewedBy());
        result.put("createdAt", request.getCreatedAt());
        result.put("updatedAt", request.getUpdatedAt());
        result.put("reviewedAt", request.getReviewedAt());

        return result;
    }
}