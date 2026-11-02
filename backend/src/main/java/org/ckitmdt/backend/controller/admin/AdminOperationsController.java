package org.ckitmdt.backend.controller.admin;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.AdminAuditLog;
import org.ckitmdt.backend.entity.AdminNotification;
import org.ckitmdt.backend.entity.AdminStaffAssignment;
import org.ckitmdt.backend.entity.ReportTicket;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.AdminAuditLogRepository;
import org.ckitmdt.backend.repository.AdminNotificationRepository;
import org.ckitmdt.backend.repository.AdminStaffAssignmentRepository;
import org.ckitmdt.backend.repository.ReportTicketRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/admin/operations")
@RequiredArgsConstructor
public class AdminOperationsController {
    private final UserRepository userRepository;
    private final ReportTicketRepository reportTicketRepository;
    private final AdminStaffAssignmentRepository assignmentRepository;
    private final AdminNotificationRepository notificationRepository;
    private final AdminAuditLogRepository auditLogRepository;

    @GetMapping("/staff")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getStaff(
            @RequestParam(required = false) String keyword,
            Authentication authentication
    ) {
        requireAdmin(authentication);
        String search = text(keyword).toLowerCase(Locale.ROOT);

        return userRepository.findAll().stream()
                .filter(user -> "STAFF".equals(normalize(user.getRole())))
                .filter(user -> search.isBlank()
                        || text(user.getFullName()).toLowerCase(Locale.ROOT).contains(search)
                        || text(user.getEmail()).toLowerCase(Locale.ROOT).contains(search))
                .sorted((a, b) -> text(a.getFullName()).compareToIgnoreCase(text(b.getFullName())))
                .map(this::staffRow)
                .toList();
    }

