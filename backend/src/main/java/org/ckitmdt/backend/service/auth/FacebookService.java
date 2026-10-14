
package org.ckitmdt.backend.service.auth;

import tools.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class FacebookService {

    @Value("${facebook.app.id}")
    private String appId;

    @Value("${facebook.app.secret}")
    private String appSecret;

    @Value("${facebook.graph.version:v26.0}")
    private String graphVersion;

    private final RestClient restClient = RestClient.create();

    public FacebookUser verifyToken(String accessToken) {

        try {
            String appAccessToken = appId + "|" + appSecret;

            JsonNode debugResponse = restClient.get()
                    .uri("https://graph.facebook.com/" + graphVersion + "/debug_token?input_token={inputToken}&access_token={appToken}", accessToken, appAccessToken)
                    .retrieve()
                    .body(JsonNode.class);

            JsonNode data = debugResponse.path("data");

            boolean valid = data.path("is_valid").asBoolean(false);
            String tokenAppId = data.path("app_id").asText("");
            String facebookId = data.path("user_id").asText("");

            if (!valid || !appId.equals(tokenAppId) || facebookId.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Facebook token không hợp lệ"
                );
            }

            JsonNode profile = restClient.get()
                    .uri("https://graph.facebook.com/" + graphVersion
                            + "/me?fields=id,name,email")
                    .headers(headers ->
                            headers.setBearerAuth(accessToken))
                    .retrieve()
                    .body(JsonNode.class);

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
