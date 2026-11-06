package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.BookingItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

@Repository
public interface BookingItemRepository extends JpaRepository<BookingItem, Long> {
    List<BookingItem> findByBookingId(Long bookingId);

    boolean existsByService_IdAndBooking_Customer_IdAndBooking_Status(
            Long serviceId,
            Long customerId,
            String bookingStatus
    );

    Optional<BookingItem> findFirstByService_IdAndBooking_Customer_IdAndBooking_StatusOrderByBooking_CompletedAtDesc(
            Long serviceId,
            Long customerId,
            String bookingStatus
    );

    @Query("""
            SELECT COALESCE(SUM(COALESCE(i.employeeCount, 1) * COALESCE(i.quantity, 1)), 0)
            FROM BookingItem i JOIN i.booking b
            WHERE b.partner.id = :partnerId
              AND b.cancelledAt IS NULL
              AND UPPER(TRIM(b.status)) NOT IN ('CANCELLED', 'CANCELED', 'EXPIRED', 'REJECTED', 'COMPLETED')
              AND b.scheduledStart < :end AND b.scheduledEnd > :start
              AND (UPPER(TRIM(b.status)) <> 'PENDING_PAYMENT'
                   OR b.holdExpiresAt IS NULL OR b.holdExpiresAt > :now)
            """)
    long countReservedEmployees(
            @Param("partnerId") Long partnerId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end,
            @Param("now") LocalDateTime now
    );

    @Query("""
            SELECT COALESCE(SUM(COALESCE(i.employeeCount, 1) * COALESCE(i.quantity, 1)), 0)
            FROM BookingItem i JOIN i.booking b
            WHERE b.partner.id = :partnerId AND b.id <> :bookingId
              AND b.cancelledAt IS NULL
              AND UPPER(TRIM(b.status)) NOT IN ('CANCELLED', 'CANCELED', 'EXPIRED', 'REJECTED', 'COMPLETED')
              AND b.scheduledStart < :end AND b.scheduledEnd > :start
              AND (UPPER(TRIM(b.status)) <> 'PENDING_PAYMENT'
                   OR b.holdExpiresAt IS NULL OR b.holdExpiresAt > :now)
            """)
    long countReservedEmployeesExcludingBooking(
            @Param("partnerId") Long partnerId,
            @Param("bookingId") Long bookingId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end,
            @Param("now") LocalDateTime now
    );
}
