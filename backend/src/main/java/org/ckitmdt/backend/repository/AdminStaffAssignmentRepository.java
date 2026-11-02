
package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.AdminStaffAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AdminStaffAssignmentRepository extends JpaRepository<AdminStaffAssignment, Long> {

    Optional<AdminStaffAssignment> findByTicket_IdAndActiveTrue(Long ticketId);

    Optional<AdminStaffAssignment> findByIdempotencyKey(String idempotencyKey);

    List<AdminStaffAssignment> findByStaff_IdAndActiveTrueOrderByAssignedAtDesc(Long staffId);

    List<AdminStaffAssignment> findTop200ByOrderByAssignedAtDesc();

    List<AdminStaffAssignment> findByActiveTrueOrderByAssignedAtDesc();
}
