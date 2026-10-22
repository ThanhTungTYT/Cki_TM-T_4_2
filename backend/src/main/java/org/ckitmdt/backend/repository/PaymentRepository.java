package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.List;

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
    Optional<Payment> findByTxnRefForUpdate(@Param("txnRef") String txnRef);
}
