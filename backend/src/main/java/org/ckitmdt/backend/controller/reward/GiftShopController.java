package org.ckitmdt.backend.controller.reward;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.service.GiftShopService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.MethodArgumentNotValidException;

@RestController @RequestMapping("/api/rewards") @RequiredArgsConstructor
public class GiftShopController {
    private final GiftShopService shop;
    @GetMapping("/gifts")
    public List<GiftShopService.GiftView> catalog() { return shop.catalog(); }
    @GetMapping("/redemptions")
    public List<GiftShopService.RedemptionView> history(Authentication auth) { return shop.history(auth.getName()); }
    @PostMapping("/redemptions")
    public GiftShopService.RedemptionView redeem(Authentication auth, @Valid @RequestBody GiftShopService.RedeemRequest request) {
        return shop.redeem(auth.getName(), request);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleBusinessError(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode())
                .body(Map.of("detail", exception.getReason() == null ? "Yêu cầu không hợp lệ." : exception.getReason()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationError() {
        return ResponseEntity.badRequest().body(Map.of("detail", "Vui lòng kiểm tra họ tên, số điện thoại và địa chỉ nhận quà (10–500 ký tự)."));
    }
}
