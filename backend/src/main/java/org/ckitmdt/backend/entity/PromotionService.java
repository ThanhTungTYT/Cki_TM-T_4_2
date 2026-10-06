package org.ckitmdt.backend.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "promotion_services")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PromotionService {

    @EmbeddedId
    private PromotionServiceId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("promotionId")
    @JoinColumn(name = "promotion_id")
    private Promotion promotion;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("serviceId")
    @JoinColumn(name = "service_id")
    private Service service;
}
