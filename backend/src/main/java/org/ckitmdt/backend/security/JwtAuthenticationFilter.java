
package org.ckitmdt.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        // Không có Bearer token thì để Spring Security xử lý tiếp.
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);

        // Token không hợp lệ thì không xác thực người dùng.
        if (!jwtService.isTokenValid(token)) {
            SecurityContextHolder.clearContext();
            filterChain.doFilter(request, response);
            return;
        }

        String email = jwtService.extractEmail(token);

        // Luôn kiểm tra tài khoản mới nhất trong database.
        User user = userRepository.findByEmail(email).orElse(null);

        // Tài khoản không tồn tại hoặc đã bị khóa.
        if (user == null || !"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            SecurityContextHolder.clearContext();

            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(
                    "{\"message\":\"Tài khoản không tồn tại hoặc đã bị khóa.\"}"
            );
            return;
        }

        // Lấy role mới nhất từ database thay vì tin role trong token.
        String role = user.getRole();

        if (role == null || role.isBlank()) {
            SecurityContextHolder.clearContext();

            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(
                    "{\"message\":\"Tài khoản chưa được phân quyền.\"}"
            );
            return;
        }

        // Tránh tạo ROLE_ROLE_ADMIN nếu role đã có tiền tố ROLE_.
        if (role.startsWith("ROLE_")) {
            role = role.substring(5);
        }

        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                        user.getEmail(),
                        null,
                        List.of(
                                new SimpleGrantedAuthority("ROLE_" + role)
                        )
                );

        SecurityContextHolder
                .getContext()
                .setAuthentication(authentication);

        filterChain.doFilter(request, response);
    }
}
