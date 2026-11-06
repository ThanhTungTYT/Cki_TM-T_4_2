package org.ckitmdt.backend.dto.service;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.List;

@Value
@Builder
public class PublicProviderProfileDto {
    Long providerId;
    String businessName;
    String description;
    String avatarUrl;
    String address;
    BigDecimal ratingAverage;
    Long totalReviews;
    Integer totalCompletedJobs;
    List<PublicProviderServiceDto> services;
}
