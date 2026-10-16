package org.ckitmdt.backend.dto.cart;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CartGroupResponse {

    private Long partnerId;
    private String partnerName;
    private List<CartItemResponse> items;
    private BigDecimal groupSubtotal;
}
