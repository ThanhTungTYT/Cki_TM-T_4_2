package org.ckitmdt.backend.config;

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
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http
    ) throws Exception {

        http
                .csrf(csrf -> csrf.disable())
                .cors(cors ->
                        cors.configurationSource(corsConfigurationSource())
                )
                .sessionManagement(session -> session
                        .sessionCreationPolicy(
                                SessionCreationPolicy.STATELESS
                        )
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/v1/services",
                                "/api/v1/services/filters",
                                "/api/v1/services/*"
                        ).permitAll()

                        .requestMatchers(
                                "/api/auth/login",
                                "/api/auth/register",
                                "/api/auth/google",
                                "/api/auth/facebook",
                                "/api/auth/register/request-otp",
                                "/api/auth/register/verify-otp",
                                "/api/auth/register/resend-otp",
                                "/api/bookings/quote",
                                "/api/auth/forgot-password",
                                "/api/auth/verify-reset-password",
                                "/api/auth/reset-password"
                        ).permitAll()

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/payments/vnpay/ipn"
                        ).permitAll()

                        .requestMatchers(
                                "/api/admin/accounts/**",
                                "/api/admin/services/**",
                                "/api/admin/orders/**",
                                "/api/admin/providers/**",
                                "/api/admin/transactions/**",
                                "/api/admin/statistics"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/refunds/admin"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                HttpMethod.PUT,
                                "/api/refunds/*/review"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                "/api/refunds/bookings/*/request"
                        ).authenticated()

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/reports/admin"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                HttpMethod.PUT,
                                "/api/reports/*/status"
                        ).hasAnyRole("ADMIN", "STAFF")

                        .requestMatchers(
                                "/api/admin/**"
                        ).hasRole("ADMIN")

                        .requestMatchers(
                                "/api/refunds/**",
                                "/api/reports/**",
                                "/api/users/**",
                                "/api/payments/**"
                        ).authenticated()

                        .anyRequest()
                        .authenticated()
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

        config.setAllowedOrigins(
                List.of(
                        "http://localhost:5173",
                        "https://handmade-opponent-punk.ngrok-free.dev"
                )
        );

        config.setAllowedMethods(
                List.of(
                        "GET",
                        "POST",
                        "PUT",
                        "PATCH",
                        "DELETE",
                        "OPTIONS"
                )
        );

        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/**", config);

        return source;
    }
}
