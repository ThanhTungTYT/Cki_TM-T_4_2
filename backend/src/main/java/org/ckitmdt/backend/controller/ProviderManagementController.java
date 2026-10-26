
package org.ckitmdt.backend.controller;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.booking.BookingActionRequest;
import org.ckitmdt.backend.entity.*;
import org.ckitmdt.backend.repository.*;
import org.ckitmdt.backend.service.booking.BookingStateEngine;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/provider")
@RequiredArgsConstructor
public class ProviderManagementController {

    private final UserRepository userRepository;
    private final PartnerRepository partnerRepository;
    private final PartnerServiceRepository partnerServiceRepository;
    private final ServiceRepository serviceRepository;
    private final ServiceCategoryRepository categoryRepository;
    private final BookingRepository bookingRepository;
    private final BookingItemRepository bookingItemRepository;
    private final CancellationRefundRepository refundRepository;
    private final BookingStateEngine bookingStateEngine;

    private User currentUser(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Vui lòng đăng nhập."
            );
        }

        User user = userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Không tìm thấy tài khoản."
                ));

        String role = normalize(user.getRole());

        if (!Set.of("PROVIDER", "PARTNER").contains(role)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Chỉ nhà cung cấp mới được sử dụng chức năng này."
            );
        }

        return user;
    }

    private Partner currentPartner(Authentication auth) {
        User user = currentUser(auth);

        return partnerRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Tài khoản chưa có hồ sơ nhà cung cấp."
                ));
    }

    @GetMapping("/services")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getServices(Authentication auth) {
        Partner partner = currentPartner(auth);

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

        Partner partner = currentPartner(auth);

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

        Partner partner = currentPartner(auth);
        PartnerService partnerService = ownedService(id, partner);
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

        Partner partner = currentPartner(auth);
        PartnerService partnerService = ownedService(id, partner);
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

    @GetMapping("/bookings")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getBookings(Authentication auth) {
        Partner partner = currentPartner(auth);

        return bookingRepository
                .findByPartner_IdOrderByCreatedAtDesc(partner.getId())
                .stream()
                .map(this::bookingRow)
                .toList();
    }

    @PostMapping("/bookings/{id}/actions/{action}")
    @Transactional
    public Object bookingAction(
            @PathVariable Long id,
            @PathVariable String action,
            @RequestBody(required = false) BookingActionRequest request,
            Authentication auth) {

        Partner partner = currentPartner(auth);

        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy đơn hàng."
                ));

        if (booking.getPartner() == null
                || !booking.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền xử lý đơn hàng của nhà cung cấp khác."
            );
        }

        if (request == null) {
            request = new BookingActionRequest();
        }

        request.setAction(action.replace("-", "_").toUpperCase(Locale.ROOT));

        return bookingStateEngine.executeAction(
                id,
                request,
                auth.getName()
        );
    }

    @GetMapping("/earnings")
    @Transactional(readOnly = true)
    public Map<String, Object> getEarnings(
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            Authentication auth) {

        Partner partner = currentPartner(auth);

        if ((fromDate == null) != (toDate == null)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Phải chọn cả ngày bắt đầu và ngày kết thúc."
            );
        }

        if (fromDate == null) {
            toDate = LocalDate.now();
            fromDate = toDate.minusDays(29);
        }

        if (fromDate.isAfter(toDate)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Ngày bắt đầu không được sau ngày kết thúc."
            );
        }

        LocalDateTime start = fromDate.atStartOfDay();
        LocalDateTime endExclusive = toDate.plusDays(1).atStartOfDay();

        List<Booking> completedBookings =
                bookingRepository.findByPartner_IdOrderByCreatedAtDesc(
                                partner.getId()
                        ).stream()
                        .filter(b -> "COMPLETED".equalsIgnoreCase(b.getStatus()))
                        .filter(b -> b.getCompletedAt() != null)
                        .filter(b -> !b.getCompletedAt().isBefore(start)
                                && b.getCompletedAt().isBefore(endExclusive))
                        .toList();

        BigDecimal completedOrderValue = completedBookings.stream()
                .map(Booking::getTotalAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Set<Long> completedBookingIds = new HashSet<>();
        completedBookings.forEach(b -> completedBookingIds.add(b.getId()));

        BigDecimal approvedRefundAmount = refundRepository.findAll()
                .stream()
                .filter(r -> r.getBooking() != null)
                .filter(r -> r.getBooking().getPartner() != null)
                .filter(r -> r.getBooking().getPartner().getId()
                        .equals(partner.getId()))
                .filter(r -> completedBookingIds.contains(r.getBooking().getId()))
                .filter(r -> "APPROVED".equalsIgnoreCase(r.getStatus()))
                .map(CancellationRefund::getApprovedAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fromDate", fromDate);
        result.put("toDate", toDate);
        result.put("completedOrders", completedBookings.size());
        result.put("completedOrderValue", completedOrderValue);
        result.put("approvedRefundAmount", approvedRefundAmount);
        result.put(
                "valueAfterApprovedRefunds",
                completedOrderValue.subtract(approvedRefundAmount)
        );
        result.put(
                "note",
                "Giá trị đơn hoàn thành sau khoản hoàn đã duyệt; chưa trừ hoa hồng hoặc đối soát."
        );

        return result;
    }

    private PartnerService ownedService(Long id, Partner partner) {
        PartnerService partnerService = partnerServiceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy dịch vụ."
                ));

        if (partnerService.getPartner() == null
                || !partnerService.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền sửa dịch vụ của nhà cung cấp khác."
            );
        }

        return partnerService;
    }

    private Map<String, Object> serviceRow(PartnerService ps) {
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

    private Map<String, Object> bookingRow(Booking booking) {
        Map<String, Object> row = new LinkedHashMap<>();

        row.put("id", booking.getId());
        row.put("bookingCode", booking.getBookingCode());
        row.put("customerName", booking.getCustomer() == null
                ? "" : booking.getCustomer().getFullName());
        row.put("customerPhone", booking.getCustomer() == null
                ? "" : booking.getCustomer().getPhone());
        row.put("scheduledStart", booking.getScheduledStart());
        row.put("scheduledEnd", booking.getScheduledEnd());
        row.put("status", booking.getStatus());
        row.put("totalAmount", booking.getTotalAmount());
        row.put("createdAt", booking.getCreatedAt());
        row.put("completedAt", booking.getCompletedAt());
        row.put("cancelReason", booking.getCancelReason());

        row.put("items", bookingItemRepository.findByBookingId(booking.getId())
                .stream()
                .map(item -> {
                    Map<String, Object> itemRow = new LinkedHashMap<>();
                    itemRow.put("serviceName", item.getServiceName());
                    itemRow.put("quantity", item.getQuantity());
                    itemRow.put("unitPrice", item.getUnitPrice());
                    itemRow.put("totalPrice", item.getTotalPrice());
                    return itemRow;
                })
                .toList());

        return row;
    }

    private Long requiredLong(Map<String, Object> body, String key) {
        try {
            return Long.valueOf(String.valueOf(body.get(key)));
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trường " + key + " không hợp lệ."
            );
        }
    }

    private BigDecimal requiredPrice(Map<String, Object> body, String key) {
        try {
            BigDecimal value = new BigDecimal(String.valueOf(body.get(key)));
            if (value.signum() <= 0) {
                throw new NumberFormatException();
            }
            return value;
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Giá dịch vụ phải lớn hơn 0."
            );
        }
    }

    private Integer requiredPositiveInt(Map<String, Object> body, String key) {
        try {
            int value = Integer.parseInt(String.valueOf(body.get(key)));
            if (value <= 0) {
                throw new NumberFormatException();
            }
            return value;
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thời lượng phải là số nguyên lớn hơn 0."
            );
        }
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }

        String role = value.trim().toUpperCase(Locale.ROOT);
        return role.startsWith("ROLE_") ? role.substring(5) : role;
    }
}
