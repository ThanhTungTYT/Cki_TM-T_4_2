package org.ckitmdt.backend.dto.service;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceDetailResponseDto {
    private Long id;
    private String name;
    private String slug;
    private String description;
    private String thumbnailUrl;
    private String pricingType;
    private BigDecimal basePrice;
    private Integer estimatedMinutes;
    private String status;
    private Long categoryId;
    private String categoryName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}