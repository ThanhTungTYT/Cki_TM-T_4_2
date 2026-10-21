package org.ckitmdt.backend.controller.auth;

import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.service.auth.ForgotPasswordService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class ForgotPasswordController {

    private final ForgotPasswordService forgotPasswordService;

    public record ForgotPasswordRequest(String email) {}

    public record VerifyResetRequest(String temporaryPassword) {}

    public record ResetPasswordRequest(String newPassword) {}

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(
            @RequestBody ForgotPasswordRequest request,
            HttpSession session
    ) {
        if (request.email() == null || request.email().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Vui lòng nhập email"));
        }

        forgotPasswordService.forgotPassword(
                request.email(),
                session
        );

        return ResponseEntity.ok(Map.of(
                "message",
                "Nếu email đã đăng ký, hệ thống sẽ gửi mật khẩu tạm thời"
        ));
    }

    @PostMapping("/verify-reset-password")
    public ResponseEntity<?> verifyResetPassword(
            @RequestBody VerifyResetRequest request,
            HttpSession session
    ) {
        try {
            forgotPasswordService.verifyTemporaryPassword(
                    request.temporaryPassword(),
                    session
            );

            return ResponseEntity.ok(Map.of(
                    "message", "Xác thực thành công"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(
            @RequestBody ResetPasswordRequest request,
            HttpSession session
    ) {
        try {
            forgotPasswordService.resetPassword(
                    request.newPassword(),
                    session
            );

            return ResponseEntity.ok(Map.of(
                    "message", "Đổi mật khẩu thành công"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", e.getMessage()));
        }
    }
}