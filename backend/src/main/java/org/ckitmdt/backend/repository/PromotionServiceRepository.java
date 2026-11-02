
package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.PromotionService;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PromotionServiceRepository extends JpaRepository<PromotionService, org.ckitmdt.backend.entity.PromotionServiceId> {
    List<PromotionService> findByPromotion_Id(Long promotionId);
    void deleteByPromotion_Id(Long promotionId);
}
