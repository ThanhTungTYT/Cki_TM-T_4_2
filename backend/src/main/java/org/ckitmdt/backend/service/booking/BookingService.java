package org.ckitmdt.backend.service.booking;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.ckitmdt.backend.dto.booking.*;
import org.ckitmdt.backend.entity.*;
import org.ckitmdt.backend.repository.*;
import org.ckitmdt.backend.service.PromotionRewardService;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingService {
    @Value("${booking.availability.minimum-notice-minutes:120}")
    private long minimumNoticeMinutes;

    @Value("${booking.availability.travel-buffer-minutes:30}")
    private long travelBufferMinutes;

    @Value("${booking.availability.opening-time:08:00}")
    private LocalTime openingTime;

    @Value("${booking.availability.closing-time:20:00}")
    private LocalTime closingTime;

    private final BookingRepository bookingRepository;
    private final BookingItemRepository bookingItemRepository;
    private final BookingStatusHistoryRepository bookingStatusHistoryRepository;
    private final BookingStateEngine bookingStateEngine;
    private final UserRepository userRepository;
    private final PartnerRepository partnerRepository;
    private final PartnerServiceRepository partnerServiceRepository;
    private final AddressRepository addressRepository;
    private final ServiceRepository serviceRepository;
    private final ServicePackageRepository servicePackageRepository;
    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final PaymentRepository paymentRepository;
    private final PromotionRewardService promotionRewardService;
    private final BookingAssignmentRepository bookingAssignmentRepository;
    private final EmployeeRepository employeeRepository;
    private final AdminNotificationRepository adminNotificationRepository;

    @Transactional(readOnly = true)
    public BookingQuoteResponse calculateQuote(
            BookingQuoteRequest request,
            String userEmail
    ) {
        User customer = getUserByEmail(userEmail);
        String customerRole = customer.getRole() == null ? "" : customer.getRole().trim().toUpperCase(Locale.ROOT).replaceFirst("^ROLE_", "");
        if (!"CUSTOMER".equals(customerRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Chỉ tài khoản khách hàng (CUSTOMER) mới được đặt lịch dịch vụ.");
        }
        return calculateQuoteInternal(request, customer, false).response();
    }

    @Transactional(readOnly = true)
    public List<BookingAvailabilitySlotResponse> getAvailability(
            BookingAvailabilityRequest request, String userEmail) {
        User customer = getUserByEmail(userEmail);
        String customerRole = customer.getRole() == null ? "" : customer.getRole().trim().toUpperCase(Locale.ROOT).replaceFirst("^ROLE_", "");
        if (!"CUSTOMER".equals(customerRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Chỉ tài khoản khách hàng (CUSTOMER) mới được đặt lịch dịch vụ.");
        }
        if (request == null || request.getDate() == null || request.getItems() == null
                || request.getItems().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cần chọn nhà cung cấp, ngày và ít nhất một dịch vụ.");
        }
        if (request.getDate().isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Không thể xem lịch của ngày đã qua.");
        }

        Partner partner = partnerRepository.findById(request.getPartnerId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Không tìm thấy nhà cung cấp."));
        Booking excludedBooking = validateAvailabilityExclusion(
                request.getExcludeBookingId(), partner.getId(), customer);
        if (!isActive(partner.getStatus()) || partner.getUser() == null
                || !isActive(partner.getUser().getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Nhà cung cấp hiện không nhận đặt dịch vụ.");
        }

        long durationMinutes = 0;
        long requiredEmployees = 0;
        for (BookingItemRequest item : request.getItems()) {
            if (item == null || item.getServiceId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dịch vụ không hợp lệ.");
            }
            org.ckitmdt.backend.entity.Service service = serviceRepository.findById(item.getServiceId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Không tìm thấy dịch vụ."));
            if (!isActive(service.getStatus()) || service.getCategory() == null
                    || !isActive(service.getCategory().getStatus())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Dịch vụ hiện không nhận đặt.");
            }
            PartnerService offer = partnerServiceRepository
                    .findByPartner_IdAndService_IdAndStatusIgnoreCase(
                            partner.getId(), service.getId(), "ACTIVE")
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                            "Dịch vụ hiện không được nhà cung cấp này cung cấp."));
            if (offer.getPrice() == null || offer.getPrice().signum() < 0) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Giá dịch vụ của nhà cung cấp hiện không hợp lệ.");
            }

            int quantity = item.getQuantity() == null ? 1 : item.getQuantity();
            if (quantity < 1 || quantity > 100) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Số lượng dịch vụ phải từ 1 đến 100.");
            }
            ServicePackage servicePackage = null;
            if (item.getPackageId() != null) {
                servicePackage = servicePackageRepository.findById(item.getPackageId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                "Không tìm thấy gói dịch vụ."));
                if (servicePackage.getService() == null
                        || !Objects.equals(servicePackage.getService().getId(), service.getId())
                        || (servicePackage.getStatus() != null && !isActive(servicePackage.getStatus()))) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Gói dịch vụ không hợp lệ hoặc đã ngừng nhận đặt.");
                }
            }
            int duration = servicePackage != null && servicePackage.getDurationMinutes() != null
                    ? servicePackage.getDurationMinutes()
                    : service.getEstimatedMinutes() != null ? service.getEstimatedMinutes() : 60;
            int employees = servicePackage != null && servicePackage.getEmployeeCount() != null
                    ? servicePackage.getEmployeeCount() : 1;
            if (duration <= 0 || employees <= 0 || employees > 100) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Thời lượng hoặc số nhân viên của dịch vụ không hợp lệ.");
            }
            durationMinutes += (long) duration * quantity;
            requiredEmployees += (long) employees * quantity;
        }
        if (durationMinutes <= 0 || durationMinutes > Integer.MAX_VALUE
                || requiredEmployees <= 0 || requiredEmployees > Integer.MAX_VALUE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Không thể xác định thời lượng hoặc nhân lực cần thiết.");
        }
        int totalDurationMinutes = Math.toIntExact(durationMinutes);
        int employeesNeeded = Math.toIntExact(requiredEmployees);

        long activeEmployees = employeeRepository.findByPartner_IdOrderByIdAsc(partner.getId()).stream()
                .filter(employee -> isActive(employee.getStatus()) && employee.getUser() != null
                        && isActive(employee.getUser().getStatus()))
                .count();
        List<LocalTime> slots = List.of(
                LocalTime.of(8, 0), LocalTime.of(9, 30), LocalTime.of(11, 0),
                LocalTime.of(13, 30), LocalTime.of(15, 0), LocalTime.of(16, 30),
                LocalTime.of(18, 0));
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime excludedBookingStart = excludedBooking == null
                ? null : excludedBooking.getScheduledStart();
        LocalDateTime excludedBookingEnd = excludedBooking == null
                ? null : excludedBooking.getScheduledEnd();
        if (excludedBookingStart != null && excludedBookingEnd == null) {
            excludedBookingEnd = excludedBookingStart.plusMinutes(totalDurationMinutes);
        }
        LocalDateTime currentBookingEnd = excludedBookingEnd;

        return slots.stream().map(time -> {
            LocalDateTime start = LocalDateTime.of(request.getDate(), time);
            LocalDateTime end = start.plusMinutes(totalDurationMinutes);
            boolean replacesCurrentBookingTime = excludedBookingStart != null
                    && currentBookingEnd != null
                    && start.isBefore(currentBookingEnd)
                    && end.isAfter(excludedBookingStart);
            boolean meetsNotice = !start.isBefore(now.plusMinutes(effectiveMinimumNoticeMinutes()))
                    || replacesCurrentBookingTime;
            boolean withinWorkingHours = isWithinWorkingHours(start, end);
            long reservedEmployees = activeEmployees;
            if (meetsNotice && withinWorkingHours) {
                LocalDateTime dayStart = start.toLocalDate().atStartOfDay();
                LocalDateTime dayEnd = start.toLocalDate().plusDays(1).atStartOfDay();
                reservedEmployees = excludedBooking == null
                        ? bookingItemRepository.countReservedEmployees(
                        partner.getId(), dayStart, dayEnd, now)
                        : bookingItemRepository.countReservedEmployeesExcludingBooking(
                        partner.getId(), excludedBooking.getId(),
                        dayStart, dayEnd, now);
            }
            boolean available = meetsNotice && withinWorkingHours && activeEmployees > 0
                    && reservedEmployees + employeesNeeded <= activeEmployees;
            String message = !meetsNotice ? "Cần đặt trước ít nhất "
                    + effectiveMinimumNoticeMinutes() + " phút"
                    : !withinWorkingHours ? "Ngoài giờ phục vụ"
                    : available ? "Còn khả dụng" : "Không đủ nhân viên";
            return BookingAvailabilitySlotResponse.builder()
                    .time(time.toString())
                    .scheduledStart(start)
                    .scheduledEnd(end)
                    .available(available)
                    .message(message)
                    .build();
        }).toList();
    }

    @Transactional(readOnly = true)
    public Map<LocalDate, Boolean> getCalendarAvailability(
            BookingCalendarAvailabilityRequest request, String userEmail) {
        if (request.getDates().size() > 42) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Chỉ có thể kiểm tra tối đa 42 ngày mỗi lần.");
        }

        Map<LocalDate, Boolean> result = new LinkedHashMap<>();
        for (LocalDate date : request.getDates()) {
            if (date.isBefore(LocalDate.now())) {
                result.put(date, false);
                continue;
            }
            BookingAvailabilityRequest dailyRequest = new BookingAvailabilityRequest();
            dailyRequest.setPartnerId(request.getPartnerId());
            dailyRequest.setDate(date);
            dailyRequest.setItems(request.getItems());
            dailyRequest.setExcludeBookingId(request.getExcludeBookingId());
            result.put(date, getAvailability(dailyRequest, userEmail).stream()
                    .anyMatch(BookingAvailabilitySlotResponse::isAvailable));
        }
        return result;
    }

    private Booking validateAvailabilityExclusion(Long bookingId, Long partnerId, User customer) {
        if (bookingId == null) return null;
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found."));
        if (booking.getCustomer() == null || !Objects.equals(booking.getCustomer().getId(), customer.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot check this booking.");
        }
        if (booking.getPartner() == null || !Objects.equals(booking.getPartner().getId(), partnerId)
                || !BookingStatusEnum.PENDING_PROVIDER.name().equals(booking.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This booking is no longer eligible for rescheduling.");
        }
        return booking;
    }

    private QuoteCalculation calculateQuoteInternal(
            BookingQuoteRequest request,
            User customer,
            boolean lockForUpdate
    ) {
        Partner partner = partnerRepository.findById(request.getPartnerId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy nhà cung cấp."
                ));

        if (!isActive(partner.getStatus()) || partner.getUser() == null
                || !isActive(partner.getUser().getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Nhà cung cấp hiện không nhận đặt dịch vụ.");
        }

        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Đơn hàng phải có ít nhất một dịch vụ."
            );
        }

        int totalEstimatedMinutes = 0;
        int requiredEmployees = 0;
        BigDecimal subtotal = BigDecimal.ZERO;
        Map<Long, BigDecimal> serviceSubtotals = new HashMap<>();

        for (BookingItemRequest itemRequest : request.getItems()) {
            org.ckitmdt.backend.entity.Service service = serviceRepository
                    .findById(itemRequest.getServiceId())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Dịch vụ không tồn tại: " + itemRequest.getServiceId()
                    ));

            if (!isActive(service.getStatus()) || service.getCategory() == null
                    || !isActive(service.getCategory().getStatus())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Dịch vụ hiện không nhận đặt.");
            }

            PartnerService offer = partnerServiceRepository
                    .findByPartner_IdAndService_IdAndStatusIgnoreCase(
                            partner.getId(), service.getId(), "ACTIVE")
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                            "Dịch vụ hiện không được nhà cung cấp này cung cấp."));

            ServicePackage servicePackage = null;

            if (itemRequest.getPackageId() != null) {
                servicePackage = servicePackageRepository.findById(itemRequest.getPackageId())
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Không tìm thấy gói dịch vụ đã chọn."
                        ));

                if (servicePackage.getService() == null
                        || !servicePackage.getService().getId().equals(service.getId())) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Gói dịch vụ không thuộc dịch vụ đã chọn."
                    );
                }
                if (servicePackage.getStatus() != null && !isActive(servicePackage.getStatus())) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Gói dịch vụ đã ngừng nhận đặt.");
                }
            }

            int quantity = itemRequest.getQuantity() == null
                    ? 1
                    : itemRequest.getQuantity();

            if (quantity < 1 || quantity > 100) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Số lượng dịch vụ phải lớn hơn 0."
                );
            }

            BigDecimal unitPrice = servicePackage != null
                    ? servicePackage.getPrice()
                    : offer.getPrice();

            if (unitPrice == null || unitPrice.signum() < 0) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Giá dịch vụ hiện không hợp lệ."
                );
            }

            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(quantity));
            subtotal = subtotal.add(lineTotal);
            serviceSubtotals.merge(service.getId(), lineTotal, BigDecimal::add);

            int duration = servicePackage != null
                    && servicePackage.getDurationMinutes() != null
                    ? servicePackage.getDurationMinutes()
                    : service.getEstimatedMinutes() != null
                    ? service.getEstimatedMinutes()
                    : 60;

            totalEstimatedMinutes += duration * quantity;
            int itemEmployees = servicePackage != null
                    && servicePackage.getEmployeeCount() != null
                    ? servicePackage.getEmployeeCount() : 1;
            if (itemEmployees < 1 || itemEmployees > 100
                    || requiredEmployees > 1000 - itemEmployees * quantity) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Số lượng nhân viên yêu cầu không hợp lệ.");
            }
            requiredEmployees += itemEmployees * quantity;
        }

        LocalDateTime scheduledStart = request.getScheduledStart();

        if (scheduledStart == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng chọn thời gian thực hiện dịch vụ."
            );
        }
        LocalDateTime now = LocalDateTime.now();
        if (scheduledStart.isBefore(now.plusMinutes(effectiveMinimumNoticeMinutes()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Thời gian đặt phải cách thời điểm hiện tại ít nhất "
                            + effectiveMinimumNoticeMinutes() + " phút.");
        }

        LocalDateTime scheduledEnd = scheduledStart.plusMinutes(totalEstimatedMinutes);
        boolean withinWorkingHours = isWithinWorkingHours(scheduledStart, scheduledEnd);

        PromotionRewardService.Pricing pricing = promotionRewardService.calculate(
                customer.getId(),
                subtotal,
                serviceSubtotals,
                request.getVoucherCode(),
                request.getRedeemPoints(),
                lockForUpdate
        );

        long overlappingCount = bookingItemRepository.countReservedEmployees(
                partner.getId(),
                scheduledStart.toLocalDate().atStartOfDay(),
                scheduledStart.toLocalDate().plusDays(1).atStartOfDay(),
                now
        );
        long activeEmployees = employeeRepository.findByPartner_IdOrderByIdAsc(partner.getId())
                .stream()
                .filter(employee -> isActive(employee.getStatus())
                        && employee.getUser() != null && isActive(employee.getUser().getStatus()))
                .count();
        boolean capacityAvailable = withinWorkingHours && activeEmployees > 0
                && overlappingCount + requiredEmployees <= activeEmployees;

        String capacityMessage = !withinWorkingHours
                ? "Lịch hẹn phải nằm trong giờ phục vụ (" + openingTime + "–" + closingTime + ")."
                : capacityAvailable
                ? "Còn đủ nhân viên cho khung giờ đã chọn."
                : "Khung giờ này không còn đủ nhân viên hoặc cần thêm thời gian di chuyển. Vui lòng chọn khung giờ khác.";

        Double distanceKm = null;
        Double serviceRadiusKm = partner.getServiceRadiusKm();
        boolean outsideServiceRadius = false;
        String serviceRadiusWarning = null;
        if (request.getAddressId() != null && partner.getLatitude() != null && partner.getLongitude() != null) {
            Address address = addressRepository.findByIdAndUserId(request.getAddressId(), customer.getId()).orElse(null);
            if (address != null && address.getLatitude() != null && address.getLongitude() != null) {
                double dist = haversineKm(
                        address.getLatitude().doubleValue(),
                        address.getLongitude().doubleValue(),
                        partner.getLatitude().doubleValue(),
                        partner.getLongitude().doubleValue()
                );
                distanceKm = Math.round(dist * 10.0) / 10.0;
                double maxRadius = (serviceRadiusKm != null && serviceRadiusKm > 0) ? serviceRadiusKm : 10.0;
                if (distanceKm > maxRadius) {
                    outsideServiceRadius = true;
                    serviceRadiusWarning = String.format(
                            Locale.ROOT,
                            "Địa chỉ đặt dịch vụ cách trụ sở %s khoảng %.1f km (vượt bán kính phục vụ tiêu chuẩn %.1f km). Đối tác có thể cần trao đổi thêm về thời gian di chuyển.",
                            partner.getBusinessName(),
                            distanceKm,
                            maxRadius
                    );
                }
            }
        }

        BookingQuoteResponse response = BookingQuoteResponse.builder()
                .partnerId(partner.getId())
                .partnerName(partner.getBusinessName())
                .subtotal(subtotal)
                .discountAmount(pricing.discount())
                .pointsDiscount(pricing.pointsDiscount())
                .platformFee(pricing.platformFee())
                .totalAmount(pricing.total())
                .pointsUsed(pricing.pointsUsed())
                .rewardBalance(pricing.rewardBalance())
                .promotionCode(pricing.promotion() != null
                        ? pricing.promotion().getCode()
                        : null)
                .estimatedMinutes(totalEstimatedMinutes)
                .scheduledStart(scheduledStart)
                .scheduledEnd(scheduledEnd)
                .capacityAvailable(capacityAvailable)
                .capacityMessage(capacityMessage)
                .distanceKm(distanceKm)
                .serviceRadiusKm(serviceRadiusKm)
                .outsideServiceRadius(outsideServiceRadius)
                .serviceRadiusWarning(serviceRadiusWarning)
                .build();

        return new QuoteCalculation(response, pricing);
    }

    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        final double R = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    @Transactional
    public BookingResponse createBooking(
            CreateBookingRequest request,
            String userEmail
    ) {
        User customer = getUserByEmail(userEmail);
        String customerRole = customer.getRole() == null ? "" : customer.getRole().trim().toUpperCase(Locale.ROOT).replaceFirst("^ROLE_", "");
        if (!"CUSTOMER".equals(customerRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Chỉ tài khoản khách hàng (CUSTOMER) mới được đặt lịch dịch vụ.");
        }
        if (request.getIdempotencyKey() != null
                && !request.getIdempotencyKey().isBlank()) {
            Optional<Booking> existing = bookingRepository.findByIdempotencyKey(
                    request.getIdempotencyKey().trim()
            );

            if (existing.isPresent()) {
                if (existing.get().getCustomer() == null
                        || !Objects.equals(existing.get().getCustomer().getId(), customer.getId())) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Mã yêu cầu này đã được sử dụng.");
                }
                if (!sameBookingRequest(existing.get(), request)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Mã yêu cầu đã được dùng cho nội dung đặt dịch vụ khác.");
                }
                return bookingStateEngine.mapToBookingResponse(existing.get());
            }
        }

        String paymentMethod = request.getPaymentMethod() == null
                ? "VNPAY"
                : request.getPaymentMethod().trim().toUpperCase(Locale.ROOT);

        if (!List.of("VNPAY", "CASH").contains(paymentMethod)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Phương thức thanh toán không được hỗ trợ."
            );
        }

        boolean cashPayment = "CASH".equals(paymentMethod);

        Partner partner = partnerRepository.findByIdForUpdate(request.getPartnerId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy nhà cung cấp."
                ));

        Address address = addressRepository.findByIdAndUserId(
                        request.getAddressId(),
                        customer.getId()
                )
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy địa chỉ hợp lệ của bạn."
                ));

        BookingQuoteRequest quoteRequest = BookingQuoteRequest.builder()
                .partnerId(partner.getId())
                .addressId(address.getId())
                .items(request.getItems())
                .scheduledStart(request.getScheduledStart())
                .voucherCode(request.getVoucherCode())
                .redeemPoints(request.getRedeemPoints())
                .build();

        QuoteCalculation calculation = calculateQuoteInternal(
                quoteRequest,
                customer,
                true
        );

        BookingQuoteResponse quote = calculation.response();
        PromotionRewardService.Pricing pricing = calculation.pricing();

        if (!quote.isCapacityAvailable()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    quote.getCapacityMessage()
            );
        }

        String bookingCode = generateBookingCode();
        LocalDateTime now = LocalDateTime.now();

        String receiverNameSnapshot = (request.getReceiverName() != null && !request.getReceiverName().isBlank())
                ? request.getReceiverName().trim()
                : address.getReceiverName();
        String receiverPhoneSnapshot = (request.getReceiverPhone() != null && !request.getReceiverPhone().isBlank())
                ? request.getReceiverPhone().trim()
                : address.getPhone();

        Booking booking = Booking.builder()
                .bookingCode(bookingCode)
                .customer(customer)
                .partner(partner)
                .address(address)
                .receiverNameSnapshot(receiverNameSnapshot)
                .receiverPhoneSnapshot(receiverPhoneSnapshot)
                .fullAddressSnapshot(formatAddress(address))
                .latitudeSnapshot(address.getLatitude())
                .longitudeSnapshot(address.getLongitude())
                .scheduledStart(quote.getScheduledStart())
                .scheduledEnd(quote.getScheduledEnd())
                .subtotal(quote.getSubtotal())
                .discountAmount(pricing.discount())
                .pointsDiscount(pricing.pointsDiscount())
                .totalAmount(pricing.total())
                .status(cashPayment
                        ? BookingStatusEnum.PENDING_PROVIDER.name()
                        : BookingStatusEnum.PENDING_PAYMENT.name())
                .idempotencyKey(request.getIdempotencyKey() != null
                        && !request.getIdempotencyKey().isBlank()
                        ? request.getIdempotencyKey().trim()
                        : null)
                .holdExpiresAt(cashPayment ? null : now.plusMinutes(15))
                .providerDeadlineAt(cashPayment ? calculateProviderDeadline(quote.getScheduledStart(), now) : null)
                .version(0L)
                .customerNote(request.getCustomerNote())
                .createdAt(now)
                .updatedAt(now)
                .build();

        Booking savedBooking = bookingRepository.save(booking);

        for (BookingItemRequest itemRequest : request.getItems()) {
            org.ckitmdt.backend.entity.Service service = serviceRepository
                    .findById(itemRequest.getServiceId())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Dịch vụ không còn tồn tại."
                    ));

            ServicePackage servicePackage = null;

            if (itemRequest.getPackageId() != null) {
                servicePackage = servicePackageRepository.findById(itemRequest.getPackageId())
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Gói dịch vụ không còn tồn tại."
                        ));

                if (servicePackage.getService() == null
                        || !servicePackage.getService().getId().equals(service.getId())) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Gói dịch vụ không thuộc dịch vụ đã chọn."
                    );
                }
            }

            int quantity = itemRequest.getQuantity() == null
                    ? 1
                    : itemRequest.getQuantity();

            BigDecimal unitPrice = servicePackage != null
                    ? servicePackage.getPrice()
                    : partnerServiceRepository.findByPartner_IdAndService_IdAndStatusIgnoreCase(
                            partner.getId(), service.getId(), "ACTIVE")
                    .map(PartnerService::getPrice)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                            "Dịch vụ hiện không được nhà cung cấp này cung cấp."));

            int itemDuration = servicePackage != null && servicePackage.getDurationMinutes() != null
                    ? servicePackage.getDurationMinutes()
                    : service.getEstimatedMinutes() != null ? service.getEstimatedMinutes() : 60;
            int itemEmployees = servicePackage != null && servicePackage.getEmployeeCount() != null
                    ? servicePackage.getEmployeeCount() : 1;

            String serviceName = service.getName();

            if (servicePackage != null && servicePackage.getName() != null) {
                serviceName += " (" + servicePackage.getName() + ")";
            }

            BookingItem item = BookingItem.builder()
                    .booking(savedBooking)
                    .service(service)
                    .servicePackage(servicePackage)
                    .serviceName(serviceName)
                    .quantity(quantity)
                    .employeeCount(itemEmployees)
                    .durationMinutes(itemDuration)
                    .unitPrice(unitPrice)
                    .totalPrice(unitPrice.multiply(BigDecimal.valueOf(quantity)))
                    .note(itemRequest.getNote())
                    .createdAt(now)
                    .build();

            bookingItemRepository.save(item);
        }

        promotionRewardService.reserve(savedBooking, customer, pricing);

        bookingStatusHistoryRepository.save(BookingStatusHistory.builder()
                .booking(savedBooking)
                .oldStatus(null)
                .newStatus(savedBooking.getStatus())
                .changedBy(customer)
                .note(cashPayment
                        ? "Khởi tạo đơn đặt dịch vụ, thanh toán tiền mặt sau khi hoàn tất."
                        : "Khởi tạo đơn đặt dịch vụ và giữ chỗ 15 phút để thanh toán VNPay.")
                .createdAt(now)
                .build());

        if (cashPayment) {
            Payment payment = new Payment();
            payment.setBooking(savedBooking);
            payment.setPaymentMethod("CASH_ON_SERVICE");
            payment.setPaymentProvider("CASH");
            payment.setAmount(savedBooking.getTotalAmount());
            payment.setStatus("PENDING");
            payment.setCreatedAt(now);
            paymentRepository.save(payment);
        }

        try {
            cartRepository.findByUserId(customer.getId())
                    .ifPresent(cart -> cartItemRepository.deleteByCartIdAndPartnerId(
                            cart.getId(),
                            partner.getId()
                    ));
        } catch (Exception exception) {
            log.warn(
                    "Không thể dọn dẹp giỏ hàng sau khi đặt đơn: {}",
                    exception.getMessage()
            );
        }

        log.info(
                "Tạo đơn hàng [{}] thành công. Voucher: {}, điểm sử dụng: {}",
                savedBooking.getBookingCode(),
                pricing.promotion() != null ? pricing.promotion().getCode() : "NONE",
                pricing.pointsUsed()
        );

        return bookingStateEngine.mapToBookingResponse(savedBooking);
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getMyBookings(String userEmail) {
        return getMyBookings(userEmail, null);
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getMyBookings(String userEmail, String status) {
        User customer = getUserByEmail(userEmail);
        String customerRole = customer.getRole() == null ? "" : customer.getRole().trim().toUpperCase(Locale.ROOT).replaceFirst("^ROLE_", "");
        if (!"CUSTOMER".equals(customerRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Chỉ tài khoản khách hàng (CUSTOMER) mới được đặt lịch dịch vụ.");
        }
        String role = customer.getRole() == null ? "" : customer.getRole().replace("ROLE_", "");
        if (!"CUSTOMER".equalsIgnoreCase(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Chỉ khách hàng mới được xem danh sách đơn hàng của mình.");
        }

        return bookingRepository.findByCustomerIdOrderByCreatedAtDesc(customer.getId())
                .stream()
                .filter(booking -> status == null || status.isBlank()
                        || (booking.getStatus() != null && booking.getStatus().equalsIgnoreCase(status.trim())))
                .map(bookingStateEngine::mapToBookingResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getCleanerBookings(String userEmail) {
        User cleaner = getUserByEmail(userEmail);

        if (!isCleanerRole(cleaner.getRole())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Chỉ nhân viên vệ sinh mới được xem danh sách công việc."
            );
        }

        Employee employee = employeeRepository.findByUser_Id(cleaner.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy hồ sơ nhân viên."
                ));

        if (!isActive(employee.getStatus()) || !isActive(cleaner.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Tài khoản nhân viên hiện không hoạt động."
            );
        }

        return bookingAssignmentRepository
                .findByEmployee_IdOrderByAssignedAtDesc(employee.getId())
                .stream()
                .filter(this::isValidCleanerProviderAssignment)
                .map(assignment -> bookingStateEngine.mapToBookingResponse(assignment.getBooking()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<CleanerAssignmentResponse> getCleanerAssignments(String userEmail) {
        User cleaner = getUserByEmail(userEmail);

        if (!isCleanerRole(cleaner.getRole())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Chỉ nhân viên vệ sinh mới được xem danh sách phân công."
            );
        }

        Employee employee = employeeRepository.findByUser_Id(cleaner.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy hồ sơ nhân viên."
                ));

        if (!isActive(employee.getStatus()) || !isActive(cleaner.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Tài khoản nhân viên hiện không hoạt động."
            );
        }

        return bookingAssignmentRepository
                .findByEmployee_IdOrderByAssignedAtDesc(employee.getId())
                .stream()
                .filter(this::isValidCleanerProviderAssignment)
                .map(assignment -> CleanerAssignmentResponse.builder()
                        .assignmentId(assignment.getId())
                        .assignmentStatus(assignment.getStatus())
                        .assignedAt(assignment.getAssignedAt())
                        .acceptedAt(assignment.getAcceptedAt())
                        .startedAt(assignment.getStartedAt())
                        .completedAt(assignment.getCompletedAt())
                        .assignmentNote(assignment.getNote())
                        .booking(bookingStateEngine.mapToBookingResponse(assignment.getBooking()))
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public BookingResponse getBookingDetail(Long id, String userEmail) {
        User user = getUserByEmail(userEmail);

        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy đơn hàng."
                ));

        boolean isCustomer = booking.getCustomer() != null
                && booking.getCustomer().getId().equals(user.getId());

        boolean isPartner = booking.getPartner() != null
                && booking.getPartner().getUser() != null
                && booking.getPartner().getUser().getId().equals(user.getId());

        boolean isAdmin = "ADMIN".equalsIgnoreCase(user.getRole())
                || "ROLE_ADMIN".equalsIgnoreCase(user.getRole())
                || "STAFF".equalsIgnoreCase(user.getRole())
                || "ROLE_STAFF".equalsIgnoreCase(user.getRole());

        if (!isCustomer && !isPartner && !isAdmin) {
            if (isCleanerRole(user.getRole())) {
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Nhân viên vui lòng xem chi tiết công việc qua cổng Cleaner (/api/cleaner/assignments)."
                );
            }
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền xem đơn hàng này."
            );
        }

        return bookingStateEngine.mapToBookingResponse(booking);
    }

    public BookingResponse executeAction(
            Long id,
            BookingActionRequest request,
            String userEmail
    ) {
        return bookingStateEngine.executeAction(id, request, userEmail);
    }

    @Transactional
    public BookingResponse reschedulePendingBooking(Long bookingId, LocalDateTime newStart, String userEmail) {
        User customer = getUserByEmail(userEmail);
        String customerRole = customer.getRole() == null ? "" : customer.getRole().trim().toUpperCase(Locale.ROOT).replaceFirst("^ROLE_", "");
        if (!"CUSTOMER".equals(customerRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Chỉ tài khoản khách hàng (CUSTOMER) mới được đặt lịch dịch vụ.");
        }
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Không tìm thấy đơn hàng."));
        if (booking.getCustomer() == null || !Objects.equals(booking.getCustomer().getId(), customer.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền đổi lịch đơn này.");
        }
        if (!BookingStatusEnum.PENDING_PROVIDER.name().equals(booking.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Chỉ có thể đổi lịch khi đơn đang chờ nhà cung cấp xác nhận.");
        }
        LocalDateTime nowCheck = LocalDateTime.now();
        if ((booking.getProviderDeadlineAt() != null && !nowCheck.isBefore(booking.getProviderDeadlineAt()))
                || (booking.getScheduledStart() != null && !nowCheck.isBefore(booking.getScheduledStart()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Đơn hàng đã quá thời hạn xác nhận hoặc đã qua giờ hẹn nên không thể đổi lịch.");
        }
        if (newStart == null || !newStart.isAfter(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thời gian mới phải ở tương lai.");
        }
        if (booking.getPartner() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Đơn hàng chưa được gắn nhà cung cấp.");
        }
        Partner partner = partnerRepository.findByIdForUpdate(booking.getPartner().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                        "Nhà cung cấp không còn hoạt động."));
        if (!isActive(partner.getStatus()) || partner.getUser() == null
                || !isActive(partner.getUser().getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Nhà cung cấp hiện không nhận đặt dịch vụ.");
        }

        List<BookingItem> items = bookingItemRepository.findByBookingId(bookingId);
        int duration = items.stream()
                .mapToInt(item -> (item.getDurationMinutes() == null ? 60 : item.getDurationMinutes())
                        * (item.getQuantity() == null ? 1 : item.getQuantity()))
                .sum();
        int requiredEmployees = items.stream()
                .mapToInt(item -> (item.getEmployeeCount() == null ? 1 : item.getEmployeeCount())
                        * (item.getQuantity() == null ? 1 : item.getQuantity()))
                .sum();
        if (duration <= 0 || requiredEmployees <= 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Không thể xác định thời lượng đơn hàng.");
        }
        LocalDateTime newEnd = newStart.plusMinutes(duration);
        LocalDateTime oldStart = booking.getScheduledStart();
        LocalDateTime oldEnd = booking.getScheduledEnd() != null
                ? booking.getScheduledEnd()
                : oldStart != null ? oldStart.plusMinutes(duration) : null;
        boolean replacesCurrentBookingTime = oldStart != null && oldEnd != null
                && newStart.isBefore(oldEnd)
                && newEnd.isAfter(oldStart);
        if (newStart.isBefore(LocalDateTime.now().plusMinutes(effectiveMinimumNoticeMinutes()))
                && !replacesCurrentBookingTime) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Lịch mới cần được đặt trước ít nhất "
                            + effectiveMinimumNoticeMinutes() + " phút.");
        }
        if (!isWithinWorkingHours(newStart, newEnd)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Lịch mới nằm ngoài giờ phục vụ.");
        }
        // Đồng bộ quy tắc công suất trọn ngày (1 nhân viên / ngày) với createBooking & getAvailability
        LocalDateTime dayStart = newStart.toLocalDate().atStartOfDay();
        LocalDateTime dayEnd = newStart.toLocalDate().plusDays(1).atStartOfDay();
        long overlappingEmployees = bookingItemRepository.countReservedEmployeesExcludingBooking(
                partner.getId(), bookingId,
                dayStart,
                dayEnd, LocalDateTime.now());
        long activeEmployees = employeeRepository.findByPartner_IdOrderByIdAsc(partner.getId()).stream()
                .filter(employee -> isActive(employee.getStatus()) && employee.getUser() != null
                        && isActive(employee.getUser().getStatus()))
                .count();
        if (activeEmployees == 0 || overlappingEmployees + requiredEmployees > activeEmployees) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ngày mới không còn đủ nhân viên trống lịch. Vui lòng chọn ngày khác.");
        }

        LocalDateTime now = LocalDateTime.now();
        booking.setScheduledStart(newStart);
        booking.setScheduledEnd(newEnd);
        booking.setProviderDeadlineAt(calculateProviderDeadline(newStart, now));
        booking.setUpdatedAt(now);
        Booking saved = bookingRepository.save(booking);
        bookingStatusHistoryRepository.save(BookingStatusHistory.builder()
                .booking(saved).oldStatus(saved.getStatus()).newStatus(saved.getStatus())
                .changedBy(customer)
                .note("Khách hàng đổi lịch từ " + oldStart + " sang " + newStart)
                .createdAt(now).build());

        if (partner.getUser() != null) {
            adminNotificationRepository.save(AdminNotification.builder()
                    .recipient(partner.getUser())
                    .type("BOOKING_RESCHEDULED")
                    .title("Khách hàng vừa đổi lịch đơn #" + saved.getBookingCode())
                    .message("Khách hàng " + customer.getFullName() + " đã đổi lịch đơn #"
                            + saved.getBookingCode() + " sang " + newStart + ".")
                    .referenceType("BOOKING")
                    .referenceId(saved.getId())
                    .createdAt(now)
                    .build());
        }
        return bookingStateEngine.mapToBookingResponse(saved);
    }

    private User getUserByEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Người dùng chưa xác thực."
            );
        }

        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Người dùng chưa xác thực hoặc không tồn tại."
                ));
    }

    private boolean isActive(String status) {
        return status != null && "ACTIVE".equalsIgnoreCase(status.trim());
    }

    private boolean isWithinWorkingHours(LocalDateTime start, LocalDateTime end) {
        return start != null && end != null && start.toLocalDate().equals(end.toLocalDate())
                && !start.toLocalTime().isBefore(openingTime)
                && !end.toLocalTime().isAfter(closingTime);
    }

    private long effectiveMinimumNoticeMinutes() {
        return Math.max(0, Math.min(minimumNoticeMinutes, 24 * 60));
    }

    public static LocalDateTime calculateProviderDeadline(LocalDateTime scheduledStart, LocalDateTime fromTime) {
        if (scheduledStart == null) {
            return fromTime.plusHours(12);
        }
        long hoursUntilService = java.time.Duration.between(fromTime, scheduledStart).toHours();
        if (hoursUntilService <= 48) {
            return fromTime.plusHours(3);
        } else {
            return fromTime.plusHours(12);
        }
    }

    private long effectiveTravelBufferMinutes() {
        return Math.max(0, Math.min(travelBufferMinutes, 12 * 60));
    }

    private String formatAddress(Address address) {
        return java.util.stream.Stream.of(address.getStreetAddress(), address.getWard(),
                        address.getDistrict(), address.getProvince())
                .filter(value -> value != null && !value.isBlank())
                .collect(Collectors.joining(", "));
    }

    private boolean sameBookingRequest(Booking booking, CreateBookingRequest request) {
        if (booking.getPartner() == null || booking.getAddress() == null
                || !Objects.equals(booking.getPartner().getId(), request.getPartnerId())
                || !Objects.equals(booking.getAddress().getId(), request.getAddressId())
                || !Objects.equals(booking.getScheduledStart(), request.getScheduledStart())) {
            return false;
        }
        List<BookingItem> storedItems = bookingItemRepository.findByBookingId(booking.getId());
        List<BookingItemRequest> requestedItems = request.getItems();
        if (requestedItems == null || storedItems.size() != requestedItems.size()) {
            return false;
        }
        for (int index = 0; index < storedItems.size(); index++) {
            BookingItem stored = storedItems.get(index);
            BookingItemRequest requested = requestedItems.get(index);
            if (!Objects.equals(stored.getService().getId(), requested.getServiceId())
                    || !Objects.equals(stored.getServicePackage() != null
                    ? stored.getServicePackage().getId() : null, requested.getPackageId())
                    || !Objects.equals(stored.getQuantity(), requested.getQuantity() == null
                    ? 1 : requested.getQuantity())) {
                return false;
            }
        }
        return true;
    }

    private boolean isCleanerRole(String role) {
        if (role == null) {
            return false;
        }

        String normalized = role.trim().toUpperCase(Locale.ROOT);

        return normalized.equals("CLEANER")
                || normalized.equals("ROLE_CLEANER")
                || normalized.equals("EMPLOYEE")
                || normalized.equals("ROLE_EMPLOYEE");
    }

    private boolean isAssignedCleaner(Booking booking, User user) {

        if (booking == null
                || booking.getId() == null
                || user == null
                || !isCleanerRole(user.getRole())) {
            return false;
        }

        return bookingAssignmentRepository
                .findByBooking_IdOrderByIdAsc(booking.getId())
                .stream()
                .filter(this::isValidCleanerProviderAssignment)
                .anyMatch(assignment -> assignment.getEmployee().getUser() != null
                        && Objects.equals(assignment.getEmployee().getUser().getId(), user.getId()));
    }

    /**
     * Kiểm tra Employee, Assignment và Booking có cùng thuộc một Provider hay không.
     */
    private boolean isValidCleanerProviderAssignment(BookingAssignment assignment) {
        if (assignment == null || assignment.getEmployee() == null
                || assignment.getPartner() == null || assignment.getBooking() == null) {
            return false;
        }

        Employee employee = assignment.getEmployee();
        Partner assignmentPartner = assignment.getPartner();
        Booking booking = assignment.getBooking();

        if (employee.getPartner() == null || booking.getPartner() == null
                || assignmentPartner.getUser() == null) {
            return false;
        }

        return Objects.equals(employee.getPartner().getId(), assignmentPartner.getId())
                && Objects.equals(assignmentPartner.getId(), booking.getPartner().getId())
                && isActive(assignmentPartner.getStatus())
                && isActive(assignmentPartner.getUser().getStatus())
                && isActive(employee.getStatus())
                && employee.getUser() != null
                && isActive(employee.getUser().getStatus())
                && !"DECLINED".equalsIgnoreCase(assignment.getStatus())
                && !"CANCELLED".equalsIgnoreCase(assignment.getStatus());
    }


    private String generateBookingCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            String code = "CLM-" + (100000 + new Random().nextInt(900000));

            if (!bookingRepository.findByBookingCode(code).isPresent()) {
                return code;
            }
        }

        throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Không thể tạo mã đơn hàng. Vui lòng thử lại."
        );
    }

    private record QuoteCalculation(
            BookingQuoteResponse response,
            PromotionRewardService.Pricing pricing
    ) {}
}
