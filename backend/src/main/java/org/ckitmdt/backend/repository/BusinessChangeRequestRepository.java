package org.ckitmdt.backend.repository;

import jakarta.persistence.LockModeType;
import org.ckitmdt.backend.entity.BusinessChangeRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BusinessChangeRequestRepository extends JpaRepository<BusinessChangeRequest, Long> {

    List<BusinessChangeRequest> findByPartner_IdOrderByCreatedAtDesc(Long partnerId);

    List<BusinessChangeRequest> findByPartner_IdAndStatusOrderByCreatedAtDesc(Long partnerId, String status);

    List<BusinessChangeRequest> findAllByOrderByCreatedAtDesc();

    List<BusinessChangeRequest> findByStatusOrderByCreatedAtDesc(String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM BusinessChangeRequest r WHERE r.id = :id")
    Optional<BusinessChangeRequest> findByIdForUpdate(@Param("id") Long id);
}