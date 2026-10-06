package org.ckitmdt.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class PromotionServiceId implements Serializable {

    private Long promotionId;
    private Long serviceId;
}
