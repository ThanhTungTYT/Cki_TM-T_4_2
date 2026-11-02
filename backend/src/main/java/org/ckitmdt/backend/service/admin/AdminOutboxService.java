package org.ckitmdt.backend.service.admin;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.AdminOutboxEvent;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.BusinessChangeRequest;
import org.ckitmdt.backend.entity.CancellationRefund;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.entity.PartnerService;
import org.ckitmdt.backend.entity.Payment;
import org.ckitmdt.backend.entity.ReportTicket;
import org.ckitmdt.backend.repository.AdminOutboxEventRepository;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.BusinessChangeRequestRepository;
import org.ckitmdt.backend.repository.CancellationRefundRepository;
import org.ckitmdt.backend.repository.PartnerRepository;
import org.ckitmdt.backend.repository.PartnerServiceRepository;
import org.ckitmdt.backend.repository.PaymentRepository;
import org.ckitmdt.backend.repository.ReportTicketRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminOutboxService {
    private final AdminOutboxEventRepository outboxRepository;
    private final ReportTicketRepository reportTicketRepository;
    private final BusinessChangeRequestRepository changeRequestRepository;
    private final PartnerRepository partnerRepository;
    private final PartnerServiceRepository partnerServiceRepository;
    private final CancellationRefundRepository refundRepository;
    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;

    @Transactional
    public void discoverEvents() {
        discoverReports();
        discoverProviderApplications();
        discoverProviderRequests();
        discoverServiceRequests();
        discoverRefundRequests();
        discoverBookingsNeedingDispatch();
        discoverPaymentFailures();
    }

    private void discoverReports() {
        List<ReportTicket> tickets = reportTicketRepository.findByStatusInOrderByCreatedAtDesc(
                List.of("OPEN", "PROVIDER_RESPONDED", "IN_PROGRESS")
        );

        for (ReportTicket ticket : tickets) {
            createIfMissing(
                    "REPORT_CREATED_" + ticket.getId(),
                    "REPORT_CREATED",
                    "Có khiếu nại mới cần xử lý",
                    "Khiếu nại #" + ticket.getId() + ": " + safe(ticket.getSubject()),
                    "REPORT_TICKET",
                    ticket.getId(),
                    ticket.getCreatedAt()
            );

            String status = upper(ticket.getStatus());
            if ("PROVIDER_RESPONDED".equals(status)) {
                createIfMissing(
                        "REPORT_PROVIDER_RESPONDED_" + ticket.getId(),
                        "REPORT_PROVIDER_RESPONDED",
                        "Nhà cung cấp đã phản hồi khiếu nại",
                        "Khiếu nại #" + ticket.getId() + " đã có phản hồi từ nhà cung cấp.",
                        "REPORT_TICKET",
                        ticket.getId(),
                        ticket.getUpdatedAt()
                );
            }
        }
    }

    private void discoverProviderApplications() {
        for (Partner partner : partnerRepository.findByStatusIgnoreCaseOrderByCreatedAtAsc("PENDING")) {
            String businessName = safe(partner.getBusinessName());
            createIfMissing(
                    "PROVIDER_APPLICATION_" + partner.getId(),
                    "PROVIDER_APPLICATION",
                    "Có hồ sơ nhà cung cấp chờ duyệt",
                    "Nhà cung cấp " + businessName + " đang chờ Admin kiểm tra hồ sơ và vị trí.",
                    "PARTNER",
                    partner.getId(),
                    partner.getCreatedAt()
            );
        }
    }

    private void discoverProviderRequests() {
        for (BusinessChangeRequest request : changeRequestRepository.findByStatusOrderByCreatedAtDesc("PENDING_REVIEW")) {
            String partnerName = request.getPartner() == null
                    ? "Nhà cung cấp"
                    : safe(request.getPartner().getBusinessName());
            String requestType = safe(request.getRequestType());
            String targetName = safe(request.getTargetName());
            String description = partnerName + " gửi yêu cầu " + requestType
                    + (targetName.isBlank() ? "" : " cho " + targetName);

            createIfMissing(
                    "PROVIDER_CHANGE_REQUEST_" + request.getId(),
                    "PROVIDER_CHANGE_REQUEST",
                    "Có yêu cầu từ nhà cung cấp cần duyệt",
                    description,
                    "BUSINESS_CHANGE_REQUEST",
                    request.getId(),
                    request.getCreatedAt()
            );
        }
    }

    private void discoverServiceRequests() {
        for (PartnerService partnerService : partnerServiceRepository.findByStatusIgnoreCaseOrderByCreatedAtAsc("PENDING")) {
            Long id = partnerService.getId();
            String partnerName = partnerService.getPartner() == null
                    ? "Nhà cung cấp"
                    : safe(partnerService.getPartner().getBusinessName());
            String serviceName = partnerService.getService() == null
                    ? "Dịch vụ"
                    : safe(partnerService.getService().getName());

            createIfMissing(
                    "PARTNER_SERVICE_REVIEW_" + id,
                    "PARTNER_SERVICE_REVIEW",
                    "Có dịch vụ nhà cung cấp chờ duyệt",
                    partnerName + " gửi dịch vụ " + serviceName + " chờ Admin kiểm tra.",
                    "PARTNER_SERVICE",
                    id,
                    partnerService.getCreatedAt()
            );
        }
    }

    private void discoverRefundRequests() {
        for (CancellationRefund refund : refundRepository.findByStatusIgnoreCaseOrderByRequestedAtDesc("PENDING_REVIEW")) {
            Booking booking = refund.getBooking();
            String bookingCode = booking == null
                    ? String.valueOf(refund.getId())
                    : safe(booking.getBookingCode());

            createIfMissing(
                    "REFUND_REVIEW_" + refund.getId(),
                    "REFUND_REVIEW",
                    "Có yêu cầu hoàn tiền chờ duyệt",
                    "Yêu cầu hoàn tiền #" + refund.getId() + " của đơn " + bookingCode + " đang chờ Admin xử lý.",
                    "CANCELLATION_REFUND",
                    refund.getId(),
                    refund.getRequestedAt()
            );
        }
    }

    private void discoverBookingsNeedingDispatch() {
        for (Booking booking : bookingRepository.findByStatusIn(List.of("CONFIRMED"))) {
            createIfMissing(
                    "BOOKING_NEEDS_DISPATCH_" + booking.getId(),
                    "BOOKING_NEEDS_DISPATCH",
                    "Có đơn đã xác nhận cần điều phối",
                    "Đơn " + safe(booking.getBookingCode()) + " đã được nhà cung cấp xác nhận và cần kiểm tra phân công nhân viên.",
                    "BOOKING",
                    booking.getId(),
                    booking.getUpdatedAt() == null ? booking.getCreatedAt() : booking.getUpdatedAt()
            );
        }
    }

    private void discoverPaymentFailures() {
        for (Payment payment : paymentRepository.findByStatusesIgnoreCase(List.of("FAILED", "ERROR"))) {
            Booking booking = payment.getBooking();
            String bookingCode = booking == null
                    ? "Không rõ đơn hàng"
                    : safe(booking.getBookingCode());

            createIfMissing(
                    "PAYMENT_FAILURE_" + payment.getId(),
                    "PAYMENT_FAILURE",
                    "Có giao dịch thanh toán lỗi",
                    "Giao dịch thanh toán #" + payment.getId() + " của đơn " + bookingCode + " cần được kiểm tra.",
                    "PAYMENT",
                    payment.getId(),
                    payment.getCreatedAt()
            );
        }
    }

    private void createIfMissing(
            String eventKey,
            String eventType,
            String title,
            String message,
            String referenceType,
            Long referenceId,
            LocalDateTime createdAt
    ) {
        if (outboxRepository.existsByEventKey(eventKey)) return;

        LocalDateTime eventCreatedAt = createdAt == null ? LocalDateTime.now() : createdAt;
        outboxRepository.save(AdminOutboxEvent.builder()
                .eventKey(eventKey)
                .eventType(eventType)
                .title(title)
                .message(message.length() > 1000 ? message.substring(0, 1000) : message)
                .referenceType(referenceType)
                .referenceId(referenceId)
                .status("PENDING")
                .attempts(0)
                .createdAt(eventCreatedAt)
                .nextAttemptAt(LocalDateTime.now())
                .build());
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String upper(String value) {
        return safe(value).toUpperCase();
    }
}