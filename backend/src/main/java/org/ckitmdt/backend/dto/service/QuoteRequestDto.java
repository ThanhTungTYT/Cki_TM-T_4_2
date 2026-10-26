package org.ckitmdt.backend.dto.service;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class QuoteRequestDto {
    private Long serviceId;
    private Integer quantity; // Số lượng / Số giờ / m2
}