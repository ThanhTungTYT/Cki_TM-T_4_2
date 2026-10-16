package org.ckitmdt.backend.service.booking;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.ckitmdt.backend.dto.booking.*;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.BookingStatusHistory;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.BookingItemRepository;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.BookingStatusHistoryRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingStateEngine {

    private final BookingRepository bookingRepository;
    private final BookingStatusHistoryRepository bookingStatusHistoryRepository;
    private final BookingItemRepository bookingItemRepository;
    private final UserRepository userRepository;

    /**
     * Thực hiện chuyển trạng thái đơn hàng theo máy trạng thái nghiêm ngặt (CN17).
     * Áp dụng kiểm tra Optimistic Locking (version) và kiểm tra quyền của Actor.
     */
    @Transactional
    public BookingResponse executeAction(Long bookingId, BookingActionRequest request, String userEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn hàng với ID: " + bookingId));

        User currentUser = null;
        if (userEmail != null && !userEmail.isBlank()) {
            currentUser = userRepository.findByEmail(userEmail).orElse(null);
        }

        // 1. Kiểm tra Optimistic Lock (version) chống xung đột cập nhật đồng thời
        if (request.getVersion() != null && !request.getVersion().equals(booking.getVersion())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Đơn hàng đã được cập nhật bởi một thao tác khác (phiên bản không khớp). Vui lòng tải lại dữ liệu mới nhất."
            );
        }

        // 2. Chuyển đổi và kiểm tra hành động hợp lệ
        BookingActionEnum action;
        try {
            action = BookingActionEnum.valueOf(request.getAction().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hành động không hợp lệ: " + request.getAction());
        }

        BookingStatusEnum currentStatus;
        try {
            currentStatus = BookingStatusEnum.valueOf(booking.getStatus());
        } catch (Exception e) {
            currentStatus = BookingStatusEnum.PENDING_PAYMENT;
        }

        // 3. Kiểm tra tự động hết hạn nếu đang ở PENDING_PAYMENT mà quá hạn giữ chỗ 15 phút
        if (currentStatus == BookingStatusEnum.PENDING_PAYMENT && booking.getHoldExpiresAt() != null) {
            if (LocalDateTime.now().isAfter(booking.getHoldExpiresAt()) && action != BookingActionEnum.CUSTOMER_PAY_SUCCESS) {
                // Tự động chuyển EXPIRED
                transition(booking, currentStatus.name(), BookingStatusEnum.EXPIRED.name(), currentUser, "Hết hạn giữ chỗ 15 phút");
                bookingRepository.save(booking);
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Đơn hàng đã hết hạn giữ chỗ và không thể thực hiện hành động này.");
            }
        }

        // 4. Xác định trạng thái đích dựa trên ma trận chuyển đổi hợp lệ (State Machine Transition Rules)
        BookingStatusEnum targetStatus = determineNextStatus(currentStatus, action);

        // 5. Kiểm tra quyền của Actor thực hiện hành động
        validateActorPermission(booking, currentUser, action);

        // 6. Thực hiện chuyển đổi và ghi nhận
        String oldStatusStr = booking.getStatus();
        booking.setStatus(targetStatus.name());
        booking.setUpdatedAt(LocalDateTime.now());

        if (targetStatus == BookingStatusEnum.COMPLETED) {
            booking.setCompletedAt(LocalDateTime.now());
        } else if (targetStatus == BookingStatusEnum.CANCELLED || targetStatus == BookingStatusEnum.REJECTED) {
            booking.setCancelledAt(LocalDateTime.now());
            if (request.getNote() != null && !request.getNote().isBlank()) {
                booking.setCancelReason(request.getNote());
            }
        }

        Booking savedBooking = bookingRepository.save(booking);

        // 7. Ghi nhật ký vào BookingStatusHistory
        BookingStatusHistory history = BookingStatusHistory.builder()
                .booking(savedBooking)
                .oldStatus(oldStatusStr)
                .newStatus(targetStatus.name())
                .changedBy(currentUser)
                .note(request.getNote() != null ? request.getNote() : "Thực hiện hành động: " + action.name())
                .createdAt(LocalDateTime.now())
                .build();
        bookingStatusHistoryRepository.save(history);

        log.info("Booking [{}] chuyển trạng thái thành công: {} -> {} qua hành động [{}] bởi user [{}]",
                booking.getBookingCode(), oldStatusStr, targetStatus.name(), action.name(),
                currentUser != null ? currentUser.getEmail() : "SYSTEM");

        return mapToBookingResponse(savedBooking);
    }

    /**
     * Ma trận chuyển đổi trạng thái (Transition Matrix)
     */
    private BookingStatusEnum determineNextStatus(BookingStatusEnum currentStatus, BookingActionEnum action) {
        return switch (currentStatus) {
            case PENDING_PAYMENT -> switch (action) {
                case CUSTOMER_PAY_SUCCESS -> BookingStatusEnum.PENDING_PROVIDER;
                case CANCEL -> BookingStatusEnum.CANCELLED;
                default -> throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Hành động " + action + " không được phép khi đơn ở trạng thái " + currentStatus
                );
            };

            case PENDING_PROVIDER -> switch (action) {
                case PROVIDER_ACCEPT -> BookingStatusEnum.CONFIRMED;
                case PROVIDER_REJECT -> BookingStatusEnum.REJECTED;
                case CANCEL -> BookingStatusEnum.CANCELLED;
                default -> throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Hành động " + action + " không được phép khi đơn ở trạng thái " + currentStatus
                );
            };

            case CONFIRMED -> switch (action) {
                case ASSIGN_CLEANER -> BookingStatusEnum.ASSIGNED;
                case CANCEL -> BookingStatusEnum.CANCELLED;
                default -> throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Hành động " + action + " không được phép khi đơn ở trạng thái " + currentStatus
                );
            };

            case ASSIGNED -> switch (action) {
                case START_TRAVEL -> BookingStatusEnum.EN_ROUTE;
                case START_JOB -> BookingStatusEnum.IN_PROGRESS;
                case CANCEL -> BookingStatusEnum.CANCELLED;
                default -> throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Hành động " + action + " không được phép khi đơn ở trạng thái " + currentStatus
                );
            };

            case EN_ROUTE -> switch (action) {
                case START_JOB -> BookingStatusEnum.IN_PROGRESS;
                default -> throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Hành động " + action + " không được phép khi đơn ở trạng thái " + currentStatus
                );
            };

            case IN_PROGRESS -> switch (action) {
                case SUBMIT_COMPLETION -> BookingStatusEnum.PENDING_COMPLETION;
                default -> throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Hành động " + action + " không được phép khi đơn ở trạng thái " + currentStatus
                );
            };

            case PENDING_COMPLETION -> switch (action) {
                case CUSTOMER_ACCEPT -> BookingStatusEnum.COMPLETED;
                case CANCEL -> BookingStatusEnum.CANCELLED; // Trường hợp khiếu nại Staff hủy
                default -> throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Hành động " + action + " không được phép khi đơn ở trạng thái " + currentStatus
                );
            };

            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Đơn hàng đang ở trạng thái cuối (" + currentStatus + ") và không thể chuyển trạng thái tiếp."
            );
        };
    }

    /**
     * Kiểm tra quyền thực hiện hành động dựa trên Actor
     */
    private void validateActorPermission(Booking booking, User user, BookingActionEnum action) {
        if (user == null) {
            // Cho phép hệ thống thực hiện IPN payment
            if (action == BookingActionEnum.CUSTOMER_PAY_SUCCESS) {
                return;
            }
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Yêu cầu đăng nhập để thực hiện hành động này.");
        }

        String userRole = user.getRole() != null ? user.getRole().toUpperCase() : "CUSTOMER";

        // Admin hoặc Staff có toàn quyền điều phối / can thiệp ngoại lệ
        if ("ADMIN".equals(userRole) || "ROLE_ADMIN".equals(userRole) || "STAFF".equals(userRole)) {
            return;
        }

        switch (action) {
            case CUSTOMER_ACCEPT -> {
                // Chỉ khách hàng sở hữu đơn mới có quyền Nghiệm thu & Xác nhận hoàn thành
                if (!booking.getCustomer().getId().equals(user.getId())) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ khách hàng tạo đơn mới có quyền nghiệm thu đơn hàng này.");
                }
            }
            case PROVIDER_ACCEPT, PROVIDER_REJECT, ASSIGN_CLEANER -> {
                // Chỉ Provider nhận đơn mới có quyền duyệt/từ chối/phân công
                if (booking.getPartner() != null && !booking.getPartner().getUser().getId().equals(user.getId())) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ nhà cung cấp của đơn hàng mới có quyền duyệt hoặc phân công việc.");
                }
            }
            case START_TRAVEL, START_JOB, SUBMIT_COMPLETION -> {
                // Phải là thợ (Cleaner/Employee) hoặc Provider hoặc Admin
                // Tạm thời cho phép nếu là partner hoặc có role cleaner
            }
            case CANCEL -> {
                // Khách chỉ hủy được trước khi làm việc, hoặc Provider hủy
                if (!booking.getCustomer().getId().equals(user.getId()) &&
                        (booking.getPartner() == null || !booking.getPartner().getUser().getId().equals(user.getId()))) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền hủy đơn hàng này.");
                }
            }
            default -> {}
        }
    }

    private void transition(Booking booking, String oldStatus, String newStatus, User user, String note) {
        booking.setStatus(newStatus);
        booking.setUpdatedAt(LocalDateTime.now());
        BookingStatusHistory history = BookingStatusHistory.builder()
                .booking(booking)
                .oldStatus(oldStatus)
                .newStatus(newStatus)
                .changedBy(user)
                .note(note)
                .createdAt(LocalDateTime.now())
                .build();
        bookingStatusHistoryRepository.save(history);
    }

    /**
     * Lấy danh sách các hành động hợp lệ mà người dùng hiện tại có thể thực hiện
     */
    public List<String> getAllowedActions(Booking booking, User user) {
        List<String> allowed = new ArrayList<>();
        BookingStatusEnum status;
        try {
            status = BookingStatusEnum.valueOf(booking.getStatus());
        } catch (Exception e) {
            return allowed;
        }

        boolean isCustomer = user != null && booking.getCustomer().getId().equals(user.getId());
        boolean isPartner = user != null && booking.getPartner() != null && booking.getPartner().getUser().getId().equals(user.getId());
        boolean isAdmin = user != null && ("ADMIN".equalsIgnoreCase(user.getRole()) || "STAFF".equalsIgnoreCase(user.getRole()));

        switch (status) {
            case PENDING_PAYMENT -> {
                if (isCustomer || isAdmin) allowed.add(BookingActionEnum.CANCEL.name());
                allowed.add(BookingActionEnum.CUSTOMER_PAY_SUCCESS.name());
            }
            case PENDING_PROVIDER -> {
                if (isPartner || isAdmin) {
                    allowed.add(BookingActionEnum.PROVIDER_ACCEPT.name());
                    allowed.add(BookingActionEnum.PROVIDER_REJECT.name());
                }
                if (isCustomer || isAdmin) allowed.add(BookingActionEnum.CANCEL.name());
            }
            case CONFIRMED -> {
                if (isPartner || isAdmin) allowed.add(BookingActionEnum.ASSIGN_CLEANER.name());
                if (isCustomer || isAdmin) allowed.add(BookingActionEnum.CANCEL.name());
            }
            case ASSIGNED -> {
                allowed.add(BookingActionEnum.START_TRAVEL.name());
                allowed.add(BookingActionEnum.START_JOB.name());
                if (isCustomer || isAdmin) allowed.add(BookingActionEnum.CANCEL.name());
            }
            case EN_ROUTE -> {
                allowed.add(BookingActionEnum.START_JOB.name());
            }
            case IN_PROGRESS -> {
                allowed.add(BookingActionEnum.SUBMIT_COMPLETION.name());
            }
            case PENDING_COMPLETION -> {
                if (isCustomer || isAdmin) allowed.add(BookingActionEnum.CUSTOMER_ACCEPT.name());
            }
            default -> {}
        }

        return allowed;
    }

    /**
     * Map Entity Booking sang DTO BookingResponse
     */
    public BookingResponse mapToBookingResponse(Booking booking) {
        var items = bookingItemRepository.findByBookingId(booking.getId()).stream()
                .map(item -> BookingItemResponse.builder()
                        .id(item.getId())
                        .serviceId(item.getService() != null ? item.getService().getId() : null)
                        .serviceName(item.getServiceName())
                        .packageId(item.getServicePackage() != null ? item.getServicePackage().getId() : null)
                        .packageName(item.getServicePackage() != null ? item.getServicePackage().getName() : null)
                        .quantity(item.getQuantity())
                        .unitPrice(item.getUnitPrice())
                        .totalPrice(item.getTotalPrice())
                        .note(item.getNote())
                        .build())
                .collect(Collectors.toList());

        var historyList = bookingStatusHistoryRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId()).stream()
                .map(h -> BookingStatusHistoryResponse.builder()
                        .id(h.getId())
                        .oldStatus(h.getOldStatus())
                        .newStatus(h.getNewStatus())
                        .changedById(h.getChangedBy() != null ? h.getChangedBy().getId() : null)
                        .changedByName(h.getChangedBy() != null ? h.getChangedBy().getFullName() : "Hệ thống")
                        .note(h.getNote())
                        .createdAt(h.getCreatedAt())
                        .build())
                .collect(Collectors.toList());

        String fullAddress = "";
        if (booking.getAddress() != null) {
            fullAddress = String.format("%s, %s, %s, %s",
                    booking.getAddress().getStreetAddress() != null ? booking.getAddress().getStreetAddress() : "",
                    booking.getAddress().getWard() != null ? booking.getAddress().getWard() : "",
                    booking.getAddress().getDistrict() != null ? booking.getAddress().getDistrict() : "",
                    booking.getAddress().getProvince() != null ? booking.getAddress().getProvince() : ""
            ).replaceAll("^, |, $", "").replaceAll(", ,", ",");
        }

        return BookingResponse.builder()
                .id(booking.getId())
                .bookingCode(booking.getBookingCode())
                .customerId(booking.getCustomer() != null ? booking.getCustomer().getId() : null)
                .customerName(booking.getCustomer() != null ? booking.getCustomer().getFullName() : null)
                .customerPhone(booking.getCustomer() != null ? booking.getCustomer().getPhone() : null)
                .partnerId(booking.getPartner() != null ? booking.getPartner().getId() : null)
                .partnerName(booking.getPartner() != null ? booking.getPartner().getBusinessName() : "CleanMate Partner")
                .addressId(booking.getAddress() != null ? booking.getAddress().getId() : null)
                .receiverName(booking.getAddress() != null ? booking.getAddress().getReceiverName() : null)
                .receiverPhone(booking.getAddress() != null ? booking.getAddress().getPhone() : null)
                .fullAddress(fullAddress)
                .latitude(booking.getAddress() != null ? booking.getAddress().getLatitude() : null)
                .longitude(booking.getAddress() != null ? booking.getAddress().getLongitude() : null)
                .scheduledStart(booking.getScheduledStart())
                .scheduledEnd(booking.getScheduledEnd())
                .subtotal(booking.getSubtotal())
                .discountAmount(booking.getDiscountAmount())
                .totalAmount(booking.getTotalAmount())
                .status(booking.getStatus())
                .customerNote(booking.getCustomerNote())
                .cancelReason(booking.getCancelReason())
                .holdExpiresAt(booking.getHoldExpiresAt())
                .version(booking.getVersion())
                .createdAt(booking.getCreatedAt())
                .completedAt(booking.getCompletedAt())
                .cancelledAt(booking.getCancelledAt())
                .items(items)
                .statusHistory(historyList)
                .build();
    }
}
