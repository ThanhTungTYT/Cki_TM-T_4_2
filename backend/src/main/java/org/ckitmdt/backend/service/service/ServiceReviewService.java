package org.ckitmdt.backend.service.service;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.service.ReviewCreateRequest;
import org.ckitmdt.backend.dto.service.ReviewPageResponseDto;
import org.ckitmdt.backend.dto.service.ReviewResponseDto;
import org.ckitmdt.backend.repository.BookingItemRepository;
import org.ckitmdt.backend.entity.Review;
import org.ckitmdt.backend.entity.BookingItem;
import org.ckitmdt.backend.entity.Service;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.ReviewRepository;
import org.ckitmdt.backend.repository.ServiceRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Objects;

@org.springframework.stereotype.Service
@RequiredArgsConstructor
public class ServiceReviewService {

    private static final int PAGE_SIZE = 10;

    private final ReviewRepository reviewRepository;
    private final BookingItemRepository bookingItemRepository;
    private final ServiceRepository serviceRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public ReviewPageResponseDto getReviews(Long serviceId, String email, int page) {
        Service service = getService(serviceId);
        User viewer = findViewer(email);
        Long customerId = viewer == null ? null : viewer.getId();
        Page<Review> result = reviewRepository.findServiceReviews(
                service.getId(), customerId, PageRequest.of(Math.max(page, 0), PAGE_SIZE)
        );
        boolean hasReviewed = customerId != null
                && reviewRepository.existsByService_IdAndCustomer_Id(serviceId, customerId);
        boolean hasCompletedServiceOrder = customerId != null
                && bookingItemRepository.existsByService_IdAndBooking_Customer_IdAndBooking_Status(
                        serviceId, customerId, "COMPLETED");

        return ReviewPageResponseDto.builder()
                .reviews(result.getContent().stream().map(review -> toDto(review, customerId)).toList())
                .page(result.getNumber())
                .size(PAGE_SIZE)
                .totalElements(result.getTotalElements())
                .hasMore(result.hasNext())
                .hasReviewed(hasReviewed)
                .canReview(hasCompletedServiceOrder && !hasReviewed)
                .build();
    }

    @Transactional
    public ReviewResponseDto createReview(Long serviceId, String email, ReviewCreateRequest request) {
        User customer = getCustomer(email);
        Service service = getService(serviceId);

        if (reviewRepository.existsByService_IdAndCustomer_Id(serviceId, customer.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bạn đã đánh giá dịch vụ này rồi.");
        }

        BookingItem completedBookingItem = bookingItemRepository
                .findFirstByService_IdAndBooking_Customer_IdAndBooking_StatusOrderByBooking_CompletedAtDesc(
                        serviceId, customer.getId(), "COMPLETED")
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Bạn chỉ có thể đánh giá sau khi đã sử dụng dịch vụ và đơn hàng hoàn tất."
                ));

        Review review = Review.builder()
                .booking(completedBookingItem.getBooking())
                .service(service)
                .customer(customer)
                .rating(request.getRating())
                .comment(request.getComment().trim())
                .createdAt(LocalDateTime.now())
                .build();

        try {
            return toDto(reviewRepository.saveAndFlush(review), customer.getId());
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bạn đã đánh giá dịch vụ này rồi.");
        }
    }

    @Transactional
    public void deleteReview(Long serviceId, Long reviewId, String email) {
        User customer = getCustomer(email);
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy bình luận."));

        if (!Objects.equals(review.getService().getId(), serviceId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy bình luận.");
        }
        if (!Objects.equals(review.getCustomer().getId(), customer.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn chỉ có thể xóa bình luận của mình.");
        }

        reviewRepository.delete(review);
    }

    private Service getService(Long serviceId) {
        return serviceRepository.findByIdAndStatusNot(serviceId, "DELETED")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy dịch vụ."));
    }

    private User findViewer(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        return userRepository.findByEmail(email).orElse(null);
    }

    private User getCustomer(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập."));
        if (!"CUSTOMER".equalsIgnoreCase(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ khách hàng mới có thể đánh giá dịch vụ.");
        }
        return user;
    }

    private ReviewResponseDto toDto(Review review, Long viewerId) {
        return ReviewResponseDto.builder()
                .id(review.getId())
                .customerId(review.getCustomer().getId())
                .customerName(review.getCustomer().getFullName())
                .rating(review.getRating())
                .comment(review.getComment())
                .createdAt(review.getCreatedAt())
                .mine(viewerId != null && viewerId.equals(review.getCustomer().getId()))
                .build();
    }
}
