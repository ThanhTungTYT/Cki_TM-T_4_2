package org.ckitmdt.backend.controller.auth;

import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.auth.*;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.UserRepository;
import org.ckitmdt.backend.service.auth.AuthService;
import org.ckitmdt.backend.service.auth.RegistrationOtpService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;
    private final RegistrationOtpService registrationOtpService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody RegisterRequest request
    ) {
        return ResponseEntity.ok(
                authService.register(request)
        );
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request
    ) {
        return ResponseEntity.ok(
                authService.login(request)
        );
    }

    @PostMapping("/google")
    public ResponseEntity<AuthResponse> googleLogin(
            @RequestBody GoogleLoginRequest request
    ) {
        return ResponseEntity.ok(
                authService.googleLogin(request)
        );
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException("Người dùng không tồn tại, vui lòng đăng kí")
                );
        UserResponse response = new UserResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getRole(),
                user.getEmailVerified()
        );
        return ResponseEntity.ok(response);
    }

    @PostMapping("/register/request-otp")
    public ResponseEntity<?> requestRegisterOtp(@Valid @RequestBody RegisterRequest request, HttpSession session) {
        registrationOtpService.requestOtp(request, session);
        return ResponseEntity.ok(Map.of("success", true, "message", "Đã gửi OTP đến email"));
    }

    @PostMapping("/register/verify-otp")
    public ResponseEntity<?> verifyRegisterOtp(@Valid @RequestBody VerifyOtpRequest request, HttpSession session) {
        registrationOtpService.verifyOtp(request.getOtp(), session);
        return ResponseEntity.ok(Map.of("success", true, "message", "Đăng ký thành công"));
    }

    @PostMapping("/register/resend-otp")
    public ResponseEntity<?> resendRegisterOtp(HttpSession session) {
        registrationOtpService.resendOtp(session);
        return ResponseEntity.ok(
                Map.of("success", true, "message", "Đã gửi lại OTP")
        );
    }
    @PostMapping("/facebook")
    public ResponseEntity<AuthResponse> facebookLogin(
            @Valid @RequestBody FacebookLoginRequest request
    ) {
        AuthResponse response = authService.loginWithFacebook(
                request.getAccessToken()
        );

        return ResponseEntity.ok(response);
    }
}