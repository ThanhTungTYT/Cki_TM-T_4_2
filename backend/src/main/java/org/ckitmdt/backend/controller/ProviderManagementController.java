
package org.ckitmdt.backend.controller;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.booking.BookingActionRequest;
import org.ckitmdt.backend.entity.*;
import org.ckitmdt.backend.repository.*;
import org.ckitmdt.backend.service.booking.BookingStateEngine;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/provider")
@RequiredArgsConstructor
public class ProviderManagementController {

    private final UserRepository userRepository;
    private final PartnerRepository partnerRepository;
    private final PartnerServiceRepository partnerServiceRepository;
    private final ServiceRepository serviceRepository;
    private final ServiceCategoryRepository categoryRepository;
    private final BookingRepository bookingRepository;
    private final BookingItemRepository bookingItemRepository;
    private final CancellationRefundRepository refundRepository;
    private final BookingStateEngine bookingStateEngine;
    private final EmployeeRepository employeeRepository;
    private final BookingAssignmentRepository assignmentRepository;
    private final PasswordEncoder passwordEncoder;
    private final BusinessChangeRequestRepository changeRequestRepository;
    private final ReportTicketRepository reportTicketRepository;
    private final ComplaintResponseRepository complaintResponseRepository;

    private User currentUser(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Vui lòng đăng nhập."
            );
        }

        User user = userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Không tìm thấy tài khoản."
                ));

        String role = normalize(user.getRole());

        if (!Set.of("PROVIDER", "PARTNER").contains(role)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Chỉ nhà cung cấp mới được sử dụng chức năng này."
            );
        }

        return user;
    }

    private Partner currentPartner(Authentication auth) {
        User user = currentUser(auth);

        return partnerRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Tài khoản chưa có hồ sơ nhà cung cấp."
                ));
    }

    @GetMapping("/services")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getServices(Authentication auth) {
        Partner partner = currentPartner(auth);

        return partnerServiceRepository.findByPartner_Id(partner.getId())
                .stream()
                .map(this::serviceRow)
                .toList();
    }

    @PostMapping("/services")
    @Transactional
    public Map<String, Object> createService(
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        Partner partner = currentPartner(auth);

        String name = text(body.get("name"));
        if (name.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tên dịch vụ không được để trống."
            );
        }

        Long categoryId = requiredLong(body, "categoryId");
        BigDecimal price = requiredPrice(body, "price");
        Integer minutes = requiredPositiveInt(body, "estimatedMinutes");

        ServiceCategory category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy danh mục dịch vụ."
                ));

        LocalDateTime now = LocalDateTime.now();

        Service service = Service.builder()
                .category(category)
                .name(name)
                .description(text(body.get("description")))
                .thumbnailUrl(text(body.get("thumbnailUrl")))
                .pricingType("FIXED")
                .basePrice(price)
                .estimatedMinutes(minutes)
                .status("ACTIVE")
                .createdAt(now)
                .updatedAt(now)
                .build();

        service = serviceRepository.save(service);

        PartnerService partnerService = PartnerService.builder()
                .partner(partner)
                .service(service)
                .price(price)
                .status("PENDING")
                .createdAt(now)
                .updatedAt(now)
                .build();

        return serviceRow(partnerServiceRepository.save(partnerService));
    }

    @PutMapping("/services/{id}")
    @Transactional
    public Map<String, Object> updateService(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        Partner partner = currentPartner(auth);
        PartnerService partnerService = ownedService(id, partner);
        Service service = partnerService.getService();

        if (body.containsKey("name")) {
            String name = text(body.get("name"));
            if (name.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Tên dịch vụ không được để trống."
                );
            }
            service.setName(name);
        }

        if (body.containsKey("description")) {
            service.setDescription(text(body.get("description")));
        }

        if (body.containsKey("thumbnailUrl")) {
            service.setThumbnailUrl(text(body.get("thumbnailUrl")));
        }

        if (body.containsKey("categoryId")) {
            Long categoryId = requiredLong(body, "categoryId");
            ServiceCategory category = categoryRepository.findById(categoryId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Không tìm thấy danh mục dịch vụ."
                    ));
            service.setCategory(category);
        }

        if (body.containsKey("price")) {
            partnerService.setPrice(requiredPrice(body, "price"));
        }

        if (body.containsKey("estimatedMinutes")) {
            service.setEstimatedMinutes(
                    requiredPositiveInt(body, "estimatedMinutes")
            );
        }

        LocalDateTime now = LocalDateTime.now();
        service.setUpdatedAt(now);
        partnerService.setUpdatedAt(now);

        serviceRepository.save(service);

        return serviceRow(partnerServiceRepository.save(partnerService));
    }

    @PatchMapping("/services/{id}/status")
    @Transactional
    public Map<String, Object> changeServiceStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        Partner partner = currentPartner(auth);
        PartnerService partnerService = ownedService(id, partner);
        String status = normalize(text(body.get("status")));

        if (!Set.of("INACTIVE", "PENDING").contains(status)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Nhà cung cấp chỉ được tạm ngừng hoặc gửi lại dịch vụ chờ duyệt."
            );
        }

        partnerService.setStatus(status);
        partnerService.setUpdatedAt(LocalDateTime.now());

        return serviceRow(partnerServiceRepository.save(partnerService));
    }

    @GetMapping("/bookings")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getBookings(Authentication auth) {
        Partner partner = currentPartner(auth);

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

        Partner partner = currentPartner(auth);

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

    @GetMapping("/earnings")
    @Transactional(readOnly = true)
    public Map<String, Object> getEarnings(
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            Authentication auth) {

        Partner partner = currentPartner(auth);
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

        List<Booking> completedBookings =
                bookingRepository.findByPartner_IdOrderByCreatedAtDesc(
                                partner.getId()
                        ).stream()
                        .filter(b -> "COMPLETED".equalsIgnoreCase(b.getStatus()))
                        .filter(b -> b.getCompletedAt() != null)
                        .filter(b -> !b.getCompletedAt().isBefore(start)
                                && b.getCompletedAt().isBefore(endExclusive))
                        .toList();

        BigDecimal completedOrderValue = completedBookings.stream()
                .map(Booking::getTotalAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Set<Long> completedBookingIds = new HashSet<>();
        completedBookings.forEach(b -> completedBookingIds.add(b.getId()));

        BigDecimal approvedRefundAmount = refundRepository.findAll()
                .stream()
                .filter(r -> r.getBooking() != null)
                .filter(r -> r.getBooking().getPartner() != null)
                .filter(r -> r.getBooking().getPartner().getId()
                        .equals(partner.getId()))
                .filter(r -> completedBookingIds.contains(r.getBooking().getId()))
                .filter(r -> "APPROVED".equalsIgnoreCase(r.getStatus()))
                .map(CancellationRefund::getApprovedAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

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

    // =========================================================
    // F01: DASHBOARD SUMMARY
    // =========================================================

    @GetMapping("/dashboard")
    @Transactional(readOnly = true)
    public Map<String, Object> getDashboard(
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            Authentication auth) {
        Partner partner = currentPartner(auth);
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
                .map(this::bookingRow)
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
                .map(this::changeRequestRow)
                .toList();

        // Complaints
        List<ReportTicket> partnerComplaints = reportTicketRepository.findByBooking_Partner_IdOrderByCreatedAtDesc(partner.getId());
        long pendingComplaintsCount = partnerComplaints.stream()
                .filter(c -> "OPEN".equalsIgnoreCase(c.getStatus()) || "WAITING_PROVIDER".equalsIgnoreCase(c.getStatus()) || "IN_PROGRESS".equalsIgnoreCase(c.getStatus()))
                .count();
        List<Map<String, Object>> recentComplaints = partnerComplaints.stream()
                .limit(5)
                .map(this::complaintRow)
                .toList();

        // Financial metrics (integrated from getEarnings)
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

    // =========================================================
    // F01: BOOKING DETAIL
    // =========================================================

    @GetMapping("/bookings/{id}")
    @Transactional(readOnly = true)
    public Map<String, Object> getBookingDetail(
            @PathVariable Long id,
            Authentication auth) {

        Partner partner = currentPartner(auth);
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng."));

        if (booking.getPartner() == null || !booking.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền xem đơn này.");
        }

        Map<String, Object> row = bookingRow(booking);

        // Thêm danh sách phân công nhân viên
        List<Map<String, Object>> assignments = assignmentRepository
                .findByBooking_IdOrderByIdAsc(booking.getId())
                .stream()
                .map(this::assignmentRow)
                .toList();
        row.put("assignments", assignments);

        return row;
    }

    // =========================================================
    // F01: EMPLOYEE MANAGEMENT
    // =========================================================

    @GetMapping("/employees")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getEmployees(Authentication auth) {
        Partner partner = currentPartner(auth);
        return employeeRepository.findByPartner_IdOrderByIdAsc(partner.getId())
                .stream()
                .map(this::employeeRow)
                .toList();
    }

    @PostMapping("/employees")
    @Transactional
    public Map<String, Object> createEmployee(
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        Partner partner = currentPartner(auth);

        String fullName = text(body.get("fullName"));
        if (fullName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Họ tên nhân viên không được để trống.");
        }

        String email = text(body.get("email"));
        if (email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email nhân viên không được để trống.");
        }

        if (userRepository.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email đã được sử dụng.");
        }

        String phone = text(body.get("phone"));
        String rawPassword = text(body.get("password"));
        if (rawPassword.isBlank()) {
            rawPassword = "Cleanmate@2024"; // mật khẩu mặc định
        }

        LocalDateTime now = LocalDateTime.now();
        User empUser = User.builder()
                .fullName(fullName)
                .email(email)
                .phone(phone.isBlank() ? null : phone)
                .passwordHash(passwordEncoder.encode(rawPassword))
                .role("CLEANER")
                .status("ACTIVE")
                .emailVerified(true)
                .createdAt(now)
                .updatedAt(now)
                .build();
        empUser = userRepository.save(empUser);

        // Tạo mã nhân viên tự động
        String empCode = "EMP-" + partner.getId() + "-" + System.currentTimeMillis() % 100000;

        Employee employee = Employee.builder()
                .partner(partner)
                .user(empUser)
                .employeeCode(empCode)
                .status("ACTIVE")
                .totalCompletedJobs(0)
                .createdAt(now)
                .updatedAt(now)
                .build();

        return employeeRow(employeeRepository.save(employee));
    }

    @PatchMapping("/employees/{id}/status")
    @Transactional
    public Map<String, Object> updateEmployeeStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        Partner partner = currentPartner(auth);
        Employee employee = ownedEmployee(id, partner);

        String status = normalize(text(body.get("status")));
        if (!Set.of("ACTIVE", "INACTIVE", "ON_LEAVE").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Trạng thái không hợp lệ. Cho phép: ACTIVE, INACTIVE, ON_LEAVE.");
        }

        employee.setStatus(status);
        employee.setUpdatedAt(LocalDateTime.now());
        return employeeRow(employeeRepository.save(employee));
    }

    // =========================================================
    // F01: BOOKING ASSIGNMENT (giao việc cho nhân viên)
    // =========================================================

    @GetMapping("/bookings/{id}/assignments")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAssignments(
            @PathVariable Long id,
            Authentication auth) {

        Partner partner = currentPartner(auth);
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

    @PostMapping("/bookings/{id}/assignments")
    @Transactional
    public Map<String, Object> assignEmployee(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        Partner partner = currentPartner(auth);
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng."));

        if (booking.getPartner() == null || !booking.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền xử lý đơn này.");
        }

        String status = booking.getStatus();
        if (!Set.of("CONFIRMED", "ASSIGNED").contains(normalize(status))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Chỉ có thể phân công nhân viên khi đơn ở trạng thái CONFIRMED hoặc ASSIGNED.");
        }

        Long employeeId = requiredLong(body, "employeeId");
        Employee employee = ownedEmployee(employeeId, partner);

        if (!"ACTIVE".equalsIgnoreCase(employee.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Nhân viên không ở trạng thái hoạt động.");
        }

        // Kiểm tra đã phân công nhân viên này cho đơn này chưa
        boolean alreadyAssigned = assignmentRepository.findByBooking_IdOrderByIdAsc(id)
                .stream()
                .anyMatch(a -> a.getEmployee() != null
                        && a.getEmployee().getId().equals(employeeId));
        if (alreadyAssigned) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Nhân viên này đã được phân công cho đơn hàng.");
        }

        LocalDateTime now = LocalDateTime.now();
        BookingAssignment assignment = BookingAssignment.builder()
                .booking(booking)
                .partner(partner)
                .employee(employee)
                .status("ASSIGNED")
                .assignedAt(now)
                .note(text(body.get("note")))
                .build();
        assignment = assignmentRepository.save(assignment);

        // Cập nhật trạng thái đơn sang ASSIGNED nếu chưa
        if ("CONFIRMED".equalsIgnoreCase(booking.getStatus())) {
            booking.setStatus("ASSIGNED");
            bookingRepository.save(booking);
        }

        return assignmentRow(assignment);
    }

    @DeleteMapping("/bookings/{bookingId}/assignments/{assignmentId}")
    @Transactional
    public Map<String, Object> removeAssignment(
            @PathVariable Long bookingId,
            @PathVariable Long assignmentId,
            Authentication auth) {

        Partner partner = currentPartner(auth);
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng."));

        if (booking.getPartner() == null || !booking.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền xử lý đơn này.");
        }

        BookingAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy phân công."));

        if (!assignment.getBooking().getId().equals(bookingId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phân công không thuộc đơn hàng này.");
        }

        assignmentRepository.delete(assignment);

        // Nếu không còn phân công nào, đưa đơn về CONFIRMED
        boolean hasOtherAssignments = assignmentRepository
                .findByBooking_IdOrderByIdAsc(bookingId).isEmpty();
        if (hasOtherAssignments && "ASSIGNED".equalsIgnoreCase(booking.getStatus())) {
            booking.setStatus("CONFIRMED");
            bookingRepository.save(booking);
        }

        return Map.of("message", "Đã xóa phân công thành công.", "assignmentId", assignmentId);
    }

    // =========================================================
    // F01: SCHEDULE — danh sách phân công theo nhân viên
    // =========================================================

    @GetMapping("/schedule")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getSchedule(
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            Authentication auth) {

        Partner partner = currentPartner(auth);

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

    // =========================================================
    // F01-09: PARTNER PROFILE & CHANGE REQUESTS
    // =========================================================

    @GetMapping("/profile")
    @Transactional(readOnly = true)
    public Map<String, Object> getProfile(Authentication auth) {
        Partner partner = currentPartner(auth);
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", partner.getId());
        map.put("businessName", partner.getBusinessName());
        map.put("description", partner.getDescription());
        map.put("taxCode", partner.getTaxCode());
        map.put("address", partner.getAddress() != null ? partner.getAddress() : "Chưa có địa chỉ được xác nhận");
        map.put("latitude", partner.getLatitude());
        map.put("longitude", partner.getLongitude());
        map.put("version", partner.getVersion() != null ? partner.getVersion() : 1);
        map.put("status", partner.getStatus());
        map.put("ratingAverage", partner.getRatingAverage());
        map.put("totalCompletedJobs", partner.getTotalCompletedJobs());
        map.put("phone", partner.getUser() != null ? partner.getUser().getPhone() : "");
        map.put("email", partner.getUser() != null ? partner.getUser().getEmail() : "");
        map.put("createdAt", partner.getCreatedAt());
        map.put("updatedAt", partner.getUpdatedAt());
        return map;
    }

    @GetMapping("/change-requests")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getChangeRequests(Authentication auth) {
        Partner partner = currentPartner(auth);
        return changeRequestRepository.findByPartner_IdOrderByCreatedAtDesc(partner.getId())
                .stream().map(this::changeRequestRow).toList();
    }

    @PostMapping("/change-requests")
    @Transactional
    public Map<String, Object> createChangeRequest(
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        Partner partner = currentPartner(auth);

        String rawType = text(body.get("type")).toUpperCase();
        final String type = rawType.isBlank() ? "PROFILE_UPDATE" : rawType;
        String reason = text(body.get("reason"));
        if (reason.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập lý do yêu cầu thay đổi.");
        }

        // Validate coordinates if LOCATION_UPDATE
        if ("LOCATION_UPDATE".equals(type)) {
            Object latObj = body.get("latitude");
            Object lonObj = body.get("longitude");
            if (latObj != null && lonObj != null) {
                try {
                    double lat = Double.parseDouble(String.valueOf(latObj));
                    double lon = Double.parseDouble(String.valueOf(lonObj));
                    if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || (lat == 0 && lon == 0)) {
                        throw new IllegalArgumentException();
                    }
                } catch (Exception e) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tọa độ không hợp lệ.");
                }
            }
        }

        // Check if there is already a PENDING_REVIEW request of this type
        boolean hasPending = changeRequestRepository.findByPartner_IdAndStatusOrderByCreatedAtDesc(partner.getId(), "PENDING_REVIEW")
                .stream().anyMatch(r -> type.equalsIgnoreCase(r.getRequestType()));
        if (hasPending) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bạn đang có một yêu cầu loại này đang chờ Admin duyệt.");
        }

        String proposedSnapshot = text(body.get("proposedSnapshot"));
        if (proposedSnapshot.isBlank()) {
            if ("LOCATION_UPDATE".equals(type)) {
                proposedSnapshot = "address=" + text(body.get("address"))
                        + ";latitude=" + text(body.get("latitude"))
                        + ";longitude=" + text(body.get("longitude"));
            } else if ("PROFILE_UPDATE".equals(type)) {
                proposedSnapshot = "businessName=" + text(body.get("businessName"))
                        + ";description=" + text(body.get("description"))
                        + ";taxCode=" + text(body.get("taxCode"));
            } else {
                proposedSnapshot = body.toString();
            }
        }

        String oldSnapshot = text(body.get("oldSnapshot"));
        if (oldSnapshot.isBlank()) {
            if ("LOCATION_UPDATE".equals(type)) {
                oldSnapshot = "address=" + (partner.getAddress() != null ? partner.getAddress() : "")
                        + ";latitude=" + (partner.getLatitude() != null ? partner.getLatitude() : "")
                        + ";longitude=" + (partner.getLongitude() != null ? partner.getLongitude() : "");
            } else if ("PROFILE_UPDATE".equals(type)) {
                oldSnapshot = "businessName=" + partner.getBusinessName()
                        + ";description=" + (partner.getDescription() != null ? partner.getDescription() : "")
                        + ";taxCode=" + (partner.getTaxCode() != null ? partner.getTaxCode() : "");
            }
        }

        LocalDateTime now = LocalDateTime.now();
        BusinessChangeRequest req = BusinessChangeRequest.builder()
                .partner(partner)
                .requestType(type)
                .status("PENDING_REVIEW")
                .targetId(partner.getId())
                .targetName(partner.getBusinessName())
                .oldSnapshot(oldSnapshot)
                .proposedSnapshot(proposedSnapshot)
                .reason(reason)
                .evidenceUrl(text(body.get("evidenceUrl")))
                .submittedBy(auth.getName())
                .createdAt(now)
                .updatedAt(now)
                .build();

        return changeRequestRow(changeRequestRepository.save(req));
    }

    @PostMapping("/change-requests/{id}/withdraw")
    @Transactional
    public Map<String, Object> withdrawChangeRequest(
            @PathVariable Long id,
            Authentication auth) {
        Partner partner = currentPartner(auth);
        BusinessChangeRequest req = changeRequestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy yêu cầu."));

        if (!req.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền thao tác yêu cầu này.");
        }

        if (!"PENDING_REVIEW".equalsIgnoreCase(req.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chỉ có thể rút yêu cầu đang chờ duyệt.");
        }

        req.setStatus("WITHDRAWN");
        req.setUpdatedAt(LocalDateTime.now());
        return changeRequestRow(changeRequestRepository.save(req));
    }

    // =========================================================
    // F01-07: SERVICES CATALOG & SERVICE REQUESTS
    // =========================================================

    @GetMapping("/services/catalog")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getServiceCatalog(Authentication auth) {
        Partner partner = currentPartner(auth);
        List<PartnerService> registered = partnerServiceRepository.findByPartner_Id(partner.getId());
        Set<Long> registeredServiceIds = new HashSet<>();
        Map<Long, PartnerService> psMap = new HashMap<>();
        for (PartnerService ps : registered) {
            registeredServiceIds.add(ps.getService().getId());
            psMap.put(ps.getService().getId(), ps);
        }

        return serviceRepository.findAll().stream()
                .map(s -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", s.getId());
                    row.put("name", s.getName());
                    row.put("category", s.getCategory() != null ? s.getCategory().getName() : "");
                    row.put("description", s.getDescription());
                    row.put("thumbnailUrl", s.getThumbnailUrl());
                    row.put("basePrice", s.getBasePrice());
                    row.put("estimatedMinutes", s.getEstimatedMinutes());
                    boolean isReg = registeredServiceIds.contains(s.getId());
                    row.put("registered", isReg);
                    if (isReg) {
                        PartnerService ps = psMap.get(s.getId());
                        row.put("partnerServiceId", ps.getId());
                        row.put("partnerPrice", ps.getPrice());
                        row.put("partnerStatus", ps.getStatus());
                    }
                    return row;
                })
                .toList();
    }

    @PostMapping("/service-requests")
    @Transactional
    public Map<String, Object> createServiceRequest(
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        Partner partner = currentPartner(auth);
        String type = text(body.get("type")).toUpperCase();
        if (type.isBlank()) type = "SERVICE_REGISTER";

        Long serviceId = requiredLong(body, "serviceId");
        Service service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy dịch vụ sàn."));

        String reason = text(body.get("reason"));
        if (reason.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập lý do.");
        }

        BigDecimal proposedPrice = body.get("proposedPrice") != null
                ? new BigDecimal(String.valueOf(body.get("proposedPrice")))
                : service.getBasePrice();

        LocalDateTime now = LocalDateTime.now();
        BusinessChangeRequest req = BusinessChangeRequest.builder()
                .partner(partner)
                .requestType(type)
                .status("PENDING_REVIEW")
                .targetId(service.getId())
                .targetName(service.getName())
                .oldSnapshot("basePrice=" + service.getBasePrice())
                .proposedSnapshot("serviceId=" + service.getId() + ";price=" + proposedPrice)
                .reason(reason)
                .evidenceUrl(text(body.get("evidenceUrl")))
                .submittedBy(auth.getName())
                .createdAt(now)
                .updatedAt(now)
                .build();

        return changeRequestRow(changeRequestRepository.save(req));
    }

    @PatchMapping("/services/{id}/pause")
    @Transactional
    public Map<String, Object> pauseService(@PathVariable Long id, Authentication auth) {
        Partner partner = currentPartner(auth);
        PartnerService ps = ownedService(id, partner);
        ps.setStatus("PAUSED");
        ps.setUpdatedAt(LocalDateTime.now());
        return serviceRow(partnerServiceRepository.save(ps));
    }

    @PatchMapping("/services/{id}/resume")
    @Transactional
    public Map<String, Object> resumeService(@PathVariable Long id, Authentication auth) {
        Partner partner = currentPartner(auth);
        PartnerService ps = ownedService(id, partner);
        ps.setStatus("ACTIVE");
        ps.setUpdatedAt(LocalDateTime.now());
        return serviceRow(partnerServiceRepository.save(ps));
    }

    // =========================================================
    // F01-08: COMPLAINTS (REPORTS)
    // =========================================================

    @GetMapping("/complaints")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getComplaints(Authentication auth) {
        Partner partner = currentPartner(auth);
        return reportTicketRepository.findByBooking_Partner_IdOrderByCreatedAtDesc(partner.getId())
                .stream()
                .map(this::complaintRow)
                .toList();
    }

    @GetMapping("/complaints/{id}")
    @Transactional(readOnly = true)
    public Map<String, Object> getComplaintDetail(@PathVariable Long id, Authentication auth) {
        Partner partner = currentPartner(auth);
        ReportTicket ticket = reportTicketRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khiếu nại."));

        if (ticket.getBooking() == null || ticket.getBooking().getPartner() == null
                || !ticket.getBooking().getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem khiếu nại này.");
        }

        Map<String, Object> row = complaintRow(ticket);
        List<Map<String, Object>> responses = complaintResponseRepository
                .findByTicket_IdOrderByCreatedAtAsc(ticket.getId())
                .stream()
                .map(this::complaintResponseRow)
                .toList();
        row.put("responses", responses);
        return row;
    }

    @PostMapping("/complaints/{id}/responses")
    @Transactional
    public Map<String, Object> respondComplaint(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        User user = currentUser(auth);
        Partner partner = currentPartner(auth);

        ReportTicket ticket = reportTicketRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khiếu nại."));

        if (ticket.getBooking() == null || ticket.getBooking().getPartner() == null
                || !ticket.getBooking().getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền phản hồi khiếu nại này.");
        }

        String content = text(body.get("content"));
        if (content.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nội dung giải trình không được để trống.");
        }

        LocalDateTime now = LocalDateTime.now();
        ComplaintResponse resp = ComplaintResponse.builder()
                .ticket(ticket)
                .author(user)
                .authorName(partner.getBusinessName())
                .authorRole("PROVIDER")
                .content(content)
                .evidenceUrl(text(body.get("evidenceUrl")))
                .createdAt(now)
                .build();
        complaintResponseRepository.save(resp);

        // Update ticket status to PROVIDER_RESPONDED
        ticket.setStatus("PROVIDER_RESPONDED");
        ticket.setUpdatedAt(now);
        reportTicketRepository.save(ticket);

        return complaintResponseRow(resp);
    }

    // =========================================================
    // PRIVATE HELPERS
    // =========================================================

    private Employee ownedEmployee(Long id, Partner partner) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy nhân viên."));
        if (!employee.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Nhân viên không thuộc nhà cung cấp của bạn.");
        }
        return employee;
    }

    private Map<String, Object> employeeRow(Employee emp) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", emp.getId());
        row.put("employeeCode", emp.getEmployeeCode());
        row.put("status", emp.getStatus());
        row.put("ratingAverage", emp.getRatingAverage());
        row.put("totalCompletedJobs", emp.getTotalCompletedJobs());
        row.put("createdAt", emp.getCreatedAt());
        if (emp.getUser() != null) {
            row.put("fullName", emp.getUser().getFullName());
            row.put("email",    emp.getUser().getEmail());
            row.put("phone",    emp.getUser().getPhone());
            row.put("avatarUrl", emp.getUser().getAvatarUrl());
        }
        return row;
    }

    private Map<String, Object> assignmentRow(BookingAssignment a) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", a.getId());
        row.put("status", a.getStatus());
        row.put("assignedAt", a.getAssignedAt());
        row.put("acceptedAt", a.getAcceptedAt());
        row.put("startedAt", a.getStartedAt());
        row.put("completedAt", a.getCompletedAt());
        row.put("note", a.getNote());
        if (a.getEmployee() != null) {
            row.put("employeeId",   a.getEmployee().getId());
            row.put("employeeCode", a.getEmployee().getEmployeeCode());
            row.put("employeeName", a.getEmployee().getUser() != null
                    ? a.getEmployee().getUser().getFullName() : "");
        }
        return row;
    }

    private PartnerService ownedService(Long id, Partner partner) {

        PartnerService partnerService = partnerServiceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy dịch vụ."
                ));

        if (partnerService.getPartner() == null
                || !partnerService.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền sửa dịch vụ của nhà cung cấp khác."
            );
        }

        return partnerService;
    }

    private Map<String, Object> serviceRow(PartnerService ps) {
        Service service = ps.getService();
        Map<String, Object> row = new LinkedHashMap<>();

        row.put("id", ps.getId());
        row.put("serviceId", service.getId());
        row.put("name", service.getName());
        row.put("categoryId", service.getCategory().getId());
        row.put("category", service.getCategory().getName());
        row.put("description", service.getDescription());
        row.put("thumbnailUrl", service.getThumbnailUrl());
        row.put("price", ps.getPrice() != null ? ps.getPrice() : service.getBasePrice());
        row.put("estimatedMinutes", service.getEstimatedMinutes());
        row.put("status", ps.getStatus());

        return row;
    }

    private Map<String, Object> bookingRow(Booking booking) {
        Map<String, Object> row = new LinkedHashMap<>();

        row.put("id", booking.getId());
        row.put("bookingCode", booking.getBookingCode());
        row.put("customerName", booking.getCustomer() == null
                ? "" : booking.getCustomer().getFullName());
        row.put("customerPhone", booking.getCustomer() == null
                ? "" : booking.getCustomer().getPhone());
        row.put("scheduledStart", booking.getScheduledStart());
        row.put("scheduledEnd", booking.getScheduledEnd());
        row.put("status", booking.getStatus());
        row.put("totalAmount", booking.getTotalAmount());
        row.put("createdAt", booking.getCreatedAt());
        row.put("completedAt", booking.getCompletedAt());
        row.put("cancelReason", booking.getCancelReason());

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

    private Long requiredLong(Map<String, Object> body, String key) {
        try {
            return Long.valueOf(String.valueOf(body.get(key)));
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trường " + key + " không hợp lệ."
            );
        }
    }

    private BigDecimal requiredPrice(Map<String, Object> body, String key) {
        try {
            BigDecimal value = new BigDecimal(String.valueOf(body.get(key)));
            if (value.signum() <= 0) {
                throw new NumberFormatException();
            }
            return value;
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Giá dịch vụ phải lớn hơn 0."
            );
        }
    }

    private Integer requiredPositiveInt(Map<String, Object> body, String key) {
        try {
            int value = Integer.parseInt(String.valueOf(body.get(key)));
            if (value <= 0) {
                throw new NumberFormatException();
            }
            return value;
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thời lượng phải là số nguyên lớn hơn 0."
            );
        }
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }

        String role = value.trim().toUpperCase(Locale.ROOT);
        return role.startsWith("ROLE_") ? role.substring(5) : role;
    }

    private Map<String, Object> changeRequestRow(BusinessChangeRequest r) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", r.getId());
        map.put("partnerId", r.getPartner().getId());
        map.put("businessName", r.getPartner().getBusinessName());
        map.put("requestType", r.getRequestType());
        map.put("status", r.getStatus());
        map.put("targetId", r.getTargetId());
        map.put("targetName", r.getTargetName());
        map.put("oldSnapshot", r.getOldSnapshot());
        map.put("proposedSnapshot", r.getProposedSnapshot());
        map.put("reason", r.getReason());
        map.put("evidenceUrl", r.getEvidenceUrl());
        map.put("rejectReason", r.getRejectReason());
        map.put("submittedBy", r.getSubmittedBy());
        map.put("reviewedBy", r.getReviewedBy());
        map.put("createdAt", r.getCreatedAt());
        map.put("reviewedAt", r.getReviewedAt());
        return map;
    }

    private Map<String, Object> complaintRow(ReportTicket c) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", c.getId());
        map.put("subject", c.getSubject());
        map.put("category", c.getCategory());
        map.put("description", c.getDescription());
        map.put("evidenceUrl", c.getEvidenceUrl());
        map.put("status", c.getStatus());
        map.put("resolution", c.getResolution());
        map.put("handledBy", c.getHandledBy());
        map.put("createdAt", c.getCreatedAt());
        map.put("updatedAt", c.getUpdatedAt());
        if (c.getBooking() != null) {
            map.put("bookingId", c.getBooking().getId());
            map.put("bookingCode", c.getBooking().getBookingCode());
        }
        if (c.getReporter() != null) {
            map.put("reporterName", c.getReporter().getFullName());
            map.put("reporterPhone", c.getReporter().getPhone());
        }
        return map;
    }

    private Map<String, Object> complaintResponseRow(ComplaintResponse cr) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", cr.getId());
        map.put("ticketId", cr.getTicket().getId());
        map.put("authorName", cr.getAuthorName());
        map.put("authorRole", cr.getAuthorRole());
        map.put("content", cr.getContent());
        map.put("evidenceUrl", cr.getEvidenceUrl());
        map.put("createdAt", cr.getCreatedAt());
        return map;
    }
}
