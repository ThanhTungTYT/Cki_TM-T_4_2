package org.ckitmdt.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "gift_redemptions", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "request_key"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class GiftRedemption {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(nullable = false)
    private RewardGift gift;
    private String giftName;
    private Integer pointsUsed;
    private String recipientName;
    private String phone;
    @Column(length = 500)
    private String address;
    private String status;
    @Column(name = "request_key", nullable = false, length = 80)
    private String requestKey;
    private LocalDateTime createdAt;
}
