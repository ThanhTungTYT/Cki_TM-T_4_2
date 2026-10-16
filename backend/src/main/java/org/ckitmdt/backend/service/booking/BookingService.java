package org.ckitmdt.backend.service.booking;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.ckitmdt.backend.dto.booking.*;
import org.ckitmdt.backend.entity.*;
import org.ckitmdt.backend.repository.*;
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

    /**
     * Báo giá dịch vụ & kiểm tra năng lực rảnh (Quote & Snapshot Preview - CN07)
     */
    @Transactional(readOnly = true)
    public BookingQuoteResponse calculateQuote(BookingQuoteRequest request, String userEmail) {
        Partner partner = partnerRepository.findById(request.getPartnerId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy nhà cung cấp"));

        int totalEstimatedMinutes = 0;
        BigDecimal subtotal = BigDecimal.ZERO;

        for (BookingItemRequest itemReq : request.getItems()) {
            org.ckitmdt.backend.entity.Service service = serviceRepository.findById(itemReq.getServiceId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dịch vụ không tồn tại: " + itemReq.getServiceId()));

            ServicePackage pkg = null;
            if (itemReq.getPackageId() != null) {
                pkg = servicePackageRepository.findById(itemReq.getPackageId()).orElse(null);
            }

            int qty = itemReq.getQuantity() != null && itemReq.getQuantity() > 0 ? itemReq.getQuantity() : 1;

            BigDecimal unitPrice = pkg != null && pkg.getPrice() != null
                    ? pkg.getPrice()
                    : (service.getBasePrice() != null ? service.getBasePrice() : BigDecimal.ZERO);

            subtotal = subtotal.add(unitPrice.multiply(BigDecimal.valueOf(qty)));

            int itemDuration = pkg != null && pkg.getDurationMinutes() != null
                    ? pkg.getDurationMinutes()
                    : (service.getEstimatedMinutes() != null ? service.getEstimatedMinutes() : 60);

            totalEstimatedMinutes += itemDuration * qty;
        }

        LocalDateTime scheduledStart = request.getScheduledStart();
        LocalDateTime scheduledEnd = scheduledStart.plusMinutes(totalEstimatedMinutes);

        // Tính phí dịch vụ sàn (cố định 10.000 VND)
        BigDecimal platformFee = BigDecimal.valueOf(10000);

        // Tính giảm giá voucher nếu có
        BigDecimal discountAmount = BigDecimal.ZERO;
        if (request.getVoucherCode() != null && !request.getVoucherCode().isBlank()) {
            String code = request.getVoucherCode().trim().toUpperCase();
            if ("CLEANMATE10".equals(code)) {
                discountAmount = subtotal.multiply(BigDecimal.valueOf(0.10));
                if (discountAmount.compareTo(BigDecimal.valueOf(50000)) > 0) {
                    discountAmount = BigDecimal.valueOf(50000);
                }
            } else if ("CLEANMATE20".equals(code)) {
                discountAmount = subtotal.multiply(BigDecimal.valueOf(0.20));
                if (discountAmount.compareTo(BigDecimal.valueOf(100000)) > 0) {
                    discountAmount = BigDecimal.valueOf(100000);
                }
            }
        }

        BigDecimal totalAmount = subtotal.subtract(discountAmount).add(platformFee);
        if (totalAmount.compareTo(BigDecimal.ZERO) < 0) {
            totalAmount = BigDecimal.ZERO;
        }

        // Kiểm tra năng lực rảnh của Provider trong khoảng thời gian (Capacity Check)
        long overlappingCount = bookingRepository.countOverlappingBookings(partner.getId(), scheduledStart, scheduledEnd);
        boolean capacityAvailable = overlappingCount < 5; // Giả định tối đa 5 đơn đồng thời cho mỗi đối tác
        String capacityMessage = capacityAvailable
                ? "Nhà cung cấp còn ca rảnh sẵn sàng tiếp nhận (hiện có " + overlappingCount + " đơn trong khung giờ này)."
                : "Khung giờ này nhà cung cấp đã đạt giới hạn nhận việc. Vui lòng chọn khung giờ khác.";

        return BookingQuoteResponse.builder()
                .partnerId(partner.getId())
                .partnerName(partner.getBusinessName())
                .subtotal(subtotal)
                .discountAmount(discountAmount)
                .platformFee(platformFee)
                .totalAmount(totalAmount)
                .estimatedMinutes(totalEstimatedMinutes)
                .scheduledStart(scheduledStart)
                .scheduledEnd(scheduledEnd)
                .capacityAvailable(capacityAvailable)
                .capacityMessage(capacityMessage)
                .build();
    }

    /**
     * Tạo đơn đặt dịch vụ kèm giữ chỗ 15 phút (CN07)
     * Có cơ chế chống nhấn đúp chuột bằng Idempotency-Key
     */
    @Transactional
    public BookingResponse createBooking(CreateBookingRequest request, String userEmail) {
        // 1. Kiểm tra Idempotency-Key chống click đúp tạo 2 đơn
        if (request.getIdempotencyKey() != null && !request.getIdempotencyKey().isBlank()) {
            Optional<Booking> existingOpt = bookingRepository.findByIdempotencyKey(request.getIdempotencyKey().trim());
            if (existingOpt.isPresent()) {
                log.info("Phát hiện yêu cầu trùng lặp với Idempotency-Key [{}], trả về đơn đã tạo trước đó.", request.getIdempotencyKey());
                return bookingStateEngine.mapToBookingResponse(existingOpt.get());
            }
        }

        User customer = getUserByEmail(userEmail);

        Partner partner = partnerRepository.findById(request.getPartnerId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy nhà cung cấp"));

        Address address = addressRepository.findByIdAndUserId(request.getAddressId(), customer.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy địa chỉ hợp lệ của bạn"));

        // Tính toán báo giá chốt
        BookingQuoteRequest quoteReq = BookingQuoteRequest.builder()
                .partnerId(partner.getId())
                .addressId(address.getId())
                .items(request.getItems())
                .scheduledStart(request.getScheduledStart())
                .voucherCode(request.getVoucherCode())
                .build();

        BookingQuoteResponse quote = calculateQuote(quoteReq, userEmail);

        if (!quote.isCapacityAvailable()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, quote.getCapacityMessage());
        }

        // Tạo mã đơn ngẫu nhiên duy nhất: CLM-XXXXXX
        String bookingCode = "CLM-" + (100000 + new Random().nextInt(900000));

        // 2. Tạo Booking mới
        Booking booking = Booking.builder()
                .bookingCode(bookingCode)
                .customer(customer)
                .partner(partner)
                .address(address)
                .scheduledStart(quote.getScheduledStart())
                .scheduledEnd(quote.getScheduledEnd())
                .subtotal(quote.getSubtotal())
                .discountAmount(quote.getDiscountAmount())
                .pointsDiscount(BigDecimal.ZERO)
                .totalAmount(quote.getTotalAmount())
                .status(BookingStatusEnum.PENDING_PAYMENT.name())
                .idempotencyKey(request.getIdempotencyKey() != null && !request.getIdempotencyKey().isBlank() ? request.getIdempotencyKey().trim() : null)
                .holdExpiresAt(LocalDateTime.now().plusMinutes(15)) // Giữ chỗ 15 phút
                .version(0L)
                .customerNote(request.getCustomerNote())
                .createdAt(LocalDateTime.now())
                .build();

        Booking savedBooking = bookingRepository.save(booking);

        // 3. Lưu snapshot từng dịch vụ vào booking_items
        for (BookingItemRequest itemReq : request.getItems()) {
            org.ckitmdt.backend.entity.Service service = serviceRepository.findById(itemReq.getServiceId()).orElse(null);
            ServicePackage pkg = itemReq.getPackageId() != null ? servicePackageRepository.findById(itemReq.getPackageId()).orElse(null) : null;
            int qty = itemReq.getQuantity() != null && itemReq.getQuantity() > 0 ? itemReq.getQuantity() : 1;

            BigDecimal unitPrice = pkg != null && pkg.getPrice() != null
                    ? pkg.getPrice()
                    : (service != null && service.getBasePrice() != null ? service.getBasePrice() : BigDecimal.ZERO);

            String serviceName = service != null ? service.getName() : "Dịch vụ";
            if (pkg != null && pkg.getName() != null) {
                serviceName += " (" + pkg.getName() + ")";
            }

            BookingItem item = BookingItem.builder()
                    .booking(savedBooking)
                    .service(service)
                    .servicePackage(pkg)
                    .serviceName(serviceName)
                    .quantity(qty)
                    .unitPrice(unitPrice)
                    .totalPrice(unitPrice.multiply(BigDecimal.valueOf(qty)))
                    .note(itemReq.getNote())
                    .createdAt(LocalDateTime.now())
                    .build();
            bookingItemRepository.save(item);
        }

        // 4. Ghi nhận nhật ký trạng thái ban đầu
        BookingStatusHistory initialHistory = BookingStatusHistory.builder()
                .booking(savedBooking)
                .oldStatus(null)
                .newStatus(BookingStatusEnum.PENDING_PAYMENT.name())
                .changedBy(customer)
                .note("Khởi tạo đơn đặt dịch vụ và giữ chỗ 15 phút")
                .createdAt(LocalDateTime.now())
                .build();
        bookingStatusHistoryRepository.save(initialHistory);

        // 5. Tự động dọn dẹp các món của Provider này khỏi giỏ hàng của khách (nếu có)
        try {
            cartRepository.findByUserId(customer.getId())
                    .ifPresent(cart -> cartItemRepository.deleteByCartIdAndPartnerId(cart.getId(), partner.getId()));
        } catch (Exception e) {
            log.warn("Không thể dọn dẹp giỏ hàng sau khi đặt đơn: {}", e.getMessage());
        }

        log.info("Tạo đơn hàng thành công mã [{}], giữ chỗ đến: {}", savedBooking.getBookingCode(), savedBooking.getHoldExpiresAt());

        return bookingStateEngine.mapToBookingResponse(savedBooking);
    }

    /**
     * Lấy danh sách đơn hàng của khách hàng hiện tại (CN17)
     */
    @Transactional(readOnly = true)
    public List<BookingResponse> getMyBookings(String userEmail) {
        User customer = getUserByEmail(userEmail);
        return bookingRepository.findByCustomerIdOrderByCreatedAtDesc(customer.getId()).stream()
                .map(bookingStateEngine::mapToBookingResponse)
                .collect(Collectors.toList());
    }

    /**
     * Xem chi tiết một đơn hàng kèm timeline lịch sử trạng thái
     */
    @Transactional(readOnly = true)
    public BookingResponse getBookingDetail(Long id, String userEmail) {
        User user = getUserByEmail(userEmail);
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng"));

        // Kiểm tra quyền xem đơn: Khách hàng, Provider nhận đơn, hoặc Admin
        boolean isCustomer = booking.getCustomer().getId().equals(user.getId());
        boolean isPartner = booking.getPartner() != null && booking.getPartner().getUser().getId().equals(user.getId());
        boolean isAdmin = "ADMIN".equalsIgnoreCase(user.getRole()) || "STAFF".equalsIgnoreCase(user.getRole());

        if (!isCustomer && !isPartner && !isAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem đơn hàng này");
        }

        return bookingStateEngine.mapToBookingResponse(booking);
    }

    /**
     * Thực hiện chuyển trạng thái (Ủy quyền cho BookingStateEngine - CN17)
     */
    public BookingResponse executeAction(Long id, BookingActionRequest request, String userEmail) {
        return bookingStateEngine.executeAction(id, request, userEmail);
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Người dùng chưa xác thực hoặc không tồn tại"));
    }
}
