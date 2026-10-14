package org.ckitmdt.backend.controller.user;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.user.UpdateProfileRequest;
import org.ckitmdt.backend.dto.user.UserProfileResponse;
import org.ckitmdt.backend.service.user.UserProfileService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserProfileController {

    private final UserProfileService userProfileService;

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getProfile(
            Authentication authentication
    ) {
        return ResponseEntity.ok(
                userProfileService.getProfile(
                        authentication.getName()
                )
        );
    }

    @PutMapping("/me")
    public ResponseEntity<UserProfileResponse> updateProfile(
            Authentication authentication,
            @RequestBody UpdateProfileRequest request
    ) {
        return ResponseEntity.ok(
                userProfileService.updateProfile(
                        authentication.getName(),
                        request
                )
        );
    }
}
