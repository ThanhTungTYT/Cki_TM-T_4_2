
package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.CancellationRefund;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CancellationRefundRepository
        extends JpaRepository<CancellationRefund, Long> {

    boolean existsByBooking_Id(Long bookingId);

    Optional<CancellationRefund> findByBooking_Id(Long bookingId);

    List<CancellationRefund> findTop200ByOrderByRequestedAtDesc();

    List<CancellationRefund> findByStatusIgnoreCaseOrderByRequestedAtDesc(
            String status
    );
}
