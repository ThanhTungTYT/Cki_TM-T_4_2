package org.ckitmdt.backend.dto.booking;

import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingItemResponse {

    private Long id;
    private Long serviceId;
    private String serviceName;
    private Long packageId;
    private String packageName;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal totalPrice;
    private String note;
}
