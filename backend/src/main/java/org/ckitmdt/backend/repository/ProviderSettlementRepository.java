
package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.ProviderSettlement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProviderSettlementRepository extends JpaRepository<ProviderSettlement, Long> {
    List<ProviderSettlement> findAllByOrderByCreatedAtDesc();

    List<ProviderSettlement> findByPartner_IdOrderByCreatedAtDesc(Long partnerId);
}
