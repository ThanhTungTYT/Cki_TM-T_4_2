package org.ckitmdt.backend.dto.cart;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CartResponse {

    private Long cartId;
    private List<CartGroupResponse> groups;
    private int totalItems;
    private BigDecimal totalAmount;
}
