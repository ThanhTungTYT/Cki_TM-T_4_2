
package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    Optional<Booking> findByBookingCode(String bookingCode);

    Optional<Booking> findByIdempotencyKey(String idempotencyKey);

    List<Booking> findByCustomerIdOrderByCreatedAtDesc(Long customerId);

    Optional<Booking> findByIdAndCustomerId(Long id, Long customerId);

    @Query("SELECT COUNT(b) FROM Booking b WHERE b.partner.id = :partnerId " +
            "AND b.status NOT IN ('CANCELLED', 'EXPIRED', 'REJECTED') " +
            "AND b.scheduledStart < :end AND b.scheduledEnd > :start")
    long countOverlappingBookings(
            @Param("partnerId") Long partnerId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );

    @Query("SELECT b FROM Booking b WHERE b.partner.id = :partnerId ORDER BY b.createdAt DESC")
    List<Booking> findByPartnerIdOrderByCreatedAtDesc(@Param("partnerId") Long partnerId);

    @Query("SELECT COALESCE(SUM(b.totalAmount), 0) FROM Booking b " +
            "WHERE b.status = 'COMPLETED' " +
            "AND b.completedAt >= :start AND b.completedAt < :end")
    BigDecimal sumCompletedRevenue(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );

    @Query("SELECT COUNT(b) FROM Booking b " +
            "WHERE b.status = 'COMPLETED' " +
            "AND b.completedAt >= :start AND b.completedAt < :end")
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
}
