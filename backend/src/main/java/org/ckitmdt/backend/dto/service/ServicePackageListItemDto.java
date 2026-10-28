package org.ckitmdt.backend.dto.service;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class ServicePackageListItemDto {
    Long id;
    String name;
    Integer durationMinutes;
    Integer employeeCount;
    BigDecimal minArea;
    BigDecimal maxArea;
    BigDecimal price;
}
