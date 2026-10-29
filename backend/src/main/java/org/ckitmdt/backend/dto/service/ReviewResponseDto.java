package org.ckitmdt.backend.dto.service;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDateTime;

@Value
@Builder
public class ReviewResponseDto {
    Long id;
    Long customerId;
    String customerName;
    Integer rating;
    String comment;
    LocalDateTime createdAt;
    boolean mine;
}
