
package org.ckitmdt.backend.service.auth;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Slf4j
public class FacebookService {

    @Value("${facebook.app.id}")
    private String appId;

    @Value("${facebook.app.secret}")
    private String appSecret;

    @Value("${facebook.graph.version:v26.0}")
    private String graphVersion;

    private final RestClient restClient = RestClient.create();
    private final ObjectMapper objectMapper;

    public FacebookUser verifyToken(String accessToken) {
        String verificationStep = "debug_token";
        try {
            String appAccessToken = appId + "|" + appSecret;

            String debugBody = restClient.get()
                    .uri("https://graph.facebook.com/" + graphVersion + "/debug_token?input_token={inputToken}&access_token={appToken}", accessToken, appAccessToken)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(String.class);
            JsonNode debugResponse = objectMapper.readTree(debugBody);

            JsonNode data = debugResponse.path("data");

            boolean valid = data.path("is_valid").asBoolean(false);
            String tokenAppId = data.path("app_id").asText("");
            String facebookId = data.path("user_id").asText("");

            if (!valid || !appId.equals(tokenAppId) || facebookId.isBlank()) {
                log.warn("Facebook token rejected by debug_token (valid={}, appIdMatches={}, userIdPresent={})",
                        valid, appId.equals(tokenAppId), !facebookId.isBlank());
                throw new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Facebook token không hợp lệ"
                );
            }

            verificationStep = "profile";
            String profileBody = restClient.get()
                    .uri("https://graph.facebook.com/" + graphVersion
                            + "/me?fields=id,name,email")
                    .accept(MediaType.APPLICATION_JSON)
                    .headers(headers ->
                            headers.setBearerAuth(accessToken))
                    .retrieve()
                    .body(String.class);
            JsonNode profile = objectMapper.readTree(profileBody);

            String profileId = profile.path("id").asText("");
            String fullName = profile.path("name").asText("");
            String email = profile.path("email").asText("");

            if (!facebookId.equals(profileId)) {
                throw new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Facebook ID không khớp"
                );
            }

            return new FacebookUser(profileId, fullName, email);

        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            if (e instanceof RestClientResponseException responseException) {
                log.warn("Facebook verification failed at {} (HTTP {}, {})",
                        verificationStep, responseException.getStatusCode().value(), e.getClass().getSimpleName());
            } else {
                log.warn("Facebook verification failed at {} ({})",
                        verificationStep, e.getClass().getSimpleName());
            }
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Xác thực Facebook thất bại",
                    e
            );
        }
    }

    public record FacebookUser(
            String facebookId,
            String fullName,
            String email
    ) {}
}
