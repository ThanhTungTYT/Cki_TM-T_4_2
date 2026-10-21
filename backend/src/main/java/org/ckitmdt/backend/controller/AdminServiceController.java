
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
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private Map<String, Object> toResponse(PartnerService ps) {
        Service service = ps.getService();
        Partner partner = ps.getPartner();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", ps.getId());
        result.put("serviceId", service.getId());
        result.put("partnerId", partner.getId());
        result.put("name", service.getName());
        result.put("category", service.getCategory().getName());
        result.put("categoryId", service.getCategory().getId());
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
                    HttpStatus.BAD_REQUEST, "Thiếu trạng thái"
            );
        }

        switch (status) {
            case "Đang hoạt động":
            case "ACTIVE":
                return "ACTIVE";
            case "Chờ duyệt":
            case "PENDING":
                return "PENDING";
            case "Tạm ngừng":
            case "INACTIVE":
                return "INACTIVE";
            default:
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Trạng thái không hợp lệ"
                );
        }
    }

    @PostMapping
    @Transactional
    public Map<String, Object> createService(
            @RequestBody Map<String, Object> body) {

        String name = String.valueOf(body.getOrDefault("name", "")).trim();

        if (name.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Tên dịch vụ không được để trống"
            );
        }

        Long categoryId = getRequiredLong(body, "categoryId");
        Long partnerId = getRequiredLong(body, "partnerId");
        BigDecimal price = getRequiredPrice(body);

        Integer minutes = body.get("estimatedMinutes") == null
                ? null
                : Integer.valueOf(body.get("estimatedMinutes").toString());

        if (minutes != null && minutes <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Thời lượng phải lớn hơn 0"
            );
        }

        ServiceCategory category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Không tìm thấy danh mục"
                ));

        Partner partner = partnerRepository.findById(partnerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Không tìm thấy nhà cung cấp"
                ));

        LocalDateTime now = LocalDateTime.now();

        Service service = Service.builder()
                .category(category)
                .name(name)
                .description((String) body.get("description"))
                .pricingType("FIXED")
                .basePrice(price)
                .estimatedMinutes(minutes)
                .status("ACTIVE")
                .createdAt(now)
                .updatedAt(now)
                .build();

        service = serviceRepository.save(service);

        PartnerService ps = PartnerService.builder()
                .partner(partner)
                .service(service)
                .price(price)
                .status(toDatabaseStatus(
                        String.valueOf(body.getOrDefault(
                                "status", "Chờ duyệt"
                        ))
                ))
                .createdAt(now)
                .updatedAt(now)
                .build();

        ps = partnerServiceRepository.save(ps);

        return toResponse(ps);
    }

    @PutMapping("/{id}")
    @Transactional
    public Map<String, Object> updateService(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {

        PartnerService ps = findPartnerService(id);
        Service service = ps.getService();

        if (body.containsKey("name")) {
            String name = String.valueOf(body.get("name")).trim();

            if (name.isEmpty()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Tên dịch vụ không được để trống"
                );
            }

            service.setName(name);
        }

        if (body.containsKey("categoryId")) {
            Long categoryId = getRequiredLong(body, "categoryId");

            ServiceCategory category = categoryRepository.findById(categoryId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND, "Không tìm thấy danh mục"
                    ));

            service.setCategory(category);
        }

        if (body.containsKey("price")) {
            BigDecimal price = getRequiredPrice(body);
            ps.setPrice(price);
        }

        if (body.containsKey("estimatedMinutes")) {
            Integer minutes = Integer.valueOf(
                    body.get("estimatedMinutes").toString()
            );

            if (minutes <= 0) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Thời lượng phải lớn hơn 0"
                );
            }

            service.setEstimatedMinutes(minutes);
        }

        if (body.containsKey("status")) {
            ps.setStatus(toDatabaseStatus(
                    String.valueOf(body.get("status"))
            ));
        }

        LocalDateTime now = LocalDateTime.now();
        service.setUpdatedAt(now);
        ps.setUpdatedAt(now);

        serviceRepository.save(service);
        partnerServiceRepository.save(ps);

        return toResponse(ps);
    }

    @PutMapping("/{id}/status")
    @Transactional
    public Map<String, Object> changeStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {

        PartnerService ps = findPartnerService(id);

        ps.setStatus(toDatabaseStatus(
                String.valueOf(body.get("status"))
        ));
        ps.setUpdatedAt(LocalDateTime.now());

        return toResponse(partnerServiceRepository.save(ps));
    }

    @DeleteMapping("/{id}")
    @Transactional
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteService(@PathVariable Long id) {
        PartnerService ps = findPartnerService(id);

        // Chỉ xóa liên kết giữa nhà cung cấp và dịch vụ.
        // Không xóa dịch vụ chung trong bảng services.
        partnerServiceRepository.delete(ps);
    }

    private PartnerService findPartnerService(Long id) {
        return partnerServiceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy dịch vụ của nhà cung cấp"
                ));
    }

    private Long getRequiredLong(
            Map<String, Object> body, String field) {

        try {
            return Long.valueOf(body.get(field).toString());
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thiếu hoặc sai dữ liệu " + field
            );
        }
    }

    private BigDecimal getRequiredPrice(Map<String, Object> body) {
        try {
            BigDecimal price = new BigDecimal(body.get("price").toString());

            if (price.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException();
            }

            return price;
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Giá dịch vụ phải lớn hơn 0"
            );
        }
    }
}
