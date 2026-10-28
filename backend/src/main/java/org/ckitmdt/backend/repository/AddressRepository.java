package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.Address;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AddressRepository extends JpaRepository<Address, Long> {
    List<Address> findByUserId(Long userId);
    Optional<Address> findByIdAndUserId(Long id, Long userId);

    List<Address> findByUserIdOrderByIdDesc(Long userId);

    @Query("""
            select a from Address a
            where a.user.id = :userId
            order by case when a.isDefault = true then 0 else 1 end, a.id
            """)
    List<Address> findProviderAddresses(@Param("userId") Long userId);
}
