package org.ckitmdt.backend.controller.cart;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.cart.AddToCartRequest;
import org.ckitmdt.backend.dto.cart.CartResponse;
import org.ckitmdt.backend.dto.cart.UpdateCartItemRequest;
import org.ckitmdt.backend.service.cart.CartService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    /**
     * Lấy toàn bộ giỏ hàng của người dùng, phân nhóm theo Provider (CN06)
     */
    @GetMapping
    public ResponseEntity<CartResponse> getCart(Authentication authentication) {
        return ResponseEntity.ok(cartService.getCart(authentication.getName()));
    }

    /**
     * Thêm dịch vụ vào giỏ hàng
     */
    @PostMapping("/items")
    public ResponseEntity<CartResponse> addToCart(
            Authentication authentication,
            @Valid @RequestBody AddToCartRequest request
    ) {
        return ResponseEntity.ok(cartService.addToCart(request, authentication.getName()));
    }

    /**
     * Cập nhật số lượng hoặc ghi chú của một mục trong giỏ
     */
    @PatchMapping("/items/{id}")
    public ResponseEntity<CartResponse> updateCartItem(
            Authentication authentication,
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateCartItemRequest request
    ) {
        return ResponseEntity.ok(cartService.updateCartItem(id, request, authentication.getName()));
    }

    /**
     * Xóa một mục khỏi giỏ hàng
     */
    @DeleteMapping("/items/{id}")
    public ResponseEntity<CartResponse> removeCartItem(
            Authentication authentication,
            @PathVariable("id") Long id
    ) {
        return ResponseEntity.ok(cartService.removeCartItem(id, authentication.getName()));
    }

    /**
     * Xóa toàn bộ giỏ hoặc xóa riêng theo nhóm Provider
     */
    @DeleteMapping
    public ResponseEntity<CartResponse> clearCart(
            Authentication authentication,
            @RequestParam(value = "partnerId", required = false) Long partnerId
    ) {
        return ResponseEntity.ok(cartService.clearCart(partnerId, authentication.getName()));
    }
}
