
package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    List<Payment> findByBooking_Id(Long bookingId);

    List<Payment> findByBooking_IdAndStatusIgnoreCase(
            Long bookingId,
            String status
    );
}
