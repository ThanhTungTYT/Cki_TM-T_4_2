package org.ckitmdt.backend.dto.user;

import java.math.BigDecimal;

public record UserAddressRequest(
        String receiverName,
        String phone,
        String province,
        String district,
        String ward,
        String streetAddress,
        Boolean isDefault,
        BigDecimal latitude,
        BigDecimal longitude
) {
}
