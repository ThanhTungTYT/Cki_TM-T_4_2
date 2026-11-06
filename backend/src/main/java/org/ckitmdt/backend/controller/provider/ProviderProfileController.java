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

        String rawType = text(body.get("type")).toUpperCase();
        final String type = rawType.isBlank() ? "PROFILE_UPDATE" : rawType;
        String reason = text(body.get("reason"));
        if (reason.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập lý do yêu cầu thay đổi.");
        }

        // Validate coordinates if LOCATION_UPDATE
        if ("LOCATION_UPDATE".equals(type)) {
            Object latObj = body.get("latitude");
            Object lonObj = body.get("longitude");
            if (latObj != null && lonObj != null) {
                try {
                    double lat = Double.parseDouble(String.valueOf(latObj));
                    double lon = Double.parseDouble(String.valueOf(lonObj));
                    if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || (lat == 0 && lon == 0)) {
                        throw new IllegalArgumentException();
                    }
                } catch (Exception e) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tọa độ không hợp lệ.");
                }
            }
        }

        // Check if there is already a PENDING_REVIEW request of this type
        boolean hasPending = changeRequestRepository.findByPartner_IdAndStatusOrderByCreatedAtDesc(partner.getId(), "PENDING_REVIEW")
                .stream().anyMatch(r -> type.equalsIgnoreCase(r.getRequestType()));
        if (hasPending) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bạn đang có một yêu cầu loại này đang chờ Admin duyệt.");
        }

        String proposedSnapshot = text(body.get("proposedSnapshot"));
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

        String oldSnapshot = text(body.get("oldSnapshot"));
        if (oldSnapshot.isBlank()) {
            if ("LOCATION_UPDATE".equals(type)) {
                oldSnapshot = "address=" + (partner.getAddress() != null ? partner.getAddress() : "")
                        + ";latitude=" + (partner.getLatitude() != null ? partner.getLatitude() : "")
                        + ";longitude=" + (partner.getLongitude() != null ? partner.getLongitude() : "");
            } else if ("PROFILE_UPDATE".equals(type)) {
                oldSnapshot = "businessName=" + partner.getBusinessName()
                        + ";description=" + (partner.getDescription() != null ? partner.getDescription() : "")
                        + ";taxCode=" + (partner.getTaxCode() != null ? partner.getTaxCode() : "");
            }
        }

        LocalDateTime now = LocalDateTime.now();
        BusinessChangeRequest req = BusinessChangeRequest.builder()
                .partner(partner)
                .requestType(type)
                .status("PENDING_REVIEW")
                .targetId(partner.getId())
                .targetName(partner.getBusinessName())
                .oldSnapshot(oldSnapshot)
                .proposedSnapshot(proposedSnapshot)
                .reason(reason)
                .evidenceUrl(text(body.get("evidenceUrl")))
                .submittedBy(auth.getName())
                .createdAt(now)
                .updatedAt(now)
                .build();

        return changeRequestRow(changeRequestRepository.save(req));
    }

    @PostMapping("/change-requests/{id}/withdraw")
    @Transactional
    public Map<String, Object> withdrawChangeRequest(
            @PathVariable Long id,
            Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        BusinessChangeRequest req = changeRequestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy yêu cầu."));

        if (!req.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền thao tác yêu cầu này.");
        }

        if (!"PENDING_REVIEW".equalsIgnoreCase(req.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chỉ có thể rút yêu cầu đang chờ duyệt.");
        }

        req.setStatus("WITHDRAWN");
        req.setUpdatedAt(LocalDateTime.now());
        return changeRequestRow(changeRequestRepository.save(req));
    }

    public Map<String, Object> changeRequestRow(BusinessChangeRequest r) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", r.getId());
        map.put("partnerId", r.getPartner().getId());
        map.put("businessName", r.getPartner().getBusinessName());
        map.put("requestType", r.getRequestType());
        map.put("status", r.getStatus());
        map.put("targetId", r.getTargetId());
        map.put("targetName", r.getTargetName());
        map.put("oldSnapshot", r.getOldSnapshot());
        map.put("proposedSnapshot", r.getProposedSnapshot());
        map.put("reason", r.getReason());
        map.put("evidenceUrl", r.getEvidenceUrl());
        map.put("rejectReason", r.getRejectReason());
        map.put("submittedBy", r.getSubmittedBy());
        map.put("reviewedBy", r.getReviewedBy());
        map.put("createdAt", r.getCreatedAt());
        map.put("reviewedAt", r.getReviewedAt());
        return map;
    }
}
