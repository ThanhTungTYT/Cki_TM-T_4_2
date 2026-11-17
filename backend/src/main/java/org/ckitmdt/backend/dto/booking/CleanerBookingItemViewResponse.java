package org.ckitmdt.backend.dto.booking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CleanerBookingItemViewResponse {

    private Long id;

    private String serviceName;

    private String packageName;

    private Integer quantity;

    private Integer employeeCount;

    private Integer durationMinutes;

    private String note;
}