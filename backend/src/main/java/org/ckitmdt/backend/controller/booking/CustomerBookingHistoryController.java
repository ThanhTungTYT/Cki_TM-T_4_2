
package org.ckitmdt.backend.controller.booking;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.booking.BookingHistoryResponseDto;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.UserRepository;
import org.ckitmdt.backend.service.booking.CustomerBookingHistoryService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/v1/me/bookings")
@RequiredArgsConstructor
public class CustomerBookingHistoryController {

    private final CustomerBookingHistoryService customerBookingHistoryService;
    private final UserRepository userRepository;

    private Long getCurrentCustomerId(Authentication authentication) {
        if (authentication == null
                || authentication.getName() == null
                || authentication.getName().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Bạn cần đăng nhập để xem lịch sử đơn hàng."
            );
        }

        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Không tìm thấy tài khoản đăng nhập."
                ));

        if (!"CUSTOMER".equalsIgnoreCase(user.getRole())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Chức năng này chỉ dành cho khách hàng."
            );
        }

        return user.getId();
    }

    @GetMapping
    public ResponseEntity<List<BookingHistoryResponseDto>> getMyBookings(
            Authentication authentication,
            @RequestParam(required = false) String status
    ) {
        Long customerId = getCurrentCustomerId(authentication);

        return ResponseEntity.ok(
                customerBookingHistoryService.getCustomerBookings(customerId, status)
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<Booking> getBookingDetail(
            Authentication authentication,
            @PathVariable Long id
    ) {
        Long customerId = getCurrentCustomerId(authentication);

        return ResponseEntity.ok(
                customerBookingHistoryService.getBookingDetail(id, customerId)
        );
    }
}
