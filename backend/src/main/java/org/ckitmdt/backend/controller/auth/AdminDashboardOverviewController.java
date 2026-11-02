package org.ckitmdt.backend.controller.auth;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.PartnerRepository;
import org.ckitmdt.backend.repository.ReportTicketRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/dashboard")
@RequiredArgsConstructor
public class AdminDashboardOverviewController {

    private final UserRepository userRepository;
    private final PartnerRepository partnerRepository;
    private final BookingRepository bookingRepository;
    private final ReportTicketRepository reportTicketRepository;

    @GetMapping("/overview")
    @Transactional(readOnly = true)
    public Map<String, Object> getOverview() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalUsers", userRepository.count());
        result.put("totalCustomers", userRepository.countByRoleIgnoreCase("CUSTOMER"));
        result.put("totalCleaners", userRepository.countByRoleIgnoreCase("CLEANER"));

        long pendingProviders = 0;
        long activeProviders = 0;
        long suspendedProviders = 0;
        long rejectedProviders = 0;
        long accountLockedProviders = 0;

        for (Partner partner : partnerRepository.findAll()) {
            String partnerStatus = normalize(partner.getStatus());
            String accountStatus = partner.getUser() == null ? "UNKNOWN" : normalize(partner.getUser().getStatus());

            if ("PENDING".equals(partnerStatus)) {
                pendingProviders++;
            } else if ("REJECTED".equals(partnerStatus)) {
                rejectedProviders++;
            } else if ("LOCKED".equals(partnerStatus)) {
                suspendedProviders++;
            } else if ("ACTIVE".equals(partnerStatus) && "ACTIVE".equals(accountStatus)) {
                activeProviders++;
            }

            if (!"ACTIVE".equals(accountStatus)) {
                accountLockedProviders++;
            }
        }

        result.put("pendingProviders", pendingProviders);
        result.put("activeProviders", activeProviders);
        result.put("suspendedProviders", suspendedProviders);
        result.put("rejectedProviders", rejectedProviders);
        result.put("accountLockedProviders", accountLockedProviders);

        long pendingBookings = bookingRepository.countByStatusIgnoreCase("PENDING_PAYMENT")
                + bookingRepository.countByStatusIgnoreCase("PENDING_PROVIDER");

        long processingBookings = bookingRepository.countByStatusIgnoreCase("CONFIRMED")
                + bookingRepository.countByStatusIgnoreCase("ASSIGNED")
                + bookingRepository.countByStatusIgnoreCase("EN_ROUTE")
                + bookingRepository.countByStatusIgnoreCase("IN_PROGRESS")
                + bookingRepository.countByStatusIgnoreCase("PENDING_COMPLETION");

        result.put("pendingBookings", pendingBookings);
        result.put("processingBookings", processingBookings);

        long openComplaints = reportTicketRepository.countByStatusIgnoreCase("OPEN")
                + reportTicketRepository.countByStatusIgnoreCase("WAITING_PROVIDER");

        long processingComplaints = reportTicketRepository.countByStatusIgnoreCase("IN_PROGRESS")
                + reportTicketRepository.countByStatusIgnoreCase("PROVIDER_RESPONDED");

        long resolvedComplaints = reportTicketRepository.countByStatusIgnoreCase("RESOLVED")
                + reportTicketRepository.countByStatusIgnoreCase("REJECTED");

        result.put("openComplaints", openComplaints);
        result.put("processingComplaints", processingComplaints);
        result.put("resolvedComplaints", resolvedComplaints);

        return result;
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}