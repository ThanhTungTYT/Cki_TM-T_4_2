
package org.ckitmdt.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class AdminAuditRequestBodyFilter extends OncePerRequestFilter {

    private static final int REQUEST_CACHE_LIMIT = 1024 * 1024;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        ContentCachingRequestWrapper wrappedRequest =
                request instanceof ContentCachingRequestWrapper
                        ? (ContentCachingRequestWrapper) request
                        : new ContentCachingRequestWrapper(request, REQUEST_CACHE_LIMIT);

        filterChain.doFilter(wrappedRequest, response);
    }
}