    @GetMapping("/unassigned-tickets")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getUnassignedTickets(Authentication authentication) {
        requireAdmin(authentication);

        return reportTicketRepository.findTop200ByOrderByCreatedAtDesc().stream()
                .filter(ticket -> !Set.of("RESOLVED", "REJECTED").contains(normalize(ticket.getStatus())))
                .filter(ticket -> assignmentRepository.findByTicket_IdAndActiveTrue(ticket.getId()).isEmpty())
                .map(ticket -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("ticketId", ticket.getId());
                    row.put("subject", ticket.getSubject());
                    row.put("status", ticket.getStatus());
                    row.put("createdAt", ticket.getCreatedAt());
                    return row;
                })
                .toList();
    }

    @GetMapping("/assignments")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAssignments(Authentication authentication) {
        User actor = requireStaff(authentication);

        List<AdminStaffAssignment> assignments = "ADMIN".equals(normalize(actor.getRole()))
                ? assignmentRepository.findByActiveTrueOrderByAssignedAtDesc()
                : assignmentRepository.findByStaff_IdAndActiveTrueOrderByAssignedAtDesc(actor.getId());

        return assignments.stream().map(this::assignmentRow).toList();
    }

    @PostMapping("/assignments")
    @Transactional
    public Map<String, Object> assignTicket(
            @RequestBody Map<String, Object> body,
            Authentication authentication
    ) {
        User admin = requireAdmin(authentication);
        Long ticketId = number(body.get("ticketId"), "Mã khiếu nại không hợp lệ.");
        Long staffId = number(body.get("staffId"), "Mã nhân viên không hợp lệ.");
        String reason = text(body.get("reason"));
        String idempotencyKey = text(body.get("idempotencyKey"));

        if (idempotencyKey.isBlank() || idempotencyKey.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thiếu khóa chống gửi lặp.");
        }

        AdminStaffAssignment existingRequest = assignmentRepository.findByIdempotencyKey(idempotencyKey).orElse(null);
        if (existingRequest != null) return assignmentRow(existingRequest);

        if (reason.isBlank() || reason.length() > 2000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lý do phân công phải từ 1 đến 2000 ký tự.");
        }

        LocalDateTime dueAt = null;
        String dueAtValue = text(body.get("dueAt"));

        if (!dueAtValue.isBlank()) {
            try {
                dueAt = LocalDateTime.parse(dueAtValue);
            } catch (DateTimeParseException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hạn xử lý không đúng định dạng ngày giờ.");
            }

            if (!dueAt.isAfter(LocalDateTime.now())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hạn xử lý phải ở thời điểm tương lai.");
            }
        }

        ReportTicket ticket = reportTicketRepository.findByIdForUpdate(ticketId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy khiếu nại."));

        if (Set.of("RESOLVED", "REJECTED").contains(normalize(ticket.getStatus()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Khiếu nại đã kết thúc, không thể phân công.");
        }

        User staff = userRepository.findById(staffId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy nhân viên."));

        if (!"STAFF".equals(normalize(staff.getRole())) || !"ACTIVE".equals(normalize(staff.getStatus()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chỉ có thể phân công cho tài khoản Staff đang hoạt động.");
        }

        AdminStaffAssignment previous = assignmentRepository.findByTicket_IdAndActiveTrue(ticketId).orElse(null);
        String beforeValue = previous == null ? "Chưa phân công" : previous.getStaff().getEmail();

        if (previous != null) {
            previous.setActive(false);
            assignmentRepository.save(previous);
        }

        LocalDateTime now = LocalDateTime.now();

        AdminStaffAssignment assignment = assignmentRepository.save(AdminStaffAssignment.builder()
                .ticket(ticket)
                .staff(staff)
                .assignedBy(admin)
                .reason(reason)
                .dueAt(dueAt)
                .idempotencyKey(idempotencyKey)
                .active(true)
                .assignedAt(now)
                .build());

        ticket.setHandledBy(staff.getEmail());
        ticket.setUpdatedAt(now);
        reportTicketRepository.save(ticket);

        notificationRepository.save(AdminNotification.builder()
                .recipient(staff)
                .type("TICKET_ASSIGNED")
                .title("Bạn được phân công xử lý khiếu nại")
                .message("Bạn được giao xử lý khiếu nại #" + ticket.getId() + ": " + ticket.getSubject())
                .referenceType("REPORT_TICKET")
                .referenceId(ticket.getId())
                .createdAt(now)
                .build());

        auditLogRepository.save(AdminAuditLog.builder()
                .actor(admin)
                .action(previous == null ? "STAFF_ASSIGNED" : "STAFF_REASSIGNED")
                .entityType("REPORT_TICKET")
                .entityId(ticket.getId())
                .reason(reason)
                .beforeValue(beforeValue)
                .afterValue(staff.getEmail() + (dueAt == null ? "" : " | dueAt=" + dueAt))
                .createdAt(now)
                .build());

        return assignmentRow(assignment);
    }

    @GetMapping("/notifications")
    @Transactional(readOnly = true)
    public Map<String, Object> getNotifications(Authentication authentication) {
        User actor = requireStaff(authentication);
        List<AdminNotification> notifications = notificationRepository
                .findTop100ByRecipient_IdOrderByCreatedAtDesc(actor.getId());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("unreadCount", notificationRepository.countByRecipient_IdAndReadAtIsNull(actor.getId()));
        response.put("items", notifications.stream().map(this::notificationRow).toList());
        return response;
    }

    @PatchMapping("/notifications/{id}/read")
    @Transactional
    public Map<String, Object> markNotificationRead(
            @PathVariable Long id,
            Authentication authentication
    ) {
        User actor = requireStaff(authentication);
        AdminNotification notification = notificationRepository.findByIdAndRecipient_Id(id, actor.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy thông báo."));

        if (notification.getReadAt() == null) {
            notification.setReadAt(LocalDateTime.now());
            notificationRepository.save(notification);
        }

        return notificationRow(notification);
    }

    @GetMapping("/audit-logs")
    @Transactional(readOnly = true)
    public Map<String, Object> getAuditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String entityType,
            Authentication authentication
    ) {
        requireAdmin(authentication);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        PageRequest pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<AdminAuditLog> result = text(entityType).isBlank()
                ? auditLogRepository.findAllByOrderByCreatedAtDesc(pageable)
                : auditLogRepository.findByEntityTypeIgnoreCaseOrderByCreatedAtDesc(text(entityType), pageable);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", result.getContent().stream().map(this::auditRow).toList());
        response.put("page", result.getNumber());
        response.put("size", result.getSize());
        response.put("totalElements", result.getTotalElements());
        response.put("totalPages", result.getTotalPages());
        return response;
    }

    private User currentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập.");
        }

        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Không tìm thấy tài khoản."));
    }

    private User requireStaff(Authentication authentication) {
        User user = currentUser(authentication);

        if (!Set.of("ADMIN", "STAFF").contains(normalize(user.getRole()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền truy cập chức năng này.");
        }

        return user;
    }

    private User requireAdmin(Authentication authentication) {
        User user = currentUser(authentication);

        if (!"ADMIN".equals(normalize(user.getRole()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ Admin được thực hiện thao tác này.");
        }

        return user;
    }

    private Map<String, Object> staffRow(User user) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", user.getId());
        row.put("name", user.getFullName());
        row.put("email", user.getEmail());
        row.put("phone", user.getPhone());
        row.put("status", user.getStatus());
        return row;
    }

    private Map<String, Object> assignmentRow(AdminStaffAssignment assignment) {
        Map<String, Object> row = new LinkedHashMap<>();
        ReportTicket ticket = assignment.getTicket();
        row.put("id", assignment.getId());
        row.put("ticketId", ticket.getId());
        row.put("subject", ticket.getSubject());
        row.put("ticketStatus", ticket.getStatus());
        row.put("staffId", assignment.getStaff().getId());
        row.put("staffName", assignment.getStaff().getFullName());
        row.put("staffEmail", assignment.getStaff().getEmail());
        row.put("assignedBy", assignment.getAssignedBy().getEmail());
        row.put("reason", assignment.getReason());
        row.put("dueAt", assignment.getDueAt());
        row.put("assignedAt", assignment.getAssignedAt());
        row.put("idempotencyKey", assignment.getIdempotencyKey());
        row.put("active", assignment.getActive());
        return row;
    }

    private Map<String, Object> notificationRow(AdminNotification notification) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", notification.getId());
        row.put("type", notification.getType());
        row.put("title", notification.getTitle());
        row.put("message", notification.getMessage());
        row.put("referenceType", notification.getReferenceType());
        row.put("referenceId", notification.getReferenceId());
        row.put("read", notification.getReadAt() != null);
        row.put("readAt", notification.getReadAt());
        row.put("createdAt", notification.getCreatedAt());
        return row;
    }

    private Map<String, Object> auditRow(AdminAuditLog log) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", log.getId());
        row.put("actorId", log.getActor().getId());
        row.put("actorName", log.getActor().getFullName());
        row.put("actorEmail", log.getActor().getEmail());
        row.put("action", log.getAction());
        row.put("entityType", log.getEntityType());
        row.put("entityId", log.getEntityId());
        row.put("reason", log.getReason());
        row.put("beforeValue", log.getBeforeValue());
        row.put("afterValue", log.getAfterValue());
        row.put("createdAt", log.getCreatedAt());
        return row;
    }

    private Long number(Object value, String message) {
        try {
            Long result = Long.valueOf(String.valueOf(value));
            if (result <= 0) throw new NumberFormatException();
            return result;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}