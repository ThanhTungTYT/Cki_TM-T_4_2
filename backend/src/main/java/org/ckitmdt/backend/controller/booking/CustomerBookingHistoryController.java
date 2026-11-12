package org.ckitmdt.backend.controller.booking;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.booking.BookingResponse;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.entity.CleanerWorkLog;
import org.ckitmdt.backend.repository.CleanerWorkLogRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.ckitmdt.backend.service.booking.BookingService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/me/bookings")
@RequiredArgsConstructor
public class CustomerBookingHistoryController {

    private final BookingService bookingService;
    private final UserRepository userRepository;
    private final CleanerWorkLogRepository cleanerWorkLogRepository;

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

    @GetMapping("/{id}/work-logs")
    public ResponseEntity<List<Map<String, Object>>> getBookingWorkLogs(
            Authentication authentication,
            @PathVariable Long id
    ) {
        String email = requireCustomer(authentication);
        // Reuse the booking ownership check before returning any cleaner notes or images.
        bookingService.getBookingDetail(id, email);

        List<Map<String, Object>> logs = cleanerWorkLogRepository
                .findByBooking_IdOrderByCreatedAtDesc(id)
                .stream()
                .map(this::toWorkLogResponse)
                .toList();
        return ResponseEntity.ok(logs);
    }

    private Map<String, Object> toWorkLogResponse(CleanerWorkLog log) {
        List<String> imageUrls = log.getImageUrls() == null || log.getImageUrls().isBlank()
                ? List.of()
                : log.getImageUrls().lines().filter(line -> !line.isBlank()).toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", log.getId());
        response.put("bookingId", log.getBooking().getId());
        response.put("assignmentId", log.getAssignment().getId());
        response.put("cleanerName", log.getCleaner().getFullName());
        response.put("type", log.getLogType());
        response.put("logType", log.getLogType());
        response.put("note", log.getNote());
        response.put("imageUrls", imageUrls);
        response.put("severity", log.getIncidentSeverity());
        response.put("category", log.getIncidentCategory());
        response.put("incidentStatus", log.getIncidentStatus());
        response.put("createdAt", log.getCreatedAt());
        return response;
    }
}
