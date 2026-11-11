
package org.ckitmdt.backend.service.admin;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.entity.ProviderSettlement;
import org.ckitmdt.backend.entity.ProviderSettlementItem;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.PartnerRepository;
import org.ckitmdt.backend.repository.ProviderSettlementItemRepository;
import org.ckitmdt.backend.repository.ProviderSettlementRepository;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ProviderSettlementService {

    private final ProviderSettlementRepository settlementRepository;
    private final ProviderSettlementItemRepository itemRepository;
    private final BookingRepository bookingRepository;
    private final PartnerRepository partnerRepository;
    private final AdminAuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAll() {
        return settlementRepository.findAll(
                        Sort.by(Sort.Direction.DESC, "createdAt")
                )
                .stream()
                .map(this::toMap)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getEligibleBookings(
            Long partnerId,
            LocalDate fromDate,
            LocalDate toDate
    ) {
        validatePeriod(fromDate, toDate);

        if (partnerId == null || partnerId <= 0) {
            throw badRequest("Provider không hợp lệ.");
        }

        Partner partner = partnerRepository.findById(partnerId)
                .orElseThrow(() -> notFound("Không tìm thấy Provider."));

        List<Booking> bookings =
                bookingRepository.findCompletedBookingsByPartnerAndCompletedDateRange(
                        partner.getId(),
                        fromDate.atStartOfDay(),
                        toDate.plusDays(1).atStartOfDay()
                );

        List<Map<String, Object>> result = new ArrayList<>();

        for (Booking booking : bookings) {
            if (itemRepository.existsByBooking_Id(booking.getId())) {
                continue;
            }

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("bookingId", booking.getId());
            item.put("bookingCode", booking.getBookingCode());
            item.put("completedAt", booking.getCompletedAt());
            item.put("subtotal", money(booking.getSubtotal()));
            item.put("totalAmount", money(booking.getTotalAmount()));
            item.put(
                    "customerName",
                    booking.getCustomer() == null
                            ? ""
                            : booking.getCustomer().getFullName()
            );

            result.add(item);
        }

        return result;
    }

    @Transactional
    public Map<String, Object> create(
            Long partnerId,
            LocalDate fromDate,
            LocalDate toDate,
            BigDecimal platformFeeAmount,
            BigDecimal refundDeductionAmount,
            String note,
            Authentication authentication
    ) {
        validatePeriod(fromDate, toDate);

        if (partnerId == null || partnerId <= 0) {
            throw badRequest("Provider không hợp lệ.");
        }

        String actor = actor(authentication);

        Partner partner = partnerRepository.findByIdForUpdate(partnerId)
                .orElseThrow(() -> notFound("Không tìm thấy Provider."));

        List<Booking> bookings =
                bookingRepository.findCompletedBookingsByPartnerAndCompletedDateRange(
                        partnerId,
                        fromDate.atStartOfDay(),
                        toDate.plusDays(1).atStartOfDay()
                );

        List<Booking> eligible = bookings.stream()
                .filter(booking ->
                        !itemRepository.existsByBooking_Id(booking.getId())
                )
                .toList();

        if (eligible.isEmpty()) {
            throw badRequest(
                    "Không có đơn COMPLETED chưa được đối soát trong khoảng thời gian này."
            );
        }

        BigDecimal gross = eligible.stream()
                .map(booking -> money(booking.getSubtotal()))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal fee = money(platformFeeAmount)
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal deduction = money(refundDeductionAmount)
                .setScale(2, RoundingMode.HALF_UP);

        if (gross.signum() <= 0) {
            throw badRequest("Tổng doanh thu dịch vụ phải lớn hơn 0.");
        }

        if (fee.signum() < 0 || deduction.signum() < 0) {
            throw badRequest("Phí sàn và khoản khấu trừ không được âm.");
        }

        if (fee.add(deduction).compareTo(gross) > 0) {
            throw badRequest(
                    "Tổng phí sàn và khấu trừ không được lớn hơn doanh thu dịch vụ."
            );
        }

        BigDecimal payout = gross.subtract(fee).subtract(deduction)
                .setScale(2, RoundingMode.HALF_UP);

        ProviderSettlement settlement = ProviderSettlement.builder()
                .partner(partner)
                .periodStart(fromDate)
                .periodEnd(toDate)
                .bookingCount(eligible.size())
                .grossAmount(gross)
                .platformFeeAmount(fee)
                .refundDeductionAmount(deduction)
                .payoutAmount(payout)
                .status("DRAFT")
                .note(cleanNote(note))
                .createdBy(actor)
                .createdAt(LocalDateTime.now())
                .build();

        settlement = settlementRepository.save(settlement);

        for (Booking booking : eligible) {
            ProviderSettlementItem item = ProviderSettlementItem.builder()
                    .settlement(settlement)
                    .booking(booking)
                    .serviceAmount(
                            money(booking.getSubtotal())
                                    .setScale(2, RoundingMode.HALF_UP)
                    )
                    .bookingCompletedAt(booking.getCompletedAt())
                    .build();

            itemRepository.save(item);
        }

        auditLogService.record(
                authentication,
                "PROVIDER_SETTLEMENT_CREATED",
                "PROVIDER_SETTLEMENT",
                settlement.getId(),
                "Tạo kỳ đối soát Provider.",
                null,
                "partnerId=" + partnerId
                        + ", period=" + fromDate + " đến " + toDate
                        + ", bookingCount=" + eligible.size()
                        + ", grossAmount=" + gross
                        + ", platformFeeAmount=" + fee
                        + ", refundDeductionAmount=" + deduction
                        + ", payoutAmount=" + payout
        );

        return toMap(settlement);
    }

    @Transactional
    public Map<String, Object> approve(
            Long id,
            String note,
            Authentication authentication
    ) {
        ProviderSettlement settlement = settlementRepository.findByIdForUpdate(id)
                .orElseThrow(() -> notFound("Không tìm thấy kỳ đối soát."));

        if (!"DRAFT".equalsIgnoreCase(settlement.getStatus())) {
            throw conflict(
                    "Chỉ kỳ đối soát ở trạng thái DRAFT mới được duyệt."
            );
        }

        String actor = actor(authentication);
        String before = settlement.getStatus();
        LocalDateTime now = LocalDateTime.now();

        settlement.setStatus("APPROVED");
        settlement.setApprovedBy(actor);
        settlement.setApprovedAt(now);

        if (note != null && !note.isBlank()) {
            settlement.setNote(appendNote(settlement.getNote(), note));
        }

        settlementRepository.save(settlement);

        auditLogService.record(
                authentication,
                "PROVIDER_SETTLEMENT_APPROVED",
                "PROVIDER_SETTLEMENT",
                id,
                cleanNote(note) == null
                        ? "Duyệt kỳ đối soát Provider."
                        : cleanNote(note),
                before,
                "APPROVED; approvedBy=" + actor + "; approvedAt=" + now
        );

        return toMap(settlement);
    }

    @Transactional
    public Map<String, Object> markPaid(
            Long id,
            String transferReference,
            String evidenceUrl,
            String note,
            Authentication authentication
    ) {
        ProviderSettlement settlement = settlementRepository.findByIdForUpdate(id)
                .orElseThrow(() -> notFound("Không tìm thấy kỳ đối soát."));

        if (!"APPROVED".equalsIgnoreCase(settlement.getStatus())) {
            throw conflict(
                    "Chỉ kỳ đối soát đã APPROVED mới được xác nhận chuyển tiền."
            );
        }

        if (settlement.getPaidAt() != null) {
            throw conflict("Kỳ đối soát này đã được ghi nhận thanh toán.");
        }

        if (transferReference == null
                || transferReference.isBlank()
                || transferReference.trim().length() > 150) {
            throw badRequest(
                    "Vui lòng nhập mã giao dịch chuyển tiền hợp lệ."
            );
        }

        validateEvidenceUrl(evidenceUrl);

        String actor = actor(authentication);
        String before = settlement.getStatus();
        LocalDateTime now = LocalDateTime.now();

        settlement.setTransferReference(transferReference.trim());
        settlement.setTransferEvidenceUrl(evidenceUrl.trim());
        settlement.setPaidBy(actor);
        settlement.setPaidAt(now);
        settlement.setStatus("PAID");

        if (note != null && !note.isBlank()) {
            settlement.setNote(appendNote(settlement.getNote(), note));
        }

        settlementRepository.save(settlement);

        auditLogService.record(
                authentication,
                "PROVIDER_SETTLEMENT_PAID",
                "PROVIDER_SETTLEMENT",
                id,
                cleanNote(note) == null
                        ? "Ghi nhận đã chuyển tiền Provider kèm chứng từ."
                        : cleanNote(note),
                before,
                "PAID; paidBy=" + actor
                        + "; paidAt=" + now
                        + "; reference=" + transferReference.trim()
                        + "; evidence=" + evidenceUrl.trim()
        );

        return toMap(settlement);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDetail(Long id) {
        ProviderSettlement settlement = settlementRepository.findById(id)
                .orElseThrow(() -> notFound("Không tìm thấy kỳ đối soát."));

        Map<String, Object> result = toMap(settlement);

        List<Map<String, Object>> items =
                itemRepository.findBySettlement_IdOrderByIdAsc(id)
                        .stream()
                        .map(item -> {
                            Map<String, Object> row = new LinkedHashMap<>();
                            Booking booking = item.getBooking();

                            row.put("bookingId", booking.getId());
                            row.put("bookingCode", booking.getBookingCode());
                            row.put("bookingStatus", booking.getStatus());
                            row.put("completedAt", item.getBookingCompletedAt());
                            row.put("serviceAmount", item.getServiceAmount());
                            row.put("totalAmount", booking.getTotalAmount());
                            row.put(
                                    "customerName",
                                    booking.getCustomer() == null
                                            ? ""
                                            : booking.getCustomer().getFullName()
                            );

                            return row;
                        })
                        .toList();

        result.put("items", items);
        return result;
    }

    private Map<String, Object> toMap(ProviderSettlement settlement) {
        Map<String, Object> row = new LinkedHashMap<>();

        row.put("id", settlement.getId());
        row.put("partnerId", settlement.getPartner().getId());
        row.put("partnerName", settlement.getPartner().getBusinessName());
        row.put("periodStart", settlement.getPeriodStart());
        row.put("periodEnd", settlement.getPeriodEnd());
        row.put("bookingCount", settlement.getBookingCount());
        row.put("grossAmount", settlement.getGrossAmount());
        row.put("platformFeeAmount", settlement.getPlatformFeeAmount());
        row.put("refundDeductionAmount", settlement.getRefundDeductionAmount());
        row.put("payoutAmount", settlement.getPayoutAmount());
        row.put("status", settlement.getStatus());
        row.put("transferReference", settlement.getTransferReference());
        row.put("transferEvidenceUrl", settlement.getTransferEvidenceUrl());
        row.put("note", settlement.getNote());
        row.put("createdBy", settlement.getCreatedBy());
        row.put("approvedBy", settlement.getApprovedBy());
        row.put("paidBy", settlement.getPaidBy());
        row.put("createdAt", settlement.getCreatedAt());
        row.put("approvedAt", settlement.getApprovedAt());
        row.put("paidAt", settlement.getPaidAt());

        return row;
    }

    private void validatePeriod(LocalDate fromDate, LocalDate toDate) {
        if (fromDate == null || toDate == null) {
            throw badRequest(
                    "Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc."
            );
        }

        if (fromDate.isAfter(toDate)) {
            throw badRequest(
                    "Ngày bắt đầu không được sau ngày kết thúc."
            );
        }

        if (fromDate.plusDays(366).isBefore(toDate)) {
            throw badRequest(
                    "Khoảng thời gian không được vượt quá 366 ngày."
            );
        }
    }

    private void validateEvidenceUrl(String value) {
        if (value == null || value.isBlank()
                || value.trim().length() > 1000) {
            throw badRequest(
                    "Vui lòng cung cấp URL chứng từ chuyển tiền."
            );
        }

        try {
            URI uri = URI.create(value.trim());
            String scheme = uri.getScheme();

            if (uri.getHost() == null
                    || !("http".equalsIgnoreCase(scheme)
                    || "https".equalsIgnoreCase(scheme))) {
                throw badRequest(
                        "URL chứng từ phải bắt đầu bằng http:// hoặc https://."
                );
            }
        } catch (IllegalArgumentException exception) {
            throw badRequest("URL chứng từ không hợp lệ.");
        }
    }

    private String actor(Authentication authentication) {
        if (authentication == null
                || authentication.getName() == null
                || authentication.getName().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Không xác định được tài khoản thực hiện."
            );
        }

        return authentication.getName();
    }

    private BigDecimal money(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String cleanNote(String note) {
        if (note == null || note.isBlank()) {
            return null;
        }

        String value = note.trim();

        if (value.length() > 5000) {
            throw badRequest("Ghi chú không được vượt quá 5000 ký tự.");
        }

        return value;
    }

    private String appendNote(String oldNote, String newNote) {
        String cleanNewNote = cleanNote(newNote);

        if (cleanNewNote == null) {
            return cleanNote(oldNote);
        }

        String result = cleanNote(oldNote) == null
                ? cleanNewNote
                : cleanNote(oldNote) + "\n" + cleanNewNote;

        if (result.length() > 10000) {
            throw badRequest("Tổng nội dung ghi chú vượt quá giới hạn cho phép.");
        }

        return result;
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message
        );
    }

    private ResponseStatusException conflict(String message) {
        return new ResponseStatusException(
                HttpStatus.CONFLICT,
                message
        );
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                message
        );
    }
}
