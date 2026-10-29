package org.ckitmdt.backend.dto.service;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class ReviewPageResponseDto {
    List<ReviewResponseDto> reviews;
    int page;
    int size;
    long totalElements;
    boolean hasMore;
    boolean hasReviewed;
    boolean canReview;
}
