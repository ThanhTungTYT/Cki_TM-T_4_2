package org.ckitmdt.backend.controller.provider;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.*;
import org.ckitmdt.backend.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/provider")
@RequiredArgsConstructor
public class ProviderDashboardController {

    private final ProviderSecurityHelper helper;
    private final BookingRepository bookingRepository;
    private final EmployeeRepository employeeRepository;
    private final BusinessChangeRequestRepository changeRequestRepository;
    private final ReportTicketRepository reportTicketRepository;
    private final AdminNotificationRepository notificationRepository;
    private final CancellationRefundRepository refundRepository;
    private final ProviderBookingController bookingController;
    private final ProviderProfileController profileController;
    private final ProviderComplaintController complaintController;

    @GetMapping("/dashboard")
    @Transactional(readOnly = true)
    public Map<String, Object> getDashboard(
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        List<Booking> all = bookingRepository.findByPartner_IdOrderByCreatedAtDesc(partner.getId());

        long pending   = all.stream().filter(b -> "PENDING_PROVIDER".equalsIgnoreCase(b.getStatus())).count();
        long confirmed = all.stream().filter(b -> "CONFIRMED".equalsIgnoreCase(b.getStatus())).count();
        long assigned  = all.stream().filter(b -> "ASSIGNED".equalsIgnoreCase(b.getStatus())).count();
        long completed = all.stream().filter(b -> "COMPLETED".equalsIgnoreCase(b.getStatus())).count();
        long cancelled = all.stream().filter(b ->
                b.getStatus() != null && b.getStatus().toUpperCase().startsWith("CANCEL")).count();

        BigDecimal revenueMonth = all.stream()
                .filter(b -> "COMPLETED".equalsIgnoreCase(b.getStatus()))
                .filter(b -> b.getCompletedAt() != null)
                .filter(b -> b.getCompletedAt().getMonth() == LocalDateTime.now().getMonth()
                        && b.getCompletedAt().getYear()  == LocalDateTime.now().getYear())
                .map(Booking::getTotalAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long employeeCount = employeeRepository.findByPartner_IdOrderByIdAsc(partner.getId()).size();

        // 5 đơn mới nhất cần xử lý (PENDING_PROVIDER)
        List<Map<String, Object>> pendingList = all.stream()
                .filter(b -> "PENDING_PROVIDER".equalsIgnoreCase(b.getStatus()))
                .limit(5)
                .map(bookingController::bookingRow)
                .toList();

        // Approved Profile
        Map<String, Object> approvedProfile = new LinkedHashMap<>();
        approvedProfile.put("id", partner.getId());
        approvedProfile.put("businessName", partner.getBusinessName());
        approvedProfile.put("description", partner.getDescription());
        approvedProfile.put("taxCode", partner.getTaxCode());
        approvedProfile.put("address", partner.getAddress() != null ? partner.getAddress() : "Chưa có địa chỉ được xác nhận");
        approvedProfile.put("latitude", partner.getLatitude());
        approvedProfile.put("longitude", partner.getLongitude());
        approvedProfile.put("version", partner.getVersion() != null ? partner.getVersion() : 1);
        approvedProfile.put("status", partner.getStatus());
        approvedProfile.put("ratingAverage", partner.getRatingAverage());
        approvedProfile.put("totalCompletedJobs", partner.getTotalCompletedJobs());
        approvedProfile.put("phone", partner.getUser() != null ? partner.getUser().getPhone() : "");
        approvedProfile.put("email", partner.getUser() != null ? partner.getUser().getEmail() : "");

        // Pending change requests
        List<BusinessChangeRequest> partnerChangeRequests = changeRequestRepository.findByPartner_IdOrderByCreatedAtDesc(partner.getId());
        long pendingRequestsCount = partnerChangeRequests.stream()
                .filter(r -> "PENDING_REVIEW".equalsIgnoreCase(r.getStatus())).count();
        List<Map<String, Object>> recentRequests = partnerChangeRequests.stream()
                .limit(5)
                .map(profileController::changeRequestRow)
                .toList();

        // Complaints
        List<ReportTicket> partnerComplaints = reportTicketRepository.findByBooking_Partner_IdOrderByCreatedAtDesc(partner.getId());
        long pendingComplaintsCount = partnerComplaints.stream()
                .filter(c -> "OPEN".equalsIgnoreCase(c.getStatus()) || "WAITING_PROVIDER".equalsIgnoreCase(c.getStatus()) || "IN_PROGRESS".equalsIgnoreCase(c.getStatus()))
                .count();
        List<Map<String, Object>> recentComplaints = partnerComplaints.stream()
                .limit(5)
                .map(complaintController::complaintRow)
                .toList();

        // Financial metrics (integrated from earnings)
        Map<String, Object> financial = calculateEarnings(partner, fromDate, toDate);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("partnerId", partner.getId());
        result.put("businessName", partner.getBusinessName());
        result.put("approvedProfile", approvedProfile);
        result.put("stats", Map.of(
                "pendingBookings",   pending,
                "confirmedBookings", confirmed,
                "assignedBookings",  assigned,
                "completedBookings", completed,
                "cancelledBookings", cancelled,
                "totalEmployees",    employeeCount,
                "revenueThisMonth",  revenueMonth,
                "pendingChangeRequests", pendingRequestsCount,
                "pendingComplaints", pendingComplaintsCount
        ));
        result.put("financial", financial);
        result.put("pendingBookings", pendingList);
        result.put("recentChangeRequests", recentRequests);
        result.put("recentComplaints", recentComplaints);
        return result;
    }

    @GetMapping("/notifications")
    @Transactional(readOnly = true)
    public Map<String, Object> getNotifications(Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        User user = partner.getUser();

        List<AdminNotification> notifications = notificationRepository
                .findTop100ByRecipient_IdOrderByCreatedAtDesc(user.getId());

        long unreadCount = notificationRepository
                .countByRecipient_IdAndReadAtIsNull(user.getId());

        List<Map<String, Object>> items = notifications.stream()
                .map(this::notificationRow)
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("unreadCount", unreadCount);
        result.put("items", items);
        return result;
    }

    @PatchMapping("/notifications/{id}/read")
    @Transactional
    public Map<String, Object> markNotificationRead(
            @PathVariable Long id,
            Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        User user = partner.getUser();

        AdminNotification notification = notificationRepository
                .findByIdAndRecipient_Id(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy thông báo."
                ));

        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
            notificationRepository.save(notification);
        }

