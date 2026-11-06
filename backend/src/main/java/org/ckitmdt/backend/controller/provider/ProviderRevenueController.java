package org.ckitmdt.backend.controller.provider;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.CancellationRefundRepository;
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
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/provider/earnings")
@RequiredArgsConstructor
public class ProviderRevenueController {

    private final ProviderSecurityHelper helper;
    private final BookingRepository bookingRepository;
    private final CancellationRefundRepository refundRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public Map<String, Object> getEarnings(
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            Authentication auth) {

        Partner partner = helper.currentPartner(auth);
        return calculateEarnings(partner, fromDate, toDate);
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

        Set<Long> completedBookingIds = completedBookings.stream()
                .map(Booking::getId)
                .collect(Collectors.toSet());

        BigDecimal approvedRefundAmount = BigDecimal.ZERO;
        if (!completedBookingIds.isEmpty()) {
            approvedRefundAmount = refundRepository.sumApprovedRefundAmountByBookingIds(completedBookingIds);
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
        result.put(
                "note",
                "Giá trị đơn hoàn thành sau khoản hoàn đã duyệt; chưa trừ hoa hồng hoặc đối soát."
        );

        return result;
    }
}
