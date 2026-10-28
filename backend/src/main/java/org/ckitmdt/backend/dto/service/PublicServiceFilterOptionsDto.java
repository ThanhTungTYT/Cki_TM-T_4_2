package org.ckitmdt.backend.dto.service;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.List;

@Value
@Builder
public class PublicServiceFilterOptionsDto {
    List<FilterOptionDto> categories;
    List<FilterOptionDto> areas;
    List<FilterOptionDto> pricingTypes;
    BigDecimal priceLimit;

    @Value
    @Builder
    public static class FilterOptionDto {
        String value;
        String label;
        long count;
    }
}
