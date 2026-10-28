package org.ckitmdt.backend.dto.user;

public record UserAddressRequest(
        String receiverName,
        String phone,
        String province,
        String district,
        String ward,
        String streetAddress,
        Boolean isDefault
) {
}
