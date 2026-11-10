package org.ckitmdt.backend.controller.booking;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.booking.BookingResponse;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.UserRepository;
import org.ckitmdt.backend.service.booking.BookingService;
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

    private final BookingService bookingService;
    private final UserRepository userRepository;

    private String requireCustomer(Authentication authentication) {
        if (authentication == null || authentication.getName() == null
                || authentication.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "Bạn cần đăng nhập để xem lịch sử đơn hàng.");
        }

        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "Không tìm thấy tài khoản đăng nhập."));
        String role = user.getRole() == null ? "" : user.getRole().replace("ROLE_", "");
        if (!"CUSTOMER".equalsIgnoreCase(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Chức năng này chỉ dành cho khách hàng.");
        }
        return user.getEmail();
    }

    @GetMapping
    public ResponseEntity<List<BookingResponse>> getMyBookings(
            Authentication authentication,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(bookingService.getMyBookings(requireCustomer(authentication), status));
    }

    @GetMapping("/{id}")
    public ResponseEntity<BookingResponse> getBookingDetail(
            Authentication authentication,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(bookingService.getBookingDetail(id, requireCustomer(authentication)));
    }
}
