package org.ckitmdt.backend.dto.service;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.List;

@Value
@Builder
public class PublicServiceListItemDto {
    Long id;
    String name;
    String description;
    String thumbnailUrl;
    Long providerId;
    String providerName;
    Long categoryId;
    String categoryName;
    String pricingType;
    BigDecimal basePrice;
    Integer estimatedMinutes;
    Double rating;
    long reviews;
    String location;
    List<ServicePackageListItemDto> packages;
}
