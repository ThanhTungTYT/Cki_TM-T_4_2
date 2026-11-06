package org.ckitmdt.backend.controller.reward;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.service.GiftRedemptionAdminService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/reward-orders")
@RequiredArgsConstructor
public class AdminGiftRedemptionController {
    private final GiftRedemptionAdminService service;

    @GetMapping
    public List<GiftRedemptionAdminService.AdminRedemptionView> list() {
        return service.list();
    }

    @PostMapping("/{id}/ship")
    public GiftRedemptionAdminService.AdminRedemptionView markShipped(@PathVariable Long id) {
        return service.markShipped(id);
    }
}
