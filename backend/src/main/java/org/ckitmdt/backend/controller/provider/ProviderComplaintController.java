package org.ckitmdt.backend.controller.provider;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.ComplaintResponse;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.entity.ReportTicket;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.ComplaintResponseRepository;
import org.ckitmdt.backend.repository.ReportTicketRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.ckitmdt.backend.controller.provider.ProviderSecurityHelper.normalize;
import static org.ckitmdt.backend.controller.provider.ProviderSecurityHelper.text;

@RestController
@RequestMapping("/api/provider/complaints")
@RequiredArgsConstructor
public class ProviderComplaintController {

    private final ProviderSecurityHelper helper;
    private final ReportTicketRepository reportTicketRepository;
    private final ComplaintResponseRepository complaintResponseRepository;

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

        ReportTicket ticket = reportTicketRepository.findById(id)
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

        if ("RESOLVED".equals(currentStatus) || "REJECTED".equals(currentStatus)) {
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

        LocalDateTime now = LocalDateTime.now();

        ComplaintResponse response = ComplaintResponse.builder()
                .ticket(ticket)
                .author(user)
                .authorName(partner.getBusinessName())
                .authorRole("PROVIDER")
                .content(content)
                .evidenceUrl(evidenceUrl != null && !evidenceUrl.isBlank() ? evidenceUrl : null)
                .createdAt(now)
                .build();

        ComplaintResponse saved = complaintResponseRepository.save(response);

        ticket.setStatus("PROVIDER_RESPONDED");
        ticket.setUpdatedAt(now);
        reportTicketRepository.save(ticket);

        return complaintResponseRow(saved);
    }

    public Map<String, Object> complaintRow(ReportTicket c) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", c.getId());
        map.put("subject", c.getSubject());
        map.put("category", c.getCategory());
        map.put("description", c.getDescription());
        map.put("evidenceUrl", c.getEvidenceUrl());
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
