package org.ckitmdt.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class AuthResponse {

    private boolean success;
    private String message;

    private String accessToken;
    private String tokenType;

    private Long userId;
    private String fullName;
    private String email;
    private String role;
}