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

@RestController
@RequestMapping("/api/admin/accounts")
@RequiredArgsConstructor
public class AdminAccountController {

    private final UserRepository userRepository;

    private static final DateTimeFormatter DATE_FORMAT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy");

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAccounts() {
        List<Map<String, Object>> accounts = userRepository.findAll()
                .stream()
                .sorted(Comparator.comparing(
                        User::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))
                .map(this::toAccountResponse)
                .toList();

        return ResponseEntity.ok(accounts);
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

        String requestedStatus = request.get("status");

        if (requestedStatus == null ||
                (!"ACTIVE".equalsIgnoreCase(requestedStatus) &&
                        !"LOCKED".equalsIgnoreCase(requestedStatus))) {
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
        response.put("message", "Cập nhật trạng thái tài khoản thành công.");
        response.put("account", toAccountResponse(savedUser));

        return ResponseEntity.ok(response);
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

        return switch (role.toUpperCase()) {
            case "CUSTOMER" -> "Customer";
            case "PROVIDER" -> "Provider";
            case "CLEANER" -> "Cleaner";
            case "STAFF" -> "Staff";
            case "ADMIN" -> "Admin";
            default -> role;
        };
    }

    private String normalizeStatus(String status) {
        if ("ACTIVE".equalsIgnoreCase(status)) {
            return "active";
        }

        return "locked";
    }
}
