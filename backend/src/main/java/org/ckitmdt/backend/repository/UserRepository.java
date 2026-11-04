
package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    Optional<User> findByFacebookId(String facebookId);

    long countByRoleIgnoreCase(String role);

    long countByStatusIgnoreCase(String status);

    List<User> findByRoleIgnoreCaseAndStatusIgnoreCase(String role, String status);
}
