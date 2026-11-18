
package org.ckitmdt.backend.config;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setCharacterEncoding("UTF-8");
                            response.setContentType("application/json;charset=UTF-8");
                            response.getWriter().write(
                                    "{\"message\":\"Phiên đăng nhập không hợp lệ hoặc đã hết hạn.\"}"
                            );
                        })
                        .accessDeniedHandler((request, response, exception) -> {
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setCharacterEncoding("UTF-8");
                            response.setContentType("application/json;charset=UTF-8");
                            response.getWriter().write(
                                    "{\"message\":\"Bạn không có quyền thực hiện thao tác này.\"}"
                            );
                        })
                )
                .authorizeHttpRequests(auth -> auth

                        .requestMatchers(
                                HttpMethod.GET,
                                "/uploads/cleaner-logs/**"
                        ).permitAll()

                        .requestMatchers("/ws/**").permitAll()

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/customer/notifications"
                        ).hasRole("CUSTOMER")

                        .requestMatchers(
                                HttpMethod.PATCH,
                                "/api/customer/notifications/*/read"
                        ).hasRole("CUSTOMER")

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/v1/providers",
                                "/api/v1/services",
                                "/api/v1/services/filters",
                                "/api/v1/services/providers/*",
                                "/api/v1/services/*",
                                "/api/v1/services/*/reviews"
                        ).permitAll()

                        .requestMatchers(
                                "/error",
                                "/api/auth/login",
                                "/api/auth/register",
                                "/api/auth/google",
                                "/api/auth/facebook",
                                "/api/auth/register/request-otp",
                                "/api/auth/register/verify-otp",
                                "/api/auth/register/resend-otp",
                                "/api/auth/forgot-password",
                                "/api/auth/verify-reset-password",
                                "/api/auth/reset-password"
                        ).permitAll()

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/payments/vnpay/ipn"
                        ).permitAll()

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/admin/operations/staff",
                                "/api/admin/operations/audit-logs",
                                "/api/admin/operations/unassigned-tickets"
                        ).hasRole("ADMIN")

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/admin/operations/assignments",
                                "/api/admin/operations/notifications"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                HttpMethod.PATCH,
                                "/api/admin/operations/notifications/*/read"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/admin/operations/assignments"
                        ).hasRole("ADMIN")

                        .requestMatchers(
                                "/api/admin/operations/**"
                        ).denyAll()

                        .requestMatchers(
                                "/api/admin/accounts",
                                "/api/admin/accounts/**"
                        ).hasRole("ADMIN")

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/admin/dashboard/overview",
                                "/api/admin/statistics",
                                "/api/admin/test"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/admin/orders",
                                "/api/admin/orders/**"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/admin/orders/**"
                        ).hasRole("ADMIN")

                        .requestMatchers(
                                "/api/admin/providers",
                                "/api/admin/providers/**",
                                "/api/admin/provider-change-requests",
                                "/api/admin/provider-change-requests/**"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                "/api/admin/provider-service-approvals",
                                "/api/admin/provider-service-approvals/**",
                                "/api/admin/partner-services",
                                "/api/admin/partner-services/**"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                "/api/admin/services",
                                "/api/admin/services/**"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/admin/transactions",
                                "/api/admin/transactions/**"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                "/api/admin/transactions/**"
                        ).hasRole("ADMIN")

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/admin/provider-settlements",
                                "/api/admin/provider-settlements/**"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/admin/provider-settlements"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                HttpMethod.PATCH,
                                "/api/admin/provider-settlements/**"
                        ).hasRole("ADMIN")

                        .requestMatchers(
                                "/api/admin/provider-settlements/**"
                        ).hasRole("ADMIN")

                        .requestMatchers(
                                "/api/admin/promotions",
                                "/api/admin/promotions/**"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/admin/rewards/policy",
                                "/api/admin/rewards/accounts"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                HttpMethod.PUT,
                                "/api/admin/rewards/policy"
                        ).hasRole("ADMIN")

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/admin/rewards/accounts/**"
                        ).hasRole("ADMIN")

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/admin/reward-orders",
                                "/api/admin/reward-orders/**"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/admin/reward-orders/*/ship"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/admin/outbox/failed"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/admin/outbox/*/retry"
                        ).hasRole("ADMIN")

                        .requestMatchers(
                                "/api/admin/outbox/**"
                        ).hasRole("ADMIN")

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/reports/admin"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                HttpMethod.PUT,
                                "/api/reports/*/status"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/refunds/admin"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                HttpMethod.PUT,
                                "/api/refunds/*/review",
                                "/api/refunds/*/transfer"
                        ).hasRole("ADMIN")

                        .requestMatchers(
                                "/api/admin/**"
                        ).hasRole("ADMIN")

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/provider/services"
                        ).denyAll()

                        .requestMatchers(
                                HttpMethod.PUT,
                                "/api/provider/services/*"
                        ).denyAll()

                        .requestMatchers(
                                HttpMethod.PATCH,
                                "/api/provider/services/*/status",
                                "/api/provider/services/*/resume"
                        ).denyAll()

                        .requestMatchers(
                                "/api/refunds/bookings/*/request"
                        ).authenticated()

                        .requestMatchers(
                                "/api/provider/**"
                        ).hasAnyRole("PROVIDER", "PARTNER")

                        .requestMatchers(
                                "/api/refunds/**",
                                "/api/reports/**",
                                "/api/users/**",
                                "/api/payments/**"
                        ).authenticated()

                        .anyRequest().authenticated()
                )
                .addFilterBefore(
                        jwtAuthenticationFilter,
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        config.setAllowedOrigins(List.of(
                "http://localhost:5173",
                "https://handmade-opponent-punk.ngrok-free.dev"
        ));

        config.setAllowedMethods(List.of(
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
                "OPTIONS"
        ));

        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/**", config);

        return source;
    }
}
