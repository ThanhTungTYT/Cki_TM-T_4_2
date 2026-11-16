
package org.ckitmdt.backend.dto.booking;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CleanerOvertimeRequestCreateRequest {

    @NotBlank(message = "Vui lòng nhập lý do cần gia hạn.")
    @Size(max = 2000, message = "Lý do không được vượt quá 2000 ký tự.")
    private String reason;

    @NotNull(message = "Vui lòng nhập thời gian gia hạn.")
    @Min(value = 1, message = "Thời gian gia hạn tối thiểu là 1 phút.")
    @Max(value = 480, message = "Thời gian gia hạn tối đa là 480 phút.")
    private Integer requestedAdditionalMinutes;
}
