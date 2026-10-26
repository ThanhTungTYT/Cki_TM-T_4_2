
package org.ckitmdt.backend.controller;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.entity.PartnerService;
import org.ckitmdt.backend.entity.Service;
import org.ckitmdt.backend.entity.ServiceCategory;
import org.ckitmdt.backend.repository.PartnerRepository;
import org.ckitmdt.backend.repository.PartnerServiceRepository;
import org.ckitmdt.backend.repository.ServiceCategoryRepository;
import org.ckitmdt.backend.repository.ServiceRepository;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/services")
@RequiredArgsConstructor
public class AdminServiceController {

    private final ServiceRepository serviceRepository;
    private final ServiceCategoryRepository categoryRepository;
    private final PartnerRepository partnerRepository;
    private final PartnerServiceRepository partnerServiceRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllServices() {
        return partnerServiceRepository.findAll()
                .stream()
                .filter(ps -> ps.getService() != null && ps.getPartner() != null)
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @GetMapping("/options")
    @Transactional(readOnly = true)
    public Map<String, Object> getFormOptions() {
        List<Map<String, Object>> categories = categoryRepository.findAll()
                .stream()
                .filter(category -> category.getStatus() == null
                        || "ACTIVE".equalsIgnoreCase(category.getStatus()))
                .map(category -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", category.getId());
                    item.put("name", category.getName());
                    return item;
                })
                .collect(Collectors.toList());

        List<Map<String, Object>> partners = partnerRepository.findAll()
                .stream()
                .filter(partner -> partner.getUser() != null
                        && !"LOCKED".equalsIgnoreCase(partner.getUser().getStatus()))
                .map(partner -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", partner.getId());
                    item.put("name", partner.getBusinessName());
                    item.put("status", partner.getStatus());
                    return item;
                })
                .collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("categories", categories);
        result.put("partners", partners);
        return result;
    }

    private Map<String, Object> toResponse(PartnerService ps) {
        Service service = ps.getService();
        Partner partner = ps.getPartner();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", ps.getId());
        result.put("serviceId", service.getId());
        result.put("partnerId", partner.getId());
        result.put("name", service.getName());
        result.put("description",
                service.getDescription() == null ? "" : service.getDescription());
        result.put("category",
                service.getCategory() == null ? "" : service.getCategory().getName());
        result.put("categoryId",
                service.getCategory() == null ? null : service.getCategory().getId());
        result.put("provider", partner.getBusinessName());
        result.put("price",
                ps.getPrice() != null ? ps.getPrice() : service.getBasePrice());
        result.put("estimatedMinutes", service.getEstimatedMinutes());
        result.put("duration", formatDuration(service.getEstimatedMinutes()));
        result.put("status", toVietnameseStatus(ps.getStatus()));

        return result;
    }

    private String formatDuration(Integer minutes) {
        if (minutes == null) {
            return "";
        }

        if (minutes % 60 == 0) {
            return (minutes / 60) + " giờ";
        }

        if (minutes > 60) {
            return (minutes / 60) + " giờ " + (minutes % 60) + " phút";
        }

        return minutes + " phút";
    }

    private String toVietnameseStatus(String status) {
        if (status == null) {
            return "Tạm ngừng";
        }

        switch (status.toUpperCase()) {
            case "ACTIVE":
                return "Đang hoạt động";
            case "PENDING":
                return "Chờ duyệt";
            default:
                return "Tạm ngừng";
        }
    }

    private String toDatabaseStatus(String status) {
        if (status == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thiếu trạng thái dịch vụ."
            );
        }

        switch (status.trim().toUpperCase()) {
            case "ĐANG HOẠT ĐỘNG":
            case "ACTIVE":
                return "ACTIVE";
            case "CHỜ DUYỆT":
            case "PENDING":
                return "PENDING";
            case "TẠM NGỪNG":
            case "INACTIVE":
                return "INACTIVE";
            default:
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Trạng thái dịch vụ không hợp lệ."
                );
        }
    }

    @PostMapping
    @Transactional
    public Map<String, Object> createService(
            @RequestBody Map<String, Object> body) {

        String name = getRequiredText(body, "name");
        Long categoryId = getRequiredLong(body, "categoryId");
        Long partnerId = getRequiredLong(body, "partnerId");
        BigDecimal price = getRequiredPrice(body);
        Integer minutes = getRequiredMinutes(body);

        ServiceCategory category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy danh mục dịch vụ."
                ));

        Partner partner = partnerRepository.findById(partnerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy nhà cung cấp."
                ));

        validatePartner(partner);

        LocalDateTime now = LocalDateTime.now();

        Service service = Service.builder()
                .category(category)
                .name(name)
                .description(getOptionalText(body, "description"))
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
                .status(toDatabaseStatus(
                        String.valueOf(body.getOrDefault("status", "Chờ duyệt"))
                ))
                .createdAt(now)
                .updatedAt(now)
                .build();

        partnerService = partnerServiceRepository.save(partnerService);

        return toResponse(partnerService);
    }

    @PutMapping("/{id}")
    @Transactional
    public Map<String, Object> updateService(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {

        PartnerService partnerService = findPartnerService(id);
        Service service = partnerService.getService();

        if (body.containsKey("name")) {
            service.setName(getRequiredText(body, "name"));
        }

        if (body.containsKey("description")) {
            service.setDescription(getOptionalText(body, "description"));
        }

        if (body.containsKey("categoryId")) {
            Long categoryId = getRequiredLong(body, "categoryId");

            ServiceCategory category = categoryRepository.findById(categoryId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Không tìm thấy danh mục dịch vụ."
                    ));

            service.setCategory(category);
        }

        if (body.containsKey("partnerId")) {
            Long partnerId = getRequiredLong(body, "partnerId");

            Partner partner = partnerRepository.findById(partnerId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Không tìm thấy nhà cung cấp."
                    ));

            validatePartner(partner);

            boolean duplicate = partnerServiceRepository.findByPartner_Id(partnerId)
                    .stream()
                    .anyMatch(item ->
                            !item.getId().equals(partnerService.getId())
                                    && item.getService() != null
                                    && item.getService().getId().equals(service.getId())
                    );

            if (duplicate) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Nhà cung cấp này đã có dịch vụ tương ứng."
                );
            }

            partnerService.setPartner(partner);
        }

        if (body.containsKey("price")) {
            partnerService.setPrice(getRequiredPrice(body));
        }

        if (body.containsKey("estimatedMinutes")) {
            service.setEstimatedMinutes(getRequiredMinutes(body));
        }

        if (body.containsKey("status")) {
            partnerService.setStatus(
                    toDatabaseStatus(String.valueOf(body.get("status")))
            );
        }

        LocalDateTime now = LocalDateTime.now();
        service.setUpdatedAt(now);
        partnerService.setUpdatedAt(now);

        serviceRepository.save(service);
        partnerServiceRepository.save(partnerService);

        return toResponse(partnerService);
    }

    @PutMapping("/{id}/status")
    @Transactional
    public Map<String, Object> changeStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {

        PartnerService partnerService = findPartnerService(id);

        if (!body.containsKey("status") || body.get("status") == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thiếu trạng thái dịch vụ."
            );
        }

        partnerService.setStatus(
                toDatabaseStatus(String.valueOf(body.get("status")))
        );
        partnerService.setUpdatedAt(LocalDateTime.now());

        partnerServiceRepository.save(partnerService);

        return toResponse(partnerService);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public Map<String, Object> deleteService(@PathVariable Long id) {
        PartnerService partnerService = findPartnerService(id);

        partnerService.setStatus("INACTIVE");
        partnerService.setUpdatedAt(LocalDateTime.now());
        partnerServiceRepository.save(partnerService);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("message", "Đã ngừng dịch vụ.");
        result.put("id", id);

        return result;
    }

    private void validatePartner(Partner partner) {
        if (partner.getUser() == null
                || "LOCKED".equalsIgnoreCase(partner.getUser().getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Nhà cung cấp đang bị khóa."
            );
        }
    }

    private PartnerService findPartnerService(Long id) {
        return partnerServiceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy dịch vụ."
                ));
    }

    private String getRequiredText(
            Map<String, Object> body,
            String key) {

        Object value = body.get(key);

        if (value == null || value.toString().trim().isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trường " + key + " không được để trống."
            );
        }

        return value.toString().trim();
    }

    private String getOptionalText(
            Map<String, Object> body,
            String key) {

        Object value = body.get(key);
        return value == null ? "" : value.toString().trim();
    }

    private Long getRequiredLong(
            Map<String, Object> body,
            String key) {

        Object value = body.get(key);

        if (value == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thiếu trường " + key + "."
            );
        }

        try {
            long result = new BigDecimal(value.toString()).longValueExact();

            if (result <= 0) {
                throw new ArithmeticException();
            }

            return result;
        } catch (NumberFormatException | ArithmeticException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trường " + key + " không hợp lệ."
            );
        }
    }

    private BigDecimal getRequiredPrice(Map<String, Object> body) {
        Object value = body.get("price");

        if (value == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thiếu giá dịch vụ."
            );
        }

        try {
            BigDecimal price = new BigDecimal(value.toString());

            if (price.compareTo(BigDecimal.ZERO) <= 0) {
                throw new NumberFormatException();
            }

            return price;
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Giá dịch vụ phải lớn hơn 0."
            );
        }
    }

    private Integer getRequiredMinutes(Map<String, Object> body) {
        Object value = body.get("estimatedMinutes");

        if (value == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thiếu thời lượng dịch vụ."
            );
        }

        try {
            int minutes = new BigDecimal(value.toString()).intValueExact();

            if (minutes <= 0) {
                throw new NumberFormatException();
            }

            return minutes;
        } catch (NumberFormatException | ArithmeticException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thời lượng phải là số nguyên lớn hơn 0."
            );
        }
    }
}
