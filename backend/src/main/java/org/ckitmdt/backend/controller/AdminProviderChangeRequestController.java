package org.ckitmdt.backend.controller;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.BusinessChangeRequest;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.entity.PartnerService;
import org.ckitmdt.backend.entity.Service;
import org.ckitmdt.backend.repository.BusinessChangeRequestRepository;
import org.ckitmdt.backend.repository.PartnerRepository;
import org.ckitmdt.backend.repository.PartnerServiceRepository;
import org.ckitmdt.backend.repository.ServiceRepository;
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

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> listRequests(
            @RequestParam(required = false) String status) {

        List<BusinessChangeRequest> list;
        if (status != null && !status.isBlank()) {
            list = requestRepository.findByStatusOrderByCreatedAtDesc(status.trim().toUpperCase());
        } else {
            list = requestRepository.findAllByOrderByCreatedAtDesc();
        }

        return list.stream().map(this::row).toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Map<String, Object> getRequest(@PathVariable Long id) {
        BusinessChangeRequest req = requestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy yêu cầu xét duyệt."));
        return row(req);
    }

    @PostMapping("/{id}/approve")
    @Transactional
    public Map<String, Object> approveRequest(
            @PathVariable Long id,
            Authentication auth) {

        BusinessChangeRequest req = requestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy yêu cầu xét duyệt."));

        if (!"PENDING_REVIEW".equalsIgnoreCase(req.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Yêu cầu đã được xử lý trước đó.");
        }

        Partner partner = req.getPartner();
        String type = req.getRequestType().toUpperCase();

        // Áp dụng thay đổi tương ứng loại yêu cầu
        if ("LOCATION_UPDATE".equals(type)) {
            // Snapshot parse đơn giản từ proposedSnapshot
            Map<String, String> values = parseSnapshot(req.getProposedSnapshot());
            if (values.containsKey("latitude") && !values.get("latitude").isBlank()) {
                partner.setLatitude(new BigDecimal(values.get("latitude")));
            }
            if (values.containsKey("longitude") && !values.get("longitude").isBlank()) {
                partner.setLongitude(new BigDecimal(values.get("longitude")));
            }
            if (values.containsKey("address") && !values.get("address").isBlank()) {
                partner.setAddress(values.get("address"));
            }
            partner.setVersion((partner.getVersion() == null ? 1 : partner.getVersion()) + 1);
            partner.setUpdatedAt(LocalDateTime.now());
            partnerRepository.save(partner);

        } else if ("PROFILE_UPDATE".equals(type)) {
            Map<String, String> values = parseSnapshot(req.getProposedSnapshot());
            if (values.containsKey("businessName") && !values.get("businessName").isBlank()) {
                partner.setBusinessName(values.get("businessName"));
            }
            if (values.containsKey("description")) {
                partner.setDescription(values.get("description"));
            }
            if (values.containsKey("taxCode")) {
                partner.setTaxCode(values.get("taxCode"));
            }
            partner.setVersion((partner.getVersion() == null ? 1 : partner.getVersion()) + 1);
            partner.setUpdatedAt(LocalDateTime.now());
            partnerRepository.save(partner);

        } else if ("SERVICE_REGISTER".equals(type)) {
            Map<String, String> values = parseSnapshot(req.getProposedSnapshot());
            Long sId = req.getTargetId();
            if (sId == null && values.containsKey("serviceId")) {
                sId = Long.valueOf(values.get("serviceId"));
            }
            if (sId != null) {
                final Long finalServiceId = sId;
                Service service = serviceRepository.findById(finalServiceId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dịch vụ sàn không tồn tại."));
                BigDecimal price = values.containsKey("price")
                        ? new BigDecimal(values.get("price"))
                        : service.getBasePrice();

                Optional<PartnerService> existing = partnerServiceRepository.findByPartner_Id(partner.getId())
                        .stream()
                        .filter(ps -> ps.getService().getId().equals(finalServiceId))
                        .findFirst();

                if (existing.isPresent()) {
                    PartnerService ps = existing.get();
                    ps.setStatus("ACTIVE");
                    ps.setPrice(price);
                    ps.setUpdatedAt(LocalDateTime.now());
                    partnerServiceRepository.save(ps);
                } else {
                    LocalDateTime now = LocalDateTime.now();
                    PartnerService ps = PartnerService.builder()
                            .partner(partner)
                            .service(service)
                            .price(price)
                            .status("ACTIVE")
                            .createdAt(now)
                            .updatedAt(now)
                            .build();
                    partnerServiceRepository.save(ps);
                }
            }

        } else if ("SERVICE_UPDATE".equals(type)) {
            Map<String, String> values = parseSnapshot(req.getProposedSnapshot());
            if (req.getTargetId() != null) {
                partnerServiceRepository.findById(req.getTargetId()).ifPresent(ps -> {
                    if (values.containsKey("price") && !values.get("price").isBlank()) {
                        ps.setPrice(new BigDecimal(values.get("price")));
                    }
                    if (values.containsKey("status") && !values.get("status").isBlank()) {
                        ps.setStatus(values.get("status").toUpperCase());
                    }
                    ps.setUpdatedAt(LocalDateTime.now());
                    partnerServiceRepository.save(ps);
                });
            }
        }

        req.setStatus("APPROVED");
        req.setReviewedBy(auth != null ? auth.getName() : "admin");
        req.setReviewedAt(LocalDateTime.now());
        req.setUpdatedAt(LocalDateTime.now());

        return row(requestRepository.save(req));
    }

    @PostMapping("/{id}/reject")
    @Transactional
    public Map<String, Object> rejectRequest(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body,
            Authentication auth) {

        BusinessChangeRequest req = requestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy yêu cầu xét duyệt."));

        if (!"PENDING_REVIEW".equalsIgnoreCase(req.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Yêu cầu đã được xử lý trước đó.");
        }

        String reason = body != null && body.get("rejectReason") != null
                ? String.valueOf(body.get("rejectReason")).trim()
                : "Không đáp ứng quy định kiểm duyệt của sàn CleanMate.";

        req.setStatus("REJECTED");
        req.setRejectReason(reason);
        req.setReviewedBy(auth != null ? auth.getName() : "admin");
        req.setReviewedAt(LocalDateTime.now());
        req.setUpdatedAt(LocalDateTime.now());

        return row(requestRepository.save(req));
    }

    private Map<String, String> parseSnapshot(String snapshot) {
        Map<String, String> map = new HashMap<>();
        if (snapshot == null || snapshot.isBlank()) return map;

        // Parse key-value strings format: key=value;key=value or json format
        String clean = snapshot.trim();
        if (clean.startsWith("{") && clean.endsWith("}")) {
            clean = clean.substring(1, clean.length() - 1);
        }
        String[] pairs = clean.split("[,;]");
        for (String pair : pairs) {
            String[] kv = pair.split("[:=]", 2);
            if (kv.length == 2) {
                String k = kv[0].trim().replace("\"", "");
                String v = kv[1].trim().replace("\"", "");
                map.put(k, v);
            }
        }
        return map;
    }

    private Map<String, Object> row(BusinessChangeRequest r) {
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
