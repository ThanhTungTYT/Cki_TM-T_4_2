package org.ckitmdt.backend.controller.provider;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.repository.ReviewRepository;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/provider/reviews")
@RequiredArgsConstructor
public class ProviderReviewController {

    private final ProviderSecurityHelper helper;
    private final ReviewRepository reviewRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getReviews(Authentication auth) {
        Partner partner = helper.currentPartner(auth);
        return reviewRepository.findByPartner_IdOrderByCreatedAtDesc(partner.getId())
                .stream()
                .map(r -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", r.getId());
                    m.put("rating", r.getRating());
                    m.put("comment", r.getComment());
                    m.put("createdAt", r.getCreatedAt());
                    m.put("customerName", r.getCustomer() != null ? r.getCustomer().getFullName() : "Khách hàng");
                    m.put("serviceName", r.getService() != null ? r.getService().getName() : "");
                    m.put("bookingCode", r.getBooking() != null ? r.getBooking().getBookingCode() : "");
                    m.put("employeeName", r.getEmployee() != null && r.getEmployee().getUser() != null ? r.getEmployee().getUser().getFullName() : "");
                    return m;
                })
                .toList();
    }
}
