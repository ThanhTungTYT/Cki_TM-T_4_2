package org.ckitmdt.backend.service.cart;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.ckitmdt.backend.dto.cart.*;
import org.ckitmdt.backend.entity.*;
import org.ckitmdt.backend.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CartService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final UserRepository userRepository;
    private final ServiceRepository serviceRepository;
    private final ServicePackageRepository servicePackageRepository;
    private final PartnerRepository partnerRepository;

    /**
     * Lấy hoặc tự động tạo giỏ hàng cho người dùng hiện tại
     */
    public Cart getOrCreateCart(User user) {
        return cartRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    Cart newCart = Cart.builder()
                            .user(user)
                            .createdAt(LocalDateTime.now())
                            .build();
                    return cartRepository.save(newCart);
                });
    }

    /**
     * Lấy toàn bộ giỏ hàng của người dùng, tự động phân nhóm theo Provider (CN06)
     */
    @Transactional
    public CartResponse getCart(String userEmail) {
        User user = getUserByEmail(userEmail);
        Cart cart = getOrCreateCart(user);
        List<CartItem> items = cartItemRepository.findByCartId(cart.getId());

        return buildCartResponse(cart.getId(), items);
    }

    /**
     * Thêm dịch vụ vào giỏ hàng (tự gộp nếu cùng dịch vụ, gói và Provider)
     */
    @Transactional
    public CartResponse addToCart(AddToCartRequest request, String userEmail) {
        User user = getUserByEmail(userEmail);
        Cart cart = getOrCreateCart(user);

        org.ckitmdt.backend.entity.Service service = serviceRepository.findById(request.getServiceId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy dịch vụ"));

        ServicePackage servicePackage = null;
        if (request.getPackageId() != null) {
            servicePackage = servicePackageRepository.findById(request.getPackageId()).orElse(null);
        }

        Partner partner = null;
        if (request.getPartnerId() != null) {
            partner = partnerRepository.findById(request.getPartnerId()).orElse(null);
        }

        // Tính đơn giá ước tính
        BigDecimal unitPrice = servicePackage != null && servicePackage.getPrice() != null
                ? servicePackage.getPrice()
                : (service.getBasePrice() != null ? service.getBasePrice() : BigDecimal.ZERO);

        int quantityToAdd = request.getQuantity() != null && request.getQuantity() > 0 ? request.getQuantity() : 1;

        // Kiểm tra xem mục này đã có trong giỏ chưa
        Optional<CartItem> existingItemOpt = cartItemRepository.findExistingCartItem(
                cart.getId(),
                service.getId(),
                servicePackage != null ? servicePackage.getId() : null,
                partner != null ? partner.getId() : null
        );

        if (existingItemOpt.isPresent()) {
            CartItem existingItem = existingItemOpt.get();
            int newQuantity = existingItem.getQuantity() + quantityToAdd;
            existingItem.setQuantity(newQuantity);
            existingItem.setEstimatedPrice(unitPrice.multiply(BigDecimal.valueOf(newQuantity)));
            if (request.getNote() != null && !request.getNote().isBlank()) {
                existingItem.setNote(request.getNote());
            }
            existingItem.setUpdatedAt(LocalDateTime.now());
            cartItemRepository.save(existingItem);
        } else {
            CartItem newItem = CartItem.builder()
                    .cart(cart)
                    .service(service)
                    .servicePackage(servicePackage)
                    .partner(partner)
                    .quantity(quantityToAdd)
                    .scheduledStart(request.getScheduledStart())
                    .estimatedPrice(unitPrice.multiply(BigDecimal.valueOf(quantityToAdd)))
                    .note(request.getNote())
                    .createdAt(LocalDateTime.now())
                    .build();
            cartItemRepository.save(newItem);
        }

        return getCart(userEmail);
    }

    /**
     * Sửa số lượng hoặc ghi chú của mục trong giỏ (kiểm tra chặt chẽ quyền sở hữu giỏ)
     */
    @Transactional
    public CartResponse updateCartItem(Long itemId, UpdateCartItemRequest request, String userEmail) {
        User user = getUserByEmail(userEmail);
        CartItem item = cartItemRepository.findByIdAndUserId(itemId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy mục trong giỏ hoặc bạn không có quyền sửa"));

        if (request.getQuantity() != null) {
            if (request.getQuantity() <= 0) {
                cartItemRepository.delete(item);
                return getCart(userEmail);
            }
            item.setQuantity(request.getQuantity());

            BigDecimal unitPrice = item.getServicePackage() != null && item.getServicePackage().getPrice() != null
                    ? item.getServicePackage().getPrice()
                    : (item.getService() != null && item.getService().getBasePrice() != null ? item.getService().getBasePrice() : BigDecimal.ZERO);
            item.setEstimatedPrice(unitPrice.multiply(BigDecimal.valueOf(request.getQuantity())));
        }

        if (request.getNote() != null) {
            item.setNote(request.getNote());
        }

        item.setUpdatedAt(LocalDateTime.now());
        cartItemRepository.save(item);

        return getCart(userEmail);
    }

    /**
     * Xóa một mục khỏi giỏ hàng
     */
    @Transactional
    public CartResponse removeCartItem(Long itemId, String userEmail) {
        User user = getUserByEmail(userEmail);
        CartItem item = cartItemRepository.findByIdAndUserId(itemId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy mục trong giỏ để xóa"));

        cartItemRepository.delete(item);
        return getCart(userEmail);
    }

    /**
     * Xóa toàn bộ giỏ hoặc xóa riêng theo nhóm Provider
     */
    @Transactional
    public CartResponse clearCart(Long partnerId, String userEmail) {
        User user = getUserByEmail(userEmail);
        Cart cart = getOrCreateCart(user);

        if (partnerId != null) {
            cartItemRepository.deleteByCartIdAndPartnerId(cart.getId(), partnerId);
        } else {
            cartItemRepository.deleteByCartId(cart.getId());
        }

        return getCart(userEmail);
    }

    /**
     * Hàm phụ trợ phân nhóm dịch vụ theo Provider
     */
    private CartResponse buildCartResponse(Long cartId, List<CartItem> items) {
        if (items.isEmpty()) {
            return CartResponse.builder()
                    .cartId(cartId)
                    .groups(Collections.emptyList())
                    .totalItems(0)
                    .totalAmount(BigDecimal.ZERO)
                    .build();
        }

        // Gom nhóm theo Partner ID
        Map<Long, List<CartItem>> groupedByPartner = items.stream()
                .collect(Collectors.groupingBy(item -> item.getPartner() != null ? item.getPartner().getId() : 0L));

        List<CartGroupResponse> groups = new ArrayList<>();
        BigDecimal grandTotal = BigDecimal.ZERO;
        int totalQuantity = 0;

        for (Map.Entry<Long, List<CartItem>> entry : groupedByPartner.entrySet()) {
            Long partnerId = entry.getKey();
            List<CartItem> partnerItems = entry.getValue();

            String partnerName = "Nhà cung cấp CleanMate";
            if (partnerId != 0L && partnerItems.get(0).getPartner() != null) {
                partnerName = partnerItems.get(0).getPartner().getBusinessName();
            }

            BigDecimal groupSubtotal = BigDecimal.ZERO;
            List<CartItemResponse> itemResponses = new ArrayList<>();

            for (CartItem it : partnerItems) {
                BigDecimal unitPrice = it.getServicePackage() != null && it.getServicePackage().getPrice() != null
                        ? it.getServicePackage().getPrice()
                        : (it.getService() != null && it.getService().getBasePrice() != null ? it.getService().getBasePrice() : BigDecimal.ZERO);

                BigDecimal itemPrice = it.getEstimatedPrice() != null
                        ? it.getEstimatedPrice()
                        : unitPrice.multiply(BigDecimal.valueOf(it.getQuantity()));

                groupSubtotal = groupSubtotal.add(itemPrice);
                totalQuantity += it.getQuantity();

                itemResponses.add(CartItemResponse.builder()
                        .id(it.getId())
                        .serviceId(it.getService() != null ? it.getService().getId() : null)
                        .serviceName(it.getService() != null ? it.getService().getName() : "")
                        .serviceThumbnail(it.getService() != null ? it.getService().getThumbnailUrl() : null)
                        .packageId(it.getServicePackage() != null ? it.getServicePackage().getId() : null)
                        .packageName(it.getServicePackage() != null ? it.getServicePackage().getName() : null)
                        .partnerId(partnerId != 0L ? partnerId : null)
                        .partnerName(partnerName)
                        .quantity(it.getQuantity())
                        .unitPrice(unitPrice)
                        .estimatedPrice(itemPrice)
                        .scheduledStart(it.getScheduledStart())
                        .note(it.getNote())
                        .build());
            }

            grandTotal = grandTotal.add(groupSubtotal);

            groups.add(CartGroupResponse.builder()
                    .partnerId(partnerId != 0L ? partnerId : null)
                    .partnerName(partnerName)
                    .items(itemResponses)
                    .groupSubtotal(groupSubtotal)
                    .build());
        }

        return CartResponse.builder()
                .cartId(cartId)
                .groups(groups)
                .totalItems(totalQuantity)
                .totalAmount(grandTotal)
                .build();
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Người dùng chưa xác thực hoặc không tồn tại"));
    }
}
