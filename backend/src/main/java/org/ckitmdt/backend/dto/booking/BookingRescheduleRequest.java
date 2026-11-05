package org.ckitmdt.backend.dto.booking;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class BookingRescheduleRequest {
    @NotNull
    private LocalDateTime scheduledStart;
}
