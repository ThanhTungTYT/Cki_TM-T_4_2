package org.ckitmdt.backend.dto.cart;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CartItemResponse {

    private Long id;
    private Long serviceId;
    private String serviceName;
    private String serviceThumbnail;
    private Long packageId;
    private String packageName;
    private Long partnerId;
    private String partnerName;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal estimatedPrice;
    private LocalDateTime scheduledStart;
    private String note;
}
