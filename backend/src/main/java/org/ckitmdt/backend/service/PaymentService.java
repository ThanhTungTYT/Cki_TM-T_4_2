package org.ckitmdt.backend.service;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.VNPayResponse;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.Payment;
import org.ckitmdt.backend.repository.PaymentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final BookingPaymentService bookingPaymentService;
    private final VNPayService vnPayService;

    @Transactional
    public VNPayResponse create(
            Long bookingId,
            String email,
            String ipAddress
    ) {
        Booking booking = bookingPaymentService
                .getBookingForPayment(bookingId, email);

        if (paymentRepository.existsByBooking_IdAndStatus(
                bookingId, "SUCCESS")) {
            throw new IllegalStateException(
                    "Booking already paid"
            );
        }

        String txnRef = UUID.randomUUID()
                .toString()
                .replace("-", "");

        Payment payment = new Payment();

        payment.setBooking(booking);
        payment.setTxnRef(txnRef);
        payment.setAmount(booking.getTotalAmount());
        payment.setPaymentMethod("ONLINE");
        payment.setPaymentProvider("VNPAY");
        payment.setStatus("PENDING");
        payment.setCreatedAt(LocalDateTime.now());

        paymentRepository.save(payment);

        String paymentUrl = vnPayService.createPaymentUrl(
                txnRef,
                booking.getTotalAmount(),
                ipAddress
        );

        return new VNPayResponse(txnRef, paymentUrl);
    }
}