package org.ckitmdt.backend.controller.provider;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.entity.Payment;
import org.ckitmdt.backend.entity.ProviderSettlement;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.CancellationRefundRepository;
import org.ckitmdt.backend.repository.PaymentRepository;
import org.ckitmdt.backend.repository.ProviderSettlementItemRepository;
import org.ckitmdt.backend.repository.ProviderSettlementRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/provider")
@RequiredArgsConstructor
public class ProviderRevenueController {

    private final ProviderSecurityHelper helper;
    private final BookingRepository bookingRepository;
    private final CancellationRefundRepository refundRepository;
    private final PaymentRepository paymentRepository;
    private final ProviderSettlementRepository settlementRepository;
    private final ProviderSettlementItemRepository settlementItemRepository;

    @GetMapping("/earnings")
    @Transactional(readOnly = true)
    public Map<String, Object> getEarnings(
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            Authentication auth) {

        Partner partner = helper.currentPartner(auth);
        return calculateEarnings(partner, fromDate, toDate);
    }

    @GetMapping("/settlements")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getSettlements(Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        return settlementRepository.findByPartner_IdOrderByCreatedAtDesc(partner.getId())
                .stream()
                .map(this::settlementRow)
                .toList();
    }

    private Map<String, Object> settlementRow(ProviderSettlement s) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", s.getId());
        row.put("periodStart", s.getPeriodStart());
        row.put("periodEnd", s.getPeriodEnd());
        row.put("bookingCount", s.getBookingCount());
        row.put("grossAmount", s.getGrossAmount());
        row.put("platformFeeAmount", s.getPlatformFeeAmount());
        row.put("refundDeductionAmount", s.getRefundDeductionAmount());
        row.put("payoutAmount", s.getPayoutAmount());
        row.put("status", s.getStatus());
        row.put("transferReference", s.getTransferReference());
        row.put("transferEvidenceUrl", s.getTransferEvidenceUrl());
        row.put("note", s.getNote());
        row.put("approvedAt", s.getApprovedAt());
        row.put("paidAt", s.getPaidAt());
        row.put("createdAt", s.getCreatedAt());
        return row;
    }

    private Map<String, Object> calculateEarnings(Partner partner, LocalDate fromDate, LocalDate toDate) {
        if ((fromDate == null) != (toDate == null)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Phải chọn cả ngày bắt đầu và ngày kết thúc."
            );
        }

        if (fromDate == null) {
            toDate = LocalDate.now();
            fromDate = toDate.minusDays(29);
        }

        if (fromDate.isAfter(toDate)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Ngày bắt đầu không được sau ngày kết thúc."
            );
        }

        LocalDateTime start = fromDate.atStartOfDay();
        LocalDateTime endExclusive = toDate.plusDays(1).atStartOfDay();

        List<Booking> completedBookings = bookingRepository.findCompletedBookingsByPartnerAndCompletedDateRange(
                partner.getId(), start, endExclusive
        );

        BigDecimal completedOrderValue = bookingRepository.sumCompletedOrderValueByPartnerAndCompletedDateRange(
                partner.getId(), start, endExclusive
        );
        if (completedOrderValue == null) {
            completedOrderValue = BigDecimal.ZERO;
        }

        int onlineOrders = 0;
        int cashOrders = 0;
        BigDecimal onlineGrossSubtotal = BigDecimal.ZERO;
        BigDecimal onlineSettledSubtotal = BigDecimal.ZERO;
        BigDecimal onlineCompletedValue = BigDecimal.ZERO;
        BigDecimal cashConfirmedValue = BigDecimal.ZERO;
        BigDecimal cashPendingValue = BigDecimal.ZERO;

        for (Booking booking : completedBookings) {
            List<Payment> payments = paymentRepository.findByBooking_Id(booking.getId());
            boolean isCash = payments.stream()
                    .anyMatch(p -> "CASH".equalsIgnoreCase(p.getPaymentProvider())
                            || "CASH".equalsIgnoreCase(p.getPaymentMethod())
                            || "CASH_ON_SERVICE".equalsIgnoreCase(p.getPaymentMethod()));
            boolean isPaid = payments.stream()
                    .anyMatch(p -> {
                        String st = p.getStatus() == null ? "" : p.getStatus().trim().toUpperCase(Locale.ROOT);
                        return "SUCCESS".equals(st) || "PAID".equals(st);
                    });

            BigDecimal subtotal = booking.getSubtotal() != null ? booking.getSubtotal() : BigDecimal.ZERO;
            BigDecimal total = booking.getTotalAmount() != null ? booking.getTotalAmount() : BigDecimal.ZERO;

            if (isCash) {
                cashOrders++;
                if (isPaid) {
                    cashConfirmedValue = cashConfirmedValue.add(total);
                } else {
                    cashPendingValue = cashPendingValue.add(total);
                }
            } else if (isPaid) {
                onlineOrders++;
                onlineGrossSubtotal = onlineGrossSubtotal.add(subtotal);
                onlineCompletedValue = onlineCompletedValue.add(total);
                if (settlementItemRepository.existsByBooking_Id(booking.getId())) {
                    onlineSettledSubtotal = onlineSettledSubtotal.add(subtotal);
                }
            }
        }

        Set<Long> completedBookingIds = completedBookings.stream()
                .map(Booking::getId)
                .collect(Collectors.toSet());

        BigDecimal approvedRefundAmount = BigDecimal.ZERO;
        if (!completedBookingIds.isEmpty()) {
            approvedRefundAmount = refundRepository.sumApprovedRefundAmountByBookingIds(completedBookingIds);
            if (approvedRefundAmount == null) {
                approvedRefundAmount = BigDecimal.ZERO;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fromDate", fromDate);
        result.put("toDate", toDate);
        result.put("completedOrders", completedBookings.size());
        result.put("completedOrderValue", completedOrderValue);
        result.put("approvedRefundAmount", approvedRefundAmount);
        result.put(
                "valueAfterApprovedRefunds",
                completedOrderValue.subtract(approvedRefundAmount)
        );
        result.put("onlineCompletedOrders", onlineOrders);
        result.put("onlineGrossSubtotal", onlineGrossSubtotal);
        result.put("onlineSettledSubtotal", onlineSettledSubtotal);
        result.put("onlinePendingSettlementSubtotal", onlineGrossSubtotal.subtract(onlineSettledSubtotal).max(BigDecimal.ZERO));
        result.put("onlineCompletedValue", onlineCompletedValue);
        result.put("cashCompletedOrders", cashOrders);
        result.put("cashConfirmedValue", cashConfirmedValue);
        result.put("cashPendingValue", cashPendingValue);
        result.put(
                "note",
                "Đơn VNPay được đối soát qua CleanMate theo giá trị dịch vụ gốc (subtotal). Đơn tiền mặt do đối tác trực tiếp thu sau khi hoàn thành."
        );

        return result;
    }
}
