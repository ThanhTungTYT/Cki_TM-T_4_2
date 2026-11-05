package org.ckitmdt.backend.service.booking;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.ckitmdt.backend.dto.booking.BookingResponse;
import org.ckitmdt.backend.dto.booking.CleanerAssignmentResponse;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.BookingAssignment;
import org.ckitmdt.backend.entity.BookingStatusHistory;
import org.ckitmdt.backend.entity.Employee;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.BookingAssignmentRepository;
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

    /**
     * Cleaner thực hiện hành động trên một Assignment cụ thể.
     *
     * Các action:
     * ACCEPT
     * DECLINE
     * START_TRAVEL
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

        // 3. Đọc Assignment ban đầu để lấy bookingId.
        // Sau đó khóa Booking trước, rồi khóa Assignment.
        BookingAssignment initialAssignment = assignmentRepository.findById(assignmentId)
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

        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy đơn hàng."
                ));

        BookingAssignment assignment = assignmentRepository.findByIdForUpdate(assignmentId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Phân công không còn tồn tại."
                ));

        // 4. Kiểm tra Assignment có đúng thuộc về Cleaner đăng nhập không
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

        // Kiểm tra tính nhất quán giữa Employee, Assignment và Booking
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

        // 5. Chuẩn hóa action
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

        String currentAssignmentStatus = normalizeStatus(assignment.getStatus());
        String currentBookingStatus = normalizeStatus(booking.getStatus());

        validateBookingStatus(currentBookingStatus, normalizedAction);

        LocalDateTime now = LocalDateTime.now();

        // 6. Xác định trạng thái Assignment tiếp theo
        String nextAssignmentStatus = determineNextAssignmentStatus(
                currentAssignmentStatus,
                normalizedAction
        );

        String oldAssignmentStatus = assignment.getStatus();

        assignment.setStatus(nextAssignmentStatus);

        switch (normalizedAction) {

            case "ACCEPT" -> assignment.setAcceptedAt(now);

            case "START_TRAVEL" -> {
                // Chỉ cập nhật trạng thái, chưa tính là bắt đầu làm.
            }

            case "START_JOB" -> assignment.setStartedAt(now);

            case "SUBMIT_COMPLETION" -> assignment.setCompletedAt(now);

            case "DECLINE" -> {
                // Không xóa Assignment.
                // Giữ bản ghi để Provider có thể xem và phân công người thay thế.
            }

            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Hành động không được hỗ trợ."
            );
        }

        assignmentRepository.saveAndFlush(assignment);

        // 7. Tổng hợp tiến độ Assignment để cập nhật Booking
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

        // 8. Trả về Assignment kèm Booking mới nhất
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

            case "ACCEPT" -> {
                if (!"ASSIGNED".equals(currentStatus)) {
                    throw invalidAssignmentTransition(currentStatus, action);
                }
                yield "ACCEPTED";
            }

            case "DECLINE" -> {
                if (!"ASSIGNED".equals(currentStatus)) {
                    throw invalidAssignmentTransition(currentStatus, action);
                }
                yield "DECLINED";
            }

            case "START_TRAVEL" -> {
                if (!"ACCEPTED".equals(currentStatus)) {
                    throw invalidAssignmentTransition(currentStatus, action);
                }
                yield "EN_ROUTE";
            }

            case "START_JOB" -> {
                if (!"ACCEPTED".equals(currentStatus)
                        && !"EN_ROUTE".equals(currentStatus)) {
                    throw invalidAssignmentTransition(currentStatus, action);
                }
                yield "IN_PROGRESS";
            }

            case "SUBMIT_COMPLETION" -> {
                if (!"IN_PROGRESS".equals(currentStatus)) {
                    throw invalidAssignmentTransition(currentStatus, action);
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

            case "START_TRAVEL", "START_JOB" ->
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
     * Một Cleaner nộp kết quả không đồng nghĩa toàn bộ Booking đã hoàn tất.
     */
    private void synchronizeBookingStatus(
            Booking booking,
            String action,
            User cleanerUser,
            String note,
            LocalDateTime now
    ) {

        String oldBookingStatus = normalizeStatus(booking.getStatus());
        String nextBookingStatus = oldBookingStatus;

        switch (action) {

            case "START_TRAVEL" -> {
                if ("ASSIGNED".equals(oldBookingStatus)) {
                    nextBookingStatus = "EN_ROUTE";
                }
            }

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

                // Bỏ qua các Assignment đã từ chối hoặc bị hủy.
                List<BookingAssignment> activeAssignments = assignments.stream()
                        .filter(a -> {
                            String status = normalizeStatus(a.getStatus());
                            return !"DECLINED".equals(status)
                                    && !"CANCELLED".equals(status);
                        })
                        .toList();

                boolean allSubmitted = !activeAssignments.isEmpty()
                        && activeAssignments.stream()
                        .allMatch(a ->
                                "WORK_SUBMITTED".equals(
                                        normalizeStatus(a.getStatus())
                                )
                        );

                if (allSubmitted && "IN_PROGRESS".equals(oldBookingStatus)) {
                    nextBookingStatus = "PENDING_COMPLETION";
                }
            }

            default -> {
                // ACCEPT và DECLINE không tự thay đổi trạng thái Booking.
            }
        }

        // Chỉ lưu lịch sử Booking khi trạng thái Booking thực sự thay đổi.
        if (!oldBookingStatus.equals(nextBookingStatus)) {

            booking.setStatus(nextBookingStatus);
            booking.setUpdatedAt(now);

            Booking savedBooking = bookingRepository.save(booking);

            bookingStatusHistoryRepository.save(
                    BookingStatusHistory.builder()
                            .booking(savedBooking)
                            .oldStatus(oldBookingStatus)
                            .newStatus(nextBookingStatus)
                            .changedBy(cleanerUser)
                            .note(
                                    note != null && !note.isBlank()
                                            ? note
                                            : "Cập nhật tiến độ từ hành động Cleaner: " + action
                            )
                            .createdAt(now)
                            .build()
            );

            log.info(
                    "Booking [{}] chuyển trạng thái {} -> {}",
                    booking.getBookingCode(),
                    oldBookingStatus,
                    nextBookingStatus
            );
        }
    }

    private CleanerAssignmentResponse mapToResponse(
            BookingAssignment assignment
    ) {

        BookingResponse bookingResponse =
                bookingStateEngine.mapToBookingResponse(
                        assignment.getBooking()
                );

        return CleanerAssignmentResponse.builder()
                .assignmentId(assignment.getId())
                .assignmentStatus(assignment.getStatus())
                .assignedAt(assignment.getAssignedAt())
                .acceptedAt(assignment.getAcceptedAt())
                .startedAt(assignment.getStartedAt())
                .completedAt(assignment.getCompletedAt())
                .assignmentNote(assignment.getNote())
                .booking(bookingResponse)
                .build();
    }

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

    private String normalizeStatus(String value) {

        return value == null
                ? ""
                : value.trim().toUpperCase(Locale.ROOT);
    }

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