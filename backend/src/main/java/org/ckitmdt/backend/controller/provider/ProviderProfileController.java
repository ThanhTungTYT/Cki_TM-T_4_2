package org.ckitmdt.backend.controller.provider;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.BusinessChangeRequest;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.repository.BusinessChangeRequestRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.ckitmdt.backend.controller.provider.ProviderSecurityHelper.text;

@RestController
@RequestMapping("/api/provider")
@RequiredArgsConstructor
public class ProviderProfileController {

    private final ProviderSecurityHelper helper;
    private final BusinessChangeRequestRepository changeRequestRepository;

    @GetMapping("/profile")
    @Transactional(readOnly = true)
    public Map<String, Object> getProfile(Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", partner.getId());
        map.put("businessName", partner.getBusinessName());
        map.put("description", partner.getDescription());
        map.put("taxCode", partner.getTaxCode());
        map.put("address", partner.getAddress() != null ? partner.getAddress() : "Chưa có địa chỉ được xác nhận");
        map.put("latitude", partner.getLatitude());
        map.put("longitude", partner.getLongitude());
        map.put("version", partner.getVersion() != null ? partner.getVersion() : 1);
        map.put("status", partner.getStatus());
        map.put("ratingAverage", partner.getRatingAverage());
        map.put("totalCompletedJobs", partner.getTotalCompletedJobs());
        map.put("phone", partner.getUser() != null ? partner.getUser().getPhone() : "");
        map.put("email", partner.getUser() != null ? partner.getUser().getEmail() : "");
        map.put("createdAt", partner.getCreatedAt());
        map.put("updatedAt", partner.getUpdatedAt());
        return map;
    }

    @GetMapping("/change-requests")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getChangeRequests(Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        return changeRequestRepository.findByPartner_IdOrderByCreatedAtDesc(partner.getId())
                .stream().map(this::changeRequestRow).toList();
    }

    @PostMapping("/change-requests")
    @Transactional
    public Map<String, Object> createChangeRequest(
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        Partner partner = helper.currentPartner(auth);

        String requestedType = text(body.get("type")).trim().toUpperCase();
        final String type = requestedType.isBlank() ? "PROFILE_UPDATE" : requestedType;

        if (!List.of(
                "LOCATION_UPDATE",
                "PROFILE_UPDATE",
                "SERVICE_REGISTER",
                "SERVICE_UPDATE",
                "SERVICE_PAUSE",
                "SERVICE_RETIRE"
        ).contains(type)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Loại yêu cầu thay đổi không hợp lệ."
            );
        }

        String reason = text(body.get("reason")).trim();

        if (reason.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng nhập lý do yêu cầu thay đổi."
            );
        }

        boolean hasPending = changeRequestRepository
                .findByPartner_IdOrderByCreatedAtDesc(partner.getId())
                .stream()
                .anyMatch(request ->
                        type.equalsIgnoreCase(request.getRequestType())
                                && "PENDING_REVIEW".equalsIgnoreCase(request.getStatus())
                );

        if (hasPending) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Bạn đang có yêu cầu cùng loại chưa được xử lý."
            );
        }

        String proposedSnapshot = text(body.get("proposedSnapshot")).trim();

        if (proposedSnapshot.isBlank()) {
            if ("LOCATION_UPDATE".equals(type)) {
                proposedSnapshot = "address=" + text(body.get("address"))
                        + ";latitude=" + text(body.get("latitude"))
                        + ";longitude=" + text(body.get("longitude"));
            } else if ("PROFILE_UPDATE".equals(type)) {
                proposedSnapshot = "businessName=" + text(body.get("businessName"))
                        + ";description=" + text(body.get("description"))
                        + ";taxCode=" + text(body.get("taxCode"));
            } else {
                proposedSnapshot = body.toString();
            }
        }

        String oldSnapshot = "";
        Integer baseVersion = null;

        if ("LOCATION_UPDATE".equals(type)) {
            oldSnapshot = "address=" + (partner.getAddress() == null ? "" : partner.getAddress())
                    + ";latitude=" + (partner.getLatitude() == null ? "" : partner.getLatitude())
                    + ";longitude=" + (partner.getLongitude() == null ? "" : partner.getLongitude());

            baseVersion = partner.getVersion() == null ? 1 : partner.getVersion();
        } else if ("PROFILE_UPDATE".equals(type)) {
            oldSnapshot = "businessName=" + partner.getBusinessName()
                    + ";description=" + (partner.getDescription() == null ? "" : partner.getDescription())
                    + ";taxCode=" + (partner.getTaxCode() == null ? "" : partner.getTaxCode());

            baseVersion = partner.getVersion() == null ? 1 : partner.getVersion();
        }

        if ("LOCATION_UPDATE".equals(type)) {
            Map<String, String> proposed = parseSnapshot(proposedSnapshot);
            validateCoordinates(
                    proposed.get("latitude"),
                    proposed.get("longitude")
            );
        }

        LocalDateTime now = LocalDateTime.now();

        BusinessChangeRequest request = BusinessChangeRequest.builder()
                .partner(partner)
                .requestType(type)
                .status("PENDING_REVIEW")
                .targetId(body.get("targetId") == null
                        ? partner.getId()
                        : parseLong(body.get("targetId"), "Mã đối tượng"))
                .targetName(text(body.get("targetName")).isBlank()
                        ? partner.getBusinessName()
                        : text(body.get("targetName")))
                .baseVersion(baseVersion)
                .oldSnapshot(oldSnapshot)
                .proposedSnapshot(proposedSnapshot)
                .reason(reason)
                .evidenceUrl(text(body.get("evidenceUrl")))
                .submittedBy(auth == null ? "provider" : auth.getName())
                .createdAt(now)
                .updatedAt(now)
                .build();

        return changeRequestRow(changeRequestRepository.save(request));
    }

    private void validateCoordinates(String latitude, String longitude) {
        try {
            if (latitude == null || longitude == null
                    || latitude.isBlank() || longitude.isBlank()) {
                throw new IllegalArgumentException();
            }

            double lat = Double.parseDouble(latitude);
            double lon = Double.parseDouble(longitude);

            if (!Double.isFinite(lat)
                    || !Double.isFinite(lon)
                    || lat < -90
                    || lat > 90
                    || lon < -180
                    || lon > 180
                    || (lat == 0 && lon == 0)) {
                throw new IllegalArgumentException();
            }
        } catch (Exception exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tọa độ không hợp lệ."
            );
        }
    }

    private Map<String, String> parseSnapshot(String snapshot) {
        Map<String, String> values = new LinkedHashMap<>();

        if (snapshot == null || snapshot.isBlank()) {
            return values;
        }

        for (String pair : snapshot.split(";")) {
            int separator = pair.indexOf('=');

            if (separator > 0) {
                values.put(
                        pair.substring(0, separator).trim(),
                        pair.substring(separator + 1).trim()
                );
            }
        }

        return values;
    }

    private Long parseLong(Object value, String field) {
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (Exception exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    field + " không hợp lệ."
            );
        }
    }

    @PostMapping("/change-requests/{id}/withdraw")
    @Transactional
    public Map<String, Object> withdrawChangeRequest(
            @PathVariable Long id,
            Authentication auth) {

        Partner partner = helper.currentPartner(auth);

        BusinessChangeRequest request = changeRequestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy yêu cầu."
                ));

        if (!request.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Không có quyền thao tác yêu cầu này."
            );
        }

        if (!"PENDING_REVIEW".equalsIgnoreCase(request.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Chỉ có thể rút yêu cầu đang chờ duyệt."
            );
        }

        request.setStatus("WITHDRAWN");
        request.setUpdatedAt(LocalDateTime.now());

        return changeRequestRow(changeRequestRepository.save(request));
    }

    public Map<String, Object> changeRequestRow(BusinessChangeRequest request) {
        Map<String, Object> map = new LinkedHashMap<>();

        map.put("id", request.getId());
        map.put("partnerId", request.getPartner().getId());
        map.put("businessName", request.getPartner().getBusinessName());
        map.put("requestType", request.getRequestType());
        map.put("status", request.getStatus());
        map.put("targetId", request.getTargetId());
        map.put("baseVersion", request.getBaseVersion());
        map.put("targetName", request.getTargetName());
        map.put("oldSnapshot", request.getOldSnapshot());
        map.put("proposedSnapshot", request.getProposedSnapshot());
        map.put("reason", request.getReason());
        map.put("evidenceUrl", request.getEvidenceUrl());
        map.put("rejectReason", request.getRejectReason());
        map.put("submittedBy", request.getSubmittedBy());
        map.put("reviewedBy", request.getReviewedBy());
        map.put("createdAt", request.getCreatedAt());
        map.put("reviewedAt", request.getReviewedAt());

        return map;
    }
}