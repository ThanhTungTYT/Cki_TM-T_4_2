package org.ckitmdt.backend.dto.service;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class PublicProviderServiceDto {
    Long id;
    String name;
    String description;
    String thumbnailUrl;
    String pricingType;
    BigDecimal basePrice;
    Double rating;
    Long reviews;
}
