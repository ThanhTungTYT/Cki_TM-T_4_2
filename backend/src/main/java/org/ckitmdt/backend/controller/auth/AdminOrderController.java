package org.ckitmdt.backend.controller.auth;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.booking.BookingActionRequest;
import org.ckitmdt.backend.dto.booking.BookingResponse;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.Payment;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.PaymentRepository;
import org.ckitmdt.backend.service.booking.BookingStateEngine;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/orders")
@RequiredArgsConstructor
public class AdminOrderController {

    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final BookingStateEngine bookingStateEngine;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getAllOrders(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long partnerId,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            Authentication authentication) {

        validateAdmin(authentication);

        String search = keyword == null ? "" : keyword.trim().toLowerCase(Locale.ROOT);
        String statusFilter = normalize(status);
        LocalDateTime from = parseDate(fromDate, false);
        LocalDateTime to = parseDate(toDate, true);

        if (from != null && to != null && from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Khoảng ngày lọc không hợp lệ.");
        }

        List<Booking> bookings = bookingRepository.findAll(
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        List<Map<String, Object>> result = new ArrayList<>();

        for (Booking booking : bookings) {
            if (!statusFilter.isEmpty() && !statusFilter.equals(normalize(booking.getStatus()))) {
                continue;
            }

            if (partnerId != null && (booking.getPartner() == null
                    || !partnerId.equals(booking.getPartner().getId()))) {
                continue;
            }

            if (customerId != null && (booking.getCustomer() == null
                    || !customerId.equals(booking.getCustomer().getId()))) {
                continue;
            }

            LocalDateTime bookingDate = booking.getScheduledStart() != null
                    ? booking.getScheduledStart()
                    : booking.getCreatedAt();

            if (from != null && (bookingDate == null || bookingDate.isBefore(from))) {
                continue;
            }

            if (to != null && (bookingDate == null || bookingDate.isAfter(to))) {
                continue;
            }

            BookingResponse response = bookingStateEngine.mapToBookingResponse(booking);

            if (!search.isEmpty() && !matchesSearch(response, search)) {
                continue;
            }

            result.add(toOrderResponse(booking, response));
        }

        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getOrderDetail(
            @PathVariable Long id,
            Authentication authentication) {
        validateAdmin(authentication);

        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy đơn hàng."
                ));

        BookingResponse response = bookingStateEngine.mapToBookingResponse(booking);

        return ResponseEntity.ok(toOrderResponse(booking, response));
    }

    @PostMapping("/{id}/actions/{action}")
    @Transactional
    public ResponseEntity<BookingResponse> executeOrderAction(
            Authentication authentication,
            @PathVariable Long id,
            @PathVariable String action,
            @RequestBody(required = false) Map<String, Object> body) {

        validateAdmin(authentication);

        String normalizedAction = action
                .replace("-", "_")
                .toUpperCase(Locale.ROOT);

        if (!"CANCEL".equals(normalizedAction)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Admin hiện chỉ được can thiệp hủy đơn qua chức năng này. Các nghiệp vụ điều phối khác phải dùng workflow riêng."
            );
        }

