
package org.ckitmdt.backend.controller.auth;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/accounts")
@RequiredArgsConstructor
public class AdminAccountController {

    private final UserRepository userRepository;

    private static final DateTimeFormatter DATE_FORMAT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy");

    // Lấy danh sách, tìm kiếm và lọc tài khoản
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAccounts(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status
    ) {
        String searchKeyword = keyword == null
                ? ""
                : keyword.trim().toLowerCase();

        String searchRole = role == null
                ? ""
                : role.trim();

        String searchStatus = status == null
                ? ""
                : status.trim();

        // Kiểm tra giá trị bộ lọc
        if (!searchRole.isEmpty()
                && !List.of(
                "CUSTOMER", "PROVIDER", "CLEANER",
                "STAFF", "ADMIN"
        ).contains(searchRole.toUpperCase())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vai trò không hợp lệ."
            );
        }

        if (!searchStatus.isEmpty()
                && !List.of("ACTIVE", "LOCKED")
                .contains(searchStatus.toUpperCase())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trạng thái chỉ được là ACTIVE hoặc LOCKED."
            );
        }

        List<Map<String, Object>> accounts = userRepository.findAll()
                .stream()
                // Tìm theo tên, email hoặc số điện thoại
                .filter(user -> searchKeyword.isEmpty()
                        || contains(user.getFullName(), searchKeyword)
                        || contains(user.getEmail(), searchKeyword)
                        || contains(user.getPhone(), searchKeyword))
                // Lọc theo vai trò
                .filter(user -> searchRole.isEmpty()
                        || searchRole.equalsIgnoreCase(user.getRole()))
                // Lọc theo trạng thái
                .filter(user -> searchStatus.isEmpty()
                        || searchStatus.equalsIgnoreCase(user.getStatus()))
                // Tài khoản mới nhất đứng trước
                .sorted(Comparator.comparing(
                        User::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))
                .map(this::toAccountResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(accounts);
    }

    // Kiểm tra chuỗi có chứa từ khóa hay không
    private boolean contains(String value, String keyword) {
        return value != null
                && value.toLowerCase().contains(keyword);
    }

    // Khóa hoặc mở khóa tài khoản
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

        String requestedStatus = request.get("status");

        if (requestedStatus == null
                || (!"ACTIVE".equalsIgnoreCase(requestedStatus)
                && !"LOCKED".equalsIgnoreCase(requestedStatus))) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trạng thái chỉ được là ACTIVE hoặc LOCKED."
            );
        }

        if ("ADMIN".equalsIgnoreCase(user.getRole())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Không thể khóa hoặc thay đổi trạng thái tài khoản quản trị viên."
            );
        }

        user.setStatus(requestedStatus.toUpperCase());
        User savedUser = userRepository.save(user);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put(
                "message",
                "Cập nhật trạng thái tài khoản thành công."
        );
        response.put("account", toAccountResponse(savedUser));

        return ResponseEntity.ok(response);
    }

    // Chuẩn hóa dữ liệu trả về cho frontend
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

        switch (role.toUpperCase()) {
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
