
package org.ckitmdt.backend.controller.auth;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.CancellationRefund;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.entity.Payment;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.CancellationRefundRepository;
import org.ckitmdt.backend.repository.PaymentRepository;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/transactions")
@RequiredArgsConstructor
public class AdminTransactionController {

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final CancellationRefundRepository refundRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTransactions() {
        List<Payment> payments = paymentRepository.findAll(
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Map<Long, CancellationRefund> refundsByBooking = new HashMap<>();

        for (CancellationRefund refund : refundRepository.findAll()) {
            if (refund.getBooking() != null) {
                refundsByBooking.put(
                        refund.getBooking().getId(),
                        refund
                );
            }
        }

        List<Map<String, Object>> result = new ArrayList<>();

        for (Payment payment : payments) {
            Booking booking = payment.getBooking();
            User customer = booking == null
                    ? null
                    : booking.getCustomer();

            Map<String, Object> item = new LinkedHashMap<>();

            item.put("id", payment.getId());
            item.put("bookingId", booking == null ? null : booking.getId());
            item.put(
                    "bookingCode",
                    booking == null ? "" : booking.getBookingCode()
            );
            item.put(
                    "bookingStatus",
                    booking == null ? "" : booking.getStatus()
            );
            item.put(
                    "customerName",
                    customer == null ? "" : customer.getFullName()
            );
            item.put(
                    "email",
                    customer == null ? "" : customer.getEmail()
            );
            item.put(
                    "phone",
                    customer == null ? "" : customer.getPhone()
            );
            item.put(
                    "partnerName",
                    booking == null || booking.getPartner() == null
                            ? ""
                            : booking.getPartner().getBusinessName()
            );
            item.put("paymentMethod", payment.getPaymentMethod());
            item.put("paymentProvider", payment.getPaymentProvider());
            item.put("createdAt", payment.getCreatedAt());
            item.put("date", payment.getCreatedAt());
            item.put("paidAt", payment.getPaidAt());
            item.put("amount", payment.getAmount());
            item.put("status", payment.getStatus());
            item.put("reference", payment.getTransactionCode());
            item.put("txnRef", payment.getTxnRef());

            if (booking != null) {
                item.put("bookingSubtotal", booking.getSubtotal());
                item.put("discountAmount", booking.getDiscountAmount());
                item.put("pointsDiscount", booking.getPointsDiscount());
                item.put("bookingTotal", booking.getTotalAmount());
                item.put("completedAt", booking.getCompletedAt());
            }

            CancellationRefund refund = booking == null
                    ? null
                    : refundsByBooking.get(booking.getId());

            item.put(
                    "refundStatus",
                    refund == null ? null : refund.getStatus()
            );
            item.put(
                    "approvedRefundAmount",
                    refund == null ? null : refund.getApprovedAmount()
            );

            result.add(item);
        }

        return result;
    }

    @GetMapping("/finance-summary")
    @Transactional(readOnly = true)
    public Map<String, Object> getFinanceSummary(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fromDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate toDate) {

        validateDateRange(fromDate, toDate);

        LocalDateTime start = fromDate == null
                ? null
                : fromDate.atStartOfDay();

        LocalDateTime end = toDate == null
                ? null
                : toDate.plusDays(1).atStartOfDay();

        List<Payment> payments = paymentRepository.findAll();
        List<Booking> bookings = bookingRepository.findAll();
        List<CancellationRefund> refunds = refundRepository.findAll();

        BigDecimal customerCollected = BigDecimal.ZERO;
        BigDecimal pendingPaymentAmount = BigDecimal.ZERO;
        long successfulPaymentCount = 0;
        long pendingPaymentCount = 0;
        long failedPaymentCount = 0;

        for (Payment payment : payments) {
            String status = upper(payment.getStatus());

            LocalDateTime date = payment.getPaidAt() != null
                    ? payment.getPaidAt()
                    : payment.getCreatedAt();

            if (!inRange(date, start, end)) {
                continue;
            }

            BigDecimal amount = money(payment.getAmount());

            if (isSuccessful(status)) {
                successfulPaymentCount++;

                if (payment.getPaidAt() != null) {
                    customerCollected = customerCollected.add(amount);
                }
            } else if ("PENDING".equals(status)
                    || "PROCESSING".equals(status)) {
                pendingPaymentCount++;
                pendingPaymentAmount = pendingPaymentAmount.add(amount);
            } else if ("FAILED".equals(status)
                    || "ERROR".equals(status)
                    || "CANCELLED".equals(status)
                    || "EXPIRED".equals(status)) {
                failedPaymentCount++;
            }
        }

        BigDecimal completedBookingTotal = BigDecimal.ZERO;
        BigDecimal completedServiceSubtotal = BigDecimal.ZERO;
        BigDecimal completedDiscounts = BigDecimal.ZERO;
        BigDecimal derivedPlatformFee = BigDecimal.ZERO;
        long completedBookingCount = 0;

        for (Booking booking : bookings) {
            if (!"COMPLETED".equalsIgnoreCase(booking.getStatus())
                    || !inRange(booking.getCompletedAt(), start, end)) {
                continue;
            }

            BigDecimal subtotal = money(booking.getSubtotal());
            BigDecimal discount = money(booking.getDiscountAmount());
            BigDecimal pointsDiscount = money(booking.getPointsDiscount());
            BigDecimal total = money(booking.getTotalAmount());

            BigDecimal derivedFee = calculateDerivedPlatformFee(
                    subtotal,
                    discount,
                    pointsDiscount,
                    total
            );

            completedBookingCount++;
            completedBookingTotal = completedBookingTotal.add(total);
            completedServiceSubtotal = completedServiceSubtotal.add(subtotal);
            completedDiscounts = completedDiscounts
                    .add(discount)
                    .add(pointsDiscount);
            derivedPlatformFee = derivedPlatformFee.add(derivedFee);
        }

        BigDecimal pendingRefundAmount = BigDecimal.ZERO;
        BigDecimal approvedRefundAmount = BigDecimal.ZERO;
        long pendingRefundCount = 0;
        long approvedRefundCount = 0;
        long rejectedRefundCount = 0;

        for (CancellationRefund refund : refunds) {
            LocalDateTime date = refund.getReviewedAt() != null
                    ? refund.getReviewedAt()
                    : refund.getRequestedAt();

            if (!inRange(date, start, end)) {
                continue;
            }

            String status = upper(refund.getStatus());

            if ("PENDING_REVIEW".equals(status)) {
                pendingRefundCount++;
                pendingRefundAmount = pendingRefundAmount.add(
                        money(refund.getRequestedAmount())
                );
            } else if ("APPROVED".equals(status)) {
                approvedRefundCount++;
                approvedRefundAmount = approvedRefundAmount.add(
                        money(refund.getApprovedAmount())
                );
            } else if ("REJECTED".equals(status)) {
                rejectedRefundCount++;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();

        result.put("fromDate", fromDate);
        result.put("toDate", toDate);
        result.put("successfulPaymentCount", successfulPaymentCount);
        result.put("customerCollected", customerCollected);
        result.put("pendingPaymentCount", pendingPaymentCount);
        result.put("pendingPaymentAmount", pendingPaymentAmount);
        result.put("failedPaymentCount", failedPaymentCount);
        result.put("completedBookingCount", completedBookingCount);
        result.put("completedBookingTotal", completedBookingTotal);
        result.put("completedServiceSubtotal", completedServiceSubtotal);
        result.put("completedDiscounts", completedDiscounts);
        result.put("derivedPlatformFee", derivedPlatformFee);
        result.put("pendingRefundCount", pendingRefundCount);
        result.put("pendingRefundAmount", pendingRefundAmount);
        result.put("approvedRefundCount", approvedRefundCount);
        result.put("approvedRefundAmount", approvedRefundAmount);
        result.put("rejectedRefundCount", rejectedRefundCount);
        result.put("providerPayoutTrackingAvailable", false);
        result.put(
                "financeNotice",
                "Hệ thống chưa có sổ chi trả Nhà cung cấp. Phí sàn là giá trị suy ra từ snapshot đơn, không phải bút toán kế toán độc lập. Hoàn tiền đã duyệt chưa đồng nghĩa đã chuyển tiền."
        );

        return result;
    }

    @GetMapping("/provider-reconciliation")
    @Transactional(readOnly = true)
    public Map<String, Object> getProviderReconciliation(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fromDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate toDate) {

        validateDateRange(fromDate, toDate);

        LocalDateTime start = fromDate == null
                ? null
                : fromDate.atStartOfDay();

        LocalDateTime end = toDate == null
                ? null
                : toDate.plusDays(1).atStartOfDay();

        List<Booking> bookings = bookingRepository.findAll(
                Sort.by(Sort.Direction.DESC, "completedAt")
        );

        Map<Long, CancellationRefund> refundsByBooking = new HashMap<>();

        for (CancellationRefund refund : refundRepository.findAll()) {
            if (refund.getBooking() != null) {
                refundsByBooking.put(
                        refund.getBooking().getId(),
                        refund
                );
            }
        }

        Map<Long, Map<String, Object>> providersById =
                new LinkedHashMap<>();

        long completedBookingCount = 0;
        BigDecimal totalServiceValue = BigDecimal.ZERO;
        BigDecimal totalApprovedRefundAmount = BigDecimal.ZERO;
        BigDecimal totalTransferredRefundAmount = BigDecimal.ZERO;

        for (Booking booking : bookings) {
            if (!"COMPLETED".equalsIgnoreCase(booking.getStatus())) {
                continue;
            }

            if (!inRange(booking.getCompletedAt(), start, end)) {
                continue;
            }

            Partner partner = booking.getPartner();

            if (partner == null || partner.getId() == null) {
                continue;
            }

            BigDecimal subtotal = money(booking.getSubtotal());
            BigDecimal discount = money(booking.getDiscountAmount());
            BigDecimal pointsDiscount = money(booking.getPointsDiscount());
            BigDecimal total = money(booking.getTotalAmount());

            BigDecimal derivedFee = calculateDerivedPlatformFee(
                    subtotal,
                    discount,
                    pointsDiscount,
                    total
            );

            CancellationRefund refund = refundsByBooking.get(booking.getId());

            String refundStatus = refund == null
                    ? null
                    : refund.getStatus();

            BigDecimal approvedRefund = BigDecimal.ZERO;
            BigDecimal transferredRefund = BigDecimal.ZERO;

            if (refund != null && "APPROVED".equalsIgnoreCase(refundStatus)) {
                approvedRefund = money(refund.getApprovedAmount());

                boolean hasTransferProof =
                        refund.getTransferredAt() != null
                                && refund.getTransferEvidenceUrl() != null
                                && !refund.getTransferEvidenceUrl().trim().isEmpty();

                if (hasTransferProof) {
                    transferredRefund = approvedRefund;
                }
            }

            Map<String, Object> provider = providersById.get(partner.getId());

            if (provider == null) {
                provider = new LinkedHashMap<>();
                provider.put("partnerId", partner.getId());
                provider.put("partnerName", partner.getBusinessName());
                provider.put("partnerStatus", partner.getStatus());
                provider.put("completedBookingCount", 0L);
                provider.put("serviceValue", BigDecimal.ZERO);
                provider.put("derivedPlatformFee", BigDecimal.ZERO);
                provider.put("approvedRefundAmount", BigDecimal.ZERO);
                provider.put("transferredRefundAmount", BigDecimal.ZERO);
                provider.put(
                        "provisionalValueAfterApprovedRefunds",
                        BigDecimal.ZERO
                );
                provider.put("bookings", new ArrayList<Map<String, Object>>());

                providersById.put(partner.getId(), provider);
            }

            long providerBookingCount =
                    ((Number) provider.get("completedBookingCount")).longValue();

            BigDecimal providerServiceValue =
                    money((BigDecimal) provider.get("serviceValue"));

            BigDecimal providerDerivedFee =
                    money((BigDecimal) provider.get("derivedPlatformFee"));

            BigDecimal providerApprovedRefund =
                    money((BigDecimal) provider.get("approvedRefundAmount"));

            BigDecimal providerTransferredRefund =
                    money((BigDecimal) provider.get("transferredRefundAmount"));

            providerBookingCount++;
            providerServiceValue = providerServiceValue.add(subtotal);
            providerDerivedFee = providerDerivedFee.add(derivedFee);
            providerApprovedRefund = providerApprovedRefund.add(approvedRefund);
            providerTransferredRefund =
                    providerTransferredRefund.add(transferredRefund);

            provider.put("completedBookingCount", providerBookingCount);
            provider.put("serviceValue", providerServiceValue);
            provider.put("derivedPlatformFee", providerDerivedFee);
            provider.put("approvedRefundAmount", providerApprovedRefund);
            provider.put("transferredRefundAmount", providerTransferredRefund);
            provider.put(
                    "provisionalValueAfterApprovedRefunds",
                    providerServiceValue.subtract(providerApprovedRefund)
            );

            Map<String, Object> bookingItem = new LinkedHashMap<>();

            bookingItem.put("bookingId", booking.getId());
            bookingItem.put("bookingCode", booking.getBookingCode());
            bookingItem.put("completedAt", booking.getCompletedAt());
            bookingItem.put("serviceValue", subtotal);
            bookingItem.put("bookingTotal", total);
            bookingItem.put("derivedPlatformFee", derivedFee);
            bookingItem.put("approvedRefundAmount", approvedRefund);
            bookingItem.put("transferredRefundAmount", transferredRefund);
            bookingItem.put("refundStatus", refundStatus);

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> providerBookings =
                    (List<Map<String, Object>>) provider.get("bookings");

            providerBookings.add(bookingItem);

            completedBookingCount++;
            totalServiceValue = totalServiceValue.add(subtotal);
            totalApprovedRefundAmount =
                    totalApprovedRefundAmount.add(approvedRefund);
            totalTransferredRefundAmount =
                    totalTransferredRefundAmount.add(transferredRefund);
        }

        List<Map<String, Object>> providerList =
                new ArrayList<>(providersById.values());

        Map<String, Object> result = new LinkedHashMap<>();

        result.put("fromDate", fromDate);
        result.put("toDate", toDate);
        result.put("providerCount", providerList.size());
        result.put("completedBookingCount", completedBookingCount);
        result.put("serviceValue", totalServiceValue);
        result.put("approvedRefundAmount", totalApprovedRefundAmount);
        result.put("transferredRefundAmount", totalTransferredRefundAmount);
        result.put("providers", providerList);
        result.put(
                "notice",
                "Dữ liệu được tổng hợp từ các đơn COMPLETED. Phí sàn là giá trị suy ra từ snapshot đơn, không phải bút toán kế toán độc lập. Hoàn tiền đã duyệt không đồng nghĩa đã chuyển tiền. Khoản hoàn chỉ được tính là đã chuyển khi có thời điểm chuyển và chứng từ chuyển tiền. Đây chưa phải sổ chi trả Provider."
        );

        return result;
    }

    private void validateDateRange(
            LocalDate fromDate,
            LocalDate toDate) {

        if ((fromDate == null) != (toDate == null)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc."
            );
        }

        if (fromDate != null && fromDate.isAfter(toDate)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Ngày bắt đầu không được sau ngày kết thúc."
            );
        }

        if (fromDate != null
                && ChronoUnit.DAYS.between(fromDate, toDate) > 365) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Khoảng thời gian không được vượt quá 366 ngày."
            );
        }
    }

    private BigDecimal calculateDerivedPlatformFee(
            BigDecimal subtotal,
            BigDecimal discount,
            BigDecimal pointsDiscount,
            BigDecimal total) {

        return total
                .subtract(subtotal)
                .add(discount)
                .add(pointsDiscount);
    }

    private boolean inRange(
            LocalDateTime value,
            LocalDateTime start,
            LocalDateTime end) {

        if (value == null) {
            return false;
        }

        return (start == null || !value.isBefore(start))
                && (end == null || value.isBefore(end));
    }

    private boolean isSuccessful(String status) {
        return "SUCCESS".equals(status)
                || "PAID".equals(status)
                || "SUCCESSFUL".equals(status)
                || "COMPLETED".equals(status)
                || "SUCCEEDED".equals(status);
    }

    private BigDecimal money(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String upper(String value) {
        return value == null
                ? ""
                : value.trim().toUpperCase(Locale.ROOT);
    }
}
