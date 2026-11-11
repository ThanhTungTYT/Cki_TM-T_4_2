
package org.ckitmdt.backend.repository;

import jakarta.persistence.LockModeType;
import org.ckitmdt.backend.entity.ProviderSettlement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProviderSettlementRepository extends JpaRepository<ProviderSettlement, Long> {

    List<ProviderSettlement> findAllByOrderByCreatedAtDesc();

    List<ProviderSettlement> findByPartner_IdOrderByCreatedAtDesc(Long partnerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM ProviderSettlement s JOIN FETCH s.partner WHERE s.id = :id")
    Optional<ProviderSettlement> findByIdForUpdate(@Param("id") Long id);
}
