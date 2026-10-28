package org.ckitmdt.backend.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.VNPayRequest;
import org.ckitmdt.backend.dto.VNPayResponse;
import org.ckitmdt.backend.dto.VNPayStatusResponse;
import org.ckitmdt.backend.entity.Payment;
import org.ckitmdt.backend.repository.PaymentRepository;
import org.ckitmdt.backend.service.BookingPaymentService;
import org.ckitmdt.backend.service.PaymentService;
import org.ckitmdt.backend.service.VNPayIpnService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments/vnpay")
@RequiredArgsConstructor
public class VNPayController {

    private final PaymentService paymentService;
    private final VNPayIpnService ipnService;
    private final PaymentRepository paymentRepository;
    private final BookingPaymentService bookingPaymentService;

    @PostMapping("/create")
    public ResponseEntity<VNPayResponse> create(
            @RequestBody VNPayRequest request,
            Authentication authentication,
            HttpServletRequest servletRequest
    ) {
        if (authentication == null ||
                !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        if (request.bookingId() == null) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(
                paymentService.create(
                        request.bookingId(),
                        authentication.getName(),
                        servletRequest.getRemoteAddr()
                )
        );
    }

    @GetMapping("/ipn")
    public ResponseEntity<Map<String, String>> ipn(
            @RequestParam Map<String, String> params
    ) {
        Map<String, String> result = ipnService.process(params);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/status/{txnRef}")
    public ResponseEntity<VNPayStatusResponse> status(
            @PathVariable String txnRef,
            Authentication authentication
    ) {
        if (authentication == null ||
                !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }

        Payment payment = paymentRepository
                .findByTxnRef(txnRef)
                .orElse(null);

        if (payment == null) {
            return ResponseEntity.notFound().build();
        }

        bookingPaymentService.assertCanView(
                payment.getBooking().getId(),
                authentication.getName()
        );

        return ResponseEntity.ok(
                new VNPayStatusResponse(
                        payment.getBooking().getId(),
                        payment.getTxnRef(),
                        payment.getStatus()
                )
        );
    }
}