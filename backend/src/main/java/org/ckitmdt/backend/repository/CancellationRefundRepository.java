package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.CancellationRefund;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CancellationRefundRepository
        extends JpaRepository<CancellationRefund, Long> {

    boolean existsByBookingId(Long bookingId);

    List<CancellationRefund> findTop200ByOrderByRequestedAtDesc();
}
