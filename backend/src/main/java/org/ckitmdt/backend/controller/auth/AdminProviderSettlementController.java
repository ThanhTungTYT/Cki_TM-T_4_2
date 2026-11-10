
package org.ckitmdt.backend.controller.auth;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.service.admin.ProviderSettlementService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/provider-settlements")
@RequiredArgsConstructor
public class AdminProviderSettlementController {
    private final ProviderSettlementService settlementService;

    @GetMapping
    public List<Map<String, Object>> getAll() {
        return settlementService.getAll();
    }

    @GetMapping("/eligible-bookings")
    public List<Map<String, Object>> getEligibleBookings(
            @RequestParam Long partnerId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate) {
        return settlementService.getEligibleBookings(partnerId, fromDate, toDate);
    }

    @GetMapping("/{id}")
    public Map<String, Object> getDetail(@PathVariable Long id) {
        return settlementService.getDetail(id);
    }

    @PostMapping
    public Map<String, Object> create(
            @RequestBody CreateRequest request,
            Authentication authentication) {
        return settlementService.create(
                request.partnerId(),
                request.fromDate(),
                request.toDate(),
                request.platformFeeAmount(),
                request.refundDeductionAmount(),
                request.note(),
                authentication
        );
    }

    @PatchMapping("/{id}/approve")
    public Map<String, Object> approve(
            @PathVariable Long id,
            @RequestBody(required = false) NoteRequest request,
            Authentication authentication) {
        return settlementService.approve(
                id,
                request == null ? null : request.note(),
                authentication
        );
    }

    @PatchMapping("/{id}/paid")
    public Map<String, Object> markPaid(
            @PathVariable Long id,
            @RequestBody PaidRequest request,
            Authentication authentication) {
        return settlementService.markPaid(
                id,
                request.transferReference(),
                request.evidenceUrl(),
                request.note(),
                authentication
        );
    }

    public record CreateRequest(
            Long partnerId,
            LocalDate fromDate,
            LocalDate toDate,
            BigDecimal platformFeeAmount,
            BigDecimal refundDeductionAmount,
            String note
    ) {}

    public record NoteRequest(String note) {}

    public record PaidRequest(
            String transferReference,
            String evidenceUrl,
            String note
    ) {}
}
