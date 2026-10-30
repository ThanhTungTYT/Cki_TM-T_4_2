package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, Long> {

    List<Employee> findByPartner_IdOrderByIdAsc(Long partnerId);

    boolean existsByPartner_IdAndUser_Id(Long partnerId, Long userId);
}
