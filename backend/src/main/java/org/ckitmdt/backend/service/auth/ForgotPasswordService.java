package org.ckitmdt.backend.service.auth;

import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ForgotPasswordService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    private static final String SESSION_KEY = "FORGOT_PASSWORD";
    private static final int EXPIRE_MINUTES = 10;
    private static final int MAX_ATTEMPTS = 5;

    private final SecureRandom random = new SecureRandom();

    public record ResetSession(
            String email,
            String passwordHash,
            Instant expiresAt,
            int attempts,
            boolean verified
    ) {}

    private String generateTemporaryPassword() {
        String numbers = "0123456789";
        String uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        String special = "!@#$%&*";

        StringBuilder password = new StringBuilder();

        for (int i = 0; i < 6; i++) {
            password.append(numbers.charAt(
                    random.nextInt(numbers.length())
            ));
        }

        password.append(uppercase.charAt(
                random.nextInt(uppercase.length())
        ));

        password.append(special.charAt(
                random.nextInt(special.length())
        ));

        char[] chars = password.toString().toCharArray();

        for (int i = chars.length - 1; i > 0; i--) {
            int j = random.nextInt(i + 1);

            char temp = chars[i];
            chars[i] = chars[j];
            chars[j] = temp;
        }

        return new String(chars);
    }

    public void forgotPassword(String email, HttpSession session) {
        String normalizedEmail = email.trim().toLowerCase();

        session.removeAttribute(SESSION_KEY);

        Optional<User> optionalUser =
                userRepository.findByEmail(normalizedEmail);

        if (optionalUser.isEmpty()) {
            return;
        }

        String temporaryPassword = generateTemporaryPassword();

        ResetSession resetSession = new ResetSession(
                normalizedEmail,
                passwordEncoder.encode(temporaryPassword),
                Instant.now().plusSeconds(EXPIRE_MINUTES * 60L),
                0,
                false
        );

        emailService.sendTemporaryPassword(
                normalizedEmail,
                temporaryPassword
        );

        session.setAttribute(SESSION_KEY, resetSession);
    }

    public void verifyTemporaryPassword(
            String temporaryPassword,
            HttpSession session
    ) {
        ResetSession data = getResetSession(session);

        if (data.attempts() >= MAX_ATTEMPTS) {
            session.removeAttribute(SESSION_KEY);
            throw new IllegalArgumentException(
                    "Bạn đã nhập sai quá số lần cho phép"
            );
        }

        if (temporaryPassword == null ||
                !passwordEncoder.matches(
                        temporaryPassword,
                        data.passwordHash()
                )) {

            int attempts = data.attempts() + 1;

            if (attempts >= MAX_ATTEMPTS) {
                session.removeAttribute(SESSION_KEY);
                throw new IllegalArgumentException(
                        "Bạn đã nhập sai quá số lần cho phép"
                );
            }

            session.setAttribute(
                    SESSION_KEY,
                    new ResetSession(
                            data.email(),
                            data.passwordHash(),
                            data.expiresAt(),
                            attempts,
                            false
                    )
            );

            throw new IllegalArgumentException(
                    "Mật khẩu tạm thời không chính xác"
            );
        }

        session.setAttribute(
                SESSION_KEY,
                new ResetSession(
                        data.email(),
                        data.passwordHash(),
                        data.expiresAt(),
                        data.attempts(),
                        true
                )
        );
    }

    public void resetPassword(
            String newPassword,
            HttpSession session
    ) {
        ResetSession data = getResetSession(session);

        if (!data.verified()) {
            throw new IllegalArgumentException(
                    "Bạn chưa xác thực mật khẩu tạm thời"
            );
        }

        if (newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException(
                    "Mật khẩu mới phải có ít nhất 8 ký tự"
            );
        }

        User user = userRepository.findByEmail(data.email())
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Tài khoản không tồn tại"
                        )
                );

        user.setPasswordHash(
                passwordEncoder.encode(newPassword)
        );

        userRepository.save(user);

        session.removeAttribute(SESSION_KEY);
    }

    private ResetSession getResetSession(HttpSession session) {
        ResetSession data =
                (ResetSession) session.getAttribute(SESSION_KEY);

        if (data == null) {
            throw new IllegalArgumentException(
                    "Phiên khôi phục mật khẩu không tồn tại"
            );
        }

        if (Instant.now().isAfter(data.expiresAt())) {
            session.removeAttribute(SESSION_KEY);

            throw new IllegalArgumentException(
                    "Mật khẩu tạm thời đã hết hạn"
            );
        }

        return data;
    }
}