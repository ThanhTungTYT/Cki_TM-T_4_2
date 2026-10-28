
package org.ckitmdt.backend.controller.auth;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
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
    private final PasswordEncoder passwordEncoder;

    private static final DateTimeFormatter DATE_FORMAT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private static final List<String> ALLOWED_ROLES =
            List.of("CUSTOMER", "PROVIDER", "CLEANER", "STAFF", "ADMIN");

    private static final List<String> ALLOWED_STATUSES =
            List.of("ACTIVE", "LOCKED");

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAccounts(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status
    ) {
        String searchKeyword = normalize(keyword);
        String searchRole = normalize(role);
        String searchStatus = normalize(status);

        if (!searchRole.isEmpty()
                && !ALLOWED_ROLES.contains(searchRole)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vai trò không hợp lệ."
            );
        }

        if (!searchStatus.isEmpty()
                && !ALLOWED_STATUSES.contains(searchStatus)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trạng thái chỉ được là ACTIVE hoặc LOCKED."
            );
        }

        List<Map<String, Object>> accounts = userRepository.findAll()
                .stream()
                .filter(user ->
                        searchKeyword.isEmpty()
                                || contains(user.getFullName(), searchKeyword)
                                || contains(user.getEmail(), searchKeyword)
                                || contains(user.getPhone(), searchKeyword)
                )
                .filter(user ->
                        searchRole.isEmpty()
                                || searchRole.equals(normalize(user.getRole()))
                )
                .filter(user ->
                        searchStatus.isEmpty()
                                || searchStatus.equals(normalize(user.getStatus()))
                )
                .sorted(Comparator.comparing(
                        User::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))
                .map(this::toAccountResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(accounts);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createAccount(
            @RequestBody Map<String, String> request
    ) {
        String name = trim(request.get("name"));
        String email = trim(request.get("email"));
        String phone = trim(request.get("phone"));
        String password = request.get("password");
        String role = normalize(request.get("role"));
        String status = normalize(request.get("status"));

        if (name.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng nhập họ và tên."
            );
        }

        if (email.isEmpty() || !email.matches(
                "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
        )) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Email không hợp lệ."
            );
        }

        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Email này đã được sử dụng."
            );
        }

        if (password == null || password.length() < 8) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Mật khẩu phải có ít nhất 8 ký tự."
            );
        }

        validateRole(role);
        validateStatus(status);

        User user = new User();
        user.setFullName(name);
        user.setEmail(email);
        user.setPhone(phone.isEmpty() ? null : phone);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole(role);
        user.setStatus(status);
        user.setEmailVerified(false);

        User savedUser = userRepository.save(user);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Tạo tài khoản thành công.");
        response.put("account", toAccountResponse(savedUser));

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateAccount(
            @PathVariable Long id,
            @RequestBody Map<String, String> request
    ) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy tài khoản."
                ));

        String name = trim(request.get("name"));
        String email = trim(request.get("email"));
        String phone = trim(request.get("phone"));

        if (name.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng nhập họ và tên."
            );
        }

        if (email.isEmpty() || !email.matches(
                "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
        )) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Email không hợp lệ."
            );
        }

        userRepository.findByEmail(email)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Email này đã được sử dụng."
                    );
                });

        String role = normalize(request.get("role"));
        String status = normalize(request.get("status"));

        if (!role.isEmpty()) {
            validateRole(role);

            if ("ADMIN".equals(normalize(user.getRole()))
                    && !"ADMIN".equals(role)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Không thể đổi vai trò của tài khoản Admin tại đây."
                );
            }

            user.setRole(role);
        }

        if (!status.isEmpty()) {
            validateStatus(status);

            if ("ADMIN".equals(normalize(user.getRole()))) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Không thể đổi trạng thái tài khoản Admin."
                );
            }

            user.setStatus(status);
        }

        String password = request.get("password");

        if (password != null && !password.isBlank()) {
            if (password.length() < 8) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Mật khẩu mới phải có ít nhất 8 ký tự."
                );
            }

            user.setPasswordHash(passwordEncoder.encode(password));
        }

        user.setFullName(name);
        user.setEmail(email);
        user.setPhone(phone.isEmpty() ? null : phone);

        User savedUser = userRepository.save(user);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Cập nhật tài khoản thành công.");
        response.put("account", toAccountResponse(savedUser));

        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteAccount(
            @PathVariable Long id
    ) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy tài khoản."
                ));

        if ("ADMIN".equals(normalize(user.getRole()))) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Không thể xóa tài khoản Admin."
            );
        }

        try {
            userRepository.delete(user);
            userRepository.flush();
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Không thể xóa tài khoản vì đang có dữ liệu liên quan. "
                            + "Hãy khóa tài khoản thay vì xóa.",
                    ex
            );
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Xóa tài khoản thành công.");
        response.put("id", id);

        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<Map<String, Object>> updateAccountStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> request
    ) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy tài khoản."
                ));

        String requestedStatus = normalize(request.get("status"));

        validateStatus(requestedStatus);

        if ("ADMIN".equals(normalize(user.getRole()))) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Không thể thay đổi trạng thái tài khoản Admin."
            );
        }

        user.setStatus(requestedStatus);
        User savedUser = userRepository.save(user);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put(
                "message",
                "Cập nhật trạng thái tài khoản thành công."
        );
        response.put("account", toAccountResponse(savedUser));

        return ResponseEntity.ok(response);
    }

    private void validateRole(String role) {
        if (!ALLOWED_ROLES.contains(role)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vai trò không hợp lệ."
            );
        }
    }

    private void validateStatus(String status) {
        if (!ALLOWED_STATUSES.contains(status)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trạng thái chỉ được là ACTIVE hoặc LOCKED."
            );
        }
    }

    private String normalize(String value) {
        return value == null
                ? ""
                : value.trim().toUpperCase(Locale.ROOT);
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean contains(String value, String keyword) {
        return value != null
                && value.toLowerCase(Locale.ROOT).contains(keyword.toLowerCase(Locale.ROOT));
    }

    private Map<String, Object> toAccountResponse(User user) {
        Map<String, Object> response = new LinkedHashMap<>();

        response.put("id", user.getId());
        response.put("name", user.getFullName());
        response.put("email", user.getEmail());
        response.put("phone", user.getPhone());
        response.put("role", normalizeRole(user.getRole()));
        response.put("status", normalizeStatus(user.getStatus()));
        response.put(
                "joinedAt",
                user.getCreatedAt() == null
                        ? ""
                        : user.getCreatedAt().format(DATE_FORMAT)
        );

        return response;
    }

    private String normalizeRole(String role) {
        if (role == null) {
            return "Customer";
        }

        switch (role.toUpperCase(Locale.ROOT)) {
            case "CUSTOMER":
                return "Customer";
            case "PROVIDER":
                return "Provider";
            case "CLEANER":
                return "Cleaner";
            case "STAFF":
                return "Staff";
            case "ADMIN":
                return "Admin";
            default:
                return role;
        }
    }

    private String normalizeStatus(String status) {
        if ("ACTIVE".equalsIgnoreCase(status)) {
            return "active";
        }

        if ("LOCKED".equalsIgnoreCase(status)) {
            return "locked";
        }

        return "unknown";
    }
}
