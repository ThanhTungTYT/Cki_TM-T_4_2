package org.ckitmdt.backend.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "reward_gifts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RewardGift {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true)
    private String code;
    @Column(nullable = false)
    private String name;
    private String description;
    private String icon;
    @Column(nullable = false)
    private Integer pointsCost;
    @Column(nullable = false)
    private Integer stock;
    @Column(nullable = false)
    private Boolean active;
}
