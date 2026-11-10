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

    private final BookingAssignmentRepository assignmentRepository;
    private final BookingRepository bookingRepository;
    private final BookingStatusHistoryRepository bookingStatusHistoryRepository;
    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final BookingStateEngine bookingStateEngine;
    private final AdminNotificationRepository adminNotificationRepository;
    private final BookingItemRepository bookingItemRepository;

    /**
     * Cleaner thực hiện hành động trên một Assignment cụ thể.
     *
     * Các action được hỗ trợ:
     * ACCEPT
     * DECLINE
     * START_JOB
     * SUBMIT_COMPLETION
     *
     * Luồng thực hiện:
     * ASSIGNED -> ACCEPTED -> IN_PROGRESS -> WORK_SUBMITTED
     *
     * Cleaner có thể từ chối:
     * ASSIGNED -> DECLINED
     * ACCEPTED -> DECLINED
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

        // 2. Tìm hồ sơ Employee tương ứng với tài khoản Cleaner
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

        // Khóa Booking trước để hạn chế cập nhật đồng thời.
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy đơn hàng."
                ));

        // Sau đó khóa Assignment.
        BookingAssignment assignment =
                assignmentRepository.findByIdForUpdate(assignmentId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Phân công không còn tồn tại."
                        ));

        // 4. Kiểm tra Assignment có thuộc về Cleaner đăng nhập không
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

        // 5. Kiểm tra tính nhất quán giữa Employee, Assignment và Booking.
        // Cleaner chỉ được thực hiện công việc thuộc đúng Provider của mình.
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

        // Kiểm tra trạng thái Booking có cho phép thao tác không.
        validateBookingStatus(
                currentBookingStatus,
                normalizedAction
        );

        LocalDateTime now = LocalDateTime.now();

        // 7. Xác định trạng thái Assignment tiếp theo
        String nextAssignmentStatus = determineNextAssignmentStatus(
                currentAssignmentStatus,
                normalizedAction
        );

        String oldAssignmentStatus = assignment.getStatus();

        assignment.setStatus(nextAssignmentStatus);

        // 8. Cập nhật thời gian và ghi chú theo hành động
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

            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Hành động không được hỗ trợ."
            );
        }

        assignmentRepository.saveAndFlush(assignment);

        // 9. Đồng bộ trạng thái Booking từ tiến độ các Assignment
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

        // 10. Trả về Assignment kèm Booking mới nhất
        return mapToResponse(assignment);
    }

    /**
     * Xác định trạng thái Assignment tiếp theo.
     */
    private String determineNextAssignmentStatus(
            String currentStatus,
            String action
    ) {

        return switch (action) {

            // Cleaner nhận công việc
            case "ACCEPT" -> {
                if (!"ASSIGNED".equals(currentStatus)) {
                    throw invalidAssignmentTransition(
                            currentStatus,
                            action
                    );
                }

                yield "ACCEPTED";
            }

            // Cleaner từ chối công việc
            case "DECLINE" -> {
                if (!"ASSIGNED".equals(currentStatus)
                        && !"ACCEPTED".equals(currentStatus)) {

                    throw invalidAssignmentTransition(
                            currentStatus,
                            action
                    );
                }

                yield "DECLINED";
            }

            // Cleaner bắt đầu thực hiện công việc.
            // Bắt buộc phải nhận việc trước.
            case "START_JOB" -> {
                if (!"ACCEPTED".equals(currentStatus)) {
                    throw invalidAssignmentTransition(
                            currentStatus,
                            action
                    );
                }

                yield "IN_PROGRESS";
            }

            // Cleaner gửi yêu cầu xác nhận hoàn thành
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
     * Đồng bộ trạng thái Booking từ tiến độ của các Assignment.
     *
     * Lưu ý:
     * - Không còn xử lý START_TRAVEL.
     * - Không tự động chuyển Booking sang EN_ROUTE.
     * - Booking chỉ chuyển IN_PROGRESS khi Cleaner bắt đầu làm.
     * - Booking chuyển PENDING_COMPLETION khi tất cả Assignment
     *   đang hoạt động đã báo hoàn thành.
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

            // Cleaner bắt đầu làm việc
            case "START_JOB" -> {
                if ("ASSIGNED".equals(oldBookingStatus)
                        || "EN_ROUTE".equals(oldBookingStatus)) {

                    nextBookingStatus = "IN_PROGRESS";
                }
            }

            // Tất cả Cleaner đã báo hoàn thành
            case "SUBMIT_COMPLETION" -> {

                List<BookingAssignment> assignments =
                        assignmentRepository.findByBooking_IdOrderByIdAsc(
                                booking.getId()
                        );

                // Bỏ qua các Assignment đã từ chối hoặc bị hủy.
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

                    // Thông báo cho Provider khi toàn bộ Cleaner đã báo hoàn thành.
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

            // Cleaner từ chối phân công
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

                // Nếu thiếu nhân viên, đưa Booking về CONFIRMED
                // để Provider có thể phân công lại.
                if (remainingActive < requiredEmployees
                        && (
                        "ASSIGNED".equals(oldBookingStatus)
                                || "EN_ROUTE".equals(oldBookingStatus)
                )) {

                    nextBookingStatus = "CONFIRMED";
                }

                // Gửi thông báo cho nhà cung cấp
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
                // ACCEPT không làm thay đổi trạng thái Booking chung.
            }
        }

        // Chỉ cập nhật Booking nếu trạng thái thực sự thay đổi.
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