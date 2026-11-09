package org.ckitmdt.backend.dto.booking;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class BookingAvailabilityRequest {
    @NotNull
    private Long partnerId;

    @NotNull
    private LocalDate date;

    @NotEmpty
    @Valid
    private List<BookingItemRequest> items;

    private Long excludeBookingId;
}
