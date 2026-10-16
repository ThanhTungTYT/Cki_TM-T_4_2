package org.ckitmdt.backend.dto.booking;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingActionRequest {

    @NotBlank(message = "Action cannot be blank")
    private String action;

    private String note;

    private Long version;
}
