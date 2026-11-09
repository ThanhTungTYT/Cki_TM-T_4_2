package org.ckitmdt.backend.controller.cleaner;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.service.booking.CleanerWorkLogService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bookings/cleaner/assignments")
@RequiredArgsConstructor
public class CleanerWorkLogController {

    private final CleanerWorkLogService cleanerWorkLogService;

    /**
     * Cleaner tạo nhật ký công việc hoặc báo sự cố.
     *
     * POST /api/bookings/cleaner/assignments/{assignmentId}/logs
     */
    @PostMapping("/{assignmentId}/logs")
    public ResponseEntity<Map<String, Object>> createLog(
            @PathVariable Long assignmentId,
            @RequestBody Map<String, Object> body,
            Authentication authentication
    ) {
        Map<String, Object> result =
                cleanerWorkLogService.createLog(
                        assignmentId,
                        body,
                        authentication.getName()
                );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(result);
    }

    /**
     * Cleaner xem nhật ký của Assignment của mình.
     *
     * GET /api/bookings/cleaner/assignments/{assignmentId}/logs
     */
    @GetMapping("/{assignmentId}/logs")
    public ResponseEntity<List<Map<String, Object>>> getLogs(
            @PathVariable Long assignmentId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(
                cleanerWorkLogService.getLogs(
                        assignmentId,
                        authentication.getName()
                )
        );
    }
}