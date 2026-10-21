package org.ckitmdt.backend.service.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String senderEmail;

    public void sendOtp(String email, String otp) {

        SimpleMailMessage message = new SimpleMailMessage();

        message.setFrom(senderEmail);
        message.setTo(email);
        message.setSubject("CleanMate - Ma xac thuc dang ky");

        message.setText(
                "Xin chao!\n\n"
                        + "Ma OTP dang ky tai khoan CleanMate cua ban la: "
                        + otp
                        + "\n\nMa co hieu luc trong 5 phut."
                        + "\nVui long khong chia se ma voi nguoi khac."
        );

        mailSender.send(message);
    }

    public void sendTemporaryPassword(String email, String temporaryPassword) {
        SimpleMailMessage message = new SimpleMailMessage();

        message.setFrom(senderEmail);
        message.setTo(email);
        message.setSubject("CleanMate - Khoi phuc mat khau");

        message.setText(
                "Xin chao!\n\n"
                        + "Mat khau tam thoi cua ban la: "
                        + temporaryPassword
                        + "\n\nMat khau nay co hieu luc trong 10 phut."
                        + "\nVui long nhap mat khau tam thoi de xac thuc,"
                        + " sau do dat mat khau moi."
                        + "\n\nKhong chia se mat khau nay voi bat ky ai."
        );

        mailSender.send(message);
    }
}
