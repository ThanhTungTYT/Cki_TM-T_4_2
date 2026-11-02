package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.AdminNotification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AdminNotificationRepository
        extends JpaRepository<AdminNotification, Long> {

    List<AdminNotification> findTop100ByRecipient_IdOrderByCreatedAtDesc(
            Long recipientId
    );

    long countByRecipient_IdAndReadAtIsNull(Long recipientId);

    Optional<AdminNotification> findByIdAndRecipient_Id(
            Long id,
            Long recipientId
    );
}