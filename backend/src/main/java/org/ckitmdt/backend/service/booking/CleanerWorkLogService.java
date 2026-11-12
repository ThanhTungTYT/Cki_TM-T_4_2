
package org.ckitmdt.backend.service.booking;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.BookingAssignment;
import org.ckitmdt.backend.entity.CleanerWorkLog;
import org.ckitmdt.backend.entity.Employee;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.BookingAssignmentRepository;
import org.ckitmdt.backend.repository.CleanerWorkLogRepository;
import org.ckitmdt.backend.repository.EmployeeRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class CleanerWorkLogService {

    private final CleanerWorkLogRepository workLogRepository;
    private final BookingAssignmentRepository assignmentRepository;
    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;

    private static final List<String> LOG_TYPES =
            List.of("PROGRESS", "INCIDENT");

    private static final List<String> INCIDENT_SEVERITIES =
            List.of("LOW", "MEDIUM", "HIGH", "CRITICAL");

    private static final List<String> INCIDENT_CATEGORIES =
            List.of(
                    "PROPERTY_DAMAGE",
                    "MISSING_EQUIPMENT",
                    "SAFETY",
                    "CUSTOMER_ISSUE",
                    "SERVICE_PROBLEM",
                    "OTHER"
            );

    /**
     * Cleaner tạo nhật ký tiến độ hoặc báo cáo sự cố.
     */
    @Transactional
    public Map<String, Object> createLog(
            Long assignmentId,
            Map<String, Object> body,
            String userEmail
    ) {
        if (body == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Dữ liệu nhật ký không hợp lệ."
            );
        }

        User cleaner = getCurrentCleaner(userEmail);
        Employee employee = getEmployee(cleaner);

        BookingAssignment assignment =
                assignmentRepository.findByIdForUpdate(assignmentId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Không tìm thấy phân công công việc."
                        ));

        if (!isValidAssignmentForEmployee(assignment, employee)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền cập nhật công việc này."
            );
        }

        Booking booking = assignment.getBooking();

        validateProviderRelationship(assignment, employee, booking);

        String assignmentStatus = normalize(assignment.getStatus());

        if (!List.of("ACCEPTED", "IN_PROGRESS").contains(assignmentStatus)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Chỉ có thể cập nhật nhật ký khi đã nhận việc và chưa kết thúc công việc."
            );
        }

        String logType = normalize(text(
                body.containsKey("logType") ? body.get("logType") : body.get("type")
        ));

        if (!LOG_TYPES.contains(logType)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Loại nhật ký chỉ được là PROGRESS hoặc INCIDENT."
            );
        }

        String note = text(body.get("note"));

        if (note.isBlank() || note.length() > 5000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Nội dung không được để trống và không vượt quá 5000 ký tự."
            );
        }

        List<String> imageUrls = readImageUrls(body.get("imageUrls"));

        if (imageUrls.size() > 5) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Mỗi lần cập nhật chỉ được gửi tối đa 5 ảnh."
            );
        }

        String severity = null;
        String category = null;
        String incidentStatus = null;

        if ("INCIDENT".equals(logType)) {
            severity = normalize(text(body.get("severity")));

            if (severity.isBlank()) {
                severity = "MEDIUM";
            }

            if (!INCIDENT_SEVERITIES.contains(severity)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Mức độ sự cố không hợp lệ."
                );
            }

            category = normalize(text(body.get("category")));

            if (category.isBlank()) {
                category = "OTHER";
            }

            if (!INCIDENT_CATEGORIES.contains(category)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Nhóm sự cố không hợp lệ."
                );
            }

            incidentStatus = "OPEN";
        }

        String storedImageUrls = String.join("\n", imageUrls);

        CleanerWorkLog workLog = CleanerWorkLog.builder()
                .assignment(assignment)
                .booking(booking)
                .cleaner(cleaner)
                .logType(logType)
                .note(note)
                .imageUrls(
                        storedImageUrls.isBlank()
                                ? null
                                : storedImageUrls
                )
                .incidentSeverity(severity)
                .incidentCategory(category)
                .incidentStatus(incidentStatus)
                .build();

        CleanerWorkLog saved = workLogRepository.save(workLog);

        return toResponse(saved);
    }

    /**
     * Cleaner xem nhật ký thuộc Assignment của chính mình.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getLogs(
            Long assignmentId,
            String userEmail
    ) {
        User cleaner = getCurrentCleaner(userEmail);
        Employee employee = getEmployee(cleaner);

        BookingAssignment assignment =
                assignmentRepository.findById(assignmentId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Không tìm thấy phân công công việc."
                        ));

        if (!isValidAssignmentForEmployee(assignment, employee)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền xem nhật ký công việc này."
            );
        }

        validateProviderRelationship(
                assignment,
                employee,
                assignment.getBooking()
        );

        return workLogRepository
                .findByAssignment_IdOrderByCreatedAtDesc(assignmentId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private User getCurrentCleaner(String email) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Người dùng chưa đăng nhập."
            );
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Không tìm thấy tài khoản."
                ));

        String role = normalize(user.getRole());

        if (!List.of(
                "CLEANER",
                "ROLE_CLEANER",
                "EMPLOYEE",
                "ROLE_EMPLOYEE"
        ).contains(role)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Tài khoản không có quyền Cleaner."
            );
        }

        if (!isActive(user.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Tài khoản hiện không hoạt động."
            );
        }

        return user;
    }

    private Employee getEmployee(User cleaner) {
        Employee employee = employeeRepository
                .findByUser_Id(cleaner.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy hồ sơ nhân viên."
                ));

        if (!isActive(employee.getStatus())
                || employee.getPartner() == null) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Hồ sơ nhân viên không hoạt động hoặc chưa thuộc nhà cung cấp."
            );
        }

        return employee;
    }

    private boolean isValidAssignmentForEmployee(
            BookingAssignment assignment,
            Employee employee
    ) {
        if (assignment == null
                || employee == null
                || assignment.getEmployee() == null
                || assignment.getPartner() == null
                || assignment.getBooking() == null
                || employee.getPartner() == null
                || assignment.getBooking().getPartner() == null
                || assignment.getPartner().getUser() == null) {
            return false;
        }

        return Objects.equals(
                assignment.getEmployee().getId(),
                employee.getId()
        )
                && Objects.equals(
                employee.getPartner().getId(),
                assignment.getPartner().getId()
        )
                && Objects.equals(
                assignment.getPartner().getId(),
                assignment.getBooking().getPartner().getId()
        )
                && isActive(assignment.getPartner().getStatus())
                && isActive(assignment.getPartner().getUser().getStatus());
    }

    private void validateProviderRelationship(
            BookingAssignment assignment,
            Employee employee,
            Booking booking
    ) {
        if (booking == null
                || assignment.getPartner() == null
                || employee.getPartner() == null
                || booking.getPartner() == null
                || !isActive(assignment.getPartner().getStatus())
                || assignment.getPartner().getUser() == null
                || !isActive(assignment.getPartner().getUser().getStatus())
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
                    "Thông tin nhà cung cấp của phân công không hợp lệ."
            );
        }
    }

    private List<String> readImageUrls(Object value) {
        if (value == null) {
            return List.of();
        }

        if (!(value instanceof List<?> rawList)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "imageUrls phải là một danh sách."
            );
        }

        return rawList.stream()
                .map(item -> {
                    if (!(item instanceof String url)) {
                        throw new ResponseStatusException(
                                HttpStatus.BAD_REQUEST,
                                "Đường dẫn ảnh không hợp lệ."
                        );
                    }

                    String trimmed = url.trim();

                    if (trimmed.length() > 1000
                            || !(trimmed.startsWith("https://")
                            || trimmed.startsWith("http://"))) {
                        throw new ResponseStatusException(
                                HttpStatus.BAD_REQUEST,
                                "Mỗi đường dẫn ảnh phải là URL HTTP hoặc HTTPS hợp lệ."
                        );
                    }

                    return trimmed;
                })
                .distinct()
                .toList();
    }

    private Map<String, Object> toResponse(CleanerWorkLog log) {
        List<String> imageUrls =
                log.getImageUrls() == null
                        || log.getImageUrls().isBlank()
                        ? List.of()
                        : log.getImageUrls()
                        .lines()
                        .filter(line -> !line.isBlank())
                        .toList();

        Map<String, Object> result = new LinkedHashMap<>();

        result.put("id", log.getId());
        result.put("assignmentId", log.getAssignment().getId());
        result.put("bookingId", log.getBooking().getId());
        result.put("bookingCode", log.getBooking().getBookingCode());
        result.put("cleanerId", log.getCleaner().getId());
        result.put("cleanerName", log.getCleaner().getFullName());
        result.put("logType", log.getLogType());
        result.put("type", log.getLogType());
        result.put("note", log.getNote());
        result.put("imageUrls", imageUrls);
        result.put("createdAt", log.getCreatedAt());

        result.put("severity", log.getIncidentSeverity());
        result.put("category", log.getIncidentCategory());
        result.put("incidentStatus", log.getIncidentStatus());

        return result;
    }

    private boolean isActive(String status) {
        return status != null
                && "ACTIVE".equalsIgnoreCase(status.trim());
    }

    private String text(Object value) {
        return value == null
                ? ""
                : String.valueOf(value).trim();
    }

    private String normalize(String value) {
        return value == null
                ? ""
                : value.trim().toUpperCase(Locale.ROOT);
    }
}