        Booking booking = bookingRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy đơn hàng."
                ));

        Map<String, Object> requestBody = body == null
                ? new LinkedHashMap<>()
                : body;

        Long requestedVersion = parseVersion(requestBody.get("version"));

        if (requestedVersion == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thiếu phiên bản đơn hàng. Vui lòng tải lại chi tiết đơn trước khi thao tác."
            );
        }

        if (!requestedVersion.equals(booking.getVersion())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Đơn hàng đã được cập nhật bởi thao tác khác. Vui lòng tải lại dữ liệu."
            );
        }

        String currentStatus = normalize(booking.getStatus());

        if (!List.of(
                "PENDING_PAYMENT",
                "PENDING_PROVIDER",
                "CONFIRMED",
                "ASSIGNED"
        ).contains(currentStatus)) {
            if (List.of("EN_ROUTE", "IN_PROGRESS", "PENDING_COMPLETION").contains(currentStatus)) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Đơn đã bắt đầu thực hiện. Không được hủy như đơn chưa thực hiện. Hãy xử lý qua quy trình ngoại lệ/khiếu nại và lưu bằng chứng."
                );
            }

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Không thể hủy đơn ở trạng thái " + currentStatus + "."
            );
        }

        String reason = readText(requestBody.get("note"));
        if (reason.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Admin phải nhập lý do hủy đơn."
            );
        }

        if (reason.length() > 2000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Lý do hủy không được vượt quá 2000 ký tự."
            );
        }

        List<Payment> payments = paymentRepository.findByBooking_Id(id);
        boolean alreadyPaid = payments.stream().anyMatch(this::isSuccessfulPayment);

        String refundPlan = readText(requestBody.get("refundPlan"));

        if (alreadyPaid && refundPlan.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Đơn đã có thanh toán thành công. Vui lòng ghi kế hoạch xử lý Customer/refund trước khi hủy."
            );
        }

        if (refundPlan.length() > 2000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Kế hoạch xử lý không được vượt quá 2000 ký tự."
            );
        }

        String auditNote = "Admin hủy đơn. Lý do: " + reason;

        if (alreadyPaid) {
            auditNote += " | Kế hoạch xử lý Customer/refund: " + refundPlan;
        }

        BookingActionRequest request = new BookingActionRequest();
        request.setAction("CANCEL");
        request.setVersion(requestedVersion);
        request.setNote(auditNote);

        BookingResponse updated = bookingStateEngine.executeAction(
                id,
                request,
                authentication.getName()
        );

        return ResponseEntity.ok(updated);
    }

    private Map<String, Object> toOrderResponse(Booking booking, BookingResponse response) {
        List<Payment> payments = paymentRepository.findByBooking_Id(booking.getId());

        boolean paid = payments.stream().anyMatch(this::isSuccessfulPayment);

        List<Map<String, Object>> paymentRecords = payments.stream().map(payment -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", payment.getId());
            row.put("method", payment.getPaymentMethod());
            row.put("provider", payment.getPaymentProvider());
            row.put("amount", payment.getAmount());
            row.put("status", payment.getStatus());
            row.put("transactionCode", payment.getTransactionCode());
            row.put("txnRef", payment.getTxnRef());
            row.put("createdAt", payment.getCreatedAt());
            row.put("paidAt", payment.getPaidAt());
            return row;
        }).toList();

        Map<String, Object> item = new LinkedHashMap<>();

        item.put("id", response.getId());
        item.put("bookingCode", response.getBookingCode());
        item.put("customerId", response.getCustomerId());
        item.put("customerName", response.getCustomerName());
        item.put("customerPhone", response.getCustomerPhone());
        item.put("partnerId", response.getPartnerId());
        item.put("partnerName", response.getPartnerName());
        item.put("address", response.getFullAddress());
        item.put("receiverName", response.getReceiverName());
        item.put("receiverPhone", response.getReceiverPhone());
        item.put("scheduledStart", response.getScheduledStart());
        item.put("scheduledEnd", response.getScheduledEnd());
        item.put("subtotal", response.getSubtotal());
        item.put("discountAmount", response.getDiscountAmount());
        item.put("totalAmount", response.getTotalAmount());
        item.put("status", response.getStatus());
        item.put("paymentMethod", response.getPaymentMethod());
        item.put("paymentStatus", paid ? "PAID" : "UNPAID");
        item.put("paymentRecords", paymentRecords);
        item.put("customerNote", response.getCustomerNote());
        item.put("cancelReason", response.getCancelReason());
        item.put("version", response.getVersion());
        item.put("createdAt", response.getCreatedAt());
        item.put("completedAt", response.getCompletedAt());
        item.put("cancelledAt", response.getCancelledAt());
        item.put("items", response.getItems());
        item.put("statusHistory", response.getStatusHistory());
        item.put("cancellationNeedsRefundReview", paid && "CANCELLED".equalsIgnoreCase(booking.getStatus()));

        return item;
    }

    private boolean matchesSearch(BookingResponse response, String search) {
        return contains(response.getBookingCode(), search)
                || contains(response.getCustomerName(), search)
                || contains(response.getCustomerPhone(), search)
                || contains(response.getPartnerName(), search)
                || contains(response.getFullAddress(), search)
                || response.getId() != null && response.getId().toString().contains(search);
    }

    private boolean contains(String value, String search) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(search);
    }

    private boolean isSuccessfulPayment(Payment payment) {
        return payment.getStatus() != null
                && ("SUCCESS".equalsIgnoreCase(payment.getStatus())
                || "PAID".equalsIgnoreCase(payment.getStatus()));
    }

    private void validateAdmin(Authentication authentication) {
        if (authentication == null || authentication.getName() == null
                || authentication.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Bạn cần đăng nhập lại.");
        }

        boolean allowed = authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));

        if (!allowed) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ Admin mới có quyền xem và can thiệp đơn hàng toàn sàn.");
        }
    }

    private Long parseVersion(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }

        if (value instanceof String string && !string.isBlank()) {
            try {
                return Long.parseLong(string.trim());
            } catch (NumberFormatException ignored) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phiên bản đơn hàng không hợp lệ.");
            }
        }

        return null;
    }

    private String readText(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private LocalDateTime parseDate(String value, boolean endOfDay) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            LocalDate date = LocalDate.parse(value.trim());
            return endOfDay ? date.plusDays(1).atStartOfDay().minusNanos(1) : date.atStartOfDay();
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ngày lọc không hợp lệ. Dùng định dạng yyyy-MM-dd.");
        }
    }
}