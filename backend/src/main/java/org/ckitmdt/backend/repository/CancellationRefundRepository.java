
package org.ckitmdt.backend.controller.booking;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.CancellationRefund;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.CancellationRefundRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/refunds")
@RequiredArgsConstructor
public class CancellationRefundController {

    private final CancellationRefundRepository refundRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;

    @PostMapping("/bookings/{bookingId}/request")
    @Transactional
    public Map<String, Object> requestRefund(
            @PathVariable Long bookingId,
            @RequestBody(required = false) Map<String, Object> body,
            Authentication auth) {

        User customer = currentUser(auth);

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy đơn hàng."
                ));

        if (booking.getCustomer() == null
                || !booking.getCustomer().getId().equals(customer.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền yêu cầu hoàn tiền cho đơn này."
            );
        }

        String bookingStatus = upper(booking.getStatus());

        if (!Set.of("CANCELLED", "REJECTED").contains(bookingStatus)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Chỉ được yêu cầu hoàn tiền cho đơn đã hủy hoặc bị từ chối."
            );
        }

        if (refundRepository.existsByBookingId(bookingId)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Đơn hàng này đã có yêu cầu hoàn tiền."
            );
        }

        BigDecimal amount = booking.getTotalAmount();

        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Không xác định được số tiền yêu cầu hoàn."
            );
        }

        String reason = body == null
                ? "" : text(body.get("reason"));

        CancellationRefund refund = CancellationRefund.builder()
                .booking(booking)
                .requestedBy(customer)
                .requestedAmount(amount)
                .status("PENDING_REVIEW")
                .cancellationReason(reason)
                .requestedAt(LocalDateTime.now())
                .build();

        return row(refundRepository.save(refund));
    }

    @GetMapping("/admin")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllRefunds(
            Authentication auth) {

        requireStaff(auth);

        return refundRepository.findTop200ByOrderByRequestedAtDesc()
                .stream()
                .map(this::row)
                .toList();
    }

    @PutMapping("/{id}/review")
    @Transactional
    public Map<String, Object> reviewRefund(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        User operator = requireStaff(auth);

        CancellationRefund refund = refundRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy yêu cầu hoàn tiền."
                ));

        if (!"PENDING_REVIEW".equals(upper(refund.getStatus()))) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Yêu cầu này đã được xử lý."
            );
        }

        String status = upper(text(body.get("status")));
        String note = text(body.get("decisionNote"));

        if (!Set.of("APPROVED", "REJECTED").contains(status)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trạng thái chỉ được là APPROVED hoặc REJECTED."
            );
        }

        if (note.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng nhập lý do xử lý."
            );
        }

        BigDecimal approvedAmount = null;

        if ("APPROVED".equals(status)) {
            Object amountValue = body.get("approvedAmount");

            try {
                approvedAmount = amountValue == null
                        ? refund.getRequestedAmount()
                        : new BigDecimal(String.valueOf(amountValue));
            } catch (NumberFormatException ex) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Số tiền hoàn không hợp lệ."
                );
            }

            if (approvedAmount == null
                    || approvedAmount.compareTo(BigDecimal.ZERO) < 0
                    || approvedAmount.compareTo(
                    refund.getRequestedAmount()) > 0) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Số tiền duyệt phải từ 0 đến số tiền yêu cầu."
                );
            }
        }

        refund.setStatus(status);
        refund.setApprovedAmount(approvedAmount);
        refund.setDecisionNote(note);
        refund.setReviewedBy(operator.getEmail());
        refund.setReviewedAt(LocalDateTime.now());

        return row(refundRepository.save(refund));
    }

    private User currentUser(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Vui lòng đăng nhập."
            );
        }

        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Không tìm thấy tài khoản."
                ));
    }

    private User requireStaff(Authentication auth) {
        User user = currentUser(auth);
        String role = upper(user.getRole());

        if (!Set.of(
                "ADMIN", "STAFF", "ROLE_ADMIN", "ROLE_STAFF"
        ).contains(role)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền xử lý yêu cầu hoàn tiền."
            );
        }

        return user;
    }

    private Map<String, Object> row(CancellationRefund refund) {
        Map<String, Object> result = new LinkedHashMap<>();

        result.put("id", refund.getId());
        result.put("bookingId", refund.getBooking().getId());
        result.put("bookingCode", refund.getBooking().getBookingCode());
        result.put("requestedBy",
                refund.getRequestedBy() == null
                        ? null : refund.getRequestedBy().getEmail());
        result.put("requestedAmount", refund.getRequestedAmount());
        result.put("approvedAmount", refund.getApprovedAmount());
        result.put("status", refund.getStatus());
        result.put("cancellationReason", refund.getCancellationReason());
        result.put("decisionNote", refund.getDecisionNote());
        result.put("reviewedBy", refund.getReviewedBy());
        result.put("requestedAt", refund.getRequestedAt());
        result.put("reviewedAt", refund.getReviewedAt());

        return result;
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String upper(String value) {
        return value == null
                ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}