        return notificationRow(notification);
    }

    @PatchMapping("/notifications/read-all")
    @Transactional
    public Map<String, Object> markAllNotificationsRead(Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        User user = partner.getUser();

        List<AdminNotification> unread = notificationRepository
                .findByRecipient_IdAndReadAtIsNull(user.getId());

        LocalDateTime now = LocalDateTime.now();
        for (AdminNotification n : unread) {
            n.setReadAt(now);
            notificationRepository.save(n);
        }

        return Map.of("message", "Đã đánh dấu đọc tất cả thông báo.", "count", unread.size());
    }

    private Map<String, Object> notificationRow(AdminNotification n) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", n.getId());
        row.put("type", n.getType());
        row.put("title", n.getTitle());
        row.put("message", n.getMessage());
        row.put("referenceType", n.getReferenceType());
        row.put("referenceId", n.getReferenceId());
        row.put("read", n.getReadAt() != null);
        row.put("readAt", n.getReadAt());
        row.put("createdAt", n.getCreatedAt());
        return row;
    }

    private Map<String, Object> calculateEarnings(Partner partner, LocalDate fromDate, LocalDate toDate) {
        if ((fromDate == null) != (toDate == null)) {
            fromDate = null;
            toDate = null;
        }

        if (fromDate == null) {
            toDate = LocalDate.now();
            fromDate = toDate.minusDays(29);
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
