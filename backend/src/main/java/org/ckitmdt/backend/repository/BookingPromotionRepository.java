package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.BookingPromotion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BookingPromotionRepository extends JpaRepository<BookingPromotion, Long> {
    List<BookingPromotion> findByBooking_Id(Long bookingId);
}