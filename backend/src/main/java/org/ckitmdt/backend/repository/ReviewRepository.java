package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    long countByPartner_Id(Long partnerId);

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
