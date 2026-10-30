package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.BusinessChangeRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BusinessChangeRequestRepository extends JpaRepository<BusinessChangeRequest, Long> {

    List<BusinessChangeRequest> findByPartner_IdOrderByCreatedAtDesc(Long partnerId);

    List<BusinessChangeRequest> findByPartner_IdAndStatusOrderByCreatedAtDesc(Long partnerId, String status);

    List<BusinessChangeRequest> findAllByOrderByCreatedAtDesc();

    List<BusinessChangeRequest> findByStatusOrderByCreatedAtDesc(String status);
}
