package org.ckitmdt.backend.service.auth;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.auth.AuthResponse;
import org.ckitmdt.backend.dto.auth.LoginRequest;
import org.ckitmdt.backend.dto.auth.RegisterRequest;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.UserRepository;
import org.ckitmdt.backend.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.ckitmdt.backend.dto.auth.GoogleLoginRequest;
import org.springframework.beans.factory.annotation.Value;
import java.util.Collections;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final FacebookService facebookService;
    @Value("${google.client-id}")
    private String googleClientId;

    public AuthResponse register(RegisterRequest request) {

        String email = request.getEmail()
                .trim()
                .toLowerCase();

        if (userRepository.existsByEmail(email)) {
            throw new RuntimeException("Email đã được sử dụng");
        }

        User user = User.builder()
                .fullName(request.getFullName())
                .email(email)
                .phone(request.getPhone())
                .passwordHash(
                        passwordEncoder.encode(request.getPassword())
                )
                .role("CUSTOMER")
                .status("ACTIVE")
                .emailVerified(false)
                .build();

        User savedUser = userRepository.save(user);

        return new AuthResponse(
                true,
                "Đăng ký thành công",
                null,
                null,
                savedUser.getId(),
                savedUser.getFullName(),
                savedUser.getEmail(),
                savedUser.getRole()
        );
    }

    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail()
                .trim()
                .toLowerCase();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Email hoặc mật khẩu không chính xác"
                        )
                );
        if (!"ACTIVE".equals(user.getStatus())) {
            throw new RuntimeException(
                    "Tài khoản đã bị khóa"
            );
        }
        if (user.getPasswordHash() == null) {
            throw new RuntimeException(
                    "Tài khoản này đăng nhập bằng Google"
            );
        }
        if (!passwordEncoder.matches(
                request.getPassword(),
                user.getPasswordHash()
        )) {
            throw new RuntimeException(
                    "Email hoặc mật khẩu không chính xác"
            );
        }
        String token = jwtService.generateToken(
                user.getId(),
                user.getEmail(),
                user.getRole()
        );
        return new AuthResponse(
                true,
                "Đăng nhập thành công",
                token,
                "Bearer",
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole()
        );
    }

    public AuthResponse googleLogin(GoogleLoginRequest request) {
        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                            GoogleNetHttpTransport.newTrustedTransport(),
                            GsonFactory.getDefaultInstance())
                            .setAudience(Collections.singletonList(googleClientId))
                            .build();
            GoogleIdToken idToken = verifier.verify(request.getCredential());
            if (idToken == null) {
                throw new RuntimeException("Google token không hợp lệ");
            }
            GoogleIdToken.Payload payload = idToken.getPayload();

            String email = payload.getEmail();
            if (email == null) {
                throw new RuntimeException("Không lấy được email từ Google");
            }
            email = email.trim().toLowerCase();
            Boolean emailVerified = payload.getEmailVerified();
            if (!Boolean.TRUE.equals(emailVerified)) {
                throw new RuntimeException("Email Google chưa được xác minh");
            }
            String fullName = (String) payload.get("name");
            String avatarUrl = (String) payload.get("picture");
            String finalEmail = email;
            User user = userRepository
                    .findByEmail(email)
                    .orElseGet(() -> {
                        User newUser = User.builder()
                                .fullName(fullName != null ? fullName : finalEmail)
                                .email(finalEmail)
                                .passwordHash(null)
                                .avatarUrl(avatarUrl)
                                .role("CUSTOMER")
                                .status("ACTIVE")
                                .emailVerified(true)
                                .build();

                        return userRepository.save(newUser);
                    });
            if (!"ACTIVE".equals(user.getStatus())) {throw new RuntimeException("Tài khoản đã bị khóa");
            }
            String token = jwtService.generateToken(
                    user.getId(),
                    user.getEmail(),
                    user.getRole()
            );
            return new AuthResponse(
                    true,
                    "Đăng nhập Google thành công",
                    token,
                    "Bearer",
                    user.getId(),
                    user.getFullName(),
                    user.getEmail(),
                    user.getRole()
            );
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Đăng nhập Google thất bại", e);
        }
    }


    @Transactional
    public AuthResponse loginWithFacebook(String accessToken) {
        FacebookService.FacebookUser facebookUser = facebookService.verifyToken(accessToken);
        String facebookId = facebookUser.facebookId();
        String fullName = facebookUser.fullName();
        String email = facebookUser.email();
        User user = userRepository.findByFacebookId(facebookId).orElse(null);

        if (user == null) {
            if (email == null || email.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Facebook không cung cấp email");
            }
            email = email.trim().toLowerCase();

            if (userRepository.existsByEmail(email)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Email đã tồn tại. Vui lòng đăng nhập bằng phương thức trước đó.");
            }

            User newUser = User.builder()
                    .fullName(fullName != null && !fullName.isBlank() ? fullName : email)
                    .email(email)
                    .facebookId(facebookId)
                    .passwordHash(null)
                    .role("CUSTOMER")
                    .status("ACTIVE")
                    .emailVerified(false)
                    .build();

            user = userRepository.save(newUser);
        }

        if (!"ACTIVE".equals(user.getStatus())) {throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tài khoản đã bị khóa");
        }

        String token = jwtService.generateToken(
                user.getId(),
                user.getEmail(),
                user.getRole()
        );

        return new AuthResponse(
                true,
                "Đăng nhập Facebook thành công",
                token,
                "Bearer",
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole()
        );
    }

}