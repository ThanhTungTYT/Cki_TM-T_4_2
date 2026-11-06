package org.ckitmdt.backend.controller.report;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.ComplaintResponse;
import org.ckitmdt.backend.entity.ReportTicket;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.ComplaintResponseRepository;
import org.ckitmdt.backend.repository.ReportTicketRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.ckitmdt.backend.service.CustomerNotificationService;
import org.ckitmdt.backend.entity.AdminNotification;
import org.ckitmdt.backend.repository.AdminNotificationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportTicketRepository reportRepository;
    private final ComplaintResponseRepository responseRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final CustomerNotificationService customerNotificationService;
    private final AdminNotificationRepository notificationRepository;

    @PostMapping
    @Transactional
    public Map<String, Object> create(
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        User reporter = currentUser(auth);

        String subject = text(body.get("subject"));
        String category = text(body.get("category"));
        String description = text(body.get("description"));
        String reportedRole = text(body.get("reportedRole"));
        String reportedName = text(body.get("reportedName"));
        String evidenceUrl = text(body.get("evidenceUrl"));

        if (subject.isBlank() || subject.length() > 120) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Tiêu đề không được để trống và không vượt quá 120 ký tự."
            );
        }

        if (description.length() < 10 || description.length() > 10000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Nội dung khiếu nại phải từ 10 đến 10000 ký tự."
            );
        }

        if (reportedRole.length() > 30 || reportedName.length() > 150
                || evidenceUrl.length() > 1000 || category.length() > 40) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thông tin khiếu nại vượt quá giới hạn cho phép."
            );
        }

        Booking booking = resolveBooking(body);

        if (booking != null && !canAccessBooking(reporter, booking)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền báo cáo đơn hàng này."
            );
        }

        LocalDateTime now = LocalDateTime.now();

        ReportTicket report = ReportTicket.builder()
                .reporter(reporter)
                .booking(booking)
                .subject(subject)
                .category(category.isBlank() ? "OTHER" : category)
                .reportedRole(reportedRole.isBlank() ? null : reportedRole)
                .reportedName(reportedName.isBlank() ? null : reportedName)
                .description(description)
                .evidenceUrl(evidenceUrl.isBlank() ? null : evidenceUrl)
                .status("OPEN")
                .createdAt(now)
                .updatedAt(now)
                .build();

        return row(reportRepository.save(report));
    }

    @GetMapping("/mine")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> mine(Authentication auth) {
        User user = currentUser(auth);

        return reportRepository
                .findByReporterIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(this::row)
                .toList();
    }

    @GetMapping("/admin")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllReports(Authentication auth) {
        requireStaff(auth);

        return reportRepository.findTop200ByOrderByCreatedAtDesc()
                .stream()
                .map(this::row)
                .toList();
    }

    @GetMapping("/{id}/responses")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getResponses(
            @PathVariable Long id,
            Authentication auth) {

        User user = currentUser(auth);
        ReportTicket report = findReport(id);

        requireReportAccess(user, report);

        return responseRepository
                .findByTicket_IdOrderByCreatedAtAsc(id)
                .stream()
                .map(this::responseRow)
                .toList();
    }

    @PostMapping("/{id}/responses")
    @Transactional
    public Map<String, Object> addResponse(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        User user = currentUser(auth);
        ReportTicket report = reportRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy khiếu nại."
                ));

        requireReportAccess(user, report);
        ensureNotTerminal(report);

        String content = text(body.get("content"));
        String evidenceUrl = text(body.get("evidenceUrl"));

        if (evidenceUrl.isBlank()) {
            evidenceUrl = text(body.get("attachmentUrl"));
        }

        if (content.isBlank() || content.length() > 10000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Nội dung phản hồi phải từ 1 đến 10000 ký tự."
            );
        }

        if (evidenceUrl.length() > 1000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Liên kết tệp đính kèm không được vượt quá 1000 ký tự."
            );
        }

        String role = upper(user.getRole());
        String authorName = text(user.getFullName());

        if (authorName.isBlank()) {
            authorName = text(user.getEmail());
        }

        if (isProviderForReport(user, report)) {
            role = "PROVIDER";
            authorName = providerName(report, authorName);
        }

        LocalDateTime now = LocalDateTime.now();

        ComplaintResponse response = ComplaintResponse.builder()
                .ticket(report)
                .author(user)
                .authorName(authorName)
                .authorRole(role)
                .content(content)
                .evidenceUrl(evidenceUrl.isBlank() ? null : evidenceUrl)
                .createdAt(now)
                .build();

        ComplaintResponse saved = responseRepository.save(response);

        if (isProviderForReport(user, report)) {
            report.setStatus("PROVIDER_RESPONDED");
            report.setUpdatedAt(now);
        } else if (isStaff(user)) {
            report.setStatus("IN_PROGRESS");
            report.setHandledBy(user.getEmail());
            report.setUpdatedAt(now);
        }

        reportRepository.save(report);

        if ("CUSTOMER".equals(upper(report.getReporter().getRole()))) {
            customerNotificationService.notifyCustomer(report.getReporter(), "COMPLAINT_RESPONSE",
                    "Khiếu nại có phản hồi mới", "Khiếu nại '" + report.getSubject() + "' đã có phản hồi mới.",
                    "COMPLAINT", report.getId());
        }

        return responseRow(saved);
    }

    @PutMapping("/{id}/status")
    @Transactional
    public Map<String, Object> updateReportStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        User operator = requireStaff(auth);

        ReportTicket report = reportRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy khiếu nại."
                ));

        ensureNotTerminal(report);

        String status = upper(text(body.get("status")));
        String resolution = text(body.get("resolution"));

        if (!Set.of("IN_PROGRESS", "RESOLVED", "REJECTED").contains(status)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trạng thái xử lý không hợp lệ."
            );
        }

        if (("RESOLVED".equals(status) || "REJECTED".equals(status))
                && resolution.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng nhập kết quả xử lý trước khi kết thúc khiếu nại."
            );
        }

        if (resolution.length() > 10000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Kết quả xử lý không được vượt quá 10000 ký tự."
            );
        }

        LocalDateTime now = LocalDateTime.now();
        String oldResolution = text(report.getResolution());

        if (!resolution.isBlank() && !resolution.equals(oldResolution)) {
            String authorName = text(operator.getFullName());

            if (authorName.isBlank()) {
                authorName = text(operator.getEmail());
            }

            ComplaintResponse response = ComplaintResponse.builder()
                    .ticket(report)
                    .author(operator)
                    .authorName(authorName)
                    .authorRole(upper(operator.getRole()))
                    .content(resolution)
                    .createdAt(now)
                    .build();

            responseRepository.save(response);
        }

        report.setStatus(status);
        report.setResolution(resolution.isBlank() ? null : resolution);
        report.setHandledBy(operator.getEmail());
        report.setUpdatedAt(now);

        ReportTicket saved = reportRepository.save(report);
        if ("CUSTOMER".equals(upper(saved.getReporter().getRole()))) {
            customerNotificationService.notifyCustomer(saved.getReporter(), "COMPLAINT_" + status,
                    "Cập nhật khiếu nại", "Khiếu nại '" + saved.getSubject() + "' đã chuyển sang trạng thái " + status + ".",
                    "COMPLAINT", saved.getId());
        }
        if (saved.getBooking() != null && saved.getBooking().getPartner() != null && saved.getBooking().getPartner().getUser() != null) {
            notificationRepository.save(AdminNotification.builder()
                    .recipient(saved.getBooking().getPartner().getUser())
                    .type("COMPLAINT_" + status)
                    .title("Khiếu nại #" + saved.getId() + " đã được xử lý (" + status + ")")
                    .message("Khiếu nại liên quan đến đơn hàng #" + saved.getBooking().getBookingCode() + " đã được cập nhật trạng thái " + status + (resolution.isBlank() ? "." : ": " + resolution))
                    .referenceType("REPORT_TICKET")
                    .referenceId(saved.getId())
                    .createdAt(now)
                    .build());
        }
        return row(saved);
    }

    private Booking resolveBooking(Map<String, Object> body) {
        String bookingCode = text(body.get("bookingCode"));
        Object bookingId = body.get("bookingId");

        if (!bookingCode.isBlank()) {
            return bookingRepository.findByBookingCode(bookingCode)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Không tìm thấy đơn hàng liên quan."
                    ));
        }

        if (bookingId == null || String.valueOf(bookingId).isBlank()) {
            return null;
        }

        try {
            return bookingRepository.findById(Long.valueOf(String.valueOf(bookingId)))
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Không tìm thấy đơn hàng liên quan."
                    ));
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Mã đơn hàng không hợp lệ."
            );
        }
    }

    private User currentUser(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Vui lòng đăng nhập."
            );
        }

        return userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Không tìm thấy tài khoản."
                ));
    }

    private User requireStaff(Authentication auth) {
        User user = currentUser(auth);

        if (!isStaff(user)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền xử lý khiếu nại."
            );
        }

        return user;
    }

    private boolean isStaff(User user) {
        return Set.of("ADMIN", "STAFF", "ROLE_ADMIN", "ROLE_STAFF")
                .contains(upper(user.getRole()));
    }

    private ReportTicket findReport(Long id) {
        return reportRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy khiếu nại."
                ));
    }

    private void ensureNotTerminal(ReportTicket report) {
        String status = upper(report.getStatus());

        if ("RESOLVED".equals(status) || "REJECTED".equals(status)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Khiếu nại đã kết thúc xử lý, không thể tiếp tục thay đổi."
            );
        }
    }

    private void requireReportAccess(User user, ReportTicket report) {
        if (isStaff(user)) {
            return;
        }

        if (report.getReporter() != null
                && Objects.equals(report.getReporter().getId(), user.getId())) {
            return;
        }

        if (isProviderForReport(user, report)) {
            return;
        }

        throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Bạn không có quyền xem hoặc phản hồi khiếu nại này."
        );
    }

    private boolean isProviderForReport(User user, ReportTicket report) {
        Booking booking = report.getBooking();

        return booking != null
                && booking.getPartner() != null
                && booking.getPartner().getUser() != null
                && Objects.equals(
                booking.getPartner().getUser().getId(),
                user.getId()
        );
    }

    private String providerName(ReportTicket report, String fallback) {
        if (report.getBooking() != null
                && report.getBooking().getPartner() != null) {
            String businessName = text(
                    report.getBooking().getPartner().getBusinessName()
            );

            if (!businessName.isBlank()) {
                return businessName;
            }
        }

        return fallback;
    }

    private boolean canAccessBooking(User user, Booking booking) {
        if (isStaff(user)) {
            return true;
        }

        boolean customer = booking.getCustomer() != null
                && Objects.equals(
                booking.getCustomer().getId(),
                user.getId()
        );

        boolean provider = booking.getPartner() != null
                && booking.getPartner().getUser() != null
                && Objects.equals(
                booking.getPartner().getUser().getId(),
                user.getId()
        );

        return customer || provider;
    }

    private Map<String, Object> row(ReportTicket report) {
        Map<String, Object> map = new LinkedHashMap<>();

        map.put("id", report.getId());
        map.put("subject", report.getSubject());
        map.put("category", report.getCategory());
        map.put("reportedRole", report.getReportedRole());
        map.put("reportedName", report.getReportedName());
        map.put("description", report.getDescription());
        map.put("evidenceUrl", report.getEvidenceUrl());
        map.put("status", report.getStatus());
        map.put("resolution", report.getResolution());
        map.put("handledBy", report.getHandledBy());
        map.put("createdAt", report.getCreatedAt());
        map.put("updatedAt", report.getUpdatedAt());

        map.put(
                "reporterName",
                report.getReporter() == null
                        ? ""
                        : report.getReporter().getFullName()
        );

        map.put(
                "reporterEmail",
                report.getReporter() == null
                        ? ""
                        : report.getReporter().getEmail()
        );

        map.put(
                "bookingId",
                report.getBooking() == null
                        ? null
                        : report.getBooking().getId()
        );

        map.put(
                "bookingCode",
                report.getBooking() == null
                        ? ""
                        : report.getBooking().getBookingCode()
        );

        return map;
    }

    private Map<String, Object> responseRow(ComplaintResponse response) {
        Map<String, Object> map = new LinkedHashMap<>();

        map.put("id", response.getId());
        map.put("ticketId", response.getTicket().getId());
        map.put("authorName", response.getAuthorName());
        map.put("authorRole", response.getAuthorRole());
        map.put("content", response.getContent());
        map.put("evidenceUrl", response.getEvidenceUrl());
        map.put("createdAt", response.getCreatedAt());
        map.put("responderName", response.getAuthorName());
        map.put("responderRole", response.getAuthorRole());
        map.put("attachmentUrl", response.getEvidenceUrl());

        return map;
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String upper(String value) {
        return value == null
                ? ""
                : value.trim().toUpperCase(Locale.ROOT);
    }
}
