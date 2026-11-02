package org.ckitmdt.backend.config;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.UserRepository;
import org.ckitmdt.backend.security.JwtService;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.security.Principal;
import java.util.Locale;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class AdminWebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private static final String NOTIFICATION_DESTINATION = "/user/queue/admin-notifications";

    private final JwtService jwtService;
    private final UserRepository userRepository;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/queue", "/topic");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(
                        "http://localhost:5173",
                        "https://handmade-opponent-punk.ngrok-free.dev"
                );
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(
                        message,
                        StompHeaderAccessor.class
                );

                if (accessor == null || accessor.getCommand() == null) return message;

                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    authenticate(accessor);
                    return message;
                }

                if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                    authorizeSubscription(accessor);
                    return message;
                }

                if (StompCommand.SEND.equals(accessor.getCommand())) {
                    throw new AccessDeniedException("Client không được phép gửi thông báo lên máy chủ.");
                }

                return message;
            }
        });
    }

    private void authenticate(StompHeaderAccessor accessor) {
        String authorization = accessor.getFirstNativeHeader("Authorization");

        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new AccessDeniedException("Thiếu JWT khi kết nối WebSocket.");
        }

        String token = authorization.substring(7).trim();

        if (token.isBlank() || !jwtService.isTokenValid(token)) {
            throw new AccessDeniedException("JWT WebSocket không hợp lệ hoặc đã hết hạn.");
        }

        String email = jwtService.extractEmail(token);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AccessDeniedException("Không tìm thấy tài khoản WebSocket."));

        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new AccessDeniedException("Tài khoản không hoạt động.");
        }

        String role = user.getRole() == null
                ? ""
                : user.getRole().trim().toUpperCase(Locale.ROOT);

        if (role.startsWith("ROLE_")) {
            role = role.substring(5);
        }

        if (!"ADMIN".equals(role) && !"STAFF".equals(role)) {
            throw new AccessDeniedException("Tài khoản không có quyền nhận thông báo quản trị.");
        }

        Principal principal = () -> user.getEmail();
        accessor.setUser(principal);
    }

    private void authorizeSubscription(StompHeaderAccessor accessor) {
        Principal principal = accessor.getUser();
        String destination = accessor.getDestination();

        if (principal == null || principal.getName() == null) {
            throw new AccessDeniedException("WebSocket chưa được xác thực.");
        }

        if (!NOTIFICATION_DESTINATION.equals(destination)) {
            throw new AccessDeniedException("Không được phép đăng ký kênh này.");
        }
    }
}