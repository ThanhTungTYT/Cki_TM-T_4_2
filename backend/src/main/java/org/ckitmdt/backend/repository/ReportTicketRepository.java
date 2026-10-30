package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.ReportTicket;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ReportTicketRepository
        extends JpaRepository<ReportTicket, Long> {

    List<ReportTicket> findByReporterIdOrderByCreatedAtDesc(
            Long reporterId
    );

    List<ReportTicket> findTop200ByOrderByCreatedAtDesc();

    List<ReportTicket> findByBooking_Partner_IdOrderByCreatedAtDesc(Long partnerId);
}
