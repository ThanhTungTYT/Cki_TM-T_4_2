
package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.ProviderSettlementItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProviderSettlementItemRepository extends JpaRepository<ProviderSettlementItem, Long> {
    boolean existsByBooking_Id(Long bookingId);

    List<ProviderSettlementItem> findBySettlement_IdOrderByIdAsc(Long settlementId);
}
