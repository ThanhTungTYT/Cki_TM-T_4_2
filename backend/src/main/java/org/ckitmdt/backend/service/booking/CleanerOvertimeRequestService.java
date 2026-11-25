
package org.ckitmdt.backend.service.booking;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.AdminNotification;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.BookingAssignment;
import org.ckitmdt.backend.entity.CleanerOvertimeRequest;
import org.ckitmdt.backend.entity.Employee;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.AdminNotificationRepository;
import org.ckitmdt.backend.repository.BookingAssignmentRepository;
import org.ckitmdt.backend.repository.CleanerOvertimeRequestRepository;
import org.ckitmdt.backend.repository.EmployeeRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CleanerOvertimeRequestService {

    private final CleanerOvertimeRequestRepository overtimeRepository;
    private final BookingAssignmentRepository assignmentRepository;
    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final AdminNotificationRepository notificationRepository;

    /**
     * Cleaner gửi yêu cầu gia hạn thời gian làm việc.
     *
     * Chỉ cho phép:
     * - Tài khoản Cleaner đang hoạt động.
     * - Assignment thuộc chính Cleaner.
     * - Employee và Assignment thuộc cùng Provider.
     * - Booking và Assignment thuộc cùng Provider.
     * - Assignment đang IN_PROGRESS.
     * - Không có yêu cầu PENDING khác trên Assignment.
     */
    @Transactional
    public Map<String, Object> createRequest(
            Long assignmentId,
            String reason,
            Integer requestedAdditionalMinutes,
            String userEmail
    ) {
        // 1. Kiểm tra tài khoản Cleaner.
        User cleaner = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Không tìm thấy tài khoản đăng nhập."
                ));

        String role = cleaner.getRole() == null
                ? ""
                : cleaner.getRole().trim().toUpperCase(Locale.ROOT);
        if (role.startsWith("ROLE_")) {
            role = role.substring(5);
        }

        if (!Set.of("CLEANER", "EMPLOYEE").contains(role)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Chỉ Cleaner mới được gửi yêu cầu gia hạn."
            );
        }

        if (!"ACTIVE".equalsIgnoreCase(cleaner.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Tài khoản Cleaner hiện không hoạt động."
            );
        }

        // 2. Kiểm tra hồ sơ Employee.
        Employee employee = employeeRepository.findByUser_Id(cleaner.getId())
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

        if (employee.getPartner() == null
                || !"ACTIVE".equalsIgnoreCase(employee.getPartner().getStatus())
                || employee.getPartner().getUser() == null
                || !"ACTIVE".equalsIgnoreCase(employee.getPartner().getUser().getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Đơn vị nhà cung cấp hiện không hoạt động hoặc đang bị khóa."
            );
        }

        // 3. Khóa Assignment để hạn chế gửi yêu cầu đồng thời.
        BookingAssignment assignment = assignmentRepository
                .findByIdForUpdate(assignmentId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy phân công công việc."
                ));

        // 4. Kiểm tra quyền sở hữu Assignment.
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

        Booking booking = assignment.getBooking();

        if (booking == null || assignment.getPartner() == null
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
                    "Thông tin Booking, Assignment và Provider không đồng nhất."
            );
        }

        // 5. Chỉ được yêu cầu gia hạn khi cả phân công và đơn hàng đang thực hiện.
        if (!"IN_PROGRESS".equalsIgnoreCase(assignment.getStatus())
                || !"IN_PROGRESS".equalsIgnoreCase(booking.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Chỉ được yêu cầu gia hạn khi công việc và đơn hàng đang ở trạng thái thực hiện (IN_PROGRESS)."
            );
        }

        // 6. Kiểm tra nội dung yêu cầu.
        if (reason == null || reason.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng nhập lý do cần gia hạn."
            );
        }

        String cleanReason = reason.trim();

        if (cleanReason.length() > 2000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Lý do không được vượt quá 2000 ký tự."
            );
        }

        if (requestedAdditionalMinutes == null
                || requestedAdditionalMinutes < 1
                || requestedAdditionalMinutes > 480) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thời gian gia hạn phải từ 1 đến 480 phút."
            );
        }

        if (booking.getScheduledEnd() == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Đơn hàng chưa có thời gian kết thúc dự kiến."
            );
        }

        // 7. Không cho gửi yêu cầu PENDING trùng lặp.
        boolean hasPendingRequest = overtimeRepository
                .existsByAssignment_IdAndStatusIgnoreCase(
                        assignmentId,
                        "PENDING"
                );

        if (hasPendingRequest) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Bạn đã có yêu cầu gia hạn đang chờ Provider xem xét."
            );
        }

        // 8. Tạo yêu cầu.
        LocalDateTime now = LocalDateTime.now();

        CleanerOvertimeRequest request = new CleanerOvertimeRequest();
        request.setAssignment(assignment);
        request.setBooking(booking);
        request.setPartner(assignment.getPartner());
        request.setCleaner(cleaner);
        request.setReason(cleanReason);
        request.setRequestedAdditionalMinutes(requestedAdditionalMinutes);
        request.setOriginalScheduledEnd(booking.getScheduledEnd());
        request.setStatus("PENDING");
        request.setCreatedAt(now);

        CleanerOvertimeRequest saved = overtimeRepository.save(request);

        // 9. Thông báo cho Provider.
        User providerUser = assignment.getPartner().getUser();

        if (providerUser != null) {
            String bookingCode = booking.getBookingCode() != null
                    ? booking.getBookingCode()
                    : String.valueOf(booking.getId());

            notificationRepository.save(AdminNotification.builder()
                    .recipient(providerUser)
                    .type("CLEANER_OVERTIME_REQUEST")
                    .title("Nhân viên yêu cầu gia hạn")
                    .message(
                            "Nhân viên " + cleaner.getFullName()
                                    + " yêu cầu gia hạn thêm "
                                    + requestedAdditionalMinutes
                                    + " phút cho đơn hàng "
                                    + bookingCode
                                    + ". Vui lòng mở chi tiết đơn hàng để duyệt hoặc từ chối."
                    )
                    .referenceType("BOOKING")
                    .referenceId(booking.getId())
                    .createdAt(now)
                    .build());
        }

        // 10. Trả dữ liệu đơn giản cho Frontend.
        Map<String, Object> response = toRow(saved);
        response.put(
                "message",
                "Yêu cầu gia hạn đã được gửi đến Provider."
        );

        return response;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getRequestsForAssignment(
            Long assignmentId,
            String userEmail
    ) {
        User cleaner = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Không tìm thấy tài khoản đăng nhập."
                ));

        Employee employee = employeeRepository.findByUser_Id(cleaner.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy hồ sơ nhân viên."
                ));

        BookingAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy phân công công việc."
                ));

        if (assignment.getEmployee() == null
                || !Objects.equals(assignment.getEmployee().getId(), employee.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền xem yêu cầu gia hạn của phân công này."
            );
        }

        return overtimeRepository.findByAssignment_IdOrderByCreatedAtDesc(assignmentId)
                .stream()
                .map(this::toRow)
                .toList();
    }

    private Map<String, Object> toRow(CleanerOvertimeRequest item) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", item.getId());
        row.put("assignmentId", item.getAssignment() != null ? item.getAssignment().getId() : null);
        row.put("bookingId", item.getBooking() != null ? item.getBooking().getId() : null);
        row.put("reason", item.getReason());
        row.put("requestedAdditionalMinutes", item.getRequestedAdditionalMinutes());
        row.put("originalScheduledEnd", item.getOriginalScheduledEnd());
        row.put("status", item.getStatus());
        row.put("providerNote", item.getProviderNote());
        row.put("reviewedBy", item.getReviewedBy() != null ? item.getReviewedBy().getFullName() : null);
        row.put("createdAt", item.getCreatedAt());
        row.put("reviewedAt", item.getReviewedAt());
        return row;
    }
}
