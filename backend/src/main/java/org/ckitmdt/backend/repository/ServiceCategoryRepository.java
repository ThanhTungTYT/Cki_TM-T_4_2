package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.ServiceCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ServiceCategoryRepository
        extends JpaRepository<ServiceCategory, Long> {
}
