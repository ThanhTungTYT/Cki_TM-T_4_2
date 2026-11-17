package org.ckitmdt.backend.controller.cleaner;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.booking.CleanerAssignmentViewResponse;
import org.ckitmdt.backend.service.booking.CleanerAssignmentQueryService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cleaner/assignments")
@RequiredArgsConstructor
public class CleanerAssignmentController {

    private final CleanerAssignmentQueryService cleanerAssignmentQueryService;

    /**
     * Lấy danh sách phân công của Cleaner đang đăng nhập.
     *
     * GET /api/cleaner/assignments
     */
    @GetMapping
    public ResponseEntity<List<CleanerAssignmentViewResponse>> getMyAssignments(
            Authentication authentication
    ) {
        return ResponseEntity.ok(
                cleanerAssignmentQueryService.getMyAssignments(
                        authentication != null
                                ? authentication.getName()
                                : null
                )
        );
    }

    /**
     * Lấy chi tiết một phân công của Cleaner đang đăng nhập.
     *
     * GET /api/cleaner/assignments/{assignmentId}
     */
    @GetMapping("/{assignmentId}")
    public ResponseEntity<CleanerAssignmentViewResponse> getMyAssignment(
            Authentication authentication,
            @PathVariable Long assignmentId
    ) {
        return ResponseEntity.ok(
                cleanerAssignmentQueryService.getMyAssignment(
                        assignmentId,
                        authentication != null
                                ? authentication.getName()
                                : null
                )
        );
    }
}