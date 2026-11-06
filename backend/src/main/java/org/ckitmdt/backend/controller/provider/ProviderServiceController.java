package org.ckitmdt.backend.controller.provider;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.*;
import org.ckitmdt.backend.repository.BusinessChangeRequestRepository;
import org.ckitmdt.backend.repository.PartnerServiceRepository;
import org.ckitmdt.backend.repository.ServiceCategoryRepository;
import org.ckitmdt.backend.repository.ServiceRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

import static org.ckitmdt.backend.controller.provider.ProviderSecurityHelper.*;

@RestController
@RequestMapping("/api/provider")
@RequiredArgsConstructor
public class ProviderServiceController {

    private final ProviderSecurityHelper helper;
    private final PartnerServiceRepository partnerServiceRepository;
    private final ServiceRepository serviceRepository;
    private final ServiceCategoryRepository categoryRepository;
    private final BusinessChangeRequestRepository changeRequestRepository;

    @GetMapping("/services")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getServices(Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        return partnerServiceRepository.findByPartner_Id(partner.getId())
                .stream()
                .map(this::serviceRow)
                .toList();
    }

    @PostMapping("/services")
    @Transactional
    public Map<String, Object> createService(
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        Partner partner = helper.currentPartner(auth);

        String name = text(body.get("name"));
        if (name.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tên dịch vụ không được để trống."
            );
        }

        Long categoryId = requiredLong(body, "categoryId");
        BigDecimal price = requiredPrice(body, "price");
        Integer minutes = requiredPositiveInt(body, "estimatedMinutes");

