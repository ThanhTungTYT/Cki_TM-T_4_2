package org.ckitmdt.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "service_packages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServicePackage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id", nullable = false)
    private Service service;

    private String name;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Column(name = "employee_count")
    private Integer employeeCount;

    @Column(name = "min_area")
    private BigDecimal minArea;

    @Column(name = "max_area")
    private BigDecimal maxArea;

    @Column(nullable = false)
    private BigDecimal price;

    private String status;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
