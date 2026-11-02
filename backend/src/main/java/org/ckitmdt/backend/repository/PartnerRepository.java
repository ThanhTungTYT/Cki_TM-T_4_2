package org.ckitmdt.backend.repository;

import jakarta.persistence.LockModeType;
import org.ckitmdt.backend.entity.Partner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PartnerRepository extends JpaRepository<Partner, Long> {
    Optional<Partner> findByUserId(Long userId);
    List<Partner> findByStatusIgnoreCaseOrderByCreatedAtAsc(String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Partner p WHERE p.id = :id")
    Optional<Partner> findByIdForUpdate(@Param("id") Long id);
}