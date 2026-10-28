package org.ckitmdt.backend.service;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Payment;
import org.ckitmdt.backend.repository.PaymentRepository;
import org.ckitmdt.backend.dto.booking.BookingActionRequest;
import org.ckitmdt.backend.dto.booking.BookingActionEnum;
import org.ckitmdt.backend.service.booking.BookingStateEngine;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class VNPayIpnService {

    private final VNPayService vnPayService;
    private final PaymentRepository paymentRepository;
    private final BookingStateEngine bookingStateEngine;

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

            if (payment.getBooking() == null
                    || !"PENDING_PAYMENT".equals(payment.getBooking().getStatus())
                    || (payment.getBooking().getHoldExpiresAt() != null
                    && LocalDateTime.now().isAfter(payment.getBooking().getHoldExpiresAt()))) {
                payment.setStatus("REVIEW");
                payment.setTransactionCode(transactionNo);
                payment.setPaidAt(LocalDateTime.now());
                paymentRepository.save(payment);
                return result("00", "Confirm Success");
            }

            boolean alreadyPaid =
                    paymentRepository.existsByBooking_IdAndStatus(
                            payment.getBooking().getId(),
                            "SUCCESS"
                    );

            if (alreadyPaid) {
                payment.setStatus("REVIEW");
                payment.setTransactionCode(transactionNo);
                paymentRepository.save(payment);
                moveBookingToProviderQueue(payment);

                return result("00", "Confirm Success");
            }

            payment.setStatus("SUCCESS");
            payment.setTransactionCode(transactionNo);
            payment.setPaidAt(LocalDateTime.now());

        } else if ("07".equals(responseCode)
                || "07".equals(transactionStatus)) {
            payment.setStatus("REVIEW");

        } else {
            payment.setStatus("FAILED");
        }

        paymentRepository.save(payment);

        if ("SUCCESS".equals(payment.getStatus())) moveBookingToProviderQueue(payment);

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
