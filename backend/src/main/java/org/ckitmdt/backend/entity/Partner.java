package org.ckitmdt.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "partners")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Partner {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "business_name", nullable = false)
    private String businessName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "tax_code")
    private String taxCode;

    private String status;

    @Column(name = "rating_average")
    private BigDecimal ratingAverage;

    @Column(name = "total_completed_jobs")
    private Integer totalCompletedJobs;

    @Column(name = "address")
    private String address;

    @Column(precision = 10, scale = 7)
    private BigDecimal latitude;

    @Column(precision = 10, scale = 7)
    private BigDecimal longitude;

    @Column(name = "service_radius_km")
    private Double serviceRadiusKm;

    @Column(name = "entity_type", length = 50)
    private String entityType;

    @Column(name = "country_code", length = 10)
    private String countryCode;

    @Column(name = "business_license_number", length = 100)
    private String businessLicenseNumber;

    @Column(name = "representative_name", length = 100)
    private String representativeName;

    @Column(name = "representative_title", length = 100)
    private String representativeTitle;

    @Column(name = "business_license_url", length = 500)
    private String businessLicenseUrl;

    @Column(name = "representative_id_card_url", length = 500)
    private String representativeIdCardUrl;

    @Column(name = "bank_name", length = 100)
    private String bankName;

    @Column(name = "bank_account_number", length = 50)
    private String bankAccountNumber;

    @Column(name = "bank_account_holder", length = 150)
    private String bankAccountHolder;

    @Column(name = "terms_accepted_at")
    private LocalDateTime termsAcceptedAt;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Builder.Default
    @Column(name = "version")
    private Integer version = 1;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}