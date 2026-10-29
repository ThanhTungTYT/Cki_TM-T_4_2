
package org.ckitmdt.backend.controller.auth;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Payment;
import org.ckitmdt.backend.repository.PaymentRepository;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/transactions")
@RequiredArgsConstructor
public class AdminTransactionController {

    private final PaymentRepository paymentRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTransactions() {
        List<Payment> payments = paymentRepository.findAll(
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        List<Map<String, Object>> result = new ArrayList<>();

        for (Payment payment : payments) {
            Map<String, Object> item = new LinkedHashMap<>();

            item.put("id", payment.getId());
            item.put("bookingId", payment.getBooking().getId());
            item.put("bookingCode", payment.getBooking().getBookingCode());
            item.put("customerName",
                    payment.getBooking().getCustomer().getFullName());
            item.put("email",
                    payment.getBooking().getCustomer().getEmail());
            item.put("phone",
                    payment.getBooking().getCustomer().getPhone());
            item.put("paymentMethod", payment.getPaymentMethod());
            item.put("paymentProvider", payment.getPaymentProvider());
            item.put("date", payment.getCreatedAt());
            item.put("paidAt", payment.getPaidAt());
            item.put("amount", payment.getAmount());
            item.put("status", payment.getStatus());
            item.put("reference", payment.getTransactionCode());
            item.put("txnRef", payment.getTxnRef());

            result.add(item);
        }

        return result;
    }
}
