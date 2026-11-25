package org.ckitmdt.backend.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.PartnerRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class ProviderApprovalInterceptor implements HandlerInterceptor {

    private final UserRepository userRepository;
    private final PartnerRepository partnerRepository;

    @Override
    public boolean preHandle(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler
    ) throws Exception {

        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication.getName() == null) {
            writeJsonError(
                    response,
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "UNAUTHORIZED",
                    null,
                    "Vui lòng đăng nhập."
            );
            return false;
        }

        Optional<User> optionalUser =
                userRepository.findByEmail(authentication.getName());

        if (optionalUser.isEmpty()) {
            writeJsonError(
                    response,
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "UNAUTHORIZED",
                    null,
                    "Không tìm thấy tài khoản."
            );
            return false;
        }

        User user = optionalUser.get();

        String role = normalize(user.getRole());
        if (role.startsWith("ROLE_")) {
            role = role.substring(5);
        }

        if (!Set.of("PROVIDER", "PARTNER").contains(role)) {
            return true;
        }

        if (!"ACTIVE".equals(normalize(user.getStatus()))) {
            writeJsonError(
                    response,
                    HttpServletResponse.SC_FORBIDDEN,
                    "ACCOUNT_LOCKED",
                    user.getStatus(),
                    "Tài khoản nhà cung cấp chưa được kích hoạt hoặc đang bị khóa."
            );
            return false;
        }

        Optional<Partner> optionalPartner =
                partnerRepository.findByUserId(user.getId());

        if (optionalPartner.isEmpty()) {
            writeJsonError(
                    response,
                    HttpServletResponse.SC_FORBIDDEN,
                    "PARTNER_NOT_APPROVED",
                    "NONE",
                    "Tài khoản chưa có hồ sơ nhà cung cấp."
            );
            return false;
        }

        Partner partner = optionalPartner.get();

        if (!"ACTIVE".equals(normalize(partner.getStatus()))) {
            writeJsonError(
                    response,
                    HttpServletResponse.SC_FORBIDDEN,
                    "PARTNER_NOT_APPROVED",
                    partner.getStatus(),
                    "Hồ sơ nhà cung cấp chưa được Admin phê duyệt hoặc đang bị khóa."
            );
            return false;
        }

        return true;
    }

    private void writeJsonError(
            HttpServletResponse response,
            int status,
            String code,
            String partnerStatus,
            String message
    ) throws IOException {
        response.setStatus(status);
        response.setCharacterEncoding("UTF-8");
        response.setContentType("application/json;charset=UTF-8");
        String safeMessage = message.replace("\\", "\\\\").replace("\"", "\\\"");
        String safeStatus = partnerStatus == null
                ? "null"
                : "\"" + partnerStatus.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
        response.getWriter().write(
                "{\"code\":\"" + code + "\",\"partnerStatus\":" + safeStatus + ",\"message\":\"" + safeMessage + "\"}"
        );
    }

    private String normalize(String value) {
        return value == null
                ? ""
                : value.trim().toUpperCase(Locale.ROOT);
    }
}