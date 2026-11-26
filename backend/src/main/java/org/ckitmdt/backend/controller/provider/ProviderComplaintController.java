package org.ckitmdt.backend.controller.provider;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.AdminNotification;
import org.ckitmdt.backend.entity.ComplaintResponse;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.entity.ReportTicket;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.AdminNotificationRepository;
import org.ckitmdt.backend.repository.ComplaintResponseRepository;
import org.ckitmdt.backend.repository.ReportTicketRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.ckitmdt.backend.service.CustomerNotificationService;
import org.ckitmdt.backend.service.admin.AdminAuditLogService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static org.ckitmdt.backend.controller.provider.ProviderSecurityHelper.normalize;
import static org.ckitmdt.backend.controller.provider.ProviderSecurityHelper.text;

@RestController
@RequestMapping("/api/provider/complaints")
@RequiredArgsConstructor
public class ProviderComplaintController {

    private final ProviderSecurityHelper helper;
    private final ReportTicketRepository reportTicketRepository;
    private final ComplaintResponseRepository complaintResponseRepository;
    private final AdminNotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final CustomerNotificationService customerNotificationService;
    private final AdminAuditLogService auditLogService;

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getComplaints(Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        return reportTicketRepository.findByBooking_Partner_IdOrderByCreatedAtDesc(partner.getId())
                .stream()
                .map(this::complaintRow)
                .toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Map<String, Object> getComplaintDetail(@PathVariable Long id, Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        ReportTicket ticket = reportTicketRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khiếu nại."));

        if (ticket.getBooking() == null || ticket.getBooking().getPartner() == null
                || !ticket.getBooking().getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem khiếu nại này.");
        }

        Map<String, Object> row = complaintRow(ticket);
        List<Map<String, Object>> responses = complaintResponseRepository
                .findByTicket_IdOrderByCreatedAtAsc(ticket.getId())
                .stream()
                .map(this::complaintResponseRow)
                .toList();
        row.put("responses", responses);
        return row;
    }

    @PostMapping("/{id}/responses")
    @Transactional
    public Map<String, Object> respondComplaint(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        User user = helper.currentUser(auth);
        Partner partner = helper.currentPartner(auth);

        ReportTicket ticket = reportTicketRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy khiếu nại."
                ));

        if (ticket.getBooking() == null
                || ticket.getBooking().getPartner() == null
                || !ticket.getBooking().getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền phản hồi khiếu nại này."
            );
        }

        String currentStatus = normalize(ticket.getStatus());

        if ("RESOLVED".equals(currentStatus)
                || "REJECTED".equals(currentStatus)
                || "CLOSED".equals(currentStatus)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Khiếu nại đã kết thúc xử lý, không thể gửi giải trình mới."
            );
        }

        String content = text(body.get("content"));
        String evidenceUrl = text(body.get("evidenceUrl"));

        if (content.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Nội dung giải trình không được để trống."
            );
        }

        if (content.length() > 10000 || (evidenceUrl != null && evidenceUrl.length() > 1000)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Nội dung hoặc liên kết bằng chứng vượt quá giới hạn cho phép."
            );
        }

        String safeEvidenceUrl = null;
        if (evidenceUrl != null && !evidenceUrl.isBlank()) {
            String lower = evidenceUrl.toLowerCase(Locale.ROOT);
            if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Liên kết bằng chứng phải bắt đầu bằng http:// hoặc https://."
                );
            }
            safeEvidenceUrl = evidenceUrl;
        }

        LocalDateTime now = LocalDateTime.now();

        ComplaintResponse response = ComplaintResponse.builder()
                .ticket(ticket)
                .author(user)
                .authorName(partner.getBusinessName())
                .authorRole("PROVIDER")
                .content(content)
                .evidenceUrl(safeEvidenceUrl)
                .createdAt(now)
                .build();

        ComplaintResponse saved = complaintResponseRepository.save(response);

        String oldStatus = ticket.getStatus();
        // Không kéo lùi ticket đang ở trạng thái UNDER_REVIEW (đã chuyển Admin thẩm định)
        if (Set.of("OPEN", "IN_PROGRESS", "WAITING_PROVIDER").contains(currentStatus)) {
            ticket.setStatus("PROVIDER_RESPONDED");
        }
        ticket.setUpdatedAt(now);
        reportTicketRepository.save(ticket);

        auditLogService.record(
                auth,
                "PROVIDER_RESPOND_COMPLAINT",
                "REPORT_TICKET",
                ticket.getId(),
                content,
                "status=" + oldStatus,
                "status=" + ticket.getStatus()
        );

        // Thông báo cho khách hàng
        if (ticket.getReporter() != null) {
            customerNotificationService.notifyCustomer(
                    ticket.getReporter(),
                    "REPORT_PROVIDER_RESPONDED",
                    "Nhà cung cấp đã phản hồi khiếu nại #" + ticket.getId(),
                    "Đối tác " + partner.getBusinessName() + " đã gửi giải trình cho khiếu nại \"" + ticket.getSubject() + "\".",
                    "REPORT_TICKET",
                    ticket.getId()
            );
        }

        // Thông báo cho Staff phụ trách hoặc toàn bộ Admin/Staff hoạt động
        String notifyTitle = "Nhà cung cấp phản hồi khiếu nại #" + ticket.getId();
        String notifyMessage = "Đối tác " + partner.getBusinessName() + " vừa gửi giải trình cho khiếu nại #"
                + ticket.getId() + " (" + ticket.getSubject() + ").";
        List<User> recipients = new java.util.ArrayList<>();
        if (ticket.getHandledBy() != null && !ticket.getHandledBy().isBlank()) {
            userRepository.findByEmail(ticket.getHandledBy().trim())
                    .filter(u -> "ACTIVE".equalsIgnoreCase(u.getStatus()))
                    .ifPresent(recipients::add);
        }
        if (recipients.isEmpty()) {
            recipients.addAll(userRepository.findByRoleIgnoreCaseAndStatusIgnoreCase("ADMIN", "ACTIVE"));
            recipients.addAll(userRepository.findByRoleIgnoreCaseAndStatusIgnoreCase("STAFF", "ACTIVE"));
        }
        for (User recipient : recipients) {
            notificationRepository.save(AdminNotification.builder()
                    .recipient(recipient)
                    .type("PROVIDER_COMPLAINT_RESPONDED")
                    .title(notifyTitle)
                    .message(notifyMessage)
                    .referenceType("REPORT_TICKET")
                    .referenceId(ticket.getId())
                    .createdAt(now)
                    .build());
        }

        return complaintResponseRow(saved);
    }

    public Map<String, Object> complaintRow(ReportTicket c) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", c.getId());
        map.put("subject", c.getSubject());
        map.put("category", c.getCategory());
        map.put("description", c.getDescription());
        String rawEvidence = c.getEvidenceUrl();
        String mappedEvidence = rawEvidence;
        if (rawEvidence != null && !rawEvidence.isBlank()
                && !rawEvidence.startsWith("http://")
                && !rawEvidence.startsWith("https://")
                && !rawEvidence.startsWith("/api/")) {
            mappedEvidence = "/api/reports/" + c.getId() + "/evidence";
        }
        map.put("evidenceUrl", mappedEvidence);
        map.put("status", c.getStatus());
        map.put("resolution", c.getResolution());
        map.put("handledBy", c.getHandledBy());
        map.put("createdAt", c.getCreatedAt());
        map.put("updatedAt", c.getUpdatedAt());
        if (c.getBooking() != null) {
            map.put("bookingId", c.getBooking().getId());
            map.put("bookingCode", c.getBooking().getBookingCode());
        }
        if (c.getReporter() != null) {
            map.put("reporterName", c.getReporter().getFullName());
            map.put("reporterPhone", c.getReporter().getPhone());
        }
        return map;
    }

    public Map<String, Object> complaintResponseRow(ComplaintResponse cr) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", cr.getId());
        map.put("ticketId", cr.getTicket().getId());
        map.put("authorName", cr.getAuthorName());
        map.put("authorRole", cr.getAuthorRole());
        map.put("content", cr.getContent());
        map.put("evidenceUrl", cr.getEvidenceUrl());
        map.put("createdAt", cr.getCreatedAt());
        return map;
    }
}
