package org.ckitmdt.backend.service;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.config.VNPayConfig;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
public class VNPayService {

    private final VNPayConfig config;

    private static final ZoneId ZONE =
            ZoneId.of("Asia/Ho_Chi_Minh");

    private static final DateTimeFormatter FORMAT =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String buildQuery(Map<String, String> params) {
        StringJoiner joiner = new StringJoiner("&");

        new TreeMap<>(params).forEach((key, value) -> {
            if (value != null && !value.isEmpty()) {
                joiner.add(encode(key) + "=" + encode(value));
            }
        });

        return joiner.toString();
    }

    private String hmacSHA512(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");

            mac.init(new SecretKeySpec(
                    config.getHashSecret().getBytes(
                            StandardCharsets.UTF_8
                    ),
                    "HmacSHA512"
            ));

            return HexFormat.of().formatHex(
                    mac.doFinal(
                            data.getBytes(StandardCharsets.UTF_8)
                    )
            );

        } catch (Exception e) {
            throw new IllegalStateException(
                    "Cannot sign VNPay request", e
            );
        }
    }

    public String createPaymentUrl(
            String txnRef,
            BigDecimal amount,
            String ipAddress
    ) {
        LocalDateTime now = LocalDateTime.now(ZONE);

        Map<String, String> params = new TreeMap<>();

        params.put("vnp_Version", "2.1.0");
        params.put("vnp_Command", "pay");
        params.put("vnp_TmnCode", config.getTmnCode());
        params.put("vnp_CurrCode", "VND");
        params.put("vnp_TxnRef", txnRef);
        params.put("vnp_OrderInfo", "Thanh toan CleanMate " + txnRef);
        params.put("vnp_OrderType", "other");
        params.put("vnp_Locale", "vn");
        params.put("vnp_ReturnUrl", config.getReturnUrl());
        params.put("vnp_IpAddr", ipAddress);
        params.put("vnp_CreateDate", now.format(FORMAT));
        params.put(
                "vnp_ExpireDate",
                now.plusMinutes(15).format(FORMAT)
        );

        params.put(
                "vnp_Amount",
                amount.movePointRight(2)
                        .toBigIntegerExact()
                        .toString()
        );

        String query = buildQuery(params);
        String hash = hmacSHA512(query);

        return config.getPayUrl()
                + "?" + query
                + "&vnp_SecureHash=" + hash;
    }

    public boolean verifySignature(Map<String, String> response) {
        String received = response.get("vnp_SecureHash");

        if (received == null ||
                !received.matches("[0-9a-fA-F]{128}")) {
            return false;
        }

        Map<String, String> params = new TreeMap<>();

        response.forEach((key, value) -> {
            if (key.startsWith("vnp_")
                    && !key.equals("vnp_SecureHash")
                    && !key.equals("vnp_SecureHashType")) {
                params.put(key, value);
            }
        });

        String expected = hmacSHA512(buildQuery(params));

        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.US_ASCII),
                received.toLowerCase(Locale.ROOT)
                        .getBytes(StandardCharsets.US_ASCII)
        );
    }

    public String getTmnCode() {
        return config.getTmnCode();
    }
}