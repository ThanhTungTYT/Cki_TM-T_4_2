
package org.ckitmdt.backend.service.booking;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.CancellationRefund;
import org.ckitmdt.backend.entity.Payment;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.CancellationRefundRepository;
import org.ckitmdt.backend.repository.PaymentRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CancellationRefundService {

    private final CancellationRefundRepository refundRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;

    @Transactional
    public Map<String, Object> requestRefund(
            Long bookingId,
            Map<String, Object> body,
            Authentication auth) {

        User customer = currentUser(auth);

        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
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

        if (!"CANCELLED".equals(bookingStatus)
                && !"REJECTED".equals(bookingStatus)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Chỉ đơn đã hủy hoặc bị từ chối mới được yêu cầu hoàn tiền."
            );
        }

        if (refundRepository.existsByBooking_Id(bookingId)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Đơn hàng này đã có yêu cầu hoàn tiền."
            );
        }

        String reason = text(body == null ? null : body.get("reason"));

        if (reason.isBlank() || reason.length() > 5000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Lý do yêu cầu hoàn tiền không được để trống và không vượt quá 5000 ký tự."
            );
        }

        List<Payment> payments =
                paymentRepository.findByBooking_Id(bookingId);

        BigDecimal requestedAmount = payments.stream()
                .filter(this::isSuccessfulPayment)
                .map(Payment::getAmount)
                .filter(amount -> amount != null && amount.signum() > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (requestedAmount.signum() <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Đơn hàng chưa có giao dịch thanh toán thành công để hoàn tiền."
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

        return row(refundRepository.save(refund));
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getRefundsForAdmin(
            Authentication auth) {

        requireStaff(auth);

        return refundRepository.findTop200ByOrderByRequestedAtDesc()
                .stream()
                .map(this::row)
                .toList();
    }

    @Transactional
    public Map<String, Object> reviewRefund(
            Long id,
            Map<String, Object> body,
            Authentication auth) {

        User operator = requireAdmin(auth);

        if (body == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thiếu dữ liệu xử lý yêu cầu hoàn tiền."
            );
        }

        CancellationRefund refund = refundRepository.findByIdForUpdate(id)
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

        LocalDateTime now = LocalDateTime.now();

        refund.setStatus(status);

        if ("APPROVED".equals(status)) {
            refund.setApprovedAmount(approvedAmount);
        } else {
            refund.setApprovedAmount(BigDecimal.ZERO);
        }

        refund.setDecisionNote(decisionNote);
        refund.setReviewedBy(operator.getEmail());
        refund.setReviewedAt(now);

        return row(refundRepository.save(refund));
    }

    private boolean isSuccessfulPayment(Payment payment) {
        if (payment == null) {
            return false;
        }

        String status = upper(payment.getStatus());

        return "PAID".equals(status)
                || "SUCCESS".equals(status)
                || "SUCCESSFUL".equals(status)
                || "COMPLETED".equals(status)
                || "SUCCEEDED".equals(status);
    }

    private void validateRefundDecision(
            CancellationRefund refund,
            String status,
            BigDecimal approvedAmount,
            String decisionNote) {

        if (!"PENDING_REVIEW".equalsIgnoreCase(refund.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
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

        if (decisionNote.isBlank() || decisionNote.length() > 5000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng nhập ghi chú xử lý không vượt quá 5000 ký tự."
            );
        }

        if ("APPROVED".equals(status)) {
            if (approvedAmount == null
                    || approvedAmount.signum() <= 0) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Số tiền hoàn phải lớn hơn 0."
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

    private User currentUser(Authentication auth) {
        if (auth == null
                || auth.getName() == null
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

    private User requireStaff(Authentication auth) {
        User user = currentUser(auth);
        String role = upper(user.getRole());

        if (!"ADMIN".equals(role)
                && !"ROLE_ADMIN".equals(role)
                && !"STAFF".equals(role)
                && !"ROLE_STAFF".equals(role)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền xem yêu cầu hoàn tiền."
            );
        }

        return user;
    }

    private User requireAdmin(Authentication auth) {
        User user = currentUser(auth);
        String role = upper(user.getRole());

        if (!"ADMIN".equals(role) && !"ROLE_ADMIN".equals(role)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Chỉ Admin mới được duyệt hoặc từ chối yêu cầu hoàn tiền."
            );
        }

        return user;
    }

    private Map<String, Object> row(CancellationRefund refund) {
        Map<String, Object> result = new LinkedHashMap<>();

        Booking booking = refund.getBooking();
        User requester = refund.getRequestedBy();

        result.put("id", refund.getId());
        result.put(
                "bookingId",
                booking == null ? null : booking.getId()
        );
        result.put(
                "bookingCode",
                booking == null ? null : booking.getBookingCode()
        );
        result.put(
                "bookingStatus",
                booking == null ? null : booking.getStatus()
        );

        result.put(
                "requestedById",
                requester == null ? null : requester.getId()
        );
        result.put(
                "requestedByName",
                requester == null ? null : requester.getFullName()
        );
        result.put(
                "requestedByEmail",
                requester == null ? null : requester.getEmail()
        );

        result.put("requestedAmount", refund.getRequestedAmount());
        result.put("approvedAmount", refund.getApprovedAmount());
        result.put("status", refund.getStatus());
        result.put("cancellationReason", refund.getCancellationReason());
        result.put("decisionNote", refund.getDecisionNote());
        result.put("reviewedBy", refund.getReviewedBy());
        result.put("requestedAt", refund.getRequestedAt());
        result.put("reviewedAt", refund.getReviewedAt());

        result.put(
                "refundTransferStatus",
                "APPROVED".equalsIgnoreCase(refund.getStatus())
                        ? "WAITING_FOR_TRANSFER_EVIDENCE"
                        : null
        );

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
