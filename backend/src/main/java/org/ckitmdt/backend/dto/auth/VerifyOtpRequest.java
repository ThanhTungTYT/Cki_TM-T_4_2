package org.ckitmdt.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class VerifyOtpRequest {

    @NotBlank(message = "Vui lòng nhập OTP")
    @Pattern(
            regexp = "\\d{6}",
            message = "OTP phải gồm đúng 6 chữ số"
    )
    private String otp;

    public String getOtp() {
        return otp;
    }

    public void setOtp(String otp) {
        this.otp = otp;
    }
}
