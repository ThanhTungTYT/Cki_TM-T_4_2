package org.ckitmdt.backend.controller.provider;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.booking.BookingActionRequest;
import org.ckitmdt.backend.dto.booking.BookingStatusEnum;
import org.ckitmdt.backend.entity.*;
import org.ckitmdt.backend.repository.*;
import org.ckitmdt.backend.service.booking.BookingStateEngine;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

import static org.ckitmdt.backend.controller.provider.ProviderSecurityHelper.*;

@RestController
@RequestMapping("/api/provider")
@RequiredArgsConstructor
public class ProviderBookingController {

    private final ProviderSecurityHelper helper;
    private final BookingRepository bookingRepository;
    private final BookingItemRepository bookingItemRepository;
    private final BookingAssignmentRepository assignmentRepository;
    private final EmployeeRepository employeeRepository;
    private final BookingStatusHistoryRepository bookingStatusHistoryRepository;
    private final PaymentRepository paymentRepository;
    private final AdminNotificationRepository notificationRepository;
    private final BookingStateEngine bookingStateEngine;

    @GetMapping("/bookings")
    @Transactional(readOnly = true)
    public Object getBookings(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Integer page,
            @RequestParam(defaultValue = "10") int size,
            Authentication auth) {
        Partner partner = helper.currentPartner(auth);

        if (page != null) {
            Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size));
            Page<Booking> bookingPage = bookingRepository.searchBookingsByPartner(
                    partner.getId(),
                    (status == null || status.isBlank()) ? null : status.trim(),
                    (search == null || search.isBlank()) ? null : search.trim(),
                    pageable
            );
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("content", bookingPage.getContent().stream().map(this::bookingRow).toList());
            res.put("totalElements", bookingPage.getTotalElements());
            res.put("totalPages", bookingPage.getTotalPages());
            res.put("currentPage", bookingPage.getNumber());
            res.put("pageSize", bookingPage.getSize());
            return res;
        }

        return bookingRepository
                .findByPartner_IdOrderByCreatedAtDesc(partner.getId())
                .stream()
                .map(this::bookingRow)
                .toList();
    }

    @PostMapping("/bookings/{id}/actions/{action}")
    @Transactional
    public Object bookingAction(
            @PathVariable Long id,
            @PathVariable String action,
            @RequestBody(required = false) BookingActionRequest request,
            Authentication auth) {

        Partner partner = helper.currentPartner(auth);

        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy đơn hàng."
                ));

        if (booking.getPartner() == null
                || !booking.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền xử lý đơn hàng của nhà cung cấp khác."
            );
        }

        if (request == null) {
            request = new BookingActionRequest();
        }

        request.setAction(action.replace("-", "_").toUpperCase(Locale.ROOT));

        return bookingStateEngine.executeAction(
                id,
                request,
                auth.getName()
        );
    }

    @GetMapping("/bookings/{id}")
    @Transactional(readOnly = true)
    public Map<String, Object> getBookingDetail(
            @PathVariable Long id,
            Authentication auth) {

        Partner partner = helper.currentPartner(auth);
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng."));

        if (booking.getPartner() == null || !booking.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền xem đơn này.");
        }

        Map<String, Object> row = bookingRow(booking);

        List<Map<String, Object>> assignments = assignmentRepository
                .findByBooking_IdOrderByIdAsc(booking.getId())
                .stream()
                .map(this::assignmentRow)
                .toList();
        row.put("assignments", assignments);

        return row;
    }

    @GetMapping("/bookings/{id}/assignments")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAssignments(
            @PathVariable Long id,
            Authentication auth) {

        Partner partner = helper.currentPartner(auth);
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng."));

        if (booking.getPartner() == null || !booking.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền xem đơn này.");
        }

        return assignmentRepository.findByBooking_IdOrderByIdAsc(id)
                .stream()
                .map(this::assignmentRow)
                .toList();
    }

    @GetMapping("/bookings/{id}/available-employees")
    @Transactional(readOnly = true)
    public Map<String, Object> getAvailableEmployees(
            @PathVariable Long id,
            Authentication auth) {

        Partner partner = helper.currentPartner(auth);
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng."));

        if (booking.getPartner() == null || !booking.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền xem đơn này.");
        }

        LocalDateTime scheduledStart = booking.getScheduledStart();
        if (scheduledStart == null) {
            scheduledStart = LocalDateTime.now();
        }
        LocalDate serviceDate = scheduledStart.toLocalDate();

        List<Employee> allEmployees = employeeRepository.findByPartner_IdOrderByIdAsc(partner.getId())
                .stream()
                .filter(e -> "ACTIVE".equalsIgnoreCase(e.getStatus()))
                .toList();

        Set<Long> alreadyAssignedEmpIds = assignmentRepository.findByBooking_IdOrderByIdAsc(id)
                .stream()
                .filter(a -> !"CANCELLED".equalsIgnoreCase(a.getStatus()) && !"DECLINED".equalsIgnoreCase(a.getStatus()))
                .filter(a -> a.getEmployee() != null)
                .map(a -> a.getEmployee().getId())
                .collect(Collectors.toSet());

        List<BookingAssignment> otherAssignmentsOnDate = assignmentRepository
                .findByPartner_IdOrderByAssignedAtDesc(partner.getId())
                .stream()
                .filter(a -> a.getBooking() != null && !a.getBooking().getId().equals(id))
                .filter(a -> !"CANCELLED".equalsIgnoreCase(a.getStatus()) && !"DECLINED".equalsIgnoreCase(a.getStatus()))
                .filter(a -> {
                    Booking b = a.getBooking();
                    String bStatus = normalize(b.getStatus());
                    if (Set.of("CANCELLED", "REJECTED", "EXPIRED", "COMPLETED").contains(bStatus)) {
                        return false;
                    }
                    if (b.getScheduledStart() == null) return false;
                    return b.getScheduledStart().toLocalDate().equals(serviceDate);
                })
                .toList();

        Map<Long, BookingAssignment> busyMap = new HashMap<>();
        for (BookingAssignment a : otherAssignmentsOnDate) {
            if (a.getEmployee() != null && !busyMap.containsKey(a.getEmployee().getId())) {
                busyMap.put(a.getEmployee().getId(), a);
            }
        }

        DateTimeFormatter timeFmt = DateTimeFormatter.ofPattern("HH:mm");
        List<Map<String, Object>> employeeList = new ArrayList<>();

        for (Employee emp : allEmployees) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", emp.getId());
            map.put("employeeCode", emp.getEmployeeCode());
            map.put("status", emp.getStatus());
            map.put("ratingAverage", emp.getRatingAverage());
            map.put("totalCompletedJobs", emp.getTotalCompletedJobs());
            if (emp.getUser() != null) {
                map.put("fullName", emp.getUser().getFullName());
                map.put("email", emp.getUser().getEmail());
                map.put("phone", emp.getUser().getPhone());
                map.put("avatarUrl", emp.getUser().getAvatarUrl());
            }

            boolean isAlreadyAssigned = alreadyAssignedEmpIds.contains(emp.getId());
            BookingAssignment busyAsg = busyMap.get(emp.getId());
            boolean isBusy = busyAsg != null;

            map.put("alreadyAssigned", isAlreadyAssigned);

            if (isAlreadyAssigned) {
                map.put("isAvailable", false);
                map.put("availabilityStatus", "ALREADY_ASSIGNED");
                map.put("busyReason", "Đã phân công cho đơn này");
            } else if (isBusy) {
                map.put("isAvailable", false);
                map.put("availabilityStatus", "BUSY");
                Booking otherBooking = busyAsg.getBooking();
                String timeStr = "";
                if (otherBooking.getScheduledStart() != null) {
                    timeStr = otherBooking.getScheduledStart().format(timeFmt);
                    if (otherBooking.getScheduledEnd() != null) {
                        timeStr += " - " + otherBooking.getScheduledEnd().format(timeFmt);
                    }
                }
                map.put("busyReason", "Đã có đơn #" + otherBooking.getBookingCode() + (timeStr.isEmpty() ? "" : " (" + timeStr + ")"));
                map.put("busyBookingId", otherBooking.getId());
                map.put("busyBookingCode", otherBooking.getBookingCode());
            } else {
                map.put("isAvailable", true);
                map.put("availabilityStatus", "AVAILABLE");
                map.put("busyReason", null);
            }

            employeeList.add(map);
        }

        employeeList.sort((a, b) -> {
            boolean aAvail = Boolean.TRUE.equals(a.get("isAvailable"));
            boolean bAvail = Boolean.TRUE.equals(b.get("isAvailable"));
            if (aAvail != bAvail) return aAvail ? -1 : 1;
            boolean aAlready = Boolean.TRUE.equals(a.get("alreadyAssigned"));
            boolean bAlready = Boolean.TRUE.equals(b.get("alreadyAssigned"));
            if (aAlready != bAlready) return aAlready ? 1 : -1;
            return 0;
        });

        long availableCount = employeeList.stream().filter(m -> Boolean.TRUE.equals(m.get("isAvailable"))).count();
        long busyCount = employeeList.stream().filter(m -> "BUSY".equals(m.get("availabilityStatus"))).count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("serviceDate", serviceDate.toString());
        result.put("totalEmployees", allEmployees.size());
        result.put("availableCount", availableCount);
        result.put("busyCount", busyCount);
        result.put("employees", employeeList);

        return result;
    }

    @PostMapping("/bookings/{id}/assignments")
    @Transactional
    public Map<String, Object> assignEmployee(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        Partner partner = helper.currentPartner(auth);
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng."));

        if (booking.getPartner() == null || !booking.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền xử lý đơn này.");
        }

        String status = booking.getStatus();
        if (!Set.of("PENDING_PROVIDER", "CONFIRMED", "ASSIGNED").contains(normalize(status))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Chỉ có thể phân công nhân viên khi đơn ở trạng thái PENDING_PROVIDER, CONFIRMED hoặc ASSIGNED.");
        }

        Long employeeId = requiredLong(body, "employeeId");
        Employee employee = helper.ownedEmployee(employeeId, partner);

        if (!"ACTIVE".equalsIgnoreCase(employee.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Nhân viên không ở trạng thái hoạt động.");
        }

        boolean alreadyAssigned = assignmentRepository.findByBooking_IdOrderByIdAsc(id)
                .stream()
                .anyMatch(a -> a.getEmployee() != null
                        && a.getEmployee().getId().equals(employeeId)
                        && !"CANCELLED".equalsIgnoreCase(a.getStatus())
                        && !"DECLINED".equalsIgnoreCase(a.getStatus()));
        if (alreadyAssigned) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Nhân viên này đã được phân công cho đơn hàng.");
        }

        if (booking.getScheduledStart() != null) {
            LocalDate serviceDate = booking.getScheduledStart().toLocalDate();
            boolean busyOnDate = assignmentRepository.findByPartner_IdOrderByAssignedAtDesc(partner.getId())
                    .stream()
                    .filter(a -> a.getEmployee() != null && a.getEmployee().getId().equals(employeeId))
                    .filter(a -> a.getBooking() != null && !a.getBooking().getId().equals(id))
                    .filter(a -> !"CANCELLED".equalsIgnoreCase(a.getStatus()) && !"DECLINED".equalsIgnoreCase(a.getStatus()))
                    .anyMatch(a -> {
                        Booking b = a.getBooking();
                        String bStatus = normalize(b.getStatus());
                        if (Set.of("CANCELLED", "REJECTED", "EXPIRED", "COMPLETED").contains(bStatus)) {
                            return false;
                        }
                        if (b.getScheduledStart() == null) return false;
                        return b.getScheduledStart().toLocalDate().equals(serviceDate);
                    });
            if (busyOnDate) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Nhân viên này đã có lịch thực hiện đơn hàng khác trong ngày " + serviceDate + ".");
            }
        }

        LocalDateTime now = LocalDateTime.now();

        if ("PENDING_PROVIDER".equalsIgnoreCase(booking.getStatus())) {
            booking = bookingStateEngine.transitionBooking(
                    booking,
                    BookingStatusEnum.CONFIRMED,
                    partner.getUser(),
                    "Đối tác tiếp nhận đơn và phân công nhân viên."
            );
        }

        BookingAssignment assignment = BookingAssignment.builder()
                .booking(booking)
                .partner(partner)
                .employee(employee)
                .status("ASSIGNED")
                .assignedAt(now)
                .note(text(body.get("note")))
                .build();
        assignment = assignmentRepository.save(assignment);

        User cleanerUser = employee.getUser();
        if (cleanerUser != null) {
            String bookingCode = booking.getBookingCode() != null
                    ? booking.getBookingCode()
                    : String.valueOf(booking.getId());

            notificationRepository.save(AdminNotification.builder()
                    .recipient(cleanerUser)
                    .type("BOOKING_ASSIGNED")
                    .title("Bạn có công việc mới")
                    .message("Bạn vừa được phân công thực hiện đơn hàng " + bookingCode + ". Vui lòng kiểm tra danh sách công việc.")
                    .referenceType("BOOKING_ASSIGNMENT")
                    .referenceId(assignment.getId())
                    .createdAt(now)
                    .build());
        }

        List<BookingItem> items = bookingItemRepository.findByBookingId(id);
        int requiredEmployees = (items == null || items.isEmpty()) ? 1 :
                items.stream()
                        .mapToInt(it -> (it.getEmployeeCount() != null && it.getEmployeeCount() > 0 ? it.getEmployeeCount() : 1)
                                * (it.getQuantity() != null && it.getQuantity() > 0 ? it.getQuantity() : 1))
                        .sum();
        if (requiredEmployees <= 0) requiredEmployees = 1;

        long activeCount = assignmentRepository.findByBooking_IdOrderByIdAsc(id).stream()
                .filter(a -> !"CANCELLED".equalsIgnoreCase(a.getStatus()) && !"DECLINED".equalsIgnoreCase(a.getStatus()))
                .count();

        if (activeCount >= requiredEmployees && "CONFIRMED".equalsIgnoreCase(booking.getStatus())) {
            booking = bookingStateEngine.transitionBooking(
                    booking,
                    BookingStatusEnum.ASSIGNED,
                    partner.getUser(),
                    "Đã phân công đủ nhân viên cho đơn hàng (" + activeCount + "/" + requiredEmployees + ")."
            );
        }

        return assignmentRow(assignment);
    }

    @DeleteMapping("/bookings/{bookingId}/assignments/{assignmentId}")
    @Transactional
    public Map<String, Object> removeAssignment(
            @PathVariable Long bookingId,
            @PathVariable Long assignmentId,
            Authentication auth) {

        Partner partner = helper.currentPartner(auth);
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng."));

        if (booking.getPartner() == null || !booking.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền xử lý đơn này.");
        }

        String bookingStatus = normalize(booking.getStatus());
        if (Set.of("IN_PROGRESS", "PENDING_COMPLETION", "COMPLETED").contains(bookingStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Không thể xóa phân công khi công việc đang hoặc đã thực hiện.");
        }

        BookingAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy phân công."));

        if (!assignment.getBooking().getId().equals(bookingId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phân công không thuộc đơn hàng này.");
        }

        String assignmentStatus = normalize(assignment.getStatus());
        if (Set.of("IN_PROGRESS", "WORK_SUBMITTED", "COMPLETED").contains(assignmentStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Không thể xóa phân công của nhân viên đang hoặc đã thực hiện công việc.");
        }

        assignmentRepository.delete(assignment);

        List<BookingItem> items = bookingItemRepository.findByBookingId(bookingId);
        int requiredEmployees = (items == null || items.isEmpty()) ? 1 :
                items.stream()
                        .mapToInt(it -> (it.getEmployeeCount() != null && it.getEmployeeCount() > 0 ? it.getEmployeeCount() : 1)
                                * (it.getQuantity() != null && it.getQuantity() > 0 ? it.getQuantity() : 1))
                        .sum();
        if (requiredEmployees <= 0) requiredEmployees = 1;

        long remainingActive = assignmentRepository.findByBooking_IdOrderByIdAsc(bookingId).stream()
                .filter(a -> !"CANCELLED".equalsIgnoreCase(a.getStatus()) && !"DECLINED".equalsIgnoreCase(a.getStatus()))
                .count();

        if (remainingActive < requiredEmployees && Set.of("ASSIGNED", "EN_ROUTE").contains(bookingStatus)) {
            bookingStateEngine.transitionBooking(
                    booking,
                    BookingStatusEnum.CONFIRMED,
                    partner.getUser(),
                    "Hủy phân công nhân viên, thiếu nhân sự (" + remainingActive + "/" + requiredEmployees + ") nên chuyển về CONFIRMED."
            );
        }

        return Map.of("message", "Đã xóa phân công thành công.", "assignmentId", assignmentId);
    }

    @GetMapping("/schedule")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getSchedule(
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            Authentication auth) {

        Partner partner = helper.currentPartner(auth);

        if (fromDate == null) fromDate = LocalDate.now();
        if (toDate == null) toDate = fromDate.plusDays(6);

        LocalDateTime start = fromDate.atStartOfDay();
        LocalDateTime end   = toDate.plusDays(1).atStartOfDay();

        return assignmentRepository.findByPartner_IdOrderByAssignedAtDesc(partner.getId())
                .stream()
                .filter(a -> {
                    LocalDateTime scheduled = a.getBooking() != null
                            ? a.getBooking().getScheduledStart() : null;
                    return scheduled != null
                            && !scheduled.isBefore(start)
                            && scheduled.isBefore(end);
                })
                .map(a -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("assignmentId", a.getId());
                    row.put("bookingId", a.getBooking().getId());
                    row.put("bookingCode", a.getBooking().getBookingCode());
                    row.put("scheduledStart", a.getBooking().getScheduledStart());
                    row.put("scheduledEnd", a.getBooking().getScheduledEnd());
                    row.put("bookingStatus", a.getBooking().getStatus());
                    row.put("assignmentStatus", a.getStatus());
                    if (a.getEmployee() != null) {
                        row.put("employeeId",   a.getEmployee().getId());
                        row.put("employeeCode", a.getEmployee().getEmployeeCode());
                        row.put("employeeName", a.getEmployee().getUser() != null
                                ? a.getEmployee().getUser().getFullName() : "");
                    }
                    row.put("customerName", a.getBooking().getCustomer() != null
                            ? a.getBooking().getCustomer().getFullName() : "");
                    row.put("note", a.getNote());
                    return row;
                })
                .toList();
    }

    public Map<String, Object> bookingRow(Booking booking) {
        Map<String, Object> row = new LinkedHashMap<>();

        row.put("id", booking.getId());
        row.put("bookingCode", booking.getBookingCode());
        row.put("customerName", booking.getCustomer() == null
                ? "" : booking.getCustomer().getFullName());
        row.put("customerPhone", booking.getCustomer() == null
                ? "" : booking.getCustomer().getPhone());
        row.put("receiverName", booking.getReceiverNameSnapshot() != null
                ? booking.getReceiverNameSnapshot()
                : (booking.getAddress() != null ? booking.getAddress().getReceiverName() : ""));
        row.put("receiverPhone", booking.getReceiverPhoneSnapshot() != null
                ? booking.getReceiverPhoneSnapshot()
                : (booking.getAddress() != null ? booking.getAddress().getPhone() : ""));
        row.put("fullAddress", booking.getFullAddressSnapshot() != null
                ? booking.getFullAddressSnapshot()
                : (booking.getAddress() != null ? booking.getAddress().getStreetAddress() : ""));
        row.put("customerNote", booking.getCustomerNote());
        row.put("scheduledStart", booking.getScheduledStart());
        row.put("scheduledEnd", booking.getScheduledEnd());
        row.put("status", booking.getStatus());
        row.put("totalAmount", booking.getTotalAmount());
        row.put("providerDeadlineAt", booking.getProviderDeadlineAt());
        row.put("createdAt", booking.getCreatedAt());
        row.put("completedAt", booking.getCompletedAt());
        row.put("cancelReason", booking.getCancelReason());

        row.put("statusHistory", bookingStatusHistoryRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId())
                .stream()
                .map(h -> {
                    Map<String, Object> hm = new LinkedHashMap<>();
                    hm.put("id", h.getId());
                    hm.put("oldStatus", h.getOldStatus());
                    hm.put("newStatus", h.getNewStatus());
                    hm.put("changedByName", h.getChangedBy() != null ? h.getChangedBy().getFullName() : "Hệ thống");
                    hm.put("note", h.getNote());
                    hm.put("createdAt", h.getCreatedAt());
                    return hm;
                })
                .toList());

        List<Payment> payments = paymentRepository.findByBooking_Id(booking.getId());
        boolean isCash = payments.stream().anyMatch(p -> "CASH".equalsIgnoreCase(p.getPaymentProvider()));
        boolean isPaid = payments.stream().anyMatch(p -> "SUCCESS".equalsIgnoreCase(p.getStatus()));
        row.put("paymentMethod", isCash ? "CASH" : "VNPAY");
        row.put("paymentStatus", isPaid ? "PAID" : "UNPAID");

        row.put("items", bookingItemRepository.findByBookingId(booking.getId())
                .stream()
                .map(item -> {
                    Map<String, Object> itemRow = new LinkedHashMap<>();
                    itemRow.put("serviceName", item.getServiceName());
                    itemRow.put("quantity", item.getQuantity());
                    itemRow.put("unitPrice", item.getUnitPrice());
                    itemRow.put("totalPrice", item.getTotalPrice());
                    return itemRow;
                })
                .toList());

        return row;
    }

    public Map<String, Object> assignmentRow(BookingAssignment a) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", a.getId());
        map.put("bookingId", a.getBooking().getId());
        map.put("bookingCode", a.getBooking().getBookingCode());
        map.put("status", a.getStatus());
        map.put("assignedAt", a.getAssignedAt());
        map.put("acceptedAt", a.getAcceptedAt());
        map.put("startedAt", a.getStartedAt());
        map.put("completedAt", a.getCompletedAt());
        map.put("note", a.getNote());
        if (a.getEmployee() != null) {
            map.put("employeeId", a.getEmployee().getId());
            map.put("employeeCode", a.getEmployee().getEmployeeCode());
            map.put("employeeName", a.getEmployee().getUser() != null ? a.getEmployee().getUser().getFullName() : "");
            map.put("employeePhone", a.getEmployee().getUser() != null ? a.getEmployee().getUser().getPhone() : "");
        }
        return map;
    }
}
