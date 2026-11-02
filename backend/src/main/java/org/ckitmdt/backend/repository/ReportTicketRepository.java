
package org.ckitmdt.backend.repository;

import jakarta.persistence.LockModeType;
import org.ckitmdt.backend.entity.ReportTicket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReportTicketRepository extends JpaRepository<ReportTicket, Long> {

    List<ReportTicket> findByReporterIdOrderByCreatedAtDesc(Long reporterId);

    List<ReportTicket> findTop200ByOrderByCreatedAtDesc();

    List<ReportTicket> findByBooking_Partner_IdOrderByCreatedAtDesc(Long partnerId);

    List<ReportTicket> findByStatusInOrderByCreatedAtDesc(List<String> statuses);

    long countByStatusIgnoreCase(String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM ReportTicket r WHERE r.id = :id")
    Optional<ReportTicket> findByIdForUpdate(@Param("id") Long id);
}
