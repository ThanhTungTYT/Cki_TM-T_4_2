package org.ckitmdt.backend.repository;

import org.ckitmdt.backend.entity.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CartItemRepository extends JpaRepository<CartItem, Long> {

    List<CartItem> findByCartId(Long cartId);

    @Query("SELECT ci FROM CartItem ci WHERE ci.cart.user.id = :userId ORDER BY ci.createdAt DESC")
    List<CartItem> findByUserId(@Param("userId") Long userId);

    @Query("SELECT ci FROM CartItem ci WHERE ci.id = :id AND ci.cart.user.id = :userId")
    Optional<CartItem> findByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    @Query("SELECT ci FROM CartItem ci WHERE ci.cart.id = :cartId " +
           "AND ci.service.id = :serviceId " +
           "AND (:packageId IS NULL AND ci.servicePackage IS NULL OR ci.servicePackage.id = :packageId) " +
           "AND (:partnerId IS NULL AND ci.partner IS NULL OR ci.partner.id = :partnerId)")
    Optional<CartItem> findExistingCartItem(
            @Param("cartId") Long cartId,
            @Param("serviceId") Long serviceId,
            @Param("packageId") Long packageId,
            @Param("partnerId") Long partnerId
    );

    @Modifying
    @Query("DELETE FROM CartItem ci WHERE ci.cart.id = :cartId")
    void deleteByCartId(@Param("cartId") Long cartId);

    @Modifying
    @Query("DELETE FROM CartItem ci WHERE ci.cart.id = :cartId AND ci.partner.id = :partnerId")
    void deleteByCartIdAndPartnerId(@Param("cartId") Long cartId, @Param("partnerId") Long partnerId);
}
