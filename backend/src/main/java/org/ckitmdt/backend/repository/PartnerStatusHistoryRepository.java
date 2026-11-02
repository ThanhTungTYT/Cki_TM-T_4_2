package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.PartnerStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PartnerStatusHistoryRepository extends JpaRepository<PartnerStatusHistory, Long> {
    List<PartnerStatusHistory> findByPartnerIdOrderByChangedAtDesc(Long partnerId);
}