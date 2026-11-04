package org.ckitmdt.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.ckitmdt.backend.entity.*;
import org.ckitmdt.backend.repository.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GiftShopServiceTest {
    private final RewardGiftRepository gifts = mock(RewardGiftRepository.class);
    private final GiftRedemptionRepository redemptions = mock(GiftRedemptionRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final RewardAccountRepository accounts = mock(RewardAccountRepository.class);
    private final RewardTransactionRepository transactions = mock(RewardTransactionRepository.class);
    private final GiftShopService shop = new GiftShopService(gifts, redemptions, users, accounts, transactions, mock(RewardExpiryService.class));
    private final GiftShopService.RedeemRequest request = new GiftShopService.RedeemRequest(1L, "Nguyen Van A", "0901234567", "12 Nguyen Trai, TP HCM", "12345678-12345678");
    private RewardAccount wallet;
    private RewardGift gift;
    @BeforeEach void setup() {
        when(users.findByEmail("user@test")).thenReturn(Optional.of(User.builder().id(7L).role("CUSTOMER").build()));
        wallet = RewardAccount.builder().balance(5000).totalRedeemed(0).build();
        gift = RewardGift.builder().id(1L).name("Bột giặt").pointsCost(3000).stock(2).active(true).build();
        when(accounts.findByUserIdForUpdate(7L)).thenReturn(Optional.of(wallet));
        when(gifts.findForUpdate(1L)).thenReturn(Optional.of(gift));
        when(redemptions.save(any())).thenAnswer(invocation -> { GiftRedemption r = invocation.getArgument(0); r.setId(99L); return r; });
    }
    @Test void redeemDeductsCoinsAndStockAndStoresDelivery() {
        var result = shop.redeem("user@test", request);
        assertEquals(2000, wallet.getBalance());
        assertEquals(1, gift.getStock());
        assertEquals(request.address(), result.address());
        assertEquals("PENDING", result.status());
        verify(transactions).save(argThat(t -> t.getPoints() == -3000 && "GIFT_REDEEM_99".equals(t.getEventKey())));
    }
    @Test void insufficientBalanceDoesNotCreateRedemption() {
        wallet.setBalance(2999);
        assertThrows(ResponseStatusException.class, () -> shop.redeem("user@test", request));
        assertEquals(2, gift.getStock());
        verify(redemptions, never()).save(any());
    }
    @Test void outOfStockDoesNotSpend() {
        gift.setStock(0);
        assertThrows(ResponseStatusException.class, () -> shop.redeem("user@test", request));
        assertEquals(5000, wallet.getBalance());
        verify(transactions, never()).save(any());
    }
    @Test void retryReturnsExistingRedemptionWithoutSpendingAgain() {
        GiftRedemption existing = GiftRedemption.builder().id(99L).gift(gift).giftName(gift.getName()).pointsUsed(3000)
                .recipientName(request.recipientName()).phone(request.phone()).address(request.address()).status("PENDING").build();
        when(redemptions.findByUser_IdAndRequestKey(7L, request.requestKey())).thenReturn(Optional.of(existing));
        assertEquals(99L, shop.redeem("user@test", request).id());
        assertEquals(5000, wallet.getBalance());
        verify(gifts, never()).findForUpdate(any());
        verify(transactions, never()).save(any());
    }
}
