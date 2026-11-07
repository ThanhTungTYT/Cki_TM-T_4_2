package org.ckitmdt.backend.controller.auth;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.AccountStatusHistory;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.AccountStatusHistoryRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.ckitmdt.backend.service.admin.AdminAuditLogService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/accounts")
@RequiredArgsConstructor
public class AdminAccountController {

    private final UserRepository userRepository;
    private final AccountStatusHistoryRepository historyRepository;
    private final PasswordEncoder passwordEncoder;
    private final AdminAuditLogService auditLogService;

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_TIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
    private static final List<String> ALLOWED_ROLES = List.of("CUSTOMER", "PROVIDER", "CLEANER", "STAFF", "ADMIN");
    private static final List<String> CREATABLE_ROLES = List.of("CUSTOMER", "PROVIDER", "CLEANER", "STAFF");

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getAccounts(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status
    ) {
        String searchKeyword = normalize(keyword);
        String searchRole = normalize(role);
        String searchStatus = normalize(status);

        if (!searchRole.isEmpty() && !ALLOWED_ROLES.contains(searchRole)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vai trò không hợp lệ.");
        }

        if (!searchStatus.isEmpty() && !List.of("ACTIVE", "LOCKED").contains(searchStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái chỉ được là ACTIVE hoặc LOCKED.");
        }

        List<Map<String, Object>> accounts = userRepository.findAll().stream()
                .filter(user -> searchKeyword.isEmpty()
                        || contains(user.getFullName(), searchKeyword)
                        || contains(user.getEmail(), searchKeyword)
                        || contains(user.getPhone(), searchKeyword))
                .filter(user -> searchRole.isEmpty() || searchRole.equals(normalize(user.getRole())))
                .filter(user -> searchStatus.isEmpty() || searchStatus.equals(normalize(user.getStatus())))
                .sorted(Comparator.comparing(User::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toAccountResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(accounts);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Map<String, Object>> createAccount(
            @RequestBody Map<String, String> request,
            Authentication authentication
    ) {
        requireActor(authentication);

        String name = trim(request.get("name"));
        String email = trim(request.get("email"));
        String phone = trim(request.get("phone"));
        String password = request.get("password");
        String role = normalize(request.get("role"));
        String status = normalize(request.get("status"));

        if (name.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập họ và tên.");
        }

        validateEmail(email);

        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email này đã được sử dụng.");
        }

        if (password == null || password.length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mật khẩu phải có ít nhất 8 ký tự.");
        }

        validateRole(role);

        if (!CREATABLE_ROLES.contains(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không được tạo tài khoản ADMIN từ chức năng quản lý tài khoản thông thường.");
        }

        if (status.isEmpty()) {
            status = "ACTIVE";
        }

        if (!"ACTIVE".equals(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tài khoản mới phải ở trạng thái ACTIVE. Hãy tạo tài khoản rồi thực hiện khóa kèm lý do nếu cần.");
        }

        User user = new User();
        user.setFullName(name);
        user.setEmail(email);
        user.setPhone(phone.isEmpty() ? null : phone);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole(role);
        user.setStatus("ACTIVE");
        user.setEmailVerified(false);

        User savedUser = userRepository.save(user);

        auditLogService.record(
                authentication,
                "ACCOUNT_CREATED",
                "USER",
                savedUser.getId(),
                "Tạo tài khoản " + role + ".",
                null,
                accountAuditValue(savedUser)
        );

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Tạo tài khoản thành công.");
        response.put("account", toAccountResponse(savedUser));

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<Map<String, Object>> updateAccount(
            @PathVariable Long id,
            @RequestBody Map<String, String> request,
            Authentication authentication
    ) {
        requireActor(authentication);

        User user = findUser(id);
        String beforeValue = accountAuditValue(user);

        String name = trim(request.get("name"));
        String email = trim(request.get("email"));
        String phone = trim(request.get("phone"));

        if (name.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập họ và tên.");
        }

        validateEmail(email);

        userRepository.findByEmail(email).filter(existing -> !existing.getId().equals(id)).ifPresent(existing -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email này đã được sử dụng.");
        });

        String role = normalize(request.get("role"));

        if (!role.isEmpty() && !role.equals(normalize(user.getRole()))) {
            validateRole(role);

            if ("ADMIN".equals(role)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không thể nâng tài khoản thành ADMIN từ chức năng quản lý tài khoản thông thường.");
            }

            if ("ADMIN".equals(normalize(user.getRole()))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không thể thay đổi vai trò tài khoản Admin tại đây.");
            }

            user.setRole(role);
        }

        if (request.containsKey("status")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hãy sử dụng chức năng khóa/mở khóa để thay đổi trạng thái và ghi nhận lý do.");
        }

        String password = request.get("password");

        if (password != null && !password.isBlank()) {
            if (password.length() < 8) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mật khẩu mới phải có ít nhất 8 ký tự.");
            }

            user.setPasswordHash(passwordEncoder.encode(password));
        }

        user.setFullName(name);
        user.setEmail(email);
        user.setPhone(phone.isEmpty() ? null : phone);

        User savedUser = userRepository.save(user);
        String afterValue = accountAuditValue(savedUser);

        if (!beforeValue.equals(afterValue) || (password != null && !password.isBlank())) {
            auditLogService.record(
                    authentication,
                    "ACCOUNT_UPDATED",
                    "USER",
                    savedUser.getId(),
                    "Cập nhật thông tin tài khoản.",
                    beforeValue,
                    afterValue + (password != null && !password.isBlank() ? ";passwordChanged=true" : "")
            );
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Cập nhật tài khoản thành công.");
        response.put("account", toAccountResponse(savedUser));

        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}/status")
    @Transactional
    public ResponseEntity<Map<String, Object>> updateAccountStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> request,
            Authentication authentication
    ) {
        requireActor(authentication);

        User user = findUser(id);

        String requestedStatus = normalize(request.get("status"));
        String reason = trim(request.get("reason"));

        if (!List.of("ACTIVE", "LOCKED").contains(requestedStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trạng thái chỉ được là ACTIVE hoặc LOCKED.");
        }

        if (reason.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập lý do thay đổi trạng thái tài khoản.");
        }

        if (reason.length() > 2000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lý do không được vượt quá 2000 ký tự.");
        }

        if ("ADMIN".equals(normalize(user.getRole()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không thể thay đổi trạng thái tài khoản Admin.");
        }

        String oldStatus = normalize(user.getStatus());

        if (oldStatus.equals(requestedStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tài khoản đã ở trạng thái được chọn.");
        }

        user.setStatus(requestedStatus);
        User savedUser = userRepository.save(user);

        historyRepository.save(AccountStatusHistory.builder()
                .account(savedUser)
                .oldStatus(oldStatus)
                .newStatus(requestedStatus)
                .reason(reason)
                .changedByEmail(authentication.getName())
                .build());

        auditLogService.record(
                authentication,
                "ACCOUNT_STATUS_CHANGED",
                "USER",
                savedUser.getId(),
                reason,
                "status=" + oldStatus,
                "status=" + requestedStatus
        );

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Cập nhật trạng thái tài khoản thành công.");
        response.put("account", toAccountResponse(savedUser));

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/history")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getStatusHistory(@PathVariable Long id) {
        findUser(id);

        List<Map<String, Object>> history = historyRepository.findByAccountIdOrderByChangedAtDesc(id).stream()
                .map(item -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", item.getId());
                    row.put("oldStatus", item.getOldStatus());
                    row.put("newStatus", item.getNewStatus());
                    row.put("reason", item.getReason());
                    row.put("changedBy", item.getChangedByEmail());
                    row.put("changedAt", item.getChangedAt() == null ? "" : item.getChangedAt().format(DATE_TIME_FORMAT));
                    return row;
                }).collect(Collectors.toList());

        return ResponseEntity.ok(history);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteAccount(@PathVariable Long id) {
        findUser(id);

        throw new ResponseStatusException(HttpStatus.CONFLICT, "Hệ thống không xóa cứng tài khoản để bảo toàn lịch sử giao dịch. Hãy sử dụng chức năng khóa tài khoản.");
    }

    private User findUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tài khoản."));
    }

    private void requireActor(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Không xác định được người thực hiện.");
        }
    }

    private String accountAuditValue(User user) {
        return "name=" + safe(user.getFullName())
                + ";email=" + safe(user.getEmail())
                + ";phone=" + safe(user.getPhone())
                + ";role=" + normalize(user.getRole())
                + ";status=" + normalize(user.getStatus());
    }

    private String safe(String value) {
        return value == null ? "" : value.replace(";", ",");
    }

    private void validateEmail(String email) {
        if (email.isEmpty() || !email.matches("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email không hợp lệ.");
        }
    }

    private void validateRole(String role) {
        if (!ALLOWED_ROLES.contains(role)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vai trò không hợp lệ.");
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean contains(String value, String keyword) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(keyword.toLowerCase(Locale.ROOT));
    }

    private Map<String, Object> toAccountResponse(User user) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", user.getId());
        response.put("name", user.getFullName());
        response.put("email", user.getEmail());
        response.put("phone", user.getPhone());
        response.put("role", normalizeRole(user.getRole()));
        response.put("status", normalizeStatus(user.getStatus()));
        response.put("joinedAt", user.getCreatedAt() == null ? "" : user.getCreatedAt().format(DATE_FORMAT));
        return response;
    }

    private String normalizeRole(String role) {
        if (role == null) return "Customer";

        return switch (role.toUpperCase(Locale.ROOT)) {
            case "CUSTOMER" -> "Customer";
            case "PROVIDER" -> "Provider";
            case "CLEANER" -> "Cleaner";
            case "STAFF" -> "Staff";
            case "ADMIN" -> "Admin";
            default -> role;
        };
    }

    private String normalizeStatus(String status) {
        if ("ACTIVE".equalsIgnoreCase(status)) return "active";
        if ("LOCKED".equalsIgnoreCase(status)) return "locked";
        return "unknown";
    }
}