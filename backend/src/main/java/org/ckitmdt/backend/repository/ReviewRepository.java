package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    long countByPartner_Id(Long partnerId);
}
