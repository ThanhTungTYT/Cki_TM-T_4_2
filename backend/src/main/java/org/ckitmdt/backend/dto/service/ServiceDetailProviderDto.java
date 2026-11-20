package org.ckitmdt.backend.dto.service;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceDetailProviderDto {
    private Long providerId;
    private String businessName;
    private String description;
    private String avatarUrl;
    private String address;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private Double serviceRadiusKm;
    private BigDecimal price;
    private BigDecimal ratingAverage;
    private Integer totalCompletedJobs;
    private Long totalReviews;
}