
package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.ReportResponse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReportResponseRepository extends JpaRepository<ReportResponse, Long> {

    List<ReportResponse> findByReport_IdOrderByCreatedAtAsc(Long reportId);

    long countByReport_Id(Long reportId);
}
