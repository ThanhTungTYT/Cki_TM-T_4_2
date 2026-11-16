
package org.ckitmdt.backend.controller.cleaner;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.booking.CleanerOvertimeRequestCreateRequest;
import org.ckitmdt.backend.service.booking.CleanerOvertimeRequestService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/cleaner/assignments")
@RequiredArgsConstructor
public class CleanerOvertimeRequestController {

    private final CleanerOvertimeRequestService overtimeRequestService;

    /**
     * Cleaner gửi yêu cầu gia hạn thời gian làm việc.
     *
     * POST /api/cleaner/assignments/{assignmentId}/overtime-requests
     */
    @PostMapping("/{assignmentId}/overtime-requests")
    public ResponseEntity<Map<String, Object>> createOvertimeRequest(
            Authentication authentication,
            @PathVariable Long assignmentId,
            @Valid @RequestBody CleanerOvertimeRequestCreateRequest request
    ) {
        Map<String, Object> response =
                overtimeRequestService.createRequest(
                        assignmentId,
                        request.getReason(),
                        request.getRequestedAdditionalMinutes(),
                        authentication != null ? authentication.getName() : null
                );

        return ResponseEntity.ok(response);
    }
}
