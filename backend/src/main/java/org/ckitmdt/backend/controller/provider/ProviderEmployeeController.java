package org.ckitmdt.backend.controller.provider;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.BookingAssignment;
import org.ckitmdt.backend.entity.Employee;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.BookingAssignmentRepository;
import org.ckitmdt.backend.repository.EmployeeRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.ckitmdt.backend.controller.provider.ProviderSecurityHelper.normalize;
import static org.ckitmdt.backend.controller.provider.ProviderSecurityHelper.text;

@RestController
@RequestMapping("/api/provider/employees")
@RequiredArgsConstructor
public class ProviderEmployeeController {

    private final ProviderSecurityHelper helper;
    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final BookingAssignmentRepository assignmentRepository;
    private final PasswordEncoder passwordEncoder;

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,6}$");
    private static final Pattern PHONE_PATTERN =
            Pattern.compile("^(0|\\+84)[0-9]{9,10}$");

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getEmployees(Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        return employeeRepository.findByPartner_IdOrderByIdAsc(partner.getId())
                .stream()
                .map(this::employeeRow)
                .toList();
    }

    @PostMapping
    @Transactional
    public Map<String, Object> createEmployee(
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        Partner partner = helper.currentPartner(auth);

        String fullName = text(body.get("fullName"));
        if (fullName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Họ tên nhân viên không được để trống.");
        }

        String email = text(body.get("email"));
        if (email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email nhân viên không được để trống.");
        }

        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Định dạng email không hợp lệ.");
        }

        if (userRepository.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email đã được sử dụng.");
        }

        String phone = text(body.get("phone"));
        if (!phone.isBlank() && !PHONE_PATTERN.matcher(phone).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Số điện thoại không đúng định dạng (cần 10 số, bắt đầu bằng 0 hoặc +84).");
        }

        String rawPassword = text(body.get("password"));
        if (rawPassword.isBlank()) {
            rawPassword = "Cleanmate@" + (1000 + new Random().nextInt(9000));
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

        // Tạo mã nhân viên tự động không trùng lặp
        String empCode;
        do {
            empCode = "EMP-" + partner.getId() + "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase(Locale.ROOT);
        } while (employeeRepository.existsByEmployeeCode(empCode));

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

    @PutMapping("/{id}")
    @Transactional
    public Map<String, Object> updateEmployee(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        Partner partner = helper.currentPartner(auth);
        Employee employee = helper.ownedEmployee(id, partner);
        User user = employee.getUser();

        String fullName = text(body.get("fullName"));
        if (!fullName.isBlank()) {
            user.setFullName(fullName);
        }

        String phone = text(body.get("phone"));
        if (!phone.isBlank()) {
            if (!PHONE_PATTERN.matcher(phone).matches()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Số điện thoại không đúng định dạng (cần 10 số, bắt đầu bằng 0 hoặc +84).");
            }
            user.setPhone(phone);
        }

        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        employee.setUpdatedAt(LocalDateTime.now());
        return employeeRow(employeeRepository.save(employee));
    }

    @PostMapping("/{id}/reset-password")
    @Transactional
    public Map<String, Object> resetEmployeePassword(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> body,
            Authentication auth) {

        Partner partner = helper.currentPartner(auth);
        Employee employee = helper.ownedEmployee(id, partner);
        User user = employee.getUser();

        String newPassword = body != null ? text(body.get("newPassword")) : "";
        if (newPassword.isBlank()) {
            newPassword = "Cleanmate@" + (1000 + new Random().nextInt(9000));
        } else if (newPassword.length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mật khẩu mới phải có ít nhất 6 ký tự.");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("success", true);
        res.put("message", "Đặt lại mật khẩu thành công.");
        res.put("employeeCode", employee.getEmployeeCode());
        res.put("temporaryPassword", newPassword);
        return res;
    }

    @PatchMapping("/{id}/status")
    @Transactional
    public Map<String, Object> updateEmployeeStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        Partner partner = helper.currentPartner(auth);
        Employee employee = helper.ownedEmployee(id, partner);

        String status = normalize(text(body.get("status")));
        if (!Set.of("ACTIVE", "INACTIVE", "ON_LEAVE").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Trạng thái không hợp lệ. Cho phép: ACTIVE, INACTIVE, ON_LEAVE.");
        }

        // BUG-03: Kiểm tra an toàn khi chuyển sang INACTIVE hoặc ON_LEAVE
        if (!"ACTIVE".equals(status)) {
            List<BookingAssignment> activeAssignments = assignmentRepository.findActiveAssignmentsByEmployeeId(employee.getId());
            if (!activeAssignments.isEmpty()) {
                String bookingCodes = activeAssignments.stream()
                        .map(a -> a.getBooking() != null ? a.getBooking().getBookingCode() : "#" + a.getId())
                        .filter(Objects::nonNull)
                        .limit(3)
                        .collect(Collectors.joining(", "));
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Không thể chuyển nhân viên sang trạng thái " + status + " do nhân viên đang phụ trách công việc chưa hoàn thành (Đơn hàng: " + bookingCodes + "). Vui lòng hoàn thành công việc hoặc đổi nhân viên khác trước.");
            }
        }

        employee.setStatus(status);
        employee.setUpdatedAt(LocalDateTime.now());
        return employeeRow(employeeRepository.save(employee));
    }

    public Map<String, Object> employeeRow(Employee e) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", e.getId());
        row.put("employeeCode", e.getEmployeeCode());
        row.put("status", e.getStatus());
        row.put("ratingAverage", e.getRatingAverage());
        row.put("totalCompletedJobs", e.getTotalCompletedJobs());
        row.put("createdAt", e.getCreatedAt());
        row.put("updatedAt", e.getUpdatedAt());
        if (e.getUser() != null) {
            row.put("userId", e.getUser().getId());
            row.put("fullName", e.getUser().getFullName());
            row.put("email", e.getUser().getEmail());
            row.put("phone", e.getUser().getPhone());
        }
        return row;
    }
}
