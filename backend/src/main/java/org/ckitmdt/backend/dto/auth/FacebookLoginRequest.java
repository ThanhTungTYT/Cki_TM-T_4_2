package org.ckitmdt.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FacebookLoginRequest {

    @NotBlank
    private String accessToken;
}