package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.ComplaintResponse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ComplaintResponseRepository extends JpaRepository<ComplaintResponse, Long> {

    List<ComplaintResponse> findByTicket_IdOrderByCreatedAtAsc(Long ticketId);
}
