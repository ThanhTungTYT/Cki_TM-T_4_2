package org.ckitmdt.backend.dto.user;

import java.time.LocalDate;

public record UpdateProfileRequest(
        String fullName,
        String phone,
        LocalDate dateOfBirth,
        String gender
) {
}
