package org.ckitmdt.backend.dto.booking;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class BookingAvailabilitySlotResponse {
    private String time;
    private LocalDateTime scheduledStart;
    private LocalDateTime scheduledEnd;
    private boolean available;
    private String message;
}
