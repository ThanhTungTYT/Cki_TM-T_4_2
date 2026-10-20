
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

@RestController
@RequestMapping("/api/refunds")
@RequiredArgsConstructor
public class CancellationRefundController {

    private final CancellationRefundRepository refundRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;

    /**
     * CN18: Khách hàng gửi yêu cầu hoàn tiền cho đơn đã hủy.
     * POST /api/refunds/bookings/{bookingId}/request
     */
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

        // Chỉ chủ đơn mới được yêu cầu hoàn tiền.
        if (booking.getCustomer() == null
                || !booking.getCustomer().getId().equals(customer.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền yêu cầu hoàn tiền cho đơn này."
            );
        }

        String bookingStatus = upper(booking.getStatus());

        if (!"CANCELLED".equals(bookingStatus)
                && !"REJECTED".equals(bookingStatus)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Chỉ đơn đã hủy hoặc bị từ chối mới được yêu cầu hoàn tiền."
            );
        }

        if (refundRepository.existsByBookingId(bookingId)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Đơn hàng này đã có yêu cầu hoàn tiền."
            );
        }

        String reason = text(body == null ? null : body.get("reason"));

        if (reason.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng nhập lý do yêu cầu hoàn tiền."
            );
        }

        /*
         * TẠM THỜI lấy totalAmount làm số tiền yêu cầu.
         * Cần đối chiếu bảng thanh toán để xác định số tiền khách
         * thực sự đã trả trước khi đưa vào sử dụng chính thức.
         */
        BigDecimal requestedAmount = booking.getTotalAmount();

        if (requestedAmount == null || requestedAmount.signum() <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Không xác định được số tiền yêu cầu hoàn."
            );
        }

        CancellationRefund refund = CancellationRefund.builder()
                .booking(booking)
                .requestedBy(customer)
                .requestedAmount(requestedAmount)
                .approvedAmount(null)
                .status("PENDING_REVIEW")
                .cancellationReason(reason)
                .requestedAt(LocalDateTime.now())
                .build();

        CancellationRefund saved = refundRepository.save(refund);

        return row(saved);
    }

    /**
     * CN18: Admin/Staff xem danh sách yêu cầu hoàn tiền.
     * GET /api/refunds/admin
     */
    @GetMapping("/admin")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getRefundsForAdmin(
            Authentication auth) {

        User operator = requireStaff(auth);

        return refundRepository.findTop200ByOrderByRequestedAtDesc()
                .stream()
                .map(this::row)
                .toList();
    }

    /**
     * CN18: Admin/Staff duyệt hoặc từ chối yêu cầu hoàn tiền.
     * PUT /api/refunds/{id}/review
     *
     * Body khi duyệt:
     * {
     *   "status": "APPROVED",
     *   "approvedAmount": 200000,
     *   "decisionNote": "Đồng ý hoàn tiền cọc"
     * }
     *
     * Body khi từ chối:
     * {
     *   "status": "REJECTED",
     *   "decisionNote": "Yêu cầu không đáp ứng chính sách"
     * }
     */
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

        String status = upper(text(body.get("status")));
        String decisionNote = text(body.get("decisionNote"));

        BigDecimal approvedAmount = null;
        Object amountValue = body.get("approvedAmount");

        if (amountValue != null
                && !String.valueOf(amountValue).isBlank()) {
            try {
                approvedAmount = new BigDecimal(
                        String.valueOf(amountValue)
                );
            } catch (NumberFormatException ex) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Số tiền hoàn không hợp lệ."
                );
            }
        }

        validateRefundDecision(
                refund,
                status,
                approvedAmount,
                decisionNote
        );

        refund.setStatus(status);

        if ("APPROVED".equals(status)) {
            refund.setApprovedAmount(approvedAmount);
        } else {
            refund.setApprovedAmount(BigDecimal.ZERO);
        }

        refund.setDecisionNote(decisionNote);
        refund.setReviewedBy(operator.getEmail());
        refund.setReviewedAt(LocalDateTime.now());

        CancellationRefund saved = refundRepository.save(refund);

        return row(saved);
    }

    /**
     * Kiểm tra dữ liệu trước khi duyệt hoàn tiền.
     */
    private void validateRefundDecision(
            CancellationRefund refund,
            String status,
            BigDecimal approvedAmount,
            String decisionNote) {

        if (refund == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Không tìm thấy yêu cầu hoàn tiền."
            );
        }

        if (!"PENDING_REVIEW".equalsIgnoreCase(refund.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Yêu cầu này đã được xử lý."
            );
        }

        if (!"APPROVED".equals(status)
                && !"REJECTED".equals(status)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trạng thái phải là APPROVED hoặc REJECTED."
            );
        }

        if (decisionNote == null || decisionNote.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng nhập lý do xử lý."
            );
        }

        if ("APPROVED".equals(status)) {
            if (approvedAmount == null
                    || approvedAmount.signum() < 0) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Số tiền hoàn không hợp lệ."
                );
            }

            if (refund.getRequestedAmount() == null
                    || approvedAmount.compareTo(
                    refund.getRequestedAmount()) > 0) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Số tiền duyệt không được lớn hơn số tiền yêu cầu."
                );
            }
        }
    }

    /**
     * Lấy người dùng hiện tại từ email trong Authentication.
     */
    private User currentUser(Authentication auth) {
        if (auth == null || auth.getName() == null
                || auth.getName().isBlank()) {
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

    /**
     * Chỉ Admin/Staff được xử lý yêu cầu hoàn tiền.
     */
    private User requireStaff(Authentication auth) {
        User user = currentUser(auth);
        String role = upper(user.getRole());

        if (!"ADMIN".equals(role)
                && !"ROLE_ADMIN".equals(role)
                && !"STAFF".equals(role)
                && !"ROLE_STAFF".equals(role)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền xử lý yêu cầu hoàn tiền."
            );
        }

        return user;
    }

    /**
     * Chuyển entity thành dữ liệu JSON trả về API.
     */
    private Map<String, Object> row(CancellationRefund refund) {
        Map<String, Object> result = new LinkedHashMap<>();

        Booking booking = refund.getBooking();
        User requester = refund.getRequestedBy();

        result.put("id", refund.getId());
        result.put("bookingId",
                booking != null ? booking.getId() : null);
        result.put("bookingCode",
                booking != null ? booking.getBookingCode() : null);
        result.put("bookingStatus",
                booking != null ? booking.getStatus() : null);

        result.put("requestedById",
                requester != null ? requester.getId() : null);
        result.put("requestedByName",
                requester != null ? requester.getFullName() : null);
        result.put("requestedByEmail",
                requester != null ? requester.getEmail() : null);

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
                ? ""
                : value.trim().toUpperCase(Locale.ROOT);
    }
}
