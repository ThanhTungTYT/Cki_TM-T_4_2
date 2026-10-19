package org.ckitmdt.backend.controller.report;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.ReportTicket;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.ReportTicketRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportTicketRepository reportRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;

    @PostMapping
    public Map<String, Object> create(
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        User reporter = currentUser(auth);

        String subject = text(body.get("subject"));
        String category = text(body.get("category"));
        String description = text(body.get("description"));

        if (subject.isBlank() || description.length() < 10) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng nhập tiêu đề và mô tả ít nhất 10 ký tự."
            );
        }

        Booking booking = null;

        Object bookingId = body.get("bookingId");
        String bookingCode = text(body.get("bookingCode"));

        if (!bookingCode.isBlank()) {
            booking = bookingRepository.findByBookingCode(bookingCode)
                    .orElseThrow(() ->
                            new ResponseStatusException(
                                    HttpStatus.NOT_FOUND,
                                    "Không tìm thấy đơn hàng liên quan."
                            ));
        } else if (bookingId != null
                && !String.valueOf(bookingId).isBlank()) {

            try {
                booking = bookingRepository.findById(
                                Long.valueOf(String.valueOf(bookingId)))
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Không tìm thấy đơn hàng liên quan."
                                ));
            } catch (NumberFormatException ex) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Mã đơn không hợp lệ."
                );
            }
        }

        if (booking != null) {
            boolean customer =
                    booking.getCustomer() != null
                            && booking.getCustomer().getId()
                            .equals(reporter.getId());

            boolean provider =
                    booking.getPartner() != null
                            && booking.getPartner().getUser() != null
                            && booking.getPartner().getUser().getId()
                            .equals(reporter.getId());

            boolean staff = Set.of("ADMIN", "STAFF")
                    .contains(upper(reporter.getRole()));

            if (!customer && !provider && !staff) {
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Bạn không có quyền báo cáo đơn hàng này."
                );
            }
        }

        ReportTicket saved = reportRepository.save(
                ReportTicket.builder()
                        .reporter(reporter)
                        .booking(booking)
                        .subject(subject.trim())
                        .category(category.isBlank()
                                ? "OTHER" : category)
                        .reportedRole(text(body.get("reportedRole")))
                        .reportedName(text(body.get("reportedName")))
                        .description(description.trim())
                        .evidenceUrl(text(body.get("evidenceUrl")))
                        .status("OPEN")
                        .createdAt(LocalDateTime.now())
                        .build()
        );

        return row(saved);
    }

    @GetMapping("/mine")
    public List<Map<String, Object>> mine(Authentication auth) {
        User user = currentUser(auth);

        return reportRepository
                .findByReporterIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::row)
                .toList();
    }

    private User currentUser(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Vui lòng đăng nhập."
            );
        }

        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.UNAUTHORIZED,
                                "Không tìm thấy tài khoản."
                        ));
    }

    private Map<String, Object> row(ReportTicket r) {
        Map<String, Object> m = new LinkedHashMap<>();

        m.put("id", r.getId());
        m.put("subject", r.getSubject());
        m.put("category", r.getCategory());
        m.put("reportedRole", r.getReportedRole());
        m.put("reportedName", r.getReportedName());
        m.put("description", r.getDescription());
        m.put("evidenceUrl", r.getEvidenceUrl());
        m.put("status", r.getStatus());
        m.put("resolution", r.getResolution());
        m.put("handledBy", r.getHandledBy());
        m.put("createdAt", r.getCreatedAt());
        m.put("updatedAt", r.getUpdatedAt());

        m.put("reporterName",
                r.getReporter() == null
                        ? "" : r.getReporter().getFullName());

        m.put("reporterEmail",
                r.getReporter() == null
                        ? "" : r.getReporter().getEmail());

        m.put("bookingId",
                r.getBooking() == null
                        ? null : r.getBooking().getId());

        m.put("bookingCode",
                r.getBooking() == null
                        ? "" : r.getBooking().getBookingCode());

        return m;
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String upper(String value) {
        return value == null
                ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}
