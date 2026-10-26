package org.ckitmdt.backend.controller.auth;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.entity.PartnerService;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.PartnerRepository;
import org.ckitmdt.backend.repository.PartnerServiceRepository;
import org.springframework.http.HttpStatus;
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

    private static final DateTimeFormatter DATE_FORMAT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy");

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getProviders(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {

        String search = keyword == null
                ? ""
                : keyword.trim().toLowerCase(Locale.ROOT);

        String statusFilter = status == null
                ? ""
                : status.trim().toUpperCase(Locale.ROOT);

        if (!statusFilter.isEmpty()
                && !List.of("ACTIVE", "PENDING", "LOCKED").contains(statusFilter)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trạng thái phải là ACTIVE, PENDING hoặc LOCKED."
            );
        }

        return partnerRepository.findAll()
                .stream()
                .filter(partner -> {
                    User user = partner.getUser();

                    return search.isEmpty()
                            || contains(partner.getBusinessName(), search)
                            || user != null && (
                            contains(user.getFullName(), search)
                                    || contains(user.getEmail(), search)
                                    || contains(user.getPhone(), search)
                    );
                })
                .filter(partner -> statusFilter.isEmpty()
                        || statusFilter.equals(getDatabaseStatus(partner)))
                .sorted(Comparator.comparing(
                        Partner::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Map<String, Object> getProvider(@PathVariable Long id) {
        Partner partner = findPartner(id);
        return toResponse(partner);
    }

    @PutMapping("/{id}/status")
    @Transactional
    public Map<String, Object> updateProviderStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> request) {

        Partner partner = findPartner(id);

        String requestedStatus = request.get("status");

        if (requestedStatus == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng cung cấp trạng thái."
            );
        }

        requestedStatus = requestedStatus.trim().toUpperCase(Locale.ROOT);

        if (!List.of("ACTIVE", "PENDING", "LOCKED").contains(requestedStatus)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trạng thái chỉ được là ACTIVE, PENDING hoặc LOCKED."
            );
        }

        User user = partner.getUser();

        if (user == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Nhà cung cấp chưa được liên kết với tài khoản người dùng."
            );
        }

        if ("ADMIN".equalsIgnoreCase(user.getRole())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Không thể thay đổi trạng thái tài khoản quản trị viên."
            );
        }

        if ("ACTIVE".equals(requestedStatus)) {
            partner.setStatus("ACTIVE");
            user.setStatus("ACTIVE");
        } else if ("PENDING".equals(requestedStatus)) {
            partner.setStatus("PENDING");
            user.setStatus("ACTIVE");
        } else {
            partner.setStatus("LOCKED");
            user.setStatus("LOCKED");
        }

        partnerRepository.save(partner);

        Map<String, Object> result = toResponse(partner);
        result.put("message", "Cập nhật trạng thái nhà cung cấp thành công.");

        return result;
    }

    private Partner findPartner(Long id) {
        return partnerRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy nhà cung cấp."
                ));
    }

    private Map<String, Object> toResponse(Partner partner) {
        User user = partner.getUser();

        List<PartnerService> services =
                partnerServiceRepository.findByPartner_Id(partner.getId());

        Map<String, Object> result = new LinkedHashMap<>();

        result.put("id", partner.getId());
        result.put("userId", user == null ? null : user.getId());
        result.put(
                "name",
                partner.getBusinessName() == null
                        ? ""
                        : partner.getBusinessName()
        );
        result.put(
                "email",
                user == null || user.getEmail() == null
                        ? ""
                        : user.getEmail()
        );
        result.put(
                "phone",
                user == null || user.getPhone() == null
                        ? ""
                        : user.getPhone()
        );
        result.put(
                "address",
                partner.getDescription() == null
                        ? ""
                        : partner.getDescription()
        );
        result.put("services", services.size());
        result.put("status", toVietnameseStatus(partner));
        result.put("databaseStatus", getDatabaseStatus(partner));
        result.put(
                "joinedAt",
                partner.getCreatedAt() == null
                        ? ""
                        : partner.getCreatedAt().format(DATE_FORMAT)
        );
        result.put("description", partner.getDescription());
        result.put("taxCode", partner.getTaxCode());
        result.put("ratingAverage", partner.getRatingAverage());
        result.put("totalCompletedJobs", partner.getTotalCompletedJobs());

        return result;
    }

    private String getDatabaseStatus(Partner partner) {
        User user = partner.getUser();

        if (user != null && "LOCKED".equalsIgnoreCase(user.getStatus())) {
            return "LOCKED";
        }

        String status = partner.getStatus();

        if (status == null || status.isBlank()) {
            return "PENDING";
        }

        status = status.trim().toUpperCase(Locale.ROOT);

        if ("ACTIVE".equals(status)) {
            return "ACTIVE";
        }

        if ("PENDING".equals(status)) {
            return "PENDING";
        }

        return "LOCKED";
    }

    private String toVietnameseStatus(Partner partner) {
        switch (getDatabaseStatus(partner)) {
            case "ACTIVE":
                return "Đang hoạt động";
            case "PENDING":
                return "Chờ duyệt";
            default:
                return "Đã khóa";
        }
    }

    private boolean contains(String value, String keyword) {
        return value != null
                && value.toLowerCase(Locale.ROOT).contains(keyword);
    }
}