
package org.ckitmdt.backend.repository;

import jakarta.persistence.LockModeType;
import org.ckitmdt.backend.entity.CancellationRefund;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM CancellationRefund r WHERE r.id = :id")
    Optional<CancellationRefund> findByIdForUpdate(
            @Param("id") Long id
    );
}
