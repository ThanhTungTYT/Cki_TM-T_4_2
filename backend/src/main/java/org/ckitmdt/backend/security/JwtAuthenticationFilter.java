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
import java.util.Locale;

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
        String requestUri = request.getRequestURI();

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);

        if (!jwtService.isTokenValid(token)) {
            SecurityContextHolder.clearContext();

            System.out.println(
                    "JWT DEBUG | URI=" + requestUri
                            + " | TOKEN_INVALID"
            );

            filterChain.doFilter(request, response);
            return;
        }

        String email = jwtService.extractEmail(token);

        User user = userRepository.findByEmail(email).orElse(null);

        if (user == null) {
            SecurityContextHolder.clearContext();

            System.out.println(
                    "JWT DEBUG | URI=" + requestUri
                            + " | USER_NOT_FOUND"
            );

            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(
                    "{\"message\":\"Tài khoản không tồn tại.\"}"
            );
            return;
        }

        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            SecurityContextHolder.clearContext();

            System.out.println(
                    "JWT DEBUG | URI=" + requestUri
                            + " | ACCOUNT_INACTIVE"
            );

            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(
                    "{\"message\":\"Tài khoản đã bị khóa hoặc không hoạt động.\"}"
            );
            return;
        }

        String role = user.getRole();

        if (role == null || role.isBlank()) {
            SecurityContextHolder.clearContext();

            System.out.println(
                    "JWT DEBUG | URI=" + requestUri
                            + " | ROLE_EMPTY"
            );

            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(
                    "{\"message\":\"Tài khoản chưa được phân quyền.\"}"
            );
            return;
        }

        role = role.trim().toUpperCase(Locale.ROOT);

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

        SecurityContextHolder.getContext().setAuthentication(authentication);

        System.out.println(
                "JWT DEBUG | URI=" + requestUri
                        + " | EMAIL=" + user.getEmail()
                        + " | ROLE=" + role
                        + " | AUTHORITIES=" + authentication.getAuthorities()
        );

        filterChain.doFilter(request, response);
    }
}
