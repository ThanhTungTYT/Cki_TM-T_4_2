
package org.ckitmdt.backend.repository;

import jakarta.persistence.LockModeType;
import org.ckitmdt.backend.entity.BookingAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BookingAssignmentRepository extends JpaRepository<BookingAssignment, Long> {

    List<BookingAssignment> findByBooking_IdOrderByIdAsc(Long bookingId);

    List<BookingAssignment> findByPartner_IdOrderByAssignedAtDesc(Long partnerId);

    List<BookingAssignment> findByEmployee_IdOrderByAssignedAtDesc(Long employeeId);

    // Khóa bản ghi Assignment trong lúc Cleaner thực hiện hành động.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM BookingAssignment a WHERE a.id = :assignmentId")
    Optional<BookingAssignment> findByIdForUpdate(
            @Param("assignmentId") Long assignmentId
    );
}
