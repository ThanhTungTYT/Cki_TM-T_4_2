package org.ckitmdt.backend.service.auth;

import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.auth.RegisterRequest;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RegistrationOtpService {

    private final EmailService emailService;
    private final AuthService authService;
    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;

    private static final String REGISTER_DATA = "REGISTER_DATA";
    private static final String REGISTER_OTP = "REGISTER_OTP";
    private static final String OTP_EXPIRES_AT = "OTP_EXPIRES_AT";
    private static final String OTP_LAST_SENT_AT = "OTP_LAST_SENT_AT";
    private static final String OTP_FAILED_ATTEMPTS = "OTP_FAILED_ATTEMPTS";

    private static final long OTP_DURATION = 5 * 60 * 1000L;
    private static final long RESEND_COOLDOWN = 60 * 1000L;
    private static final int MAX_ATTEMPTS = 5;

    public void requestOtp(RegisterRequest request, HttpSession session) {
        String email = request.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {throw new IllegalArgumentException(
                    "Email đã được sử dụng"
            );
        }
        sendAndSaveOtp(request, session);
    }

    public void resendOtp(HttpSession session) {
        RegisterRequest request =
                (RegisterRequest) session.getAttribute(REGISTER_DATA);
        if (request == null) {
            throw new IllegalArgumentException(
                    "Không tìm thấy thông tin đăng ký"
            );
        }
        sendAndSaveOtp(request, session);
    }

    private void sendAndSaveOtp(RegisterRequest request, HttpSession session) {
        Long lastSentAt = (Long) session.getAttribute(OTP_LAST_SENT_AT);
        long now = System.currentTimeMillis();

        if (lastSentAt != null
                && now - lastSentAt < RESEND_COOLDOWN) {
            throw new IllegalArgumentException(
                    "Vui lòng đợi 60 giây trước khi gửi lại OTP"
            );
        }
        int otpNumber = (int) (Math.random() * 900000) + 100000;
        String otp = String.valueOf(otpNumber);
        String otpHash = passwordEncoder.encode(otp);

        emailService.sendOtp(request.getEmail(), otp);
        session.setAttribute(REGISTER_DATA, request);
        session.setAttribute(REGISTER_OTP, otpHash);
        session.setAttribute(OTP_EXPIRES_AT, now + OTP_DURATION);
        session.setAttribute(OTP_LAST_SENT_AT, now);
        session.setAttribute(OTP_FAILED_ATTEMPTS, 0);
    }

    public void verifyOtp(String otp, HttpSession session) {
        String savedOtpHash = (String) session.getAttribute(REGISTER_OTP);
        Long expiresAt = (Long) session.getAttribute(OTP_EXPIRES_AT);
        RegisterRequest registerData = (RegisterRequest) session.getAttribute(REGISTER_DATA);

        if (savedOtpHash == null || expiresAt == null || registerData == null) {
            throw new IllegalArgumentException(
                    "Phiên đăng ký không tồn tại hoặc đã hết hạn"
            );
        }
        if (System.currentTimeMillis() > expiresAt) {
            clearRegistration(session);
            throw new IllegalArgumentException(
                    "OTP đã hết hạn"
            );
        }
        Integer attempts = (Integer) session.getAttribute(OTP_FAILED_ATTEMPTS);
        if (attempts == null) {
            attempts = 0;
        }
        if (attempts >= MAX_ATTEMPTS) {
            throw new IllegalArgumentException(
                    "Bạn đã nhập sai OTP quá 5 lần"
            );
        }
        if (!passwordEncoder.matches(otp, savedOtpHash)) {
            session.setAttribute(
                    OTP_FAILED_ATTEMPTS,
                    attempts + 1
            );
            throw new IllegalArgumentException(
                    "OTP không chính xác"
            );
        }
        session.removeAttribute(REGISTER_OTP);
        session.removeAttribute(OTP_EXPIRES_AT);
        authService.register(registerData);
        clearRegistration(session);
    }

    private void clearRegistration(HttpSession session) {

        session.removeAttribute(REGISTER_DATA);
        session.removeAttribute(REGISTER_OTP);
        session.removeAttribute(OTP_EXPIRES_AT);
        session.removeAttribute(OTP_LAST_SENT_AT);
        session.removeAttribute(OTP_FAILED_ATTEMPTS);
    }
}
