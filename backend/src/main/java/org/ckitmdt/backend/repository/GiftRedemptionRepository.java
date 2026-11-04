package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.GiftRedemption;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface GiftRedemptionRepository extends JpaRepository<GiftRedemption, Long> {
    Optional<GiftRedemption> findByUser_IdAndRequestKey(Long userId, String requestKey);
    List<GiftRedemption> findByUser_IdOrderByCreatedAtDesc(Long userId);
}
