package org.ckitmdt.backend.service.service;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.service.ReviewCreateRequest;
import org.ckitmdt.backend.dto.service.ReviewPageResponseDto;
import org.ckitmdt.backend.dto.service.ReviewResponseDto;
import org.ckitmdt.backend.entity.BookingAssignment;
import org.ckitmdt.backend.entity.BookingItem;
import org.ckitmdt.backend.entity.Employee;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.entity.Review;
import org.ckitmdt.backend.entity.Service;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.BookingAssignmentRepository;
import org.ckitmdt.backend.repository.BookingItemRepository;
import org.ckitmdt.backend.repository.EmployeeRepository;
import org.ckitmdt.backend.repository.PartnerRepository;
import org.ckitmdt.backend.repository.ReviewRepository;
import org.ckitmdt.backend.repository.ServiceRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@org.springframework.stereotype.Service
@RequiredArgsConstructor
public class ServiceReviewService {

    private static final int PAGE_SIZE = 10;

    private final ReviewRepository reviewRepository;
    private final BookingItemRepository bookingItemRepository;
    private final BookingAssignmentRepository bookingAssignmentRepository;
    private final PartnerRepository partnerRepository;
    private final EmployeeRepository employeeRepository;
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
        boolean hasUnreviewedCompletedOrder = customerId != null
                && findNextUnreviewedCompletedItem(serviceId, customerId) != null;

        return ReviewPageResponseDto.builder()
                .reviews(result.getContent().stream().map(review -> toDto(review, customerId)).toList())
                .page(result.getNumber())
                .size(PAGE_SIZE)
                .totalElements(result.getTotalElements())
                .hasMore(result.hasNext())
                .hasReviewed(hasReviewed)
                .canReview(hasUnreviewedCompletedOrder)
                .build();
    }

    @Transactional
    public ReviewResponseDto createReview(Long serviceId, String email, ReviewCreateRequest request) {
        User customer = getCustomer(email);
        Service service = getService(serviceId);

        if (request == null || request.getRating() == null || request.getRating() < 1
                || request.getRating() > 5 || request.getComment() == null
                || request.getComment().isBlank() || request.getComment().length() > 2000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Đánh giá cần có số sao từ 1 đến 5 và nội dung tối đa 2000 ký tự.");
        }

        BookingItem completedBookingItem = findNextUnreviewedCompletedItem(serviceId, customer.getId());
        if (completedBookingItem == null) {
            boolean hasAnyCompleted = bookingItemRepository
                    .existsByService_IdAndBooking_Customer_IdAndBooking_Status(serviceId, customer.getId(), "COMPLETED");
            if (hasAnyCompleted) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Bạn đã đánh giá tất cả đơn hoàn thành của dịch vụ này.");
            }
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn chỉ có thể đánh giá sau khi đã sử dụng dịch vụ và đơn hàng hoàn tất."
            );
        }

        Employee assignedEmployee = bookingAssignmentRepository
                .findByBooking_IdOrderByIdAsc(completedBookingItem.getBooking().getId())
                .stream()
                .map(BookingAssignment::getEmployee)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);

        Review review = Review.builder()
                .booking(completedBookingItem.getBooking())
                .service(service)
                .partner(completedBookingItem.getBooking().getPartner())
                .employee(assignedEmployee)
                .customer(customer)
                .rating(request.getRating())
                .comment(request.getComment().trim())
                .createdAt(LocalDateTime.now())
                .build();

        try {
            Review saved = reviewRepository.saveAndFlush(review);
            syncRatingAverages(saved.getPartner(), saved.getEmployee());
            return toDto(saved, customer.getId());
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bạn đã đánh giá dịch vụ này cho đơn hàng này rồi.");
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

        Partner partner = review.getPartner();
        Employee employee = review.getEmployee();
        reviewRepository.delete(review);
        reviewRepository.flush();
        syncRatingAverages(partner, employee);
    }

    @Transactional
    public ReviewResponseDto updateReview(Long serviceId, Long reviewId, String email, ReviewCreateRequest request) {
        User customer = getCustomer(email);
        Service service = getService(serviceId);
        if (request == null || request.getRating() == null || request.getRating() < 1
                || request.getRating() > 5 || request.getComment() == null
                || request.getComment().isBlank() || request.getComment().length() > 2000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Đánh giá cần có số sao từ 1 đến 5 và nội dung tối đa 2000 ký tự.");
        }

        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đánh giá."));
        if (!Objects.equals(review.getService().getId(), service.getId())
                || !Objects.equals(review.getCustomer().getId(), customer.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đánh giá của bạn.");
        }

        review.setRating(request.getRating());
        review.setComment(request.getComment().trim());
        review.setUpdatedAt(LocalDateTime.now());
        Review saved = reviewRepository.saveAndFlush(review);
        syncRatingAverages(saved.getPartner(), saved.getEmployee());
        return toDto(saved, customer.getId());
    }

    private BookingItem findNextUnreviewedCompletedItem(Long serviceId, Long customerId) {
        List<BookingItem> completedItems = bookingItemRepository
                .findByService_IdAndBooking_Customer_IdAndBooking_StatusOrderByBooking_CompletedAtDesc(
                        serviceId, customerId, "COMPLETED");
        for (BookingItem item : completedItems) {
            if (item.getBooking() != null
                    && !reviewRepository.existsByBooking_IdAndService_Id(item.getBooking().getId(), serviceId)) {
                return item;
            }
        }
        return null;
    }

    private void syncRatingAverages(Partner partner, Employee employee) {
        if (partner != null && partner.getId() != null) {
            Double avg = reviewRepository.averageRatingByPartnerId(partner.getId());
            partner.setRatingAverage(avg == null ? null : BigDecimal.valueOf(avg).setScale(2, RoundingMode.HALF_UP));
            partnerRepository.save(partner);
        }
        if (employee != null && employee.getId() != null) {
            Double avg = reviewRepository.averageRatingByEmployeeId(employee.getId());
            employee.setRatingAverage(avg == null ? null : BigDecimal.valueOf(avg).setScale(2, RoundingMode.HALF_UP));
            employeeRepository.save(employee);
        }
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
        String normalizedRole = user.getRole() == null
                ? ""
                : user.getRole().trim().toUpperCase(Locale.ROOT).replaceFirst("^ROLE_", "");
        if (!"CUSTOMER".equals(normalizedRole)) {
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
                .mine(viewerId != null && Objects.equals(review.getCustomer().getId(), viewerId))
                .build();
    }
}
