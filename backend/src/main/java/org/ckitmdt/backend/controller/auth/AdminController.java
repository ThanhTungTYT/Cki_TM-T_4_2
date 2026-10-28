
package org.ckitmdt.backend.controller.auth;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.repository.BookingRepository;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final BookingRepository bookingRepository;

    @GetMapping("/test")
    public ResponseEntity<String> testAdmin() {
        return ResponseEntity.ok("Bạn đang truy cập với quyền ADMIN");
    }

    @GetMapping("/statistics")
    public ResponseEntity<Map<String, Object>> statistics(
            @RequestParam(defaultValue = "7") String period,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fromDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate toDate) {

        LocalDate today = LocalDate.now();
        LocalDate startDate;
        LocalDate endDate;

        if (fromDate != null || toDate != null) {
            if (fromDate == null || toDate == null
                    || fromDate.isAfter(toDate)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Vui lòng chọn khoảng ngày hợp lệ."
                );
            }

            startDate = fromDate;
            endDate = toDate;
            period = "custom";
        } else {
            int days;

            switch (period) {
                case "7":
                    days = 7;
                    break;
                case "14":
                    days = 14;
                    break;
                case "30":
                    days = 30;
                    break;
                case "365":
                    days = 365;
                    break;
                default:
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Chu kỳ không hợp lệ. Chỉ chấp nhận 7, 14, 30 hoặc 365 ngày."
                    );
            }

            startDate = today.minusDays(days - 1L);
            endDate = today;
        }

        long daysBetween =
                ChronoUnit.DAYS.between(startDate, endDate) + 1;

        if (daysBetween > 366) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Khoảng ngày không được vượt quá 366 ngày."
            );
        }

        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime endExclusive = endDate.plusDays(1).atStartOfDay();

        List<Booking> bookings =
                bookingRepository
                        .findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                                start,
                                endExclusive
                        );

        List<Booking> completedRevenueBookings =
                bookingRepository
                        .findByStatusAndCompletedAtGreaterThanEqualAndCompletedAtLessThan(
                                "COMPLETED",
                                start,
                                endExclusive
                        );
        List<Booking> allBookings = bookingRepository.findAll();

        BigDecimal allTimeServiceValue = BigDecimal.ZERO;

        for (Booking booking : allBookings) {
            if ("COMPLETED".equalsIgnoreCase(booking.getStatus())
                    && booking.getCompletedAt() != null
                    && booking.getTotalAmount() != null) {
                allTimeServiceValue =
                        allTimeServiceValue.add(booking.getTotalAmount());
            }
        }

        long allTimeOrders = allBookings.size();

        BigDecimal totalRevenue = BigDecimal.ZERO;

        for (Booking booking : completedRevenueBookings) {
            if (booking.getTotalAmount() != null) {
                totalRevenue = totalRevenue.add(
                        booking.getTotalAmount()
                );
            }
        }

        boolean monthly = "365".equals(period)
                || ("custom".equals(period) && daysBetween > 60);

        boolean weekly = "30".equals(period)
                || ("custom".equals(period)
                && daysBetween > 14 && daysBetween <= 60);

        Map<String, BigDecimal> chartRevenue = new LinkedHashMap<>();
        Map<String, Long> chartOrderCounts = new LinkedHashMap<>();

        for (LocalDate date = startDate;
             !date.isAfter(endDate);
             date = date.plusDays(1)) {

            String key = bucketKey(date, monthly, weekly);

            chartRevenue.putIfAbsent(key, BigDecimal.ZERO);
            chartOrderCounts.putIfAbsent(key, 0L);
        }

        for (Booking booking : bookings) {
            if (booking.getCreatedAt() == null) {
                continue;
            }

            LocalDate createdDate =
                    booking.getCreatedAt().toLocalDate();

            String key = bucketKey(createdDate, monthly, weekly);

            if (chartOrderCounts.containsKey(key)) {
                chartOrderCounts.put(
                        key,
                        chartOrderCounts.get(key) + 1
                );
            }
        }

        for (Booking booking : completedRevenueBookings) {
            if (booking.getCompletedAt() == null
                    || booking.getTotalAmount() == null) {
                continue;
            }

            LocalDate completedDate =
                    booking.getCompletedAt().toLocalDate();

            String key = bucketKey(
                    completedDate,
                    monthly,
                    weekly
            );

            if (chartRevenue.containsKey(key)) {
                chartRevenue.put(
                        key,
                        chartRevenue.get(key).add(
                                booking.getTotalAmount()
                        )
                );
            }
        }

        List<Map<String, Object>> chartData = new ArrayList<>();

        for (String key : chartRevenue.keySet()) {
            Map<String, Object> item = new LinkedHashMap<>();

            item.put(
                    "label",
                    bucketLabel(key, period, monthly, weekly)
            );
            item.put("value", chartRevenue.get(key));
            item.put("revenue", chartRevenue.get(key));
            item.put(
                    "orderCount",
                    chartOrderCounts.getOrDefault(key, 0L)
            );

            chartData.add(item);
        }

        Map<String, Long> statusCounts = new LinkedHashMap<>();
        statusCounts.put("COMPLETED", 0L);
        statusCounts.put("PROCESSING", 0L);
        statusCounts.put("PENDING", 0L);
        statusCounts.put("CANCELLED", 0L);

        for (Booking booking : bookings) {
            if (booking.getStatus() == null) {
                continue;
            }

            String status = booking.getStatus()
                    .trim()
                    .toUpperCase(Locale.ROOT);

            if ("COMPLETED".equals(status)) {
                statusCounts.put(
                        "COMPLETED",
                        statusCounts.get("COMPLETED") + 1
                );
            } else if (
                    "PENDING_PAYMENT".equals(status)
                            || "PENDING_PROVIDER".equals(status)
                            || "PENDING".equals(status)
                            || "WAITING_CONFIRMATION".equals(status)
                            || "PENDING_CONFIRMATION".equals(status)
            ) {
                statusCounts.put(
                        "PENDING",
                        statusCounts.get("PENDING") + 1
                );
            } else if (
                    "CANCELLED".equals(status)
                            || "CANCELED".equals(status)
                            || "EXPIRED".equals(status)
                            || "REJECTED".equals(status)
            ) {
                statusCounts.put(
                        "CANCELLED",
                        statusCounts.get("CANCELLED") + 1
                );
            } else {
                statusCounts.put(
                        "PROCESSING",
                        statusCounts.get("PROCESSING") + 1
                );
            }
        }

        long statusTotal = statusCounts.values()
                .stream()
                .mapToLong(Long::longValue)
                .sum();

        long completedOrders = statusCounts.get("COMPLETED");

        List<Map<String, Object>> orderStats = new ArrayList<>();

        String[] statusKeys = {
                "COMPLETED",
                "PROCESSING",
                "PENDING",
                "CANCELLED"
        };

        String[] statusLabels = {
                "Hoàn thành",
                "Đang xử lý",
                "Chờ xác nhận",
                "Đã hủy"
        };

        String[] statusColors = {
                "#16a34a",
                "#3b82f6",
                "#f59e0b",
                "#ef4444"
        };

        for (int i = 0; i < statusKeys.length; i++) {
            long count = statusCounts.get(statusKeys[i]);

            double percentage = statusTotal == 0
                    ? 0
                    : Math.round(count * 10000.0 / statusTotal) / 100.0;

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("label", statusLabels[i]);
            item.put("status", statusKeys[i]);
            item.put("count", count);
            item.put("value", percentage);
            item.put("color", statusColors[i]);

            orderStats.add(item);
        }

        Map<String, Object> result = new LinkedHashMap<>();

        result.put("period", period);
        result.put("fromDate", startDate);
        result.put("toDate", endDate);
        result.put("totalRevenue", totalRevenue);
        result.put("totalServiceValue", totalRevenue);
        result.put("totalOrders", bookings.size());

        result.put("allTimeServiceValue", allTimeServiceValue);
        result.put("allTimeOrders", allTimeOrders);

        result.put("completedOrders", completedOrders);
        result.put("orderStats", orderStats);
        result.put("chartData", chartData);
        return ResponseEntity.ok(result);
    }

    private String bucketKey(
            LocalDate date,
            boolean monthly,
            boolean weekly) {

        if (monthly) {
            return YearMonth.from(date).toString();
        }

        if (weekly) {
            LocalDate monday = date.with(DayOfWeek.MONDAY);
            return monday.toString();
        }

        return date.toString();
    }

    private String bucketLabel(
            String key,
            String period,
            boolean monthly,
            boolean weekly) {

        if (monthly) {
            YearMonth month = YearMonth.parse(key);

            return "T" + month.getMonthValue()
                    + "/" + month.getYear();
        }

        if (weekly) {
            LocalDate monday = LocalDate.parse(key);

            return monday.format(
                    DateTimeFormatter.ofPattern("dd/MM")
            );
        }

        LocalDate date = LocalDate.parse(key);

        if ("7".equals(period)) {
            String[] weekdays = {
                    "T2", "T3", "T4", "T5",
                    "T6", "T7", "CN"
            };

            return weekdays[date.getDayOfWeek().getValue() - 1];
        }

        return date.format(
                DateTimeFormatter.ofPattern("dd/MM")
        );
    }
}
