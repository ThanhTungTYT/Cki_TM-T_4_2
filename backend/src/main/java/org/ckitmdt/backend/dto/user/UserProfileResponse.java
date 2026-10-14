package org.ckitmdt.backend.dto.user;

import java.time.LocalDate;

public record UserProfileResponse(
        Long userId,
        String fullName,
        String email,
        String phone,
        LocalDate dateOfBirth,
        String gender
) {
}
