package org.ckitmdt.backend.service.booking;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.ckitmdt.backend.dto.booking.*;
import org.ckitmdt.backend.entity.*;
import org.ckitmdt.backend.repository.*;
import org.ckitmdt.backend.service.PromotionRewardService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingService {
    private final BookingRepository bookingRepository;
    private final BookingItemRepository bookingItemRepository;
    private final BookingStatusHistoryRepository bookingStatusHistoryRepository;
    private final BookingStateEngine bookingStateEngine;
    private final UserRepository userRepository;
    private final PartnerRepository partnerRepository;
    private final AddressRepository addressRepository;
    private final ServiceRepository serviceRepository;
    private final ServicePackageRepository servicePackageRepository;
    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final PaymentRepository paymentRepository;
    private final PromotionRewardService promotionRewardService;

    @Transactional(readOnly = true)
    public BookingQuoteResponse calculateQuote(
            BookingQuoteRequest request,
            String userEmail
    ) {
        User customer = getUserByEmail(userEmail);
        return calculateQuoteInternal(request, customer, false).response();
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

        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Đơn hàng phải có ít nhất một dịch vụ."
            );
        }

        int totalEstimatedMinutes = 0;
        BigDecimal subtotal = BigDecimal.ZERO;
        Map<Long, BigDecimal> serviceSubtotals = new HashMap<>();

        for (BookingItemRequest itemRequest : request.getItems()) {
            org.ckitmdt.backend.entity.Service service = serviceRepository
                    .findById(itemRequest.getServiceId())
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Dịch vụ không tồn tại: " + itemRequest.getServiceId()
                    ));

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
            }

            int quantity = itemRequest.getQuantity() == null
                    ? 1
                    : itemRequest.getQuantity();

            if (quantity < 1) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Số lượng dịch vụ phải lớn hơn 0."
                );
            }

            BigDecimal unitPrice = servicePackage != null
                    ? servicePackage.getPrice()
                    : service.getBasePrice();

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
        }

        LocalDateTime scheduledStart = request.getScheduledStart();

        if (scheduledStart == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng chọn thời gian thực hiện dịch vụ."
            );
        }

        LocalDateTime scheduledEnd = scheduledStart.plusMinutes(totalEstimatedMinutes);

        PromotionRewardService.Pricing pricing = promotionRewardService.calculate(
                customer.getId(),
                subtotal,
                serviceSubtotals,
                request.getVoucherCode(),
                request.getRedeemPoints(),
                lockForUpdate
        );

        long overlappingCount = bookingRepository.countOverlappingBookings(
                partner.getId(),
                scheduledStart,
                scheduledEnd
        );

        boolean capacityAvailable = overlappingCount < 5;

        String capacityMessage = capacityAvailable
                ? "Nhà cung cấp còn ca rảnh sẵn sàng tiếp nhận (hiện có "
                + overlappingCount + " đơn trong khung giờ này)."
                : "Khung giờ này nhà cung cấp đã đạt giới hạn nhận việc. Vui lòng chọn khung giờ khác.";

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
                .build();

        return new QuoteCalculation(response, pricing);
    }

    @Transactional
    public BookingResponse createBooking(
            CreateBookingRequest request,
            String userEmail
    ) {
        if (request.getIdempotencyKey() != null
                && !request.getIdempotencyKey().isBlank()) {
            Optional<Booking> existing = bookingRepository.findByIdempotencyKey(
                    request.getIdempotencyKey().trim()
            );

            if (existing.isPresent()) {
                return bookingStateEngine.mapToBookingResponse(existing.get());
            }
        }

        User customer = getUserByEmail(userEmail);

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

        Partner partner = partnerRepository.findById(request.getPartnerId())
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

        Booking booking = Booking.builder()
                .bookingCode(bookingCode)
                .customer(customer)
                .partner(partner)
                .address(address)
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
                    : service.getBasePrice();

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
        User customer = getUserByEmail(userEmail);

        return bookingRepository.findByCustomerIdOrderByCreatedAtDesc(customer.getId())
                .stream()
                .map(bookingStateEngine::mapToBookingResponse)
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
                || "STAFF".equalsIgnoreCase(user.getRole());

        if (!isCustomer && !isPartner && !isAdmin) {
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