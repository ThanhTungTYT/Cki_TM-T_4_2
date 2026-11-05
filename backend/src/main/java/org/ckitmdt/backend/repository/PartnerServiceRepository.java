package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.PartnerService;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PartnerServiceRepository extends JpaRepository<PartnerService, Long>, JpaSpecificationExecutor<PartnerService> {
    List<PartnerService> findByPartner_Id(Long partnerId);
    List<PartnerService> findByService_Id(Long serviceId);
    List<PartnerService> findByPartner_IdAndStatusIgnoreCase(Long partnerId, String status);
    Optional<PartnerService> findByPartner_IdAndService_IdAndStatusIgnoreCase(
            Long partnerId,
            Long serviceId,
            String status
    );
    List<PartnerService> findByStatusIgnoreCaseOrderByCreatedAtAsc(String status);
}
