package org.ckitmdt.backend.dto;

public record VNPayStatusResponse(
        Long bookingId,
        String txnRef,
        String status
) {
}