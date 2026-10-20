
package org.ckitmdt.backend.controller.auth;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.repository.BookingRepository;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final BookingRepository bookingRepository;

    @GetMapping("/test")
    public ResponseEntity<String> testAdmin() {
        return ResponseEntity.ok(
                "Bạn đang truy cập với quyền ADMIN"
        );
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

        // Nếu người dùng chọn khoảng ngày riêng
        if (fromDate != null || toDate != null) {
            if (fromDate == null || toDate == null
                    || fromDate.isAfter(toDate)) {
                throw new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.BAD_REQUEST,
                        "Vui lòng chọn khoảng ngày hợp lệ."
                );
            }

            startDate = fromDate;
            endDate = toDate;

            // Bao gồm toàn bộ ngày kết thúc
            period = "custom";
        } else {
            int days;

            switch (period) {
                case "30":
                    days = 30;
                    break;
                case "365":
                    days = 365;
                    break;
                default:
                    period = "7";
                    days = 7;
                    break;
            }

            startDate = today.minusDays(days - 1L);
            endDate = today;
        }

        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime endExclusive =
                endDate.plusDays(1).atStartOfDay();

        List<Booking> bookings =
                bookingRepository
                        .findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                                start,
                                endExclusive
                        );

        BigDecimal totalServiceValue = BigDecimal.ZERO;

        for (Booking booking : bookings) {
            if (booking.getTotalAmount() != null) {
                totalServiceValue = totalServiceValue.add(
                        booking.getTotalAmount()
                );
            }
        }

        long totalOrders = bookings.size();

        long daysBetween =
                ChronoUnit.DAYS.between(startDate, endDate) + 1;

        boolean monthly = "365".equals(period)
                || ("custom".equals(period) && daysBetween > 60);

        boolean weekly = "30".equals(period)
                || ("custom".equals(period)
                && daysBetween > 14 && daysBetween <= 60);

        Map<String, BigDecimal> chart = new LinkedHashMap<>();

        // Tạo sẵn các mốc thời gian, kể cả khi không có đơn hàng
        for (LocalDate date = startDate;
             !date.isAfter(endDate);
             date = date.plusDays(1)) {

            String key = bucketKey(date, monthly, weekly);
            chart.putIfAbsent(key, BigDecimal.ZERO);
        }

        // Cộng giá trị dịch vụ theo thời điểm tạo đơn
        for (Booking booking : bookings) {
            if (booking.getCreatedAt() == null) {
                continue;
            }

            LocalDate date = booking.getCreatedAt().toLocalDate();

            String key = bucketKey(date, monthly, weekly);

            if (chart.containsKey(key)
                    && booking.getTotalAmount() != null) {
                chart.put(
                        key,
                        chart.get(key).add(booking.getTotalAmount())
                );
            }
        }

        List<Map<String, Object>> chartData = new ArrayList<>();

        for (Map.Entry<String, BigDecimal> entry
                : chart.entrySet()) {

            Map<String, Object> item = new LinkedHashMap<>();
            item.put(
                    "label",
                    bucketLabel(
                            entry.getKey(),
                            period,
                            monthly,
                            weekly,
                            startDate
                    )
            );
            item.put("value", entry.getValue());
            chartData.add(item);
        }

        Map<String, Long> statusCounts = new LinkedHashMap<>();

        statusCounts.put("COMPLETED", 0L);
        statusCounts.put("PROCESSING", 0L);
        statusCounts.put("PENDING", 0L);
        statusCounts.put("CANCELLED", 0L);

        for (Booking booking : bookings) {
            String status = booking.getStatus();

            if (status == null) {
                continue;
            }

            status = status.trim().toUpperCase(Locale.ROOT);

            if ("COMPLETED".equals(status)) {
                statusCounts.put(
                        "COMPLETED",
                        statusCounts.get("COMPLETED") + 1
                );
            } else if (
                    "PENDING".equals(status)
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
        result.put("totalServiceValue", totalServiceValue);
        result.put("totalOrders", totalOrders);
        result.put("chartData", chartData);
        result.put("orderStats", orderStats);

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
            return String.valueOf(
                    ChronoUnit.DAYS.between(
                            LocalDate.of(1970, 1, 5),
                            date
                    ) / 7
            );
        }

        return date.toString();
    }

    private String bucketLabel(
            String key,
            String period,
            boolean monthly,
            boolean weekly,
            LocalDate startDate) {

        if (monthly) {
            YearMonth month = YearMonth.parse(key);
            return "T" + month.getMonthValue()
                    + "/" + month.getYear();
        }

        if (weekly) {
            long weekIndex = Long.parseLong(key);
            LocalDate monday = LocalDate.of(1970, 1, 5)
                    .plusWeeks(weekIndex);

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
