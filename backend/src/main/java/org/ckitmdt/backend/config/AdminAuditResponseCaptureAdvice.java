
package org.ckitmdt.backend.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

import java.util.List;
import java.util.Map;

@ControllerAdvice
public class AdminAuditResponseCaptureAdvice
        implements ResponseBodyAdvice<Object> {

    public static final String ENTITY_ID_ATTRIBUTE =
            AdminAuditResponseCaptureAdvice.class.getName() + ".ENTITY_ID";

    public static final String STATUS_ATTRIBUTE =
            AdminAuditResponseCaptureAdvice.class.getName() + ".STATUS";

    private static final List<String> NESTED_KEYS = List.of(
            "account",
            "service",
            "category",
            "promotion",
            "data",
            "result"
    );

    @Override
    public boolean supports(
            MethodParameter returnType,
            Class<? extends HttpMessageConverter<?>> converterType
    ) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(
            Object body,
            MethodParameter returnType,
            MediaType selectedContentType,
            Class<? extends HttpMessageConverter<?>> selectedConverterType,
            ServerHttpRequest request,
            ServerHttpResponse response
    ) {
        if (!(request instanceof ServletServerHttpRequest servletRequest)) {
            return body;
        }

        HttpServletRequest httpRequest =
                servletRequest.getServletRequest();

        String path = httpRequest.getRequestURI();
        String method = httpRequest.getMethod();

        boolean adminMutation =
                path.startsWith("/api/admin/")
                        && List.of("POST", "PUT", "PATCH", "DELETE")
                        .contains(method);

        boolean complaintCreation =
                "/api/reports".equals(path)
                        && "POST".equals(method);

        boolean complaintReopen =
                path.matches("/api/reports/\\d+/reopen/?")
                        && "POST".equals(method);

        if (!adminMutation
                && !complaintCreation
                && !complaintReopen) {
            return body;
        }

        Long entityId = findId(body);

        if (entityId != null) {
            httpRequest.setAttribute(
                    ENTITY_ID_ATTRIBUTE,
                    entityId
            );
        }

        String status = findStatus(body);

        if (status != null) {
            httpRequest.setAttribute(
                    STATUS_ATTRIBUTE,
                    status
            );
        }

        return body;
    }

    private Long findId(Object value) {
        if (!(value instanceof Map<?, ?> map)) {
            return null;
        }

        Long directId = toLong(map.get("id"));

        if (directId != null) {
            return directId;
        }

        for (String key : NESTED_KEYS) {
            Long nestedId = findId(map.get(key));

            if (nestedId != null) {
                return nestedId;
            }
        }

        return null;
    }

    private String findStatus(Object value) {
        if (!(value instanceof Map<?, ?> map)) {
            return null;
        }

        Object status = map.get("status");

        if (status != null
                && !String.valueOf(status).isBlank()) {
            return String.valueOf(status);
        }

        for (String key : NESTED_KEYS) {
            String nestedStatus = findStatus(map.get(key));

            if (nestedStatus != null) {
                return nestedStatus;
            }
        }

        return null;
    }

    private Long toLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }

        if (value instanceof String string
                && string.matches("\\d+")) {
            try {
                return Long.valueOf(string);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }

        return null;
    }
}
