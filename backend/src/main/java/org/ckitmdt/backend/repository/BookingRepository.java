
package org.ckitmdt.backend.repository;

import jakarta.persistence.LockModeType;
import org.ckitmdt.backend.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    Optional<Booking> findByBookingCode(String bookingCode);

    Optional<Booking> findByIdempotencyKey(String idempotencyKey);

    List<Booking> findByCustomerIdOrderByCreatedAtDesc(Long customerId);

    Optional<Booking> findByIdAndCustomerId(Long id, Long customerId);

    boolean existsByAddress_Id(Long addressId);

    long countByPartner_IdAndStatusNotInAndScheduledStartBeforeAndScheduledEndAfter(
            Long partnerId,
            Collection<String> statuses,
            LocalDateTime end,
            LocalDateTime start
    );

    default long countOverlappingBookings(
            Long partnerId,
            LocalDateTime start,
            LocalDateTime end
    ) {
        return countByPartner_IdAndStatusNotInAndScheduledStartBeforeAndScheduledEndAfter(
                partnerId,
                List.of("CANCELLED", "EXPIRED", "REJECTED"),
                end,
                start
        );
    }

    List<Booking> findByPartner_IdOrderByCreatedAtDesc(Long partnerId);

    @Query("""
            SELECT COALESCE(SUM(b.totalAmount), 0)
            FROM Booking b
            WHERE b.status = 'COMPLETED'
              AND b.completedAt >= :start
              AND b.completedAt < :end
            """)
    BigDecimal sumCompletedRevenue(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );

    @Query("""
            SELECT COUNT(b)
            FROM Booking b
            WHERE b.status = 'COMPLETED'
              AND b.completedAt >= :start
              AND b.completedAt < :end
            """)
    long countCompletedBookings(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );

    List<Booking> findByStatusAndCompletedAtGreaterThanEqualAndCompletedAtLessThan(
            String status,
            LocalDateTime start,
            LocalDateTime end
    );

    List<Booking> findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(
            LocalDateTime start,
            LocalDateTime end
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM Booking b WHERE b.id = :bookingId")
    Optional<Booking> findByIdForUpdate(
            @Param("bookingId") Long bookingId
    );

    List<Booking> findByStatusAndHoldExpiresAtBefore(String status, LocalDateTime expiresAt);
}
