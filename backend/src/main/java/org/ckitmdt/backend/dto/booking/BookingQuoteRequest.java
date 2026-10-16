package org.ckitmdt.backend.dto.booking;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingQuoteRequest {

    @NotNull(message = "partnerId is required")
    private Long partnerId;

    private Long addressId;

    @NotEmpty(message = "Items list cannot be empty")
    @Valid
    private List<BookingItemRequest> items;

    @NotNull(message = "scheduledStart is required")
    private LocalDateTime scheduledStart;

    private String voucherCode;
}
