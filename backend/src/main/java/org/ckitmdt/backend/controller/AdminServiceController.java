package org.ckitmdt.backend.controller;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Service;
import org.ckitmdt.backend.entity.ServiceCategory;
import org.ckitmdt.backend.repository.PartnerServiceRepository;
import org.ckitmdt.backend.repository.ServiceCategoryRepository;
import org.ckitmdt.backend.repository.ServicePackageRepository;
import org.ckitmdt.backend.repository.ServiceRepository;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/services")
@RequiredArgsConstructor
public class AdminServiceController {

    private final ServiceRepository serviceRepository;
    private final ServiceCategoryRepository categoryRepository;
    private final PartnerServiceRepository partnerServiceRepository;
    private final ServicePackageRepository servicePackageRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllServices() {
        return serviceRepository.findAll().stream()
                .sorted(Comparator.comparing(Service::getDisplayOrder,
                                Comparator.nullsLast(Integer::compareTo))
                        .thenComparing(Service::getId))
                .map(this::serviceRow)
                .toList();
    }

    @GetMapping("/options")
    @Transactional(readOnly = true)
    public Map<String, Object> getFormOptions() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("categories", categoryRepository.findAll().stream()
                .sorted(Comparator.comparing(ServiceCategory::getDisplayOrder,
                                Comparator.nullsLast(Integer::compareTo))
                        .thenComparing(ServiceCategory::getId))
                .map(this::categoryRow)
                .toList());
        result.put("pricingTypes", List.of("FIXED"));
        return result;
    }

    @PostMapping
    @Transactional
    public Map<String, Object> createService(@RequestBody Map<String, Object> body) {
        String name = requiredText(body.get("name"), "Tên dịch vụ không được để trống.");
        ServiceCategory category = requireCategory(
                requiredLong(body.get("categoryId"), "Vui lòng chọn danh mục.")
        );
        String slug = createUniqueSlug(
                text(body.get("slug")).isBlank() ? name : text(body.get("slug")),
                null
        );
        BigDecimal basePrice = optionalMoney(body.get("basePrice"));
        Integer estimatedMinutes = optionalPositiveInteger(body.get("estimatedMinutes"));
        String pricingType = normalize(text(body.get("pricingType")));

        if (pricingType.isBlank()) {
            pricingType = "FIXED";
        }

        if (!List.of("FIXED").contains(pricingType)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Loại giá hiện tại không được hỗ trợ."
            );
        }

        LocalDateTime now = LocalDateTime.now();

        Service service = Service.builder()
                .category(category)
                .name(name)
                .slug(slug)
                .description(text(body.get("description")))
                .thumbnailUrl(text(body.get("thumbnailUrl")))
                .pricingType(pricingType)
                .basePrice(basePrice)
                .estimatedMinutes(estimatedMinutes)
                .displayOrder(optionalInteger(body.get("displayOrder"), 0))
                .status("ACTIVE")
                .createdAt(now)
                .updatedAt(now)
                .build();

        return serviceRow(serviceRepository.save(service));
    }

    @PutMapping("/{id}")
    @Transactional
    public Map<String, Object> updateService(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {

        Service service = serviceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy dịch vụ."
                ));

        String name = requiredText(body.get("name"), "Tên dịch vụ không được để trống.");
        Long categoryId = requiredLong(body.get("categoryId"), "Vui lòng chọn danh mục.");

        ServiceCategory category = requireCategory(
                categoryId,
                service.getCategory() != null
                        && service.getCategory().getId().equals(categoryId)
        );

        String slug = createUniqueSlug(
                text(body.get("slug")).isBlank() ? name : text(body.get("slug")),
                id
        );

        String pricingType = normalize(text(body.get("pricingType")));

        if (pricingType.isBlank()) {
            pricingType = service.getPricingType();
        }

        if (!List.of("FIXED").contains(pricingType)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Loại giá hiện tại không được hỗ trợ."
            );
        }

        service.setName(name);
        service.setCategory(category);
        service.setSlug(slug);
        service.setDescription(text(body.get("description")));
        service.setThumbnailUrl(text(body.get("thumbnailUrl")));
        service.setPricingType(pricingType);
        service.setBasePrice(optionalMoney(body.get("basePrice")));
        service.setEstimatedMinutes(optionalPositiveInteger(body.get("estimatedMinutes")));
        service.setDisplayOrder(optionalInteger(body.get("displayOrder"), 0));
        service.setUpdatedAt(LocalDateTime.now());

        return serviceRow(serviceRepository.save(service));
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public Map<String, Object> updateServiceStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {

        Service service = serviceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy dịch vụ."
                ));

        String status = normalize(text(body.get("status")));

        if (!List.of("ACTIVE", "INACTIVE").contains(status)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trạng thái chỉ được là ACTIVE hoặc INACTIVE."
            );
        }

        service.setStatus(status);
        service.setUpdatedAt(LocalDateTime.now());

        return serviceRow(serviceRepository.save(service));
    }

    @GetMapping("/categories")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getCategories() {
        return categoryRepository.findAll().stream()
                .sorted(Comparator.comparing(ServiceCategory::getDisplayOrder,
                                Comparator.nullsLast(Integer::compareTo))
                        .thenComparing(ServiceCategory::getId))
                .map(this::categoryRow)
                .toList();
    }

    @PostMapping("/categories")
    @Transactional
    public Map<String, Object> createCategory(@RequestBody Map<String, Object> body) {
        String name = requiredText(body.get("name"), "Tên danh mục không được để trống.");
        ensureUniqueCategoryName(name, null);

        LocalDateTime now = LocalDateTime.now();

        ServiceCategory category = ServiceCategory.builder()
                .name(name)
                .description(text(body.get("description")))
                .imageUrl(text(body.get("imageUrl")))
                .displayOrder(optionalInteger(body.get("displayOrder"), 0))
                .status("ACTIVE")
                .createdAt(now)
                .updatedAt(now)
                .build();

        return categoryRow(categoryRepository.save(category));
    }

    @PutMapping("/categories/{id}")
    @Transactional
    public Map<String, Object> updateCategory(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {

        ServiceCategory category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy danh mục."
                ));

        String name = requiredText(body.get("name"), "Tên danh mục không được để trống.");
        ensureUniqueCategoryName(name, id);

        category.setName(name);
        category.setDescription(text(body.get("description")));
        category.setImageUrl(text(body.get("imageUrl")));
        category.setDisplayOrder(optionalInteger(body.get("displayOrder"), 0));
        category.setUpdatedAt(LocalDateTime.now());

        return categoryRow(categoryRepository.save(category));
    }

    @PatchMapping("/categories/{id}/status")
    @Transactional
    public Map<String, Object> updateCategoryStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {

        ServiceCategory category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy danh mục."
                ));

        String status = normalize(text(body.get("status")));

        if (!List.of("ACTIVE", "INACTIVE").contains(status)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trạng thái chỉ được là ACTIVE hoặc INACTIVE."
            );
        }

        category.setStatus(status);
        category.setUpdatedAt(LocalDateTime.now());

        return categoryRow(categoryRepository.save(category));
    }

    private ServiceCategory requireCategory(Long id) {
        return requireCategory(id, false);
    }

    private ServiceCategory requireCategory(
            Long id,
            boolean allowInactiveCurrentCategory) {

        ServiceCategory category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy danh mục dịch vụ."
                ));

        if (!allowInactiveCurrentCategory
                && !"ACTIVE".equalsIgnoreCase(category.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Không thể gán dịch vụ vào danh mục đã ngừng hoạt động."
            );
        }

        return category;
    }

    private void ensureUniqueCategoryName(String name, Long currentId) {
        boolean exists = categoryRepository.findAll().stream()
                .anyMatch(item -> item.getName() != null
                        && item.getName().trim().equalsIgnoreCase(name.trim())
                        && (currentId == null || !item.getId().equals(currentId)));

        if (exists) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Tên danh mục đã tồn tại."
            );
        }
    }

    private String createUniqueSlug(String raw, Long currentId) {
        String normalized = Normalizer.normalize(
                        raw.trim().toLowerCase(Locale.ROOT),
                        Normalizer.Form.NFD
                )
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd')
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");

        if (normalized.isBlank()) {
            normalized = "service";
        }

        String candidate = normalized;
        int suffix = 2;

        while (currentId == null
                ? serviceRepository.existsBySlugIgnoreCase(candidate)
                : serviceRepository.existsBySlugIgnoreCaseAndIdNot(candidate, currentId)) {
            candidate = normalized + "-" + suffix++;
        }

        return candidate;
    }

    private Map<String, Object> serviceRow(Service service) {
        Map<String, Object> row = new LinkedHashMap<>();

        row.put("id", service.getId());
        row.put("name", service.getName());
        row.put("slug", service.getSlug());
        row.put("description", service.getDescription());
        row.put("thumbnailUrl", service.getThumbnailUrl());
        row.put("categoryId", service.getCategory() == null
                ? null
                : service.getCategory().getId());
        row.put("category", service.getCategory() == null
                ? ""
                : service.getCategory().getName());
        row.put("pricingType", service.getPricingType());
        row.put("basePrice", service.getBasePrice());
        row.put("price", service.getBasePrice());
        row.put("estimatedMinutes", service.getEstimatedMinutes());
        row.put("duration", service.getEstimatedMinutes());
        row.put("displayOrder", service.getDisplayOrder());
        row.put("status", normalize(service.getStatus()));
        row.put("partnerOfferCount",
                partnerServiceRepository.findByService_Id(service.getId()).size());
        row.put("packageCount",
                servicePackageRepository.findByServiceId(service.getId()).size());
        row.put("createdAt", service.getCreatedAt());
        row.put("updatedAt", service.getUpdatedAt());

        return row;
    }

    private Map<String, Object> categoryRow(ServiceCategory category) {
        Map<String, Object> row = new LinkedHashMap<>();

        row.put("id", category.getId());
        row.put("name", category.getName());
        row.put("description", category.getDescription());
        row.put("imageUrl", category.getImageUrl());
        row.put("displayOrder", category.getDisplayOrder());
        row.put("status", normalize(category.getStatus()));
        row.put("serviceCount", serviceRepository.findAll().stream()
                .filter(service -> service.getCategory() != null
                        && service.getCategory().getId().equals(category.getId()))
                .count());
        row.put("createdAt", category.getCreatedAt());
        row.put("updatedAt", category.getUpdatedAt());

        return row;
    }

    private String requiredText(Object value, String message) {
        String result = text(value);

        if (result.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }

        return result;
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private Long requiredLong(Object value, String message) {
        try {
            long result = Long.parseLong(text(value));

            if (result <= 0) {
                throw new NumberFormatException();
            }

            return result;
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private BigDecimal optionalMoney(Object value) {
        if (value == null || text(value).isBlank()) {
            return null;
        }

        try {
            BigDecimal result = new BigDecimal(text(value));

            if (result.signum() < 0) {
                throw new NumberFormatException();
            }

            return result;
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Giá dịch vụ không hợp lệ."
            );
        }
    }

    private Integer optionalPositiveInteger(Object value) {
        if (value == null || text(value).isBlank()) {
            return null;
        }

        try {
            int result = Integer.parseInt(text(value));

            if (result <= 0) {
                throw new NumberFormatException();
            }

            return result;
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thời lượng phải là số nguyên dương."
            );
        }
    }

    private Integer optionalInteger(Object value, int defaultValue) {
        if (value == null || text(value).isBlank()) {
            return defaultValue;
        }

        try {
            return Integer.parseInt(text(value));
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thứ tự hiển thị không hợp lệ."
            );
        }
    }
}