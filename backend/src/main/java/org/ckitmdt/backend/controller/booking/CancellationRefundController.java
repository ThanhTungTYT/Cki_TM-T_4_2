
package org.ckitmdt.backend.controller.booking;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.service.booking.CancellationRefundService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/refunds")
@RequiredArgsConstructor
public class CancellationRefundController {

    private final CancellationRefundService refundService;

    // Khách hàng gửi yêu cầu hoàn tiền.
    // POST /api/refunds/bookings/{bookingId}/request
    @PostMapping("/bookings/{bookingId}/request")
    public Map<String, Object> requestRefund(
            @PathVariable Long bookingId,
            @RequestBody(required = false) Map<String, Object> body,
            Authentication auth) {

        return refundService.requestRefund(bookingId, body, auth);
    }

    // Admin/Staff xem danh sách yêu cầu.
    // GET /api/refunds/admin
    @GetMapping("/admin")
    public List<Map<String, Object>> getRefundsForAdmin(
            Authentication auth) {

        return refundService.getRefundsForAdmin(auth);
    }

    // Admin/Staff duyệt hoặc từ chối yêu cầu.
    // PUT /api/refunds/{id}/review
    @PutMapping("/{id}/review")
    public Map<String, Object> reviewRefund(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        return refundService.reviewRefund(id, body, auth);
    }
}
