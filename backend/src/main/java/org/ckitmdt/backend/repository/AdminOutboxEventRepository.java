package org.ckitmdt.backend.repository;

import jakarta.persistence.LockModeType;
import org.ckitmdt.backend.entity.AdminOutboxEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AdminOutboxEventRepository extends JpaRepository<AdminOutboxEvent, Long> {
    boolean existsByEventKey(String eventKey);

    List<AdminOutboxEvent> findTop100ByStatusOrderByCreatedAtDesc(String status);

    List<AdminOutboxEvent> findTop50ByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc(
            String status,
            LocalDateTime now
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM AdminOutboxEvent e WHERE e.id = :id")
    Optional<AdminOutboxEvent> findByIdForUpdate(@Param("id") Long id);
}