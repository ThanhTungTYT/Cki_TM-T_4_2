package org.ckitmdt.backend.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class ProviderApprovalWebConfig implements WebMvcConfigurer {
    private final ProviderApprovalInterceptor providerApprovalInterceptor;
    private final AdminAuditInterceptor adminAuditInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(providerApprovalInterceptor)
                .addPathPatterns("/api/provider/**");
        registry.addInterceptor(adminAuditInterceptor)
                .addPathPatterns("/api/admin/**", "/api/refunds/*/review");
    }
}