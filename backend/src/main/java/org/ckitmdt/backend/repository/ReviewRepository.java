package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    interface ServiceReviewStats {
        Long getServiceId();
        Double getAverageRating();
        Long getReviewCount();
    }

    interface PartnerReviewStats {
        Long getPartnerId();
        Double getAverageRating();
        Long getReviewCount();
    }

    @Query("select r.partner.id as partnerId, avg(r.rating) as averageRating, count(r) as reviewCount from Review r " +
            "where r.partner.id in :partnerIds group by r.partner.id")
    List<PartnerReviewStats> summarizeByPartnerIds(@Param("partnerIds") Collection<Long> partnerIds);

    @Query("""
            select r.service.id as serviceId, avg(r.rating) as averageRating,
                   count(r) as reviewCount
            from Review r
            where r.service.id in :serviceIds
            group by r.service.id
            """)
    List<ServiceReviewStats> summarizeByServiceIds(@Param("serviceIds") Collection<Long> serviceIds);

    long countByPartner_Id(Long partnerId);

    List<Review> findByPartner_IdOrderByCreatedAtDesc(Long partnerId);

    boolean existsByService_IdAndCustomer_Id(Long serviceId, Long customerId);

    @Query(value = "select r from Review r where r.service.id = :serviceId " +
            "order by case when :customerId is not null and r.customer.id = :customerId then 0 else 1 end, " +
            "r.createdAt desc, r.id desc",
            countQuery = "select count(r) from Review r where r.service.id = :serviceId")
    Page<Review> findServiceReviews(
            @Param("serviceId") Long serviceId,
            @Param("customerId") Long customerId,
            Pageable pageable
    );
}
