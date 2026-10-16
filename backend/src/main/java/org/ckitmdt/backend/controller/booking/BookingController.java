package org.ckitmdt.backend.controller.booking;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.booking.*;
import org.ckitmdt.backend.service.booking.BookingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;

    /**
     * Báo giá snapshot & kiểm tra năng lực rảnh trước khi đặt (CN07)
     */
    @PostMapping("/quote")
    public ResponseEntity<BookingQuoteResponse> calculateQuote(
            Authentication authentication,
            @Valid @RequestBody BookingQuoteRequest request
    ) {
        String userEmail = authentication != null ? authentication.getName() : null;
        return ResponseEntity.ok(bookingService.calculateQuote(request, userEmail));
    }

    /**
     * Tạo đơn đặt dịch vụ kèm giữ chỗ 15 phút (CN07)
     * Nhận Header Idempotency-Key hoặc trường trong body để chống nhấn lặp
     */
    @PostMapping
    public ResponseEntity<BookingResponse> createBooking(
            Authentication authentication,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKeyHeader,
            @Valid @RequestBody CreateBookingRequest request
    ) {
        if (idempotencyKeyHeader != null && !idempotencyKeyHeader.isBlank()) {
            request.setIdempotencyKey(idempotencyKeyHeader.trim());
        }
        return ResponseEntity.ok(bookingService.createBooking(request, authentication.getName()));
    }

    /**
     * Lấy danh sách đơn hàng của khách hàng hiện tại (CN17)
     */
    @GetMapping("/me")
    public ResponseEntity<List<BookingResponse>> getMyBookings(Authentication authentication) {
        return ResponseEntity.ok(bookingService.getMyBookings(authentication.getName()));
    }

    /**
     * Xem chi tiết đơn hàng kèm snapshot và timeline trạng thái (CN17)
     */
    @GetMapping("/{id}")
    public ResponseEntity<BookingResponse> getBookingDetail(
            Authentication authentication,
            @PathVariable("id") Long id
    ) {
        return ResponseEntity.ok(bookingService.getBookingDetail(id, authentication.getName()));
    }

    /**
     * Thực hiện hành động chuyển trạng thái đơn hàng (CN17)
     * Ví dụ: POST /api/bookings/1/actions/customer-accept
     */
    @PostMapping("/{id}/actions/{action}")
    public ResponseEntity<BookingResponse> executeNamedAction(
            Authentication authentication,
            @PathVariable("id") Long id,
            @PathVariable("action") String action,
            @RequestBody(required = false) BookingActionRequest request
    ) {
        if (request == null) {
            request = new BookingActionRequest();
        }
        request.setAction(action.replace("-", "_").toUpperCase());
        return ResponseEntity.ok(bookingService.executeAction(id, request, authentication.getName()));
    }

    /**
     * Thực hiện hành động chuyển trạng thái đơn hàng qua body request (CN17)
     * POST /api/bookings/1/actions
     */
    @PostMapping("/{id}/actions")
    public ResponseEntity<BookingResponse> executeAction(
            Authentication authentication,
            @PathVariable("id") Long id,
            @Valid @RequestBody BookingActionRequest request
    ) {
        return ResponseEntity.ok(bookingService.executeAction(id, request, authentication.getName()));
    }
}
