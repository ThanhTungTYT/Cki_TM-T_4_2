
package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, Long> {

    List<Employee> findByPartner_IdOrderByIdAsc(Long partnerId);

    boolean existsByPartner_IdAndUser_Id(Long partnerId, Long userId);

    // Tìm hồ sơ nhân viên thông qua tài khoản đăng nhập
    Optional<Employee> findByUser_Id(Long userId);
}
