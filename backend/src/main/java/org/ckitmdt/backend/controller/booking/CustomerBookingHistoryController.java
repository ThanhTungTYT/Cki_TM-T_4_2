package org.ckitmdt.backend.controller.booking;

import org.ckitmdt.backend.dto.booking.BookingHistoryResponseDto;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.service.booking.CustomerBookingHistoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/me/bookings")
@CrossOrigin(origins = "*")
public class CustomerBookingHistoryController {

    @Autowired
    private CustomerBookingHistoryService customerBookingHistoryService;

    // Giả định Lấy ID Customer đăng nhập (Đang để mặc định ID = 1 để test)
    private Long getCurrentCustomerId() {
        return 1L;
    }

    @GetMapping
    public ResponseEntity<List<BookingHistoryResponseDto>> getMyBookings(
            @RequestParam(required = false) String status
    ) {
        Long customerId = getCurrentCustomerId();
        List<BookingHistoryResponseDto> result = customerBookingHistoryService.getCustomerBookings(customerId, status);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Booking> getBookingDetail(@PathVariable Long id) {
        Long customerId = getCurrentCustomerId();
        Booking booking = customerBookingHistoryService.getBookingDetail(id, customerId);
        return ResponseEntity.ok(booking);
    }
}