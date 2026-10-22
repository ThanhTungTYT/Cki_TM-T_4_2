package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    Optional<Booking> findByBookingCode(String bookingCode);

    Optional<Booking> findByIdempotencyKey(String idempotencyKey);

    List<Booking> findByCustomerIdOrderByCreatedAtDesc(Long customerId);

    Optional<Booking> findByIdAndCustomerId(Long id, Long customerId);

    // 1. Thay cho câu query bị lỗi ở dòng 28
    long countByPartner_IdAndStatusNotInAndScheduledStartBeforeAndScheduledEndAfter(
            Long partnerId,
            Collection<String> statuses,
            LocalDateTime end,
            LocalDateTime start
    );

    // Bổ sung method hỗ trợ giữ tương thích code cũ nếu dự án khác đang gọi countOverlappingBookings
    default long countOverlappingBookings(Long partnerId, LocalDateTime start, LocalDateTime end) {
        return countByPartner_IdAndStatusNotInAndScheduledStartBeforeAndScheduledEndAfter(
                partnerId,
                List.of("CANCELLED", "EXPIRED", "REJECTED"),
                end,
                start
        );
    }

    // 2. Thay cho câu query bị lỗi ở dòng 37
    List<Booking> findByPartner_IdOrderByCreatedAtDesc(Long partnerId);

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

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM Booking b WHERE b.id = :bookingId")
    Optional<Booking> findByIdForUpdate(
            @Param("bookingId") Long bookingId
    );
}
