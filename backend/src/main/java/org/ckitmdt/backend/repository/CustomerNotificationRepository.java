package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.CustomerNotification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CustomerNotificationRepository extends JpaRepository<CustomerNotification, Long> {
    List<CustomerNotification> findTop100ByRecipient_IdOrderByCreatedAtDesc(Long recipientId);
    long countByRecipient_IdAndReadAtIsNull(Long recipientId);
    Optional<CustomerNotification> findByIdAndRecipient_Id(Long id, Long recipientId);
}
