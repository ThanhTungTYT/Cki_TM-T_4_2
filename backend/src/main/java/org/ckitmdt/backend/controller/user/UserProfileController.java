package org.ckitmdt.backend.controller.user;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.user.UpdateProfileRequest;
import org.ckitmdt.backend.dto.user.UserProfileResponse;
import org.ckitmdt.backend.dto.user.UserAddressRequest;
import org.ckitmdt.backend.dto.user.UserAddressResponse;
import org.ckitmdt.backend.service.user.UserProfileService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

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

    @GetMapping("/me/addresses")
    public ResponseEntity<List<UserAddressResponse>> getAddresses(Authentication authentication) {
        return ResponseEntity.ok(userProfileService.getAddresses(authentication.getName()));
    }

    @PostMapping("/me/addresses")
    public ResponseEntity<UserAddressResponse> addAddress(
            Authentication authentication, @RequestBody UserAddressRequest request) {
        return ResponseEntity.ok(userProfileService.addAddress(authentication.getName(), request));
    }

    @PutMapping("/me/addresses/{id}")
    public ResponseEntity<UserAddressResponse> updateAddress(
            Authentication authentication, @PathVariable Long id, @RequestBody UserAddressRequest request) {
        return ResponseEntity.ok(userProfileService.updateAddress(authentication.getName(), id, request));
    }

    @DeleteMapping("/me/addresses/{id}")
    public ResponseEntity<Void> deleteAddress(Authentication authentication, @PathVariable Long id) {
        userProfileService.deleteAddress(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }
}
