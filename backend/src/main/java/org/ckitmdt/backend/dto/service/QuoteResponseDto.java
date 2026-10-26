package org.ckitmdt.backend.dto.service;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
@AllArgsConstructor
public class QuoteResponseDto {
    private Long serviceId;
    private String serviceName;
    private BigDecimal unitPrice;
    private Integer quantity;
    private String pricingType;
    private BigDecimal totalEstimatedPrice;
}