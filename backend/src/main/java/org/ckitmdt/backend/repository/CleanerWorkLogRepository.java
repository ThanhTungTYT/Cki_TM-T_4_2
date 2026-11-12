package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.CleanerWorkLog;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CleanerWorkLogRepository
        extends JpaRepository<CleanerWorkLog, Long> {

    List<CleanerWorkLog>
    findByAssignment_IdOrderByCreatedAtDesc(Long assignmentId);

    @EntityGraph(attributePaths = {"assignment", "booking", "cleaner"})
    List<CleanerWorkLog>
    findByBooking_IdOrderByCreatedAtDesc(Long bookingId);

    List<CleanerWorkLog>
    findByCleaner_IdOrderByCreatedAtDesc(Long cleanerId);
}
