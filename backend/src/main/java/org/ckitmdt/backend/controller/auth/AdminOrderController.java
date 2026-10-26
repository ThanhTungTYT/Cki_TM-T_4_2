package org.ckitmdt.backend.controller.auth;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.booking.BookingResponse;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.Payment;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.PaymentRepository;
import org.ckitmdt.backend.service.booking.BookingStateEngine;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Sort;

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
    public ResponseEntity<List<Map<String, Object>>> getAllOrders() {
        List<Booking> bookings = bookingRepository.findAll(
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        List<Map<String, Object>> result = new ArrayList<>();

        for (Booking booking : bookings) {
            BookingResponse response =
                    bookingStateEngine.mapToBookingResponse(booking);

            List<Payment> payments =
                    paymentRepository.findByBooking_Id(booking.getId());

            boolean paid = payments.stream().anyMatch(payment ->
                    payment.getStatus() != null
                            && (
                            "SUCCESS".equalsIgnoreCase(payment.getStatus())
                                    || "PAID".equalsIgnoreCase(payment.getStatus())
                    )
            );

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
            item.put("customerNote", response.getCustomerNote());
            item.put("cancelReason", response.getCancelReason());
            item.put("version", response.getVersion());
            item.put("createdAt", response.getCreatedAt());
            item.put("completedAt", response.getCompletedAt());
            item.put("cancelledAt", response.getCancelledAt());
            item.put("items", response.getItems());
            item.put("statusHistory", response.getStatusHistory());
            item.put("paymentStatus", paid ? "PAID" : "UNPAID");

            result.add(item);
        }

        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getOrderDetail(
            @PathVariable Long id
    ) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy đơn hàng."
                ));

        BookingResponse response =
                bookingStateEngine.mapToBookingResponse(booking);

        List<Payment> payments =
                paymentRepository.findByBooking_Id(id);

        boolean paid = payments.stream().anyMatch(payment ->
                payment.getStatus() != null
                        && (
                        "SUCCESS".equalsIgnoreCase(payment.getStatus())
                                || "PAID".equalsIgnoreCase(payment.getStatus())
                )
        );

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", response.getId());
        result.put("bookingCode", response.getBookingCode());
        result.put("customerId", response.getCustomerId());
        result.put("customerName", response.getCustomerName());
        result.put("customerPhone", response.getCustomerPhone());
        result.put("partnerId", response.getPartnerId());
        result.put("partnerName", response.getPartnerName());
        result.put("address", response.getFullAddress());
        result.put("receiverName", response.getReceiverName());
        result.put("receiverPhone", response.getReceiverPhone());
        result.put("scheduledStart", response.getScheduledStart());
        result.put("scheduledEnd", response.getScheduledEnd());
        result.put("subtotal", response.getSubtotal());
        result.put("discountAmount", response.getDiscountAmount());
        result.put("totalAmount", response.getTotalAmount());
        result.put("status", response.getStatus());
        result.put("customerNote", response.getCustomerNote());
        result.put("cancelReason", response.getCancelReason());
        result.put("version", response.getVersion());
        result.put("createdAt", response.getCreatedAt());
        result.put("completedAt", response.getCompletedAt());
        result.put("cancelledAt", response.getCancelledAt());
        result.put("items", response.getItems());
        result.put("statusHistory", response.getStatusHistory());
        result.put("paymentStatus", paid ? "PAID" : "UNPAID");

        return ResponseEntity.ok(result);
    }

    @PostMapping("/{id}/actions/{action}")
    public ResponseEntity<BookingResponse> executeOrderAction(
            Authentication authentication,
            @PathVariable Long id,
            @PathVariable String action,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        if (authentication == null
                || authentication.getName() == null
                || authentication.getName().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Bạn cần đăng nhập lại."
            );
        }

        Map<String, Object> requestBody =
                body == null ? new LinkedHashMap<>() : body;

        String normalizedAction = action
                .replace("-", "_")
                .toUpperCase(Locale.ROOT);

        org.ckitmdt.backend.dto.booking.BookingActionRequest request =
                new org.ckitmdt.backend.dto.booking.BookingActionRequest();

        request.setAction(normalizedAction);

        Object version = requestBody.get("version");

        if (version instanceof Number) {
            request.setVersion(((Number) version).longValue());
        } else if (version instanceof String) {
            try {
                request.setVersion(Long.parseLong((String) version));
            } catch (NumberFormatException ignored) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Phiên bản đơn hàng không hợp lệ."
                );
            }
        }

        Object note = requestBody.get("note");

        if (note instanceof String) {
            request.setNote((String) note);
        }

        BookingResponse updated = bookingStateEngine.executeAction(
                id,
                request,
                authentication.getName()
        );

        return ResponseEntity.ok(updated);
    }
}