package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.BookingItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

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
}
