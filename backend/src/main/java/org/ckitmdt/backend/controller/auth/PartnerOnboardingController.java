package org.ckitmdt.backend.controller.auth;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.AdminNotification;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.entity.PartnerStatusHistory;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.AdminNotificationRepository;
import org.ckitmdt.backend.repository.PartnerRepository;
import org.ckitmdt.backend.repository.PartnerStatusHistoryRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.ckitmdt.backend.service.auth.AuthRateLimitService;
import org.ckitmdt.backend.service.auth.EmailService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

@RestController
@RequiredArgsConstructor
public class PartnerOnboardingController {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,10}$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^(0|\\+84)[0-9]{9,10}$");
    private static final Pattern TAX_CODE_PATTERN = Pattern.compile("^[0-9]{10}(-[0-9]{3})?$|^[0-9]{13}$");
    private static final Set<String> ALLOWED_ENTITY_TYPES = Set.of(
            "HOUSEHOLD_BUSINESS", "SINGLE_MEMBER_LLC", "MULTI_MEMBER_LLC", "JOINT_STOCK_COMPANY", "PRIVATE_ENTERPRISE"
    );
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "application/pdf"
    );
    private static final long MAX_FILE_SIZE_BYTES = 5L * 1024 * 1024;
    private static final long OTP_TTL_MILLIS = 5 * 60 * 1000L;
    private static final long OTP_RESEND_COOLDOWN_MILLIS = 60 * 1000L;
    private static final long VERIFIED_TOKEN_TTL_MILLIS = 30 * 60 * 1000L;
    private static final int OTP_MAX_ATTEMPTS = 5;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final Map<String, PendingOtp> pendingOtps = new ConcurrentHashMap<>();
    private final Map<String, VerifiedEmail> verifiedTokens = new ConcurrentHashMap<>();

    private final UserRepository userRepository;
    private final PartnerRepository partnerRepository;
    private final PartnerStatusHistoryRepository historyRepository;
    private final AdminNotificationRepository notificationRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final AuthRateLimitService rateLimitService;

    @Value("${cleanmate.upload.partner-kyb-dir:uploads/partner-kyb}")
    private String kybUploadDir;

    @PostMapping("/api/auth/register-partner/send-otp")
    public ResponseEntity<Map<String, Object>> sendPartnerEmailOtp(
            @RequestBody Map<String, String> request,
            HttpServletRequest httpRequest
    ) {
        String cleanEmail = clean(request == null ? null : request.get("email")).toLowerCase(Locale.ROOT);
        if (!EMAIL_PATTERN.matcher(cleanEmail).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email doanh nghiệp không hợp lệ.");
        }

        String remoteAddress = resolveClientIp(httpRequest);
        rateLimitService.consume("partner-otp-send-ip:" + remoteAddress,
                30, 60 * 60 * 1000L,
                "Địa chỉ mạng này đã gửi quá nhiều yêu cầu OTP. Vui lòng thử lại sau.");
        rateLimitService.consume("partner-otp-send:" + remoteAddress + ":" + cleanEmail,
                5, 60 * 60 * 1000L,
                "Bạn đã yêu cầu gửi mã OTP quá nhiều lần cho email này. Vui lòng thử lại sau 1 giờ.");

        if (userRepository.existsByEmail(cleanEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email doanh nghiệp này đã được đăng ký trong hệ thống.");
        }

        long now = System.currentTimeMillis();
        cleanupExpiredStores(now);

        PendingOtp existing = pendingOtps.get(cleanEmail);
        if (existing != null && now - existing.lastSentAt() < OTP_RESEND_COOLDOWN_MILLIS) {
            long waitSeconds = Math.max(1L, (OTP_RESEND_COOLDOWN_MILLIS - (now - existing.lastSentAt()) + 999L) / 1000L);
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Vui lòng đợi " + waitSeconds + " giây trước khi gửi lại mã OTP.");
        }

        String otp = String.valueOf(SECURE_RANDOM.nextInt(900000) + 100000);
        String otpHash = passwordEncoder.encode(otp);

        try {
            emailService.sendPartnerRegistrationOtp(cleanEmail, otp);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Không thể gửi email xác thực lúc này. Vui lòng kiểm tra cấu hình SMTP hoặc thử lại sau.");
        }

        pendingOtps.put(cleanEmail, new PendingOtp(otpHash, now + OTP_TTL_MILLIS, now, 0));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "Đã gửi mã OTP 6 chữ số đến email " + cleanEmail + ".");
        body.put("cooldownSeconds", 60);
        body.put("expiresInSeconds", 300);
        return ResponseEntity.ok(body);
    }

    @PostMapping("/api/auth/register-partner/verify-otp")
    public ResponseEntity<Map<String, Object>> verifyPartnerEmailOtp(
            @RequestBody Map<String, String> request,
            HttpServletRequest httpRequest
    ) {
        String cleanEmail = clean(request == null ? null : request.get("email")).toLowerCase(Locale.ROOT);
        String otp = clean(request == null ? null : request.get("otp"));

        if (!EMAIL_PATTERN.matcher(cleanEmail).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email doanh nghiệp không hợp lệ.");
        }
        if (!otp.matches("^[0-9]{6}$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mã OTP phải gồm đúng 6 chữ số.");
        }

        String remoteAddress = resolveClientIp(httpRequest);
        rateLimitService.consume("partner-otp-verify:" + remoteAddress + ":" + cleanEmail,
                10, 10 * 60 * 1000L,
                "Bạn đã thử xác thực OTP quá nhiều lần. Vui lòng thử lại sau ít phút.");

        long now = System.currentTimeMillis();
        cleanupExpiredStores(now);

        PendingOtp record = pendingOtps.get(cleanEmail);
        if (record == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Chưa có mã OTP cho email này hoặc mã đã hết hạn. Vui lòng bấm gửi lại mã.");
        }
        if (now > record.expiresAt()) {
            pendingOtps.remove(cleanEmail);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.");
        }
        if (record.failedAttempts() >= OTP_MAX_ATTEMPTS) {
            pendingOtps.remove(cleanEmail);
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Bạn đã nhập sai OTP quá 5 lần. Vui lòng yêu cầu gửi lại mã mới.");
        }
        if (!passwordEncoder.matches(otp, record.otpHash())) {
            int nextAttempts = record.failedAttempts() + 1;
            pendingOtps.put(cleanEmail, new PendingOtp(record.otpHash(), record.expiresAt(), record.lastSentAt(), nextAttempts));
            int remaining = Math.max(0, OTP_MAX_ATTEMPTS - nextAttempts);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    remaining > 0
                            ? "Mã OTP không chính xác. Bạn còn " + remaining + " lần thử."
                            : "Mã OTP không chính xác. Vui lòng yêu cầu gửi lại mã mới.");
        }

        pendingOtps.remove(cleanEmail);
        String verificationToken = UUID.randomUUID().toString();
        verifiedTokens.put(verificationToken, new VerifiedEmail(cleanEmail, now + VERIFIED_TOKEN_TTL_MILLIS));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("verified", true);
        body.put("email", cleanEmail);
        body.put("emailVerificationToken", verificationToken);
        body.put("expiresInSeconds", 1800);
        body.put("message", "Xác thực email doanh nghiệp thành công!");
        return ResponseEntity.ok(body);
    }

    @PostMapping(value = "/api/auth/register-partner", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public ResponseEntity<Map<String, Object>> registerPartner(
            @RequestParam("representativeName") String representativeName,
            @RequestParam(value = "representativeTitle", required = false, defaultValue = "Giám đốc / Chủ hộ kinh doanh") String representativeTitle,
            @RequestParam("email") String email,
            @RequestParam("emailVerificationToken") String emailVerificationToken,
            @RequestParam("phone") String phone,
            @RequestParam("password") String password,
            @RequestParam("businessName") String businessName,
            @RequestParam("entityType") String entityType,
            @RequestParam(value = "countryCode", required = false, defaultValue = "VN") String countryCode,
            @RequestParam("taxCode") String taxCode,
            @RequestParam("businessLicenseNumber") String businessLicenseNumber,
            @RequestParam("address") String address,
            @RequestParam("latitude") BigDecimal latitude,
            @RequestParam("longitude") BigDecimal longitude,
            @RequestParam(value = "serviceRadiusKm", required = false, defaultValue = "10") Double serviceRadiusKm,
            @RequestParam("bankName") String bankName,
            @RequestParam("bankAccountNumber") String bankAccountNumber,
            @RequestParam("bankAccountHolder") String bankAccountHolder,
            @RequestParam(value = "description", required = false, defaultValue = "") String description,
            @RequestParam(value = "termsAccepted", defaultValue = "false") boolean termsAccepted,
            @RequestParam(value = "businessLicenseFile", required = false) MultipartFile businessLicenseFile,
            @RequestParam(value = "representativeIdCardFile", required = false) MultipartFile representativeIdCardFile
    ) {
        String cleanEmail = clean(email).toLowerCase(Locale.ROOT);
        String cleanVerifyToken = clean(emailVerificationToken);
        String cleanRepName = clean(representativeName);
        String cleanPhone = clean(phone);
        String cleanBizName = clean(businessName);
        String cleanEntityType = clean(entityType).toUpperCase(Locale.ROOT);
        String cleanTaxCode = clean(taxCode);
        String cleanLicenseNo = clean(businessLicenseNumber);
        String cleanAddress = clean(address);
        String cleanBankName = clean(bankName);
        String cleanBankAcc = clean(bankAccountNumber);
        String cleanBankHolder = clean(bankAccountHolder);

        validateOnboardingFields(
                cleanRepName, cleanEmail, cleanPhone, password, true,
                cleanBizName, cleanEntityType, cleanTaxCode, cleanLicenseNo,
                cleanAddress, latitude, longitude, serviceRadiusKm,
                cleanBankName, cleanBankAcc, cleanBankHolder, termsAccepted
        );

        VerifiedEmail verified = verifiedTokens.get(cleanVerifyToken);
        if (verified == null
                || System.currentTimeMillis() > verified.expiresAt()
                || !verified.email().equals(cleanEmail)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Email doanh nghiệp chưa được xác thực OTP hoặc phiên xác thực đã hết hạn. Vui lòng quay lại Bước 1 xác thực email.");
        }

        if (userRepository.existsByEmail(cleanEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email doanh nghiệp này đã được đăng ký trong hệ thống.");
        }

        String licenseUrl = businessLicenseFile != null && !businessLicenseFile.isEmpty()
                ? storeDocument(businessLicenseFile, "license")
                : null;
        String idCardUrl = representativeIdCardFile != null && !representativeIdCardFile.isEmpty()
                ? storeDocument(representativeIdCardFile, "idcard")
                : null;

        LocalDateTime now = LocalDateTime.now();
        User user = User.builder()
                .fullName(trimMax(cleanRepName, 100))
                .email(trimMax(cleanEmail, 150))
                .phone(trimMax(cleanPhone, 20))
                .passwordHash(passwordEncoder.encode(password))
                .role("PARTNER")
                .status("ACTIVE")
                .emailVerified(true)
                .createdAt(now)
                .updatedAt(now)
                .build();
        user = userRepository.save(user);

        Partner partner = Partner.builder()
                .user(user)
                .businessName(trimMax(cleanBizName, 255))
                .description(clean(description))
                .taxCode(trimMax(cleanTaxCode, 255))
                .entityType(trimMax(cleanEntityType, 50))
                .countryCode(trimMax(clean(countryCode).isBlank() ? "VN" : clean(countryCode).toUpperCase(Locale.ROOT), 10))
                .businessLicenseNumber(trimMax(cleanLicenseNo, 100))
                .representativeName(trimMax(cleanRepName, 100))
                .representativeTitle(trimMax(clean(representativeTitle), 100))
                .businessLicenseUrl(licenseUrl)
                .representativeIdCardUrl(idCardUrl)
                .address(trimMax(cleanAddress, 255))
                .latitude(latitude)
                .longitude(longitude)
                .serviceRadiusKm(clampRadius(serviceRadiusKm))
                .bankName(trimMax(cleanBankName, 100))
                .bankAccountNumber(trimMax(cleanBankAcc, 50))
                .bankAccountHolder(trimMax(cleanBankHolder.toUpperCase(Locale.ROOT), 150))
                .termsAcceptedAt(now)
                .status("PENDING")
                .totalCompletedJobs(0)
                .version(1)
                .createdAt(now)
                .updatedAt(now)
                .build();
        partner = partnerRepository.save(partner);

        historyRepository.save(PartnerStatusHistory.builder()
                .partner(partner)
                .oldStatus("NONE")
                .newStatus("PENDING")
                .reason("Doanh nghiệp nộp hồ sơ đăng ký đối tác chuẩn KYB.")
                .actionType("REGISTER")
                .changedByEmail(cleanEmail)
                .build());

        notifyAdminsNewApplication(partner, false);
        verifiedTokens.remove(cleanVerifyToken);

        Map<String, Object> body = toOnboardingResponse(partner);
        body.put("message", "Đăng ký đối tác thành công! Hồ sơ của bạn đang chờ Admin thẩm định.");
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @GetMapping("/api/partner-onboarding/status")
    @Transactional(readOnly = true)
    public Map<String, Object> getOnboardingStatus(Authentication auth) {
        Partner partner = resolveOwnPartner(auth);
        return toOnboardingResponse(partner);
    }

    @PutMapping(value = "/api/partner-onboarding/resubmit", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public Map<String, Object> resubmitPartner(
            Authentication auth,
            @RequestParam("representativeName") String representativeName,
            @RequestParam(value = "representativeTitle", required = false, defaultValue = "Giám đốc / Chủ hộ kinh doanh") String representativeTitle,
            @RequestParam("phone") String phone,
            @RequestParam("businessName") String businessName,
            @RequestParam("entityType") String entityType,
            @RequestParam(value = "countryCode", required = false, defaultValue = "VN") String countryCode,
            @RequestParam("taxCode") String taxCode,
            @RequestParam("businessLicenseNumber") String businessLicenseNumber,
            @RequestParam("address") String address,
            @RequestParam("latitude") BigDecimal latitude,
            @RequestParam("longitude") BigDecimal longitude,
            @RequestParam(value = "serviceRadiusKm", required = false, defaultValue = "10") Double serviceRadiusKm,
            @RequestParam("bankName") String bankName,
            @RequestParam("bankAccountNumber") String bankAccountNumber,
            @RequestParam("bankAccountHolder") String bankAccountHolder,
            @RequestParam(value = "description", required = false, defaultValue = "") String description,
            @RequestParam(value = "termsAccepted", defaultValue = "true") boolean termsAccepted,
            @RequestParam(value = "businessLicenseFile", required = false) MultipartFile businessLicenseFile,
            @RequestParam(value = "representativeIdCardFile", required = false) MultipartFile representativeIdCardFile
    ) {
        Partner partner = resolveOwnPartner(auth);
        String oldStatus = partner.getStatus() == null ? "PENDING" : partner.getStatus().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("REJECTED", "PENDING").contains(oldStatus)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Chỉ hồ sơ đang chờ duyệt hoặc bị từ chối mới có thể chỉnh sửa và nộp lại.");
        }

        String cleanRepName = clean(representativeName);
        String cleanPhone = clean(phone);
        String cleanBizName = clean(businessName);
        String cleanEntityType = clean(entityType).toUpperCase(Locale.ROOT);
        String cleanTaxCode = clean(taxCode);
        String cleanLicenseNo = clean(businessLicenseNumber);
        String cleanAddress = clean(address);
        String cleanBankName = clean(bankName);
        String cleanBankAcc = clean(bankAccountNumber);
        String cleanBankHolder = clean(bankAccountHolder);

        validateOnboardingFields(
                cleanRepName, partner.getUser().getEmail(), cleanPhone, null, false,
                cleanBizName, cleanEntityType, cleanTaxCode, cleanLicenseNo,
                cleanAddress, latitude, longitude, serviceRadiusKm,
                cleanBankName, cleanBankAcc, cleanBankHolder, termsAccepted
        );

        if (businessLicenseFile != null && !businessLicenseFile.isEmpty()) {
            partner.setBusinessLicenseUrl(storeDocument(businessLicenseFile, "license"));
        }
        if (representativeIdCardFile != null && !representativeIdCardFile.isEmpty()) {
            partner.setRepresentativeIdCardUrl(storeDocument(representativeIdCardFile, "idcard"));
        }

        LocalDateTime now = LocalDateTime.now();
        User user = partner.getUser();
        user.setFullName(cleanRepName);
        user.setPhone(cleanPhone);
        user.setUpdatedAt(now);
        userRepository.save(user);

        partner.setBusinessName(cleanBizName);
        partner.setDescription(clean(description));
        partner.setEntityType(cleanEntityType);
        partner.setCountryCode(clean(countryCode).isBlank() ? "VN" : clean(countryCode).toUpperCase(Locale.ROOT));
        partner.setTaxCode(cleanTaxCode);
        partner.setBusinessLicenseNumber(cleanLicenseNo);
        partner.setRepresentativeName(cleanRepName);
        partner.setRepresentativeTitle(clean(representativeTitle));
        partner.setAddress(cleanAddress);
        partner.setLatitude(latitude);
        partner.setLongitude(longitude);
        partner.setServiceRadiusKm(clampRadius(serviceRadiusKm));
        partner.setBankName(cleanBankName);
        partner.setBankAccountNumber(cleanBankAcc);
        partner.setBankAccountHolder(cleanBankHolder.toUpperCase(Locale.ROOT));
        partner.setTermsAcceptedAt(now);
        partner.setStatus("PENDING");
        partner.setRejectionReason(null);
        partner.setVersion((partner.getVersion() == null ? 1 : partner.getVersion()) + 1);
        partner.setUpdatedAt(now);
        partner = partnerRepository.save(partner);

        historyRepository.save(PartnerStatusHistory.builder()
                .partner(partner)
                .oldStatus(oldStatus)
                .newStatus("PENDING")
                .reason("Doanh nghiệp đã bổ sung và nộp lại hồ sơ KYB.")
                .actionType("RESUBMIT")
                .changedByEmail(user.getEmail())
                .build());

        notifyAdminsNewApplication(partner, true);

        Map<String, Object> body = toOnboardingResponse(partner);
        body.put("message", "Đã cập nhật và gửi lại hồ sơ cho Admin thẩm định.");
        return body;
    }

    @GetMapping("/api/partner-onboarding/documents/{fileName:.+}")
    @Transactional(readOnly = true)
    public ResponseEntity<Resource> downloadDocument(
            @PathVariable String fileName,
            Authentication auth
    ) {
        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập.");
        }
        String safeName = Paths.get(fileName).getFileName().toString();
        User viewer = userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Không tìm thấy tài khoản."));
        String role = viewer.getRole() == null ? "" : viewer.getRole().trim().toUpperCase(Locale.ROOT).replaceFirst("^ROLE_", "");

        if (!Set.of("ADMIN", "STAFF").contains(role)) {
            Partner partner = partnerRepository.findByUserId(viewer.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem tài liệu này."));
            String expectedSuffix = "/api/partner-onboarding/documents/" + safeName;
            boolean ownsFile = expectedSuffix.equals(partner.getBusinessLicenseUrl())
                    || expectedSuffix.equals(partner.getRepresentativeIdCardUrl());
            if (!ownsFile) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền truy cập tài liệu này.");
            }
        }

        try {
            Path dir = Paths.get(kybUploadDir).toAbsolutePath().normalize();
            Path target = dir.resolve(safeName).normalize();
            if (!target.startsWith(dir) || !Files.exists(target)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tệp tài liệu.");
            }
            Resource resource = new UrlResource(target.toUri());
            String contentType = Files.probeContentType(target);
            if (contentType == null) {
                contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
            }
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + safeName + "\"")
                    .body(resource);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể đọc tệp tài liệu.");
        }
    }

    private Partner resolveOwnPartner(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập.");
        }
        User user = userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Không tìm thấy tài khoản."));
        return partnerRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chưa tìm thấy hồ sơ doanh nghiệp."));
    }

    private void validateOnboardingFields(
            String repName, String email, String phone, String password, boolean requirePassword,
            String bizName, String entityType, String taxCode, String licenseNo,
            String address, BigDecimal lat, BigDecimal lng, Double radius,
            String bankName, String bankAcc, String bankHolder, boolean termsAccepted
    ) {
        if (repName.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập họ tên người đại diện.");
        if (!EMAIL_PATTERN.matcher(email).matches()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email doanh nghiệp không hợp lệ.");
        if (!PHONE_PATTERN.matcher(phone).matches()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Số điện thoại phải bắt đầu bằng 0 hoặc +84 và gồm 10-11 chữ số.");
        if (requirePassword && (password == null || password.length() < 8)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mật khẩu phải có ít nhất 8 ký tự.");
        }
        if (bizName.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập tên doanh nghiệp.");
        if (!ALLOWED_ENTITY_TYPES.contains(entityType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Loại hình doanh nghiệp không hợp lệ.");
        }
        if (!TAX_CODE_PATTERN.matcher(taxCode).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mã số thuế phải gồm 10 hoặc 13 chữ số (hoặc dạng 10 số-3 số).");
        }
        if (licenseNo.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập số Giấy phép ĐKKD.");
        if (address.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập địa chỉ trụ sở.");
        if (lat == null || lng == null
                || lat.doubleValue() < -90 || lat.doubleValue() > 90
                || lng.doubleValue() < -180 || lng.doubleValue() > 180
                || (lat.doubleValue() == 0.0 && lng.doubleValue() == 0.0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng chọn vị trí trụ sở hợp lệ trên bản đồ.");
        }
        if (bankName.isBlank() || bankAcc.isBlank() || bankHolder.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập đầy đủ thông tin tài khoản ngân hàng nhận đối soát.");
        }
        if (!termsAccepted) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bạn cần xác nhận đồng ý Điều khoản Đối tác và cam kết SLA CleanMate.");
        }
    }

    private String storeDocument(MultipartFile file, String prefix) {
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tệp tài liệu không được vượt quá 5MB.");
        }
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!ALLOWED_MIME_TYPES.contains(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chỉ hỗ trợ tải lên ảnh JPG, PNG, WEBP hoặc tệp PDF.");
        }
        String ext = switch (contentType) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "application/pdf" -> ".pdf";
            default -> ".jpg";
        };
        String fileName = prefix + "_" + UUID.randomUUID().toString().replace("-", "") + ext;
        try {
            Path dir = Paths.get(kybUploadDir).toAbsolutePath().normalize();
            Files.createDirectories(dir);
            Files.copy(file.getInputStream(), dir.resolve(fileName), StandardCopyOption.REPLACE_EXISTING);
            return "/api/partner-onboarding/documents/" + fileName;
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể lưu tệp tài liệu KYB.");
        }
    }

    private void notifyAdminsNewApplication(Partner partner, boolean resubmit) {
        List<User> admins = userRepository.findByRoleIgnoreCaseAndStatusIgnoreCase("ADMIN", "ACTIVE");
        String title = resubmit ? "Doanh nghiệp nộp lại hồ sơ KYB" : "Hồ sơ đăng ký doanh nghiệp mới";
        String message = (resubmit ? "Đối tác " : "Doanh nghiệp mới ") + partner.getBusinessName()
                + " (MST: " + partner.getTaxCode() + ") đang chờ thẩm định phê duyệt.";
        for (User admin : admins) {
            notificationRepository.save(AdminNotification.builder()
                    .recipient(admin)
                    .type("PROVIDER_KYB_SUBMITTED")
                    .title(title)
                    .message(message)
                    .referenceType("PARTNER")
                    .referenceId(partner.getId())
                    .build());
        }
    }

    private Map<String, Object> toOnboardingResponse(Partner p) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", p.getId());
        map.put("status", p.getStatus());
        map.put("businessName", p.getBusinessName());
        map.put("description", p.getDescription());
        map.put("entityType", p.getEntityType());
        map.put("countryCode", p.getCountryCode());
        map.put("taxCode", p.getTaxCode());
        map.put("businessLicenseNumber", p.getBusinessLicenseNumber());
        map.put("representativeName", p.getRepresentativeName());
        map.put("representativeTitle", p.getRepresentativeTitle());
        map.put("businessLicenseUrl", p.getBusinessLicenseUrl());
        map.put("representativeIdCardUrl", p.getRepresentativeIdCardUrl());
        map.put("address", p.getAddress());
        map.put("latitude", p.getLatitude());
        map.put("longitude", p.getLongitude());
        map.put("serviceRadiusKm", p.getServiceRadiusKm());
        map.put("bankName", p.getBankName());
        map.put("bankAccountNumber", p.getBankAccountNumber());
        map.put("bankAccountHolder", p.getBankAccountHolder());
        map.put("termsAcceptedAt", p.getTermsAcceptedAt());
        map.put("rejectionReason", p.getRejectionReason());
        map.put("createdAt", p.getCreatedAt());
        map.put("updatedAt", p.getUpdatedAt());
        if (p.getUser() != null) {
            map.put("email", p.getUser().getEmail());
            map.put("phone", p.getUser().getPhone());
        }
        return map;
    }

    private Double clampRadius(Double radius) {
        if (radius == null || radius.isNaN()) return 10.0;
        return Math.max(1.0, Math.min(50.0, radius));
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private String trimMax(String value, int maxLen) {
        String cleaned = clean(value);
        return cleaned.length() <= maxLen ? cleaned : cleaned.substring(0, maxLen);
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) return "unknown";
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
    }

    private void cleanupExpiredStores(long now) {
        pendingOtps.entrySet().removeIf(entry -> now > entry.getValue().expiresAt());
        verifiedTokens.entrySet().removeIf(entry -> now > entry.getValue().expiresAt());
    }

    private record PendingOtp(String otpHash, long expiresAt, long lastSentAt, int failedAttempts) {}

    private record VerifiedEmail(String email, long expiresAt) {}
}
