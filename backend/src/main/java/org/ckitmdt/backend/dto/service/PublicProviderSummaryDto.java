package org.ckitmdt.backend.dto.service;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class PublicProviderSummaryDto {
    Long providerId;
    String businessName;
    String description;
    String avatarUrl;
    String address;
    BigDecimal ratingAverage;
    Long totalReviews;
    Integer totalCompletedJobs;
    Long serviceCount;
}