        ServiceCategory category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy danh mục dịch vụ."
                ));

        LocalDateTime now = LocalDateTime.now();

        Service service = Service.builder()
                .category(category)
                .name(name)
                .description(text(body.get("description")))
                .thumbnailUrl(text(body.get("thumbnailUrl")))
                .pricingType("FIXED")
                .basePrice(price)
                .estimatedMinutes(minutes)
                .status("ACTIVE")
                .createdAt(now)
                .updatedAt(now)
                .build();

        service = serviceRepository.save(service);

        PartnerService partnerService = PartnerService.builder()
                .partner(partner)
                .service(service)
                .price(price)
                .status("PENDING")
                .createdAt(now)
                .updatedAt(now)
                .build();

        return serviceRow(partnerServiceRepository.save(partnerService));
    }

    @PutMapping("/services/{id}")
    @Transactional
    public Map<String, Object> updateService(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        Partner partner = helper.currentPartner(auth);
        PartnerService partnerService = helper.ownedService(id, partner);
        Service service = partnerService.getService();

        if (body.containsKey("name")) {
            String name = text(body.get("name"));
            if (name.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Tên dịch vụ không được để trống."
                );
            }
            service.setName(name);
        }

        if (body.containsKey("description")) {
            service.setDescription(text(body.get("description")));
        }

        if (body.containsKey("thumbnailUrl")) {
            service.setThumbnailUrl(text(body.get("thumbnailUrl")));
        }

        if (body.containsKey("categoryId")) {
            Long categoryId = requiredLong(body, "categoryId");
            ServiceCategory category = categoryRepository.findById(categoryId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Không tìm thấy danh mục dịch vụ."
                    ));
            service.setCategory(category);
        }

        if (body.containsKey("price")) {
            partnerService.setPrice(requiredPrice(body, "price"));
        }

        if (body.containsKey("estimatedMinutes")) {
            service.setEstimatedMinutes(
                    requiredPositiveInt(body, "estimatedMinutes")
            );
        }

        LocalDateTime now = LocalDateTime.now();
        service.setUpdatedAt(now);
        partnerService.setUpdatedAt(now);

        serviceRepository.save(service);

        return serviceRow(partnerServiceRepository.save(partnerService));
    }

    @PatchMapping("/services/{id}/status")
    @Transactional
    public Map<String, Object> changeServiceStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        Partner partner = helper.currentPartner(auth);
        PartnerService partnerService = helper.ownedService(id, partner);
        String status = normalize(text(body.get("status")));

        if (!Set.of("INACTIVE", "PENDING").contains(status)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Nhà cung cấp chỉ được tạm ngừng hoặc gửi lại dịch vụ chờ duyệt."
            );
        }

        partnerService.setStatus(status);
        partnerService.setUpdatedAt(LocalDateTime.now());

        return serviceRow(partnerServiceRepository.save(partnerService));
    }

    @GetMapping("/services/catalog")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getServiceCatalog(Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        List<PartnerService> registered = partnerServiceRepository.findByPartner_Id(partner.getId());
        Set<Long> registeredServiceIds = new HashSet<>();
        Map<Long, PartnerService> psMap = new HashMap<>();
        for (PartnerService ps : registered) {
            registeredServiceIds.add(ps.getService().getId());
            psMap.put(ps.getService().getId(), ps);
        }

        return serviceRepository.findAll().stream()
                .map(s -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", s.getId());
                    row.put("name", s.getName());
                    row.put("category", s.getCategory() != null ? s.getCategory().getName() : "");
                    row.put("description", s.getDescription());
                    row.put("thumbnailUrl", s.getThumbnailUrl());
                    row.put("basePrice", s.getBasePrice());
                    row.put("estimatedMinutes", s.getEstimatedMinutes());
                    boolean isReg = registeredServiceIds.contains(s.getId());
                    row.put("registered", isReg);
                    if (isReg) {
                        PartnerService ps = psMap.get(s.getId());
                        row.put("partnerServiceId", ps.getId());
                        row.put("partnerPrice", ps.getPrice());
                        row.put("partnerStatus", ps.getStatus());
                    }
                    return row;
                })
                .toList();
    }

    @PostMapping("/service-requests")
    @Transactional
    public Map<String, Object> createServiceRequest(
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        String type = text(body.get("type")).toUpperCase();
        if (type.isBlank()) type = "SERVICE_REGISTER";

        Long serviceId = requiredLong(body, "serviceId");
        Service service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy dịch vụ sàn."));

        String reason = text(body.get("reason"));
        if (reason.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập lý do.");
        }

        BigDecimal proposedPrice = body.get("proposedPrice") != null
                ? new BigDecimal(String.valueOf(body.get("proposedPrice")))
                : service.getBasePrice();

        LocalDateTime now = LocalDateTime.now();
        BusinessChangeRequest req = BusinessChangeRequest.builder()
                .partner(partner)
                .requestType(type)
                .status("PENDING_REVIEW")
                .targetId(service.getId())
                .targetName(service.getName())
                .oldSnapshot("basePrice=" + service.getBasePrice())
                .proposedSnapshot("serviceId=" + service.getId() + ";price=" + proposedPrice)
                .reason(reason)
                .evidenceUrl(text(body.get("evidenceUrl")))
                .submittedBy(auth.getName())
                .createdAt(now)
                .updatedAt(now)
                .build();

        BusinessChangeRequest saved = changeRequestRepository.save(req);
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", saved.getId());
        map.put("partnerId", saved.getPartner().getId());
        map.put("businessName", saved.getPartner().getBusinessName());
        map.put("requestType", saved.getRequestType());
        map.put("status", saved.getStatus());
        map.put("targetId", saved.getTargetId());
        map.put("targetName", saved.getTargetName());
        map.put("oldSnapshot", saved.getOldSnapshot());
        map.put("proposedSnapshot", saved.getProposedSnapshot());
        map.put("reason", saved.getReason());
        map.put("evidenceUrl", saved.getEvidenceUrl());
        map.put("rejectReason", saved.getRejectReason());
        map.put("submittedBy", saved.getSubmittedBy());
        map.put("reviewedBy", saved.getReviewedBy());
        map.put("createdAt", saved.getCreatedAt());
        map.put("reviewedAt", saved.getReviewedAt());
        return map;
    }

    @PatchMapping("/services/{id}/pause")
    @Transactional
    public Map<String, Object> pauseService(@PathVariable Long id, Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        PartnerService ps = helper.ownedService(id, partner);
        ps.setStatus("PAUSED");
        ps.setUpdatedAt(LocalDateTime.now());
        return serviceRow(partnerServiceRepository.save(ps));
    }

    @PatchMapping("/services/{id}/resume")
    @Transactional
    public Map<String, Object> resumeService(@PathVariable Long id, Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        PartnerService ps = helper.ownedService(id, partner);
        ps.setStatus("ACTIVE");
        ps.setUpdatedAt(LocalDateTime.now());
        return serviceRow(partnerServiceRepository.save(ps));
    }

    public Map<String, Object> serviceRow(PartnerService ps) {
        Service service = ps.getService();
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", ps.getId());
        row.put("serviceId", service.getId());
        row.put("name", service.getName());
        row.put("categoryId", service.getCategory().getId());
        row.put("category", service.getCategory().getName());
        row.put("description", service.getDescription());
        row.put("thumbnailUrl", service.getThumbnailUrl());
        row.put("price", ps.getPrice() != null ? ps.getPrice() : service.getBasePrice());
        row.put("estimatedMinutes", service.getEstimatedMinutes());
        row.put("status", ps.getStatus());
        return row;
    }
}
