package org.ckitmdt.backend.controller.provider;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.booking.BookingActionRequest;
import org.ckitmdt.backend.dto.booking.BookingStatusEnum;
import org.ckitmdt.backend.entity.*;
import org.ckitmdt.backend.repository.*;
import org.ckitmdt.backend.service.CustomerNotificationService;
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
    private final CleanerWorkLogRepository cleanerWorkLogRepository;
    private final CleanerOvertimeRequestRepository overtimeRequestRepository;
    private final CustomerNotificationService customerNotificationService;

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
                .filter(e -> e.getUser() != null && "ACTIVE".equalsIgnoreCase(e.getUser().getStatus()))
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
        Booking booking = bookingRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng."));

        if (booking.getPartner() == null || !booking.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền xử lý đơn này.");
        }

        LocalDateTime now = LocalDateTime.now();
        String status = normalize(booking.getStatus());

        if ("PENDING_PROVIDER".equals(status)) {
            LocalDateTime deadline = booking.getProviderDeadlineAt();
            if ((deadline != null && !now.isBefore(deadline))
                    || (booking.getScheduledStart() != null && !now.isBefore(booking.getScheduledStart()))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Đơn hàng đã quá thời hạn tiếp nhận hoặc đã qua giờ hẹn nên không thể phân công.");
            }
        }

        int requiredEmployees = computeRequiredEmployees(id);
        List<BookingAssignment> existingAssignments = assignmentRepository.findByBooking_IdOrderByIdAsc(id);
        long activeHealthyCount = existingAssignments.stream()
                .filter(a -> !"CANCELLED".equalsIgnoreCase(a.getStatus())
                        && !"DECLINED".equalsIgnoreCase(a.getStatus())
                        && !isReportedUnable(a))
                .count();

        boolean allowedNormal = Set.of("PENDING_PROVIDER", "CONFIRMED", "ASSIGNED").contains(status);
        boolean allowedReplacement = Set.of("EN_ROUTE", "IN_PROGRESS").contains(status)
                && activeHealthyCount < requiredEmployees;
        if (!allowedNormal && !allowedReplacement) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Chỉ có thể phân công nhân viên khi đơn ở trạng thái PENDING_PROVIDER, CONFIRMED, ASSIGNED hoặc cần bổ sung nhân sự thay thế.");
        }

        if (activeHealthyCount >= requiredEmployees) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Đơn hàng đã đủ số nhân viên yêu cầu (" + requiredEmployees + " người). Vui lòng gỡ nhân viên cũ trước khi phân công thay thế.");
        }

        Long employeeId = requiredLong(body, "employeeId");
        Employee employee = helper.ownedEmployee(employeeId, partner);

        if (!"ACTIVE".equalsIgnoreCase(employee.getStatus())
                || employee.getUser() == null
                || !"ACTIVE".equalsIgnoreCase(employee.getUser().getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Nhân viên không ở trạng thái hoạt động hoặc tài khoản đang bị khóa.");
        }

        boolean alreadyAssigned = existingAssignments
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

        long activeCount = assignmentRepository.findByBooking_IdOrderByIdAsc(id).stream()
                .filter(a -> !"CANCELLED".equalsIgnoreCase(a.getStatus())
                        && !"DECLINED".equalsIgnoreCase(a.getStatus())
                        && !isReportedUnable(a))
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
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng."));

        if (booking.getPartner() == null || !booking.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền xử lý đơn này.");
        }

        BookingAssignment assignment = assignmentRepository.findByIdForUpdate(assignmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy phân công."));

        if (!assignment.getBooking().getId().equals(bookingId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phân công không thuộc đơn hàng này.");
        }

        String bookingStatus = normalize(booking.getStatus());
        String assignmentStatus = normalize(assignment.getStatus());
        boolean reportedUnable = isReportedUnable(assignment);

        if (Set.of("PENDING_COMPLETION", "COMPLETED", "CANCELLED", "REJECTED", "EXPIRED").contains(bookingStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Không thể gỡ phân công khi đơn hàng đã hoàn tất hoặc kết thúc.");
        }

        if ("IN_PROGRESS".equals(bookingStatus) && !reportedUnable && !"ASSIGNED".equals(assignmentStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Không thể gỡ phân công khi công việc đang thực hiện, trừ nhân viên đã báo không thể thực hiện hoặc chưa bắt đầu.");
        }

        if (Set.of("IN_PROGRESS", "WORK_SUBMITTED", "COMPLETED").contains(assignmentStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Không thể gỡ phân công của nhân viên đang hoặc đã thực hiện công việc.");
        }

        if ("CANCELLED".equals(assignmentStatus)) {
            return Map.of("message", "Phân công đã được hủy trước đó.", "assignmentId", assignmentId);
        }

        LocalDateTime now = LocalDateTime.now();
        String existingNote = assignment.getNote();
        String cancelNote = "Đối tác đã hủy phân công.";
        assignment.setStatus("CANCELLED");
        assignment.setNote(existingNote == null || existingNote.isBlank()
                ? cancelNote
                : existingNote + "\n" + cancelNote);
        assignmentRepository.save(assignment);

        if (assignment.getEmployee() != null && assignment.getEmployee().getUser() != null) {
            String bookingCode = booking.getBookingCode() != null
                    ? booking.getBookingCode()
                    : String.valueOf(booking.getId());
            notificationRepository.save(AdminNotification.builder()
                    .recipient(assignment.getEmployee().getUser())
                    .type("BOOKING_ASSIGNMENT_REMOVED")
                    .title("Phân công công việc đã được thay đổi")
                    .message("Đối tác đã gỡ phân công của bạn khỏi đơn hàng " + bookingCode + ".")
                    .referenceType("BOOKING_ASSIGNMENT")
                    .referenceId(assignment.getId())
                    .createdAt(now)
                    .build());
        }

        int requiredEmployees = computeRequiredEmployees(bookingId);

        long remainingActive = assignmentRepository.findByBooking_IdOrderByIdAsc(bookingId).stream()
                .filter(a -> !"CANCELLED".equalsIgnoreCase(a.getStatus())
                        && !"DECLINED".equalsIgnoreCase(a.getStatus())
                        && !isReportedUnable(a))
                .count();

        if (remainingActive < requiredEmployees && Set.of("ASSIGNED", "EN_ROUTE").contains(bookingStatus)) {
            bookingStateEngine.transitionBooking(
                    booking,
                    BookingStatusEnum.CONFIRMED,
                    partner.getUser(),
                    "Hủy phân công nhân viên, thiếu nhân sự (" + remainingActive + "/" + requiredEmployees + ") nên chuyển về CONFIRMED."
            );
        }

        return Map.of("message", "Đã hủy phân công thành công.", "assignmentId", assignmentId);
    }

    private boolean isReportedUnable(BookingAssignment assignment) {
        return assignment != null
                && assignment.getNote() != null
                && assignment.getNote().contains("BÁO KHÔNG THỂ THỰC HIỆN [");
    }

    private int computeRequiredEmployees(Long bookingId) {
        List<BookingItem> items = bookingItemRepository.findByBookingId(bookingId);
        int required = (items == null || items.isEmpty()) ? 1 :
                items.stream()
                        .mapToInt(it -> (it.getEmployeeCount() != null && it.getEmployeeCount() > 0 ? it.getEmployeeCount() : 1)
                                * (it.getQuantity() != null && it.getQuantity() > 0 ? it.getQuantity() : 1))
                        .sum();
        return Math.max(1, required);
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
                    String asgStatus = normalize(a.getStatus());
                    return !"CANCELLED".equals(asgStatus) && !"DECLINED".equals(asgStatus);
                })
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
        row.put("version", booking.getVersion());
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
        boolean isPaid = payments.stream().anyMatch(p ->
                "SUCCESS".equalsIgnoreCase(p.getStatus()) || "PAID".equalsIgnoreCase(p.getStatus()));
        row.put("paymentMethod", isCash ? "CASH" : "VNPAY");
        row.put("paymentStatus", isPaid ? "PAID" : "UNPAID");

        row.put("items", bookingItemRepository.findByBookingId(booking.getId())
                .stream()
                .map(item -> {
                    Map<String, Object> itemRow = new LinkedHashMap<>();
                    itemRow.put("serviceId", item.getService() != null ? item.getService().getId() : null);
                    itemRow.put("serviceName", item.getServiceName());
                    itemRow.put("packageName", item.getServicePackage() != null ? item.getServicePackage().getName() : null);
                    itemRow.put("quantity", item.getQuantity());
                    itemRow.put("employeeCount", item.getEmployeeCount());
                    itemRow.put("durationMinutes", item.getDurationMinutes());
                    itemRow.put("unitPrice", item.getUnitPrice());
                    itemRow.put("totalPrice", item.getTotalPrice());
                    return itemRow;
                })
                .toList());

        return row;
    }

    @GetMapping("/bookings/{id}/work-logs")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getBookingWorkLogs(
            @PathVariable Long id,
            Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng."));
        if (booking.getPartner() == null || !booking.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền xem nhật ký đơn hàng này.");
        }

        return cleanerWorkLogRepository.findByBooking_IdOrderByCreatedAtDesc(id)
                .stream()
                .map(this::workLogRow)
                .toList();
    }

    @PatchMapping("/bookings/{id}/work-logs/{logId}/incident-status")
    @Transactional
    public Map<String, Object> updateIncidentStatus(
            @PathVariable Long id,
            @PathVariable Long logId,
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng."));
        if (booking.getPartner() == null || !booking.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền xử lý sự cố của đơn hàng này.");
        }

        CleanerWorkLog workLog = cleanerWorkLogRepository.findById(logId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy nhật ký công việc."));
        if (workLog.getBooking() == null || !workLog.getBooking().getId().equals(id)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nhật ký không thuộc đơn hàng này.");
        }
        if (!"INCIDENT".equalsIgnoreCase(workLog.getLogType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chỉ áp dụng cập nhật trạng thái cho báo cáo sự cố (INCIDENT).");
        }

        String nextStatus = normalize(text(body == null ? null : body.get("incidentStatus")));
        if (!Set.of("IN_PROGRESS", "RESOLVED", "REJECTED").contains(nextStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái sự cố không hợp lệ (IN_PROGRESS, RESOLVED, REJECTED).");
        }
        String resolutionNote = text(body == null ? null : body.get("note"));

        workLog.setIncidentStatus(nextStatus);
        if (!resolutionNote.isBlank()) {
            workLog.setNote(workLog.getNote() + "\n[Phản hồi Đối tác]: " + resolutionNote);
        }
        CleanerWorkLog saved = cleanerWorkLogRepository.save(workLog);

        if (workLog.getCleaner() != null) {
            notificationRepository.save(AdminNotification.builder()
                    .recipient(workLog.getCleaner())
                    .type("INCIDENT_STATUS_UPDATED")
                    .title("Đối tác đã cập nhật xử lý sự cố")
                    .message("Sự cố trên đơn #" + booking.getBookingCode()
                            + " đã được cập nhật trạng thái: " + nextStatus
                            + (resolutionNote.isBlank() ? "." : " (" + resolutionNote + ")"))
                    .referenceType("BOOKING_ASSIGNMENT")
                    .referenceId(workLog.getAssignment() != null ? workLog.getAssignment().getId() : null)
                    .createdAt(LocalDateTime.now())
                    .build());
        }

        return workLogRow(saved);
    }

    @GetMapping("/bookings/{id}/overtime-requests")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getBookingOvertimeRequests(
            @PathVariable Long id,
            Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng."));
        if (booking.getPartner() == null || !booking.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền xem yêu cầu gia hạn của đơn hàng này.");
        }

        return overtimeRequestRepository.findByBooking_IdOrderByCreatedAtDesc(id)
                .stream()
                .map(this::overtimeRow)
                .toList();
    }

    @PostMapping("/overtime-requests/{requestId}/review")
    @Transactional
    public Map<String, Object> reviewOvertimeRequest(
            @PathVariable Long requestId,
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        User providerUser = helper.currentUser(auth);
        Partner partner = helper.currentPartner(auth);

        CleanerOvertimeRequest overtimeRequest = overtimeRequestRepository.findByIdForUpdate(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy yêu cầu gia hạn."));
        if (overtimeRequest.getPartner() == null
                || !overtimeRequest.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xử lý yêu cầu gia hạn này.");
        }
        if (!"PENDING".equalsIgnoreCase(overtimeRequest.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Yêu cầu gia hạn này đã được xử lý trước đó.");
        }

        String decision = normalize(text(body == null ? null : body.get("decision")));
        String providerNote = text(body == null ? null : body.get("providerNote"));
        if (!Set.of("APPROVE", "APPROVED", "REJECT", "REJECTED").contains(decision)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quyết định phải là APPROVE hoặc REJECT.");
        }
        boolean approve = decision.startsWith("APPROV");
        if (!approve && providerNote.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập lý do khi từ chối yêu cầu gia hạn.");
        }

        LocalDateTime now = LocalDateTime.now();
        Booking booking = bookingRepository.findByIdForUpdate(overtimeRequest.getBooking().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng."));

        if (approve) {
            if (!"IN_PROGRESS".equalsIgnoreCase(booking.getStatus())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Chỉ có thể duyệt gia hạn khi đơn hàng đang ở trạng thái IN_PROGRESS.");
            }
            int addMinutes = overtimeRequest.getRequestedAdditionalMinutes() != null
                    ? overtimeRequest.getRequestedAdditionalMinutes() : 0;
            LocalDateTime baseEnd = booking.getScheduledEnd() != null ? booking.getScheduledEnd() : now;
            LocalDateTime extendedEnd = baseEnd.plusMinutes(addMinutes);
            booking.setScheduledEnd(extendedEnd);
            booking.setUpdatedAt(now);
            bookingRepository.save(booking);

            bookingStatusHistoryRepository.save(BookingStatusHistory.builder()
                    .booking(booking)
                    .oldStatus(booking.getStatus())
                    .newStatus(booking.getStatus())
                    .changedBy(providerUser)
                    .note("Đối tác duyệt gia hạn thêm " + addMinutes + " phút cho nhân viên"
                            + (providerNote.isBlank() ? "." : ": " + providerNote))
                    .createdAt(now)
                    .build());

            overtimeRequest.setStatus("APPROVED");

            if (booking.getCustomer() != null) {
                customerNotificationService.notifyCustomer(
                        booking.getCustomer(),
                        "BOOKING_OVERTIME_APPROVED",
                        "Cập nhật thời gian hoàn thành đơn #" + booking.getBookingCode(),
                        "Đối tác " + partner.getBusinessName() + " đã duyệt gia hạn thêm " + addMinutes
                                + " phút thực hiện dịch vụ cho đơn #" + booking.getBookingCode() + ".",
                        "BOOKING",
                        booking.getId()
                );
            }
        } else {
            overtimeRequest.setStatus("REJECTED");
        }

        overtimeRequest.setProviderNote(providerNote.isBlank() ? null : providerNote);
        overtimeRequest.setReviewedBy(providerUser);
        overtimeRequest.setReviewedAt(now);
        CleanerOvertimeRequest saved = overtimeRequestRepository.save(overtimeRequest);

        if (overtimeRequest.getCleaner() != null) {
            notificationRepository.save(AdminNotification.builder()
                    .recipient(overtimeRequest.getCleaner())
                    .type(approve ? "OVERTIME_APPROVED" : "OVERTIME_REJECTED")
                    .title(approve ? "Yêu cầu gia hạn đã được duyệt" : "Yêu cầu gia hạn bị từ chối")
                    .message("Yêu cầu gia hạn " + overtimeRequest.getRequestedAdditionalMinutes()
                            + " phút cho đơn #" + booking.getBookingCode()
                            + (approve ? " đã được đối tác phê duyệt." : " đã bị từ chối. Lý do: " + providerNote))
                    .referenceType("BOOKING_ASSIGNMENT")
                    .referenceId(overtimeRequest.getAssignment() != null ? overtimeRequest.getAssignment().getId() : null)
                    .createdAt(now)
                    .build());
        }

        return overtimeRow(saved);
    }

    private Map<String, Object> workLogRow(CleanerWorkLog log) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", log.getId());
        map.put("assignmentId", log.getAssignment() != null ? log.getAssignment().getId() : null);
        map.put("bookingId", log.getBooking() != null ? log.getBooking().getId() : null);
        map.put("logType", log.getLogType());
        map.put("note", log.getNote());
        List<String> images = log.getImageUrls() == null || log.getImageUrls().isBlank()
                ? List.of()
                : Arrays.stream(log.getImageUrls().split("\\r?\\n"))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
        map.put("imageUrls", images);
        map.put("incidentSeverity", log.getIncidentSeverity());
        map.put("incidentCategory", log.getIncidentCategory());
        map.put("incidentStatus", log.getIncidentStatus());
        map.put("cleanerName", log.getCleaner() != null ? log.getCleaner().getFullName() : null);
        map.put("cleanerPhone", log.getCleaner() != null ? log.getCleaner().getPhone() : null);
        map.put("createdAt", log.getCreatedAt());
        return map;
    }

    private Map<String, Object> overtimeRow(CleanerOvertimeRequest req) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", req.getId());
        map.put("assignmentId", req.getAssignment() != null ? req.getAssignment().getId() : null);
        map.put("bookingId", req.getBooking() != null ? req.getBooking().getId() : null);
        map.put("cleanerName", req.getCleaner() != null ? req.getCleaner().getFullName() : null);
        map.put("cleanerPhone", req.getCleaner() != null ? req.getCleaner().getPhone() : null);
        map.put("reason", req.getReason());
        map.put("requestedAdditionalMinutes", req.getRequestedAdditionalMinutes());
        map.put("originalScheduledEnd", req.getOriginalScheduledEnd());
        map.put("status", req.getStatus());
        map.put("providerNote", req.getProviderNote());
        map.put("reviewedBy", req.getReviewedBy() != null ? req.getReviewedBy().getFullName() : null);
        map.put("createdAt", req.getCreatedAt());
        map.put("reviewedAt", req.getReviewedAt());
        return map;
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
