
package org.ckitmdt.backend.repository;

import jakarta.persistence.LockModeType;
import org.ckitmdt.backend.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;    
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    List<Payment> findByBooking_Id(Long bookingId);

    List<Payment> findByBooking_IdAndStatusIgnoreCase(
            Long bookingId,
            String status
    );

    Optional<Payment> findByTxnRef(String txnRef);

    boolean existsByBooking_IdAndStatus(Long bookingId, String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Payment p WHERE p.txnRef = :txnRef")
    Optional<Payment> findByTxnRefForUpdate(
            @Param("txnRef") String txnRef
    );

    @Query("""
            SELECT COALESCE(SUM(p.amount), 0)
            FROM Payment p
            WHERE UPPER(p.status) = 'SUCCESS'
              AND p.paidAt >= :start
              AND p.paidAt < :end
            """)
    BigDecimal sumSuccessfulPaymentsByPaidAt(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );

    List<Payment> findByPaidAtGreaterThanEqualAndPaidAtLessThanAndStatusIgnoreCase(
            LocalDateTime start,
            LocalDateTime end,
            String status
    );
}
