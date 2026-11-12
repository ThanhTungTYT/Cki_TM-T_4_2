
package org.ckitmdt.backend.service.booking;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.ckitmdt.backend.dto.booking.BookingResponse;
import org.ckitmdt.backend.dto.booking.CleanerAssignmentResponse;
import org.ckitmdt.backend.entity.AdminNotification;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.BookingAssignment;
import org.ckitmdt.backend.entity.BookingItem;
import org.ckitmdt.backend.entity.Employee;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.AdminNotificationRepository;
import org.ckitmdt.backend.repository.BookingAssignmentRepository;
import org.ckitmdt.backend.repository.BookingItemRepository;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.BookingStatusHistoryRepository;
import org.ckitmdt.backend.repository.CleanerWorkLogRepository;
import org.ckitmdt.backend.repository.EmployeeRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class CleanerAssignmentService {

    private static final String UNABLE_REPORT_MARKER =
            "BÁO KHÔNG THỂ THỰC HIỆN [";

    private final BookingAssignmentRepository assignmentRepository;
    private final BookingRepository bookingRepository;
    private final BookingStatusHistoryRepository bookingStatusHistoryRepository;
    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final BookingStateEngine bookingStateEngine;
    private final AdminNotificationRepository adminNotificationRepository;
    private final BookingItemRepository bookingItemRepository;
    private final CleanerWorkLogRepository cleanerWorkLogRepository;

    /**
     * Cleaner thực hiện hành động trên một Assignment cụ thể.
     *
     * Các action được hỗ trợ:
     * ACCEPT
     * DECLINE
     * REPORT_UNABLE
     * START_JOB
     * SUBMIT_COMPLETION
     */
    @Transactional
    public CleanerAssignmentResponse executeAction(
            Long assignmentId,
            String action,
            String note,
            String userEmail
    ) {

        // 1. Kiểm tra người đăng nhập
        User cleanerUser = getUserByEmail(userEmail);

        if (!isCleanerRole(cleanerUser.getRole())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Chỉ nhân viên vệ sinh mới được thực hiện thao tác này."
            );
        }

        if (!"ACTIVE".equalsIgnoreCase(cleanerUser.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Tài khoản Cleaner hiện không hoạt động."
            );
        }

        // 2. Tìm hồ sơ Employee
        Employee employee = employeeRepository.findByUser_Id(cleanerUser.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy hồ sơ nhân viên."
                ));

        if (!"ACTIVE".equalsIgnoreCase(employee.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Hồ sơ nhân viên hiện không hoạt động."
            );
        }

        // 3. Tìm Assignment ban đầu để lấy bookingId
        BookingAssignment initialAssignment =
                assignmentRepository.findById(assignmentId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Không tìm thấy phân công công việc."
                        ));

        if (initialAssignment.getBooking() == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Phân công không liên kết với đơn hàng hợp lệ."
            );
        }

        Long bookingId = initialAssignment.getBooking().getId();

        // Khóa Booking trước để hạn chế cập nhật đồng thời
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy đơn hàng."
                ));

        // Khóa Assignment
        BookingAssignment assignment =
                assignmentRepository.findByIdForUpdate(assignmentId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Phân công không còn tồn tại."
                        ));

        // 4. Kiểm tra Assignment có thuộc Cleaner đăng nhập không
        if (assignment.getEmployee() == null
                || !Objects.equals(
                assignment.getEmployee().getId(),
                employee.getId()
        )) {

            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không được phân công thực hiện công việc này."
            );
        }

        // 5. Kiểm tra tính nhất quán Employee - Assignment - Booking
        if (assignment.getPartner() == null
                || employee.getPartner() == null
                || booking.getPartner() == null
                || !Objects.equals(
                assignment.getPartner().getId(),
                employee.getPartner().getId()
        )
                || !Objects.equals(
                assignment.getPartner().getId(),
                booking.getPartner().getId()
        )) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Thông tin nhà cung cấp của phân công không đồng nhất."
            );
        }

        // 6. Chuẩn hóa action
        if (action == null || action.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Hành động không được để trống."
            );
        }

        String normalizedAction = action
                .trim()
                .replace("-", "_")
                .toUpperCase(Locale.ROOT);

        String currentAssignmentStatus =
                normalizeStatus(assignment.getStatus());

        String currentBookingStatus =
                normalizeStatus(booking.getStatus());

        /*
         * 7. Chặn các hành động không hợp lệ sau khi Cleaner
         * đã gửi báo cáo không thể thực hiện.
         *
         * Assignment vẫn giữ ACCEPTED để Provider/Staff điều phối.
         * Cleaner không được gửi báo cáo lặp lại hoặc tự bắt đầu việc.
         */
        boolean alreadyReportedUnable = hasReportedUnable(assignment);

        if ("REPORT_UNABLE".equals(normalizedAction)
                && alreadyReportedUnable) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Bạn đã gửi báo cáo không thể thực hiện công việc trước đó. "
                            + "Vui lòng chờ Provider/Staff điều phối nhân viên thay thế."
            );
        }

        if ("START_JOB".equals(normalizedAction)
                && alreadyReportedUnable) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Bạn đã báo không thể thực hiện công việc này. "
                            + "Không thể bắt đầu công việc. "
                            + "Vui lòng chờ Provider/Staff điều phối nhân viên thay thế."
            );
        }

        // 8. SUBMIT_COMPLETION chỉ được phép khi Cleaner đã lưu FINAL_REPORT.
        // Kiểm tra ở Backend để không thể bỏ qua bước báo cáo bằng cách gọi API trực tiếp.
        if ("SUBMIT_COMPLETION".equals(normalizedAction)) {
            boolean hasFinalReport = cleanerWorkLogRepository
                    .findByAssignment_IdOrderByCreatedAtDesc(assignmentId)
                    .stream()
                    .anyMatch(workLog ->
                            "FINAL_REPORT".equalsIgnoreCase(workLog.getLogType())
                    );

            if (!hasFinalReport) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Bạn phải gửi báo cáo tổng kết trước khi nộp kết quả công việc."
                );
            }
        }

        // 9. Kiểm tra Booking có cho phép hành động không
        validateBookingStatus(
                currentBookingStatus,
                normalizedAction
        );

        LocalDateTime now = LocalDateTime.now();

        // 10. Nếu bắt đầu công việc, phải kiểm tra đủ nhân viên đã nhận việc
        if ("START_JOB".equals(normalizedAction)) {
            validateEnoughAcceptedEmployees(booking);
        }

        // 11. Xác định trạng thái Assignment tiếp theo
        String nextAssignmentStatus = determineNextAssignmentStatus(
                currentAssignmentStatus,
                normalizedAction
        );

        String oldAssignmentStatus = assignment.getStatus();

        assignment.setStatus(nextAssignmentStatus);

        // 12. Cập nhật thời gian và ghi chú
        switch (normalizedAction) {

            case "ACCEPT" -> {
                assignment.setAcceptedAt(now);
            }

            case "START_JOB" -> {
                if (assignment.getStartedAt() == null) {
                    assignment.setStartedAt(now);
                }
            }

            case "SUBMIT_COMPLETION" -> {
                if (assignment.getCompletedAt() == null) {
                    assignment.setCompletedAt(now);
                }
            }

            case "DECLINE" -> {
                if (note == null || note.trim().isBlank()) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Vui lòng ghi rõ lý do từ chối công việc."
                    );
                }

                assignment.setNote("Từ chối: " + note.trim());
            }

            case "REPORT_UNABLE" -> {
                if (note == null || note.trim().isBlank()) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Vui lòng ghi rõ lý do không thể thực hiện công việc."
                    );
                }

                String existingNote = assignment.getNote();

                String report = UNABLE_REPORT_MARKER
                        + now + "]: " + note.trim();

                assignment.setNote(
                        existingNote == null || existingNote.isBlank()
                                ? report
                                : existingNote + "\n" + report
                );

                if (assignment.getPartner() != null
                        && assignment.getPartner().getUser() != null) {

                    String reason = note.trim();

                    if (reason.length() > 700) {
                        reason = reason.substring(0, 700) + "...";
                    }

                    adminNotificationRepository.save(
                            AdminNotification.builder()
                                    .recipient(assignment.getPartner().getUser())
                                    .type("ASSIGNMENT_UNABLE")
                                    .title("Cleaner báo không thể thực hiện công việc")
                                    .message(
                                            "Nhân viên "
                                                    + cleanerUser.getFullName()
                                                    + " báo không thể tiếp tục/đảm nhận công việc "
                                                    + booking.getBookingCode()
                                                    + ". Lý do: " + reason
                                                    + ". Vui lòng liên hệ và điều phối nhân sự thay thế nếu cần."
                                    )
                                    .referenceType("BOOKING")
                                    .referenceId(booking.getId())
                                    .createdAt(now)
                                    .build()
                    );
                }
            }

            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Hành động không được hỗ trợ."
            );
        }

        assignmentRepository.saveAndFlush(assignment);

        // 12. Đồng bộ trạng thái Booking
        synchronizeBookingStatus(
                booking,
                normalizedAction,
                cleanerUser,
                note,
                now
        );

        log.info(
                "Cleaner [{}] thực hiện [{}] trên Assignment [{}]: {} -> {}",
                cleanerUser.getEmail(),
                normalizedAction,
                assignmentId,
                oldAssignmentStatus,
                nextAssignmentStatus
        );

        // 13. Trả về Assignment mới nhất
        return mapToResponse(assignment);
    }

    /**
     * Kiểm tra Assignment đã có báo cáo không thể thực hiện hay chưa.
     */
    private boolean hasReportedUnable(BookingAssignment assignment) {

        String assignmentNote = assignment.getNote();

        return assignmentNote != null
                && assignmentNote.contains(UNABLE_REPORT_MARKER);
    }

    /**
     * Xác định trạng thái Assignment tiếp theo.
     */
    private String determineNextAssignmentStatus(
            String currentStatus,
            String action
    ) {

        return switch (action) {

            case "ACCEPT" -> {
                if (!"ASSIGNED".equals(currentStatus)) {
                    throw invalidAssignmentTransition(
                            currentStatus,
                            action
                    );
                }

                yield "ACCEPTED";
            }

            case "DECLINE" -> {
                // Chỉ được từ chối trước khi nhận việc.
                // Sau ACCEPT, Provider/Staff phải điều phối thay người.
                if (!"ASSIGNED".equals(currentStatus)) {
                    throw invalidAssignmentTransition(
                            currentStatus,
                            action
                    );
                }

                yield "DECLINED";
            }

            case "REPORT_UNABLE" -> {
                // Đây là yêu cầu điều phối, không tự hủy Assignment.
                // Giữ ACCEPTED để Provider/Staff quyết định thay người.
                if (!"ACCEPTED".equals(currentStatus)) {
                    throw invalidAssignmentTransition(
                            currentStatus,
                            action
                    );
                }

                yield currentStatus;
            }

            case "START_JOB" -> {
                if (!"ACCEPTED".equals(currentStatus)) {
                    throw invalidAssignmentTransition(
                            currentStatus,
                            action
                    );
                }

                yield "IN_PROGRESS";
            }

            case "SUBMIT_COMPLETION" -> {
                if (!"IN_PROGRESS".equals(currentStatus)) {
                    throw invalidAssignmentTransition(
                            currentStatus,
                            action
                    );
                }

                yield "WORK_SUBMITTED";
            }

            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Hành động Cleaner không hợp lệ: " + action
            );
        };
    }

    /**
     * Kiểm tra số nhân viên đã xác nhận tham gia có đáp ứng yêu cầu không.
     *
     * ASSIGNED chưa được tính vì Cleaner chưa chấp nhận phân công.
     */
    private void validateEnoughAcceptedEmployees(Booking booking) {

        List<BookingItem> items =
                bookingItemRepository.findByBookingId(booking.getId());

        int requiredEmployees =
                (items == null || items.isEmpty())
                        ? 1
                        : items.stream()
                        .mapToInt(item -> {
                            int employeeCount =
                                    item.getEmployeeCount() != null
                                            && item.getEmployeeCount() > 0
                                            ? item.getEmployeeCount()
                                            : 1;

                            int quantity =
                                    item.getQuantity() != null
                                            && item.getQuantity() > 0
                                            ? item.getQuantity()
                                            : 1;

                            return employeeCount * quantity;
                        })
                        .sum();

        if (requiredEmployees <= 0) {
            requiredEmployees = 1;
        }

        List<BookingAssignment> assignments =
                assignmentRepository.findByBooking_IdOrderByIdAsc(
                        booking.getId()
                );

        long acceptedEmployees = assignments.stream()
                .filter(assignment -> assignment.getEmployee() != null)
                .filter(assignment -> {
                    String status = normalizeStatus(assignment.getStatus());

                    return List.of(
                            "ACCEPTED",
                            "EN_ROUTE",
                            "IN_PROGRESS",
                            "WORK_SUBMITTED",
                            "COMPLETED"
                    ).contains(status);
                })
                .map(assignment -> assignment.getEmployee().getId())
                .filter(Objects::nonNull)
                .distinct()
                .count();

        if (acceptedEmployees < requiredEmployees) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Chưa đủ nhân viên xác nhận nhận việc. Cần "
                            + requiredEmployees
                            + " người, hiện có "
                            + acceptedEmployees
                            + " người đã xác nhận. Vui lòng chờ đủ nhân viên trước khi bắt đầu."
            );
        }
    }

    /**
     * Kiểm tra Booking có cho phép thực hiện hành động hay không.
     */
    private void validateBookingStatus(
            String bookingStatus,
            String action
    ) {

        boolean allowed = switch (action) {

            case "ACCEPT", "DECLINE" ->
                    List.of(
                            "CONFIRMED",
                            "ASSIGNED",
                            "EN_ROUTE",
                            "IN_PROGRESS"
                    ).contains(bookingStatus);

            case "REPORT_UNABLE" ->
                    List.of(
                            "CONFIRMED",
                            "ASSIGNED",
                            "EN_ROUTE",
                            "IN_PROGRESS"
                    ).contains(bookingStatus);

            case "START_JOB" ->
                    List.of(
                            "ASSIGNED",
                            "EN_ROUTE",
                            "IN_PROGRESS"
                    ).contains(bookingStatus);

            case "SUBMIT_COMPLETION" ->
                    "IN_PROGRESS".equals(bookingStatus);

            default -> false;
        };

        if (!allowed) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Đơn hàng đang ở trạng thái "
                            + bookingStatus
                            + ", không thể thực hiện hành động "
                            + action
                            + "."
            );
        }
    }

    /**
     * Đồng bộ trạng thái Booking từ tiến độ Assignment.
     */
    private void synchronizeBookingStatus(
            Booking booking,
            String action,
            User cleanerUser,
            String note,
            LocalDateTime now
    ) {

        String oldBookingStatus =
                normalizeStatus(booking.getStatus());

        String nextBookingStatus = oldBookingStatus;

        switch (action) {

            case "START_JOB" -> {
                if ("ASSIGNED".equals(oldBookingStatus)
                        || "EN_ROUTE".equals(oldBookingStatus)) {

                    nextBookingStatus = "IN_PROGRESS";
                }
            }

            case "SUBMIT_COMPLETION" -> {

                List<BookingAssignment> assignments =
                        assignmentRepository.findByBooking_IdOrderByIdAsc(
                                booking.getId()
                        );

                List<BookingAssignment> activeAssignments =
                        assignments.stream()
                                .filter(assignment -> {
                                    String status =
                                            normalizeStatus(assignment.getStatus());

                                    return !"DECLINED".equals(status)
                                            && !"CANCELLED".equals(status);
                                })
                                .toList();

                boolean allSubmitted =
                        !activeAssignments.isEmpty()
                                && activeAssignments.stream()
                                .allMatch(assignment -> {
                                    String status =
                                            normalizeStatus(assignment.getStatus());

                                    return "WORK_SUBMITTED".equals(status)
                                            || "COMPLETED".equals(status);
                                });

                if (allSubmitted
                        && "IN_PROGRESS".equals(oldBookingStatus)) {

                    nextBookingStatus = "PENDING_COMPLETION";

                    if (booking.getPartner() != null
                            && booking.getPartner().getUser() != null) {

                        adminNotificationRepository.save(
                                AdminNotification.builder()
                                        .recipient(booking.getPartner().getUser())
                                        .type("CLEANER_WORK_SUBMITTED")
                                        .title("Nhân viên đã báo hoàn thành công việc")
                                        .message(
                                                "Tất cả nhân viên được phân công đã báo hoàn thành đơn hàng "
                                                        + booking.getBookingCode()
                                                        + ". Vui lòng kiểm tra và theo dõi khách hàng nghiệm thu."
                                        )
                                        .referenceType("BOOKING")
                                        .referenceId(booking.getId())
                                        .createdAt(now)
                                        .build()
                        );
                    }
                }
            }

            case "DECLINE" -> {

                List<BookingItem> items =
                        bookingItemRepository.findByBookingId(
                                booking.getId()
                        );

                int requiredEmployees =
                        (items == null || items.isEmpty())
                                ? 1
                                : items.stream()
                                .mapToInt(item -> {
                                    int employeeCount =
                                            item.getEmployeeCount() != null
                                                    && item.getEmployeeCount() > 0
                                                    ? item.getEmployeeCount()
                                                    : 1;

                                    int quantity =
                                            item.getQuantity() != null
                                                    && item.getQuantity() > 0
                                                    ? item.getQuantity()
                                                    : 1;

                                    return employeeCount * quantity;
                                })
                                .sum();

                if (requiredEmployees <= 0) {
                    requiredEmployees = 1;
                }

                long remainingActive =
                        assignmentRepository
                                .findByBooking_IdOrderByIdAsc(booking.getId())
                                .stream()
                                .filter(assignment -> {
                                    String status =
                                            normalizeStatus(assignment.getStatus());

                                    return !"DECLINED".equals(status)
                                            && !"CANCELLED".equals(status);
                                })
                                .count();

                if (remainingActive < requiredEmployees
                        && (
                        "ASSIGNED".equals(oldBookingStatus)
                                || "EN_ROUTE".equals(oldBookingStatus)
                )) {

                    nextBookingStatus = "CONFIRMED";
                }

                if (booking.getPartner() != null
                        && booking.getPartner().getUser() != null) {

                    adminNotificationRepository.save(
                            AdminNotification.builder()
                                    .recipient(booking.getPartner().getUser())
                                    .type("ASSIGNMENT_DECLINED")
                                    .title("Nhân viên từ chối nhận việc")
                                    .message(
                                            "Nhân viên "
                                                    + cleanerUser.getFullName()
                                                    + " đã từ chối phân công cho đơn hàng "
                                                    + booking.getBookingCode()
                                                    + (
                                                    note != null && !note.isBlank()
                                                            ? " (Lý do: " + note + ")"
                                                            : ""
                                            )
                                                    + ". Vui lòng phân công nhân viên thay thế."
                                    )
                                    .referenceType("BOOKING")
                                    .referenceId(booking.getId())
                                    .createdAt(now)
                                    .build()
                    );
                }
            }

            default -> {
                // ACCEPT và REPORT_UNABLE không thay đổi trạng thái Booking.
            }
        }

        if (!oldBookingStatus.equals(nextBookingStatus)) {

            org.ckitmdt.backend.dto.booking.BookingStatusEnum targetEnum =
                    org.ckitmdt.backend.dto.booking.BookingStatusEnum.valueOf(
                            nextBookingStatus
                    );

            String transitionNote =
                    note != null && !note.isBlank()
                            ? note
                            : "Cập nhật tiến độ từ hành động Cleaner: " + action;

            bookingStateEngine.transitionBooking(
                    booking,
                    targetEnum,
                    cleanerUser,
                    transitionNote
            );
        }
    }

    /**
     * Chuyển Assignment thành DTO trả về Frontend.
     */
    private CleanerAssignmentResponse mapToResponse(
            BookingAssignment assignment
    ) {

        BookingResponse bookingResponse =
                bookingStateEngine.mapToBookingResponse(
                        assignment.getBooking()
                );

        Employee employee = assignment.getEmployee();

        User employeeUser =
                employee != null ? employee.getUser() : null;

        return CleanerAssignmentResponse.builder()
                .assignmentId(assignment.getId())
                .assignmentStatus(assignment.getStatus())
                .assignedAt(assignment.getAssignedAt())
                .acceptedAt(assignment.getAcceptedAt())
                .startedAt(assignment.getStartedAt())
                .completedAt(assignment.getCompletedAt())
                .assignmentNote(assignment.getNote())
                .employeeId(employee != null ? employee.getId() : null)
                .employeeCode(
                        employee != null ? employee.getEmployeeCode() : null
                )
                .employeeName(
                        employeeUser != null
                                ? employeeUser.getFullName()
                                : null
                )
                .employeePhone(
                        employeeUser != null
                                ? employeeUser.getPhone()
                                : null
                )
                .booking(bookingResponse)
                .build();
    }

    /**
     * Tìm tài khoản Cleaner theo email đăng nhập.
     */
    private User getUserByEmail(String email) {

        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Người dùng chưa xác thực."
            );
        }

        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Tài khoản không tồn tại hoặc chưa xác thực."
                ));
    }

    /**
     * Kiểm tra vai trò Cleaner.
     */
    private boolean isCleanerRole(String role) {

        if (role == null) {
            return false;
        }

        String normalized = normalizeStatus(role);

        return normalized.equals("CLEANER")
                || normalized.equals("ROLE_CLEANER")
                || normalized.equals("EMPLOYEE")
                || normalized.equals("ROLE_EMPLOYEE");
    }

    /**
     * Chuẩn hóa chuỗi trạng thái.
     */
    private String normalizeStatus(String value) {

        return value == null
                ? ""
                : value.trim().toUpperCase(Locale.ROOT);
    }

    /**
     * Tạo lỗi khi Assignment không thể chuyển trạng thái.
     */
    private ResponseStatusException invalidAssignmentTransition(
            String currentStatus,
            String action
    ) {

        return new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Không thể thực hiện hành động "
                        + action
                        + " khi Assignment đang ở trạng thái "
                        + currentStatus
                        + "."
        );
    }
}
