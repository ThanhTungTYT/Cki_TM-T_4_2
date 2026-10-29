package org.ckitmdt.backend.controller.service;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.service.ReviewCreateRequest;
import org.ckitmdt.backend.dto.service.ReviewPageResponseDto;
import org.ckitmdt.backend.dto.service.ReviewResponseDto;
import org.ckitmdt.backend.service.service.ServiceReviewService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/services/{serviceId}/reviews")
public class ServiceReviewController {

    private final ServiceReviewService serviceReviewService;

    @GetMapping
    public ReviewPageResponseDto getReviews(
            @PathVariable Long serviceId,
            @RequestParam(defaultValue = "0") int page,
            Authentication authentication
    ) {
        return serviceReviewService.getReviews(
                serviceId,
                authentication == null ? null : authentication.getName(),
                page
        );
    }

    @PostMapping
    public ResponseEntity<ReviewResponseDto> createReview(
            @PathVariable Long serviceId,
            @Valid @RequestBody ReviewCreateRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                serviceReviewService.createReview(serviceId, authentication.getName(), request)
        );
    }

    @DeleteMapping("/{reviewId}")
    public ResponseEntity<Void> deleteReview(
            @PathVariable Long serviceId,
            @PathVariable Long reviewId,
            Authentication authentication
    ) {
        serviceReviewService.deleteReview(serviceId, reviewId, authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
