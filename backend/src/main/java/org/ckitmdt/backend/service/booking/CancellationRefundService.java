
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
import org.ckitmdt.backend.service.CustomerNotificationService;
import org.ckitmdt.backend.service.admin.AdminAuditLogService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
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
    private final CustomerNotificationService customerNotificationService;
    private final AdminAuditLogService auditLogService;

    @Transactional
    public void createLatePaymentRefund(
            Long bookingId,
            BigDecimal receivedAmount,
            String transactionNo
    ) {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElse(null);

        if (booking == null
                || booking.getCustomer() == null
                || receivedAmount == null
                || receivedAmount.signum() <= 0
                || refundRepository.existsByBooking_Id(bookingId)) {
            return;
        }

        BigDecimal requestedAmount = receivedAmount.setScale(
                2,
                RoundingMode.HALF_UP
        );

        if (booking.getTotalAmount() != null
                && booking.getTotalAmount().signum() > 0
                && requestedAmount.compareTo(booking.getTotalAmount()) > 0) {
            requestedAmount = booking.getTotalAmount().setScale(
                    2,
                    RoundingMode.HALF_UP
            );
        }

        if (requestedAmount.signum() <= 0) {
            return;
        }

        String transaction = transactionNo == null || transactionNo.isBlank()
                ? "không có"
                : transactionNo.trim();

        refundRepository.save(CancellationRefund.builder()
                .booking(booking)
                .requestedBy(booking.getCustomer())
                .requestedAmount(requestedAmount)
                .status("PENDING_REVIEW")
                .cancellationReason(
                        "Thanh toán VNPay thành công sau khi thời hạn giữ chỗ đã kết thúc. "
                                + "Đơn không được khôi phục; cần đối soát và hoàn tiền. "
                                + "Mã giao dịch: " + transaction
                )
                .requestedAt(LocalDateTime.now())
                .build());
    }

    @Transactional
    public Map<String, Object> requestRefund(
            Long bookingId,
            Map<String, Object> body,
            Authentication auth
    ) {
        User customer = currentUser(auth);

        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> error(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy đơn hàng."
                ));

        if (booking.getCustomer() == null
                || !booking.getCustomer().getId().equals(customer.getId())) {
            throw error(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền yêu cầu hoàn tiền cho đơn này."
            );
        }

        String bookingStatus = upper(booking.getStatus());

        if (!"CANCELLED".equals(bookingStatus)
                && !"REJECTED".equals(bookingStatus)
                && !"EXPIRED".equals(bookingStatus)) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Chỉ đơn đã hủy, bị từ chối hoặc hết hạn mới được yêu cầu hoàn tiền."
            );
        }

        if (refundRepository.existsByBooking_Id(bookingId)) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Đơn hàng này đã có yêu cầu hoàn tiền."
            );
        }

        String reason = text(body == null ? null : body.get("reason"));

        if (reason.isBlank() || reason.length() > 5000) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Lý do yêu cầu hoàn tiền không được để trống và không vượt quá 5000 ký tự."
            );
        }

        List<Payment> payments = paymentRepository.findByBooking_Id(bookingId);

        BigDecimal requestedAmount = payments.stream()
                .filter(this::isSuccessfulPayment)
                .map(Payment::getAmount)
                .filter(amount -> amount != null && amount.signum() > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        if (booking.getTotalAmount() != null
                && booking.getTotalAmount().signum() > 0
                && requestedAmount.compareTo(booking.getTotalAmount()) > 0) {
            requestedAmount = booking.getTotalAmount().setScale(
                    2,
                    RoundingMode.HALF_UP
            );
        }

        if (requestedAmount.signum() <= 0) {
            throw error(
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

        CancellationRefund saved = refundRepository.save(refund);

        auditLogService.record(
                auth,
                "REFUND_REQUESTED",
                "CANCELLATION_REFUND",
                saved.getId(),
                reason,
                null,
                "bookingId=" + bookingId
                        + ";bookingCode=" + booking.getBookingCode()
                        + ";requestedAmount=" + requestedAmount
                        + ";status=PENDING_REVIEW"
        );

        return row(saved);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getRefundsForAdmin(
            Authentication auth
    ) {
        requireStaff(auth);

        return refundRepository.findTop200ByOrderByRequestedAtDesc()
                .stream()
                .map(this::row)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getMyRefunds(
            Authentication auth
    ) {
        User customer = currentUser(auth);

        return refundRepository
                .findByRequestedBy_IdOrderByRequestedAtDesc(customer.getId())
                .stream()
                .map(this::row)
                .toList();
    }

    @Transactional
    public Map<String, Object> recordTransfer(
            Long id,
            Map<String, Object> body,
            Authentication auth
    ) {
        User operator = requireAdmin(auth);

        if (body == null) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Thiếu thông tin chuyển tiền."
            );
        }

        CancellationRefund refund = refundRepository.findByIdForUpdate(id)
                .orElseThrow(() -> error(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy yêu cầu hoàn tiền."
                ));

        if (!"APPROVED".equalsIgnoreCase(refund.getStatus())) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Chỉ yêu cầu đã duyệt mới được ghi nhận chuyển tiền."
            );
        }

        if (refund.getTransferredAt() != null) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Yêu cầu này đã được ghi nhận chuyển tiền."
            );
        }

        String reference = text(body.get("transferReference"));
        String evidenceUrl = text(body.get("evidenceUrl"));

        if (reference.isBlank() || reference.length() > 150) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Mã giao dịch chuyển tiền là bắt buộc và không vượt quá 150 ký tự."
            );
        }

        validateEvidenceUrl(evidenceUrl);

        LocalDateTime now = LocalDateTime.now();

        refund.setTransferReference(reference);
        refund.setTransferEvidenceUrl(evidenceUrl);
        refund.setTransferredBy(operator.getEmail());
        refund.setTransferredAt(now);

        CancellationRefund saved = refundRepository.save(refund);

        auditLogService.record(
                auth,
                "REFUND_TRANSFER_RECORDED",
                "CANCELLATION_REFUND",
                saved.getId(),
                "Ghi nhận chứng từ chuyển tiền hoàn cho đơn "
                        + saved.getBooking().getBookingCode(),
                "status=APPROVED;transferredAt=null",
                "status=APPROVED"
                        + ";approvedAmount=" + saved.getApprovedAmount()
                        + ";transferReference=" + reference
                        + ";evidenceUrl=" + evidenceUrl
                        + ";transferredAt=" + now
        );

        if (saved.getRequestedBy() != null) {
            customerNotificationService.notifyCustomer(
                    saved.getRequestedBy(),
                    "REFUND_TRANSFERRED",
                    "Đã ghi nhận chuyển khoản hoàn tiền",
                    "Khoản hoàn tiền cho đơn "
                            + saved.getBooking().getBookingCode()
                            + " đã được ghi nhận kèm chứng từ chuyển khoản.",
                    "REFUND",
                    saved.getId()
            );
        }

        return row(saved);
    }

    @Transactional
    public Map<String, Object> reviewRefund(
            Long id,
            Map<String, Object> body,
            Authentication auth
    ) {
        User operator = requireAdmin(auth);

        if (body == null) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Thiếu dữ liệu xử lý yêu cầu hoàn tiền."
            );
        }

        CancellationRefund refund = refundRepository.findByIdForUpdate(id)
                .orElseThrow(() -> error(
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
                ).setScale(2, RoundingMode.HALF_UP);
            } catch (NumberFormatException exception) {
                throw error(
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
        String oldStatus = upper(refund.getStatus());
        BigDecimal oldApprovedAmount = refund.getApprovedAmount();

        refund.setStatus(status);

        if ("APPROVED".equals(status)) {
            refund.setApprovedAmount(approvedAmount);
        } else {
            refund.setApprovedAmount(BigDecimal.ZERO.setScale(2));
        }

        refund.setDecisionNote(decisionNote);
        refund.setReviewedBy(operator.getEmail());
        refund.setReviewedAt(now);

        CancellationRefund saved = refundRepository.save(refund);

        auditLogService.record(
                auth,
                "REFUND_REVIEWED",
                "CANCELLATION_REFUND",
                saved.getId(),
                decisionNote,
                "status=" + oldStatus
                        + ";approvedAmount=" + oldApprovedAmount,
                "status=" + status
                        + ";approvedAmount=" + saved.getApprovedAmount()
                        + ";reviewedBy=" + operator.getEmail()
                        + ";reviewedAt=" + now
        );

        if (saved.getRequestedBy() != null) {
            String message = "Yêu cầu hoàn tiền cho đơn "
                    + saved.getBooking().getBookingCode()
                    + ("APPROVED".equals(status)
                    ? " đã được duyệt."
                    : " đã bị từ chối.");

            customerNotificationService.notifyCustomer(
                    saved.getRequestedBy(),
                    "REFUND_" + status,
                    "Cập nhật yêu cầu hoàn tiền",
                    message,
                    "REFUND",
                    saved.getId()
            );
        }

        return row(saved);
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
            String decisionNote
    ) {
        if (!"PENDING_REVIEW".equalsIgnoreCase(refund.getStatus())) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Yêu cầu này đã được xử lý."
            );
        }

        if (!"APPROVED".equals(status)
                && !"REJECTED".equals(status)) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Trạng thái phải là APPROVED hoặc REJECTED."
            );
        }

        if (decisionNote.isBlank() || decisionNote.length() > 5000) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng nhập ghi chú xử lý không vượt quá 5000 ký tự."
            );
        }

        if ("APPROVED".equals(status)) {
            if (approvedAmount == null || approvedAmount.signum() <= 0) {
                throw error(
                        HttpStatus.BAD_REQUEST,
                        "Số tiền hoàn phải lớn hơn 0."
                );
            }

            if (refund.getRequestedAmount() == null
                    || approvedAmount.compareTo(
                    refund.getRequestedAmount()) > 0) {
                throw error(
                        HttpStatus.BAD_REQUEST,
                        "Số tiền duyệt không được lớn hơn số tiền yêu cầu."
                );
            }
        }
    }

    private void validateEvidenceUrl(String value) {
        if (value == null || value.isBlank() || value.length() > 1000) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Phải cung cấp liên kết chứng từ chuyển tiền hợp lệ."
            );
        }

        try {
            URI uri = URI.create(value);
            String scheme = uri.getScheme();

            if (scheme == null
                    || !("http".equalsIgnoreCase(scheme)
                    || "https".equalsIgnoreCase(scheme))
                    || uri.getHost() == null) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException exception) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Liên kết chứng từ phải là URL HTTP hoặc HTTPS hợp lệ."
            );
        }
    }

    private User currentUser(Authentication auth) {
        if (auth == null
                || auth.getName() == null
                || auth.getName().isBlank()) {
            throw error(
                    HttpStatus.UNAUTHORIZED,
                    "Vui lòng đăng nhập."
            );
        }

        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> error(
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
            throw error(
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
            throw error(
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
        result.put("bookingId", booking == null ? null : booking.getId());
        result.put("bookingCode", booking == null ? null : booking.getBookingCode());
        result.put("bookingStatus", booking == null ? null : booking.getStatus());

        result.put("requestedById", requester == null ? null : requester.getId());
        result.put("requestedByName", requester == null ? null : requester.getFullName());
        result.put("requestedByEmail", requester == null ? null : requester.getEmail());

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
                refund.getTransferredAt() != null
                        ? "TRANSFERRED"
                        : "APPROVED".equalsIgnoreCase(refund.getStatus())
                        ? "WAITING_FOR_TRANSFER_EVIDENCE"
                        : null
        );

        result.put("transferReference", refund.getTransferReference());
        result.put("transferEvidenceUrl", refund.getTransferEvidenceUrl());
        result.put("transferredBy", refund.getTransferredBy());
        result.put("transferredAt", refund.getTransferredAt());

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

    private ResponseStatusException error(
            HttpStatus status,
            String message
    ) {
        return new ResponseStatusException(status, message);
    }
}
