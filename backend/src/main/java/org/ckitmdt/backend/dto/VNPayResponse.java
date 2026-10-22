package org.ckitmdt.backend.dto;

public record VNPayResponse(
        String txnRef,
        String paymentUrl
) {
}