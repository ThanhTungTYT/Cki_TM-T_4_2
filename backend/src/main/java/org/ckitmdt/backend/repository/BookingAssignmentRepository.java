package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.BookingAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BookingAssignmentRepository extends JpaRepository<BookingAssignment, Long> {

    List<BookingAssignment> findByBooking_IdOrderByIdAsc(Long bookingId);

    List<BookingAssignment> findByPartner_IdOrderByAssignedAtDesc(Long partnerId);

    List<BookingAssignment> findByEmployee_IdOrderByAssignedAtDesc(Long employeeId);
}
