package org.ckitmdt.backend.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/customer/ai")
public class ChatbotProxyController {

    private final RestClient restClient;

    public ChatbotProxyController(@Value("${cleanmate.chatbot.url:http://127.0.0.1:8000}") String chatbotUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(15));
        this.restClient = RestClient.builder()
                .baseUrl(chatbotUrl)
                .requestFactory(factory)
                .build();
    }

    @PostMapping("/api/chat")
    public ResponseEntity<Map<String, Object>> chat(@RequestBody Map<String, Object> body) {
        Map<String, Object> payload = new LinkedHashMap<>();
        if (body != null) {
            payload.put("message", body.getOrDefault("message", ""));
            payload.put("context", body.getOrDefault("context", Map.of()));
            Object topK = body.get("top_k");
            payload.put("top_k", topK instanceof Number ? Math.max(1, Math.min(5, ((Number) topK).intValue())) : 3);
            payload.put("mode", "hybrid");
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restClient.post()
                    .uri("/api/chat")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(Map.class);
            return ResponseEntity.ok(response);
        } catch (RestClientResponseException ex) {
            return ResponseEntity.status(ex.getStatusCode())
                    .body(Map.of("message", "Dịch vụ AI phản hồi lỗi: " + ex.getStatusText()));
        } catch (RestClientException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", "Dịch vụ AI Chatbot hiện chưa khởi chạy trên cổng 8000."));
        }
    }

    @GetMapping("/api/models")
    public ResponseEntity<Map<String, Object>> models() {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restClient.get().uri("/api/models").retrieve().body(Map.class);
            return ResponseEntity.ok(response);
        } catch (RestClientException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", "Dịch vụ AI Chatbot hiện chưa khởi chạy."));
        }
    }

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, Object>> health() {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restClient.get().uri("/api/health").retrieve().body(Map.class);
            return ResponseEntity.ok(response);
        } catch (RestClientException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("status", "down", "message", "Dịch vụ AI Chatbot hiện chưa khởi chạy."));
        }
    }
}
