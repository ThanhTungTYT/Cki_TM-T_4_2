
package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.CleanerOvertimeRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CleanerOvertimeRequestRepository
        extends JpaRepository<CleanerOvertimeRequest, Long> {

    // Lịch sử yêu cầu overtime của một Cleaner.
    List<CleanerOvertimeRequest> findByCleaner_IdOrderByCreatedAtDesc(
            Long cleanerId
    );

    // Các yêu cầu overtime thuộc một Provider.
    List<CleanerOvertimeRequest> findByPartner_IdOrderByCreatedAtDesc(
            Long partnerId
    );

    // Provider chỉ xem được yêu cầu thuộc đơn vị của mình.
    Optional<CleanerOvertimeRequest> findByIdAndPartner_Id(
            Long id,
            Long partnerId
    );

    // Lịch sử yêu cầu của một Assignment.
    List<CleanerOvertimeRequest> findByAssignment_IdOrderByCreatedAtDesc(
            Long assignmentId
    );

    // Kiểm tra Assignment đã có yêu cầu đang chờ duyệt hay chưa.
    boolean existsByAssignment_IdAndStatusIgnoreCase(
            Long assignmentId,
            String status
    );

    // Tìm yêu cầu gần nhất của một Assignment theo trạng thái.
    Optional<CleanerOvertimeRequest>
    findFirstByAssignment_IdAndStatusIgnoreCaseOrderByCreatedAtDesc(
            Long assignmentId,
            String status
    );
}
