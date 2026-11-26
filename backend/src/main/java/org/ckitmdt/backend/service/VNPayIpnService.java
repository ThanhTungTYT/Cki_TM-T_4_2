package org.ckitmdt.backend.service;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.AdminNotification;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.Payment;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.AdminNotificationRepository;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.PaymentRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.ckitmdt.backend.dto.booking.BookingActionRequest;
import org.ckitmdt.backend.dto.booking.BookingActionEnum;
import org.ckitmdt.backend.service.booking.BookingStateEngine;
import org.ckitmdt.backend.service.booking.CancellationRefundService;
import org.ckitmdt.backend.service.CustomerNotificationService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class VNPayIpnService {

    private final VNPayService vnPayService;
    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final AdminNotificationRepository adminNotificationRepository;
    private final UserRepository userRepository;
    private final BookingStateEngine bookingStateEngine;
    private final CancellationRefundService cancellationRefundService;
    private final CustomerNotificationService customerNotificationService;

    @Transactional
    public Map<String, String> process(
            Map<String, String> params
    ) {
        if (!vnPayService.verifySignature(params)) {
            return result("97", "Invalid signature");
        }

        if (!vnPayService.getTmnCode().equals(
                params.get("vnp_TmnCode"))) {
            return result("97", "Invalid merchant");
        }

        String txnRef = params.get("vnp_TxnRef");

        if (txnRef == null || txnRef.isBlank()) {
            return result("01", "Order not found");
        }

        Payment payment = paymentRepository
                .findByTxnRefForUpdate(txnRef)
                .orElse(null);

        if (payment == null) {
            return result("01", "Order not found");
        }

        BigDecimal receivedAmount;

        try {
            receivedAmount = new BigDecimal(
                    params.get("vnp_Amount")
            ).movePointLeft(2);
        } catch (RuntimeException e) {
            return result("04", "Invalid amount");
        }

        if (payment.getAmount().compareTo(receivedAmount) != 0) {
            return result("04", "Invalid amount");
        }

        if (!"VNPAY".equals(payment.getPaymentProvider())) {
            return result("99", "Invalid provider");
        }

        if (!"PENDING".equals(payment.getStatus())) {
            return result("02", "Order already updated");
        }

        String responseCode = params.get("vnp_ResponseCode");
        String transactionStatus = params.get("vnp_TransactionStatus");

        if (responseCode == null || transactionStatus == null) {
            return result("99", "Missing status");
        }

        if ("00".equals(responseCode)
                && "00".equals(transactionStatus)) {

            String transactionNo = params.get("vnp_TransactionNo");

            if (transactionNo == null || transactionNo.isBlank()) {
                return result("99", "Missing transaction number");
            }

            LocalDateTime paidAt = LocalDateTime.now();
            // Khóa Booking trước khi kiểm tra trạng thái & alreadyPaid để chống race condition thanh toán trùng
            Booking lockedBooking = payment.getBooking() != null && payment.getBooking().getId() != null
                    ? bookingRepository.findByIdForUpdate(payment.getBooking().getId()).orElse(null)
                    : null;

            boolean alreadyPaid = lockedBooking != null
                    && paymentRepository.existsByBooking_IdAndStatus(
                            lockedBooking.getId(),
                            "SUCCESS"
                    );

            if (alreadyPaid) {
                payment.setStatus("REVIEW");
                payment.setTransactionCode(transactionNo);
                payment.setPaidAt(paidAt);
                paymentRepository.save(payment);

                cancellationRefundService.createDuplicatePaymentRefund(
                        lockedBooking.getId(), payment.getAmount(), transactionNo);

                if (lockedBooking.getCustomer() != null) {
                    customerNotificationService.notifyCustomer(
                            lockedBooking.getCustomer(),
                            "PAYMENT_DUPLICATE_REVIEW",
                            "Phát hiện thanh toán trùng lặp",
                            "Đơn " + lockedBooking.getBookingCode()
                                    + " đã được thanh toán trước đó. Giao dịch trùng lặp (" + transactionNo
                                    + ") đã được tự động tạo yêu cầu hoàn tiền để Admin kiểm tra.",
                            "BOOKING",
                            lockedBooking.getId()
                    );
                }

                List<User> admins = userRepository.findByRoleIgnoreCaseAndStatusIgnoreCase("ADMIN", "ACTIVE");
                for (User admin : admins) {
                    adminNotificationRepository.save(AdminNotification.builder()
                            .recipient(admin)
                            .type("PAYMENT_DUPLICATE_REVIEW")
                            .title("Phát hiện thanh toán VNPay trùng lặp")
                            .message("Đơn #" + lockedBooking.getBookingCode()
                                    + " phát sinh giao dịch VNPay trùng lặp (" + transactionNo
                                    + ", số tiền " + payment.getAmount() + "đ). Hệ thống đã tạo yêu cầu hoàn tiền chờ duyệt.")
                            .referenceType("BOOKING")
                            .referenceId(lockedBooking.getId())
                            .createdAt(paidAt)
                            .build());
                }

                moveBookingToProviderQueue(payment);
                return result("00", "Confirm Success");
            }

            boolean bookingCanAcceptPayment = lockedBooking != null
                    && "PENDING_PAYMENT".equals(lockedBooking.getStatus())
                    && (lockedBooking.getHoldExpiresAt() == null
                    || !paidAt.isAfter(lockedBooking.getHoldExpiresAt()));
            if (!bookingCanAcceptPayment) {
                payment.setStatus("REVIEW");
                payment.setTransactionCode(transactionNo);
                payment.setPaidAt(paidAt);
                paymentRepository.save(payment);
                if (lockedBooking != null) {
                    cancellationRefundService.createLatePaymentRefund(
                            lockedBooking.getId(), payment.getAmount(), transactionNo);
                    customerNotificationService.notifyCustomer(lockedBooking.getCustomer(), "PAYMENT_REVIEW",
                            "Thanh toán cần được kiểm tra", "Thanh toán cho đơn "
                                    + lockedBooking.getBookingCode()
                                    + " đến sau thời hạn giữ chỗ và đang được xử lý hoàn tiền.",
                            "BOOKING", lockedBooking.getId());
                }
                return result("00", "Confirm Success");
            }

            payment.setStatus("SUCCESS");
            payment.setTransactionCode(transactionNo);
            payment.setPaidAt(paidAt);

        } else if ("07".equals(responseCode)
                || "07".equals(transactionStatus)) {
            payment.setStatus("REVIEW");

        } else {
            payment.setStatus("FAILED");
        }

        paymentRepository.save(payment);

        if ("SUCCESS".equals(payment.getStatus())) moveBookingToProviderQueue(payment);
        else if (payment.getBooking() != null) {
            String title = "FAILED".equals(payment.getStatus()) ? "Thanh toán chưa thành công" : "Thanh toán cần được kiểm tra";
            String message = "FAILED".equals(payment.getStatus())
                    ? "Thanh toán cho đơn " + payment.getBooking().getBookingCode() + " chưa thành công. Vui lòng thử lại hoặc chọn phương thức khác."
                    : "Thanh toán cho đơn " + payment.getBooking().getBookingCode() + " đang được kiểm tra.";
            customerNotificationService.notifyCustomer(payment.getBooking().getCustomer(),
                    "PAYMENT_" + payment.getStatus(), title, message, "BOOKING", payment.getBooking().getId());
        }

        return result("00", "Confirm Success");
    }

    private void moveBookingToProviderQueue(Payment payment) {
        if (payment.getBooking() == null
                || !"PENDING_PAYMENT".equals(payment.getBooking().getStatus())) return;
        bookingStateEngine.executeAction(
                payment.getBooking().getId(),
                BookingActionRequest.builder()
                        .action(BookingActionEnum.CUSTOMER_PAY_SUCCESS.name())
                        .note("Cổng VNPay đã xác nhận thanh toán thành công.")
                        .build(),
                null
        );
    }

    private Map<String, String> result(
            String code,
            String message
    ) {
        return Map.of(
                "RspCode", code,
                "Message", message
        );
    }
}
