
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
import java.util.Locale;
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
     * Thực hiện chuyển trạng thái đơn hàng.
     * Kiểm tra phiên bản, trạng thái và quyền người thực hiện.
     */
    @Transactional
    public BookingResponse executeAction(
            Long bookingId,
            BookingActionRequest request,
            String userEmail) {

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy đơn hàng với ID: " + bookingId
                ));

        User currentUser = null;

        if (userEmail != null && !userEmail.isBlank()) {
            currentUser = userRepository.findByEmail(userEmail).orElse(null);
        }

        // 1. Kiểm tra phiên bản đơn hàng
        if (request.getVersion() != null
                && !request.getVersion().equals(booking.getVersion())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Đơn hàng đã được cập nhật bởi thao tác khác. "
                            + "Vui lòng tải lại dữ liệu mới nhất."
            );
        }

        // 2. Kiểm tra hành động
        if (request.getAction() == null || request.getAction().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Hành động không được để trống."
            );
        }

        BookingActionEnum action;

        try {
            action = BookingActionEnum.valueOf(
                    request.getAction().trim().toUpperCase(Locale.ROOT)
            );
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Hành động không hợp lệ: " + request.getAction()
            );
        }

        // 3. Đọc trạng thái hiện tại
        BookingStatusEnum currentStatus;

        try {
            currentStatus = BookingStatusEnum.valueOf(booking.getStatus());
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trạng thái đơn hàng không hợp lệ: " + booking.getStatus()
            );
        }

        // 4. Kiểm tra hết hạn giữ chỗ
        if (currentStatus == BookingStatusEnum.PENDING_PAYMENT
                && booking.getHoldExpiresAt() != null
                && LocalDateTime.now().isAfter(booking.getHoldExpiresAt())
                && action != BookingActionEnum.CUSTOMER_PAY_SUCCESS) {

            String oldStatus = booking.getStatus();

            booking.setStatus(BookingStatusEnum.EXPIRED.name());
            booking.setUpdatedAt(LocalDateTime.now());

            Booking expiredBooking = bookingRepository.save(booking);

            BookingStatusHistory history = BookingStatusHistory.builder()
                    .booking(expiredBooking)
                    .oldStatus(oldStatus)
                    .newStatus(BookingStatusEnum.EXPIRED.name())
                    .changedBy(currentUser)
                    .note("Hết hạn giữ chỗ")
                    .createdAt(LocalDateTime.now())
                    .build();

            bookingStatusHistoryRepository.save(history);

            // Không ném exception ở đây để tránh rollback việc cập nhật EXPIRED.
            return mapToBookingResponse(expiredBooking);
        }

        // 5. Xác định trạng thái tiếp theo
        BookingStatusEnum targetStatus = determineNextStatus(
                currentStatus, action
        );

        // 6. Kiểm tra quyền trước khi cập nhật
        validateActorPermission(booking, currentUser, action);

        // 7. Cập nhật trạng thái
        String oldStatus = booking.getStatus();

        booking.setStatus(targetStatus.name());
        booking.setUpdatedAt(LocalDateTime.now());

        if (targetStatus == BookingStatusEnum.COMPLETED) {
            booking.setCompletedAt(LocalDateTime.now());
        }

        if (targetStatus == BookingStatusEnum.CANCELLED
                || targetStatus == BookingStatusEnum.REJECTED) {
            booking.setCancelledAt(LocalDateTime.now());

            if (request.getNote() != null
                    && !request.getNote().isBlank()) {
                booking.setCancelReason(request.getNote());
            }
        }

        Booking savedBooking = bookingRepository.save(booking);

        // 8. Lưu lịch sử trạng thái
        BookingStatusHistory history = BookingStatusHistory.builder()
                .booking(savedBooking)
                .oldStatus(oldStatus)
                .newStatus(targetStatus.name())
                .changedBy(currentUser)
                .note(request.getNote() != null
                        ? request.getNote()
                        : "Thực hiện hành động: " + action.name())
                .createdAt(LocalDateTime.now())
                .build();

        bookingStatusHistoryRepository.save(history);

        log.info(
                "Booking [{}] chuyển trạng thái {} -> {} qua hành động [{}], user [{}]",
                savedBooking.getBookingCode(),
                oldStatus,
                targetStatus.name(),
                action.name(),
                currentUser != null ? currentUser.getEmail() : "SYSTEM"
        );

        return mapToBookingResponse(savedBooking);
    }

    /**
     * Ma trận chuyển trạng thái hợp lệ.
     */
    private BookingStatusEnum determineNextStatus(
            BookingStatusEnum currentStatus,
            BookingActionEnum action) {

        return switch (currentStatus) {
            case PENDING_PAYMENT -> switch (action) {
                case CUSTOMER_PAY_SUCCESS ->
                        BookingStatusEnum.PENDING_PROVIDER;
                case CANCEL -> BookingStatusEnum.CANCELLED;
                default -> invalidTransition(currentStatus, action);
            };

            case PENDING_PROVIDER -> switch (action) {
                case PROVIDER_ACCEPT -> BookingStatusEnum.CONFIRMED;
                case PROVIDER_REJECT -> BookingStatusEnum.REJECTED;
                case CANCEL -> BookingStatusEnum.CANCELLED;
                default -> invalidTransition(currentStatus, action);
            };

            case CONFIRMED -> switch (action) {
                case ASSIGN_CLEANER -> BookingStatusEnum.ASSIGNED;
                case CANCEL -> BookingStatusEnum.CANCELLED;
                default -> invalidTransition(currentStatus, action);
            };

            case ASSIGNED -> switch (action) {
                case START_TRAVEL -> BookingStatusEnum.EN_ROUTE;
                case START_JOB -> BookingStatusEnum.IN_PROGRESS;
                case CANCEL -> BookingStatusEnum.CANCELLED;
                default -> invalidTransition(currentStatus, action);
            };

            case EN_ROUTE -> switch (action) {
                case START_JOB -> BookingStatusEnum.IN_PROGRESS;
                default -> invalidTransition(currentStatus, action);
            };

            case IN_PROGRESS -> switch (action) {
                case SUBMIT_COMPLETION ->
                        BookingStatusEnum.PENDING_COMPLETION;
                default -> invalidTransition(currentStatus, action);
            };

            case PENDING_COMPLETION -> switch (action) {
                case CUSTOMER_ACCEPT -> BookingStatusEnum.COMPLETED;
                case CANCEL -> BookingStatusEnum.CANCELLED;
                default -> invalidTransition(currentStatus, action);
            };

            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Đơn hàng đang ở trạng thái cuối ("
                            + currentStatus
                            + ") và không thể chuyển trạng thái tiếp."
            );
        };
    }

    private BookingStatusEnum invalidTransition(
            BookingStatusEnum currentStatus,
            BookingActionEnum action) {

        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Hành động " + action
                        + " không được phép khi đơn ở trạng thái "
                        + currentStatus
        );
    }

    /**
     * Kiểm tra quyền thực hiện hành động.
     */
    private void validateActorPermission(
            Booking booking,
            User user,
            BookingActionEnum action) {

        if (user == null) {
            if (action == BookingActionEnum.CUSTOMER_PAY_SUCCESS) {
                return;
            }

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Yêu cầu đăng nhập để thực hiện hành động này."
            );
        }

        String role = normalizeRole(user.getRole());

        // Admin/Staff được phép xử lý các trường hợp quản trị.
        if (isStaffRole(role)) {
            return;
        }

        boolean isCustomer = booking.getCustomer() != null
                && booking.getCustomer().getId().equals(user.getId());

        boolean isPartner = booking.getPartner() != null
                && booking.getPartner().getUser() != null
                && booking.getPartner().getUser().getId().equals(user.getId());

        switch (action) {
            case CUSTOMER_PAY_SUCCESS -> {
                if (!isCustomer) {
                    throw new ResponseStatusException(
                            HttpStatus.FORBIDDEN,
                            "Bạn không có quyền xác nhận thanh toán đơn này."
                    );
                }
            }

            case CUSTOMER_ACCEPT -> {
                if (!isCustomer) {
                    throw new ResponseStatusException(
                            HttpStatus.FORBIDDEN,
                            "Chỉ khách hàng tạo đơn mới có quyền xác nhận hoàn thành."
                    );
                }
            }

            case PROVIDER_ACCEPT, PROVIDER_REJECT, ASSIGN_CLEANER -> {
                if (!isPartner) {
                    throw new ResponseStatusException(
                            HttpStatus.FORBIDDEN,
                            "Chỉ nhà cung cấp của đơn hàng mới có quyền thực hiện hành động này."
                    );
                }
            }

            case START_TRAVEL, START_JOB, SUBMIT_COMPLETION -> {
                if (!isPartner && !isCleanerRole(role)) {
                    throw new ResponseStatusException(
                            HttpStatus.FORBIDDEN,
                            "Bạn không có quyền cập nhật tiến độ dịch vụ."
                    );
                }
            }

            case CANCEL -> {
                if (!isCustomer && !isPartner) {
                    throw new ResponseStatusException(
                            HttpStatus.FORBIDDEN,
                            "Bạn không có quyền hủy đơn hàng này."
                    );
                }

                String status = booking.getStatus() == null
                        ? ""
                        : booking.getStatus().toUpperCase(Locale.ROOT);

                if (isCustomer) {
                    boolean canCancel = switch (status) {
                        case "PENDING_PAYMENT",
                             "PENDING_PROVIDER",
                             "CONFIRMED",
                             "ASSIGNED" -> true;
                        default -> false;
                    };

                    if (!canCancel) {
                        throw new ResponseStatusException(
                                HttpStatus.FORBIDDEN,
                                "Đơn đã bắt đầu di chuyển hoặc thực hiện dịch vụ. "
                                        + "Vui lòng gửi khiếu nại để nhân viên hỗ trợ."
                        );
                    }
                }

                if (isPartner) {
                    boolean canCancel = switch (status) {
                        case "PENDING_PROVIDER",
                             "CONFIRMED",
                             "ASSIGNED" -> true;
                        default -> false;
                    };

                    if (!canCancel) {
                        throw new ResponseStatusException(
                                HttpStatus.FORBIDDEN,
                                "Nhà cung cấp không thể hủy đơn ở trạng thái hiện tại."
                        );
                    }
                }
            }

            default -> {
                // Không xử lý thêm.
            }
        }
    }

    private String normalizeRole(String role) {
        return role == null
                ? ""
                : role.trim().toUpperCase(Locale.ROOT);
    }

    private boolean isStaffRole(String role) {
        return "ADMIN".equals(role)
                || "ROLE_ADMIN".equals(role)
                || "STAFF".equals(role)
                || "ROLE_STAFF".equals(role);
    }

    private boolean isCleanerRole(String role) {
        return "CLEANER".equals(role)
                || "ROLE_CLEANER".equals(role)
                || "EMPLOYEE".equals(role)
                || "ROLE_EMPLOYEE".equals(role);
    }

    /**
     * Lấy các hành động được phép theo trạng thái và người dùng.
     */
    public List<String> getAllowedActions(Booking booking, User user) {
        List<String> allowed = new ArrayList<>();

        if (booking == null || booking.getStatus() == null) {
            return allowed;
        }

        BookingStatusEnum status;

        try {
            status = BookingStatusEnum.valueOf(booking.getStatus());
        } catch (Exception e) {
            return allowed;
        }

        boolean isCustomer = user != null
                && booking.getCustomer() != null
                && booking.getCustomer().getId().equals(user.getId());

        boolean isPartner = user != null
                && booking.getPartner() != null
                && booking.getPartner().getUser() != null
                && booking.getPartner().getUser().getId().equals(user.getId());

        boolean isAdmin = user != null
                && isStaffRole(normalizeRole(user.getRole()));

        boolean isCleaner = user != null
                && isCleanerRole(normalizeRole(user.getRole()));

        switch (status) {
            case PENDING_PAYMENT -> {
                if (isCustomer || isAdmin) {
                    allowed.add(BookingActionEnum.CANCEL.name());
                }

                if (isCustomer || isAdmin) {
                    allowed.add(BookingActionEnum.CUSTOMER_PAY_SUCCESS.name());
                }
            }

            case PENDING_PROVIDER -> {
                if (isPartner || isAdmin) {
                    allowed.add(BookingActionEnum.PROVIDER_ACCEPT.name());
                    allowed.add(BookingActionEnum.PROVIDER_REJECT.name());
                }

                if (isCustomer || isAdmin) {
                    allowed.add(BookingActionEnum.CANCEL.name());
                }
            }

            case CONFIRMED -> {
                if (isPartner || isAdmin) {
                    allowed.add(BookingActionEnum.ASSIGN_CLEANER.name());
                }

                if (isCustomer || isAdmin) {
                    allowed.add(BookingActionEnum.CANCEL.name());
                }
            }

            case ASSIGNED -> {
                if (isPartner || isCleaner || isAdmin) {
                    allowed.add(BookingActionEnum.START_TRAVEL.name());
                    allowed.add(BookingActionEnum.START_JOB.name());
                }

                if (isCustomer || isAdmin) {
                    allowed.add(BookingActionEnum.CANCEL.name());
                }
            }

            case EN_ROUTE -> {
                if (isPartner || isCleaner || isAdmin) {
                    allowed.add(BookingActionEnum.START_JOB.name());
                }
            }

            case IN_PROGRESS -> {
                if (isPartner || isCleaner || isAdmin) {
                    allowed.add(BookingActionEnum.SUBMIT_COMPLETION.name());
                }
            }

            case PENDING_COMPLETION -> {
                if (isCustomer || isAdmin) {
                    allowed.add(BookingActionEnum.CUSTOMER_ACCEPT.name());
                }

                if (isAdmin) {
                    allowed.add(BookingActionEnum.CANCEL.name());
                }
            }

            default -> {
                // Trạng thái cuối không có hành động tiếp theo.
            }
        }

        return allowed;
    }

    /**
     * Chuyển Booking entity thành BookingResponse DTO.
     */
    public BookingResponse mapToBookingResponse(Booking booking) {

        var items = bookingItemRepository
                .findByBookingId(booking.getId())
                .stream()
                .map(item -> BookingItemResponse.builder()
                        .id(item.getId())
                        .serviceId(item.getService() != null
                                ? item.getService().getId() : null)
                        .serviceName(item.getServiceName())
                        .packageId(item.getServicePackage() != null
                                ? item.getServicePackage().getId() : null)
                        .packageName(item.getServicePackage() != null
                                ? item.getServicePackage().getName() : null)
                        .quantity(item.getQuantity())
                        .unitPrice(item.getUnitPrice())
                        .totalPrice(item.getTotalPrice())
                        .note(item.getNote())
                        .build())
                .collect(Collectors.toList());

        var historyList = bookingStatusHistoryRepository
                .findByBookingIdOrderByCreatedAtAsc(booking.getId())
                .stream()
                .map(h -> BookingStatusHistoryResponse.builder()
                        .id(h.getId())
                        .oldStatus(h.getOldStatus())
                        .newStatus(h.getNewStatus())
                        .changedById(h.getChangedBy() != null
                                ? h.getChangedBy().getId() : null)
                        .changedByName(h.getChangedBy() != null
                                ? h.getChangedBy().getFullName() : "Hệ thống")
                        .note(h.getNote())
                        .createdAt(h.getCreatedAt())
                        .build())
                .collect(Collectors.toList());

        String fullAddress = "";

        if (booking.getAddress() != null) {
            fullAddress = String.format("%s, %s, %s, %s",
                            booking.getAddress().getStreetAddress() != null
                                    ? booking.getAddress().getStreetAddress() : "",
                            booking.getAddress().getWard() != null
                                    ? booking.getAddress().getWard() : "",
                            booking.getAddress().getDistrict() != null
                                    ? booking.getAddress().getDistrict() : "",
                            booking.getAddress().getProvince() != null
                                    ? booking.getAddress().getProvince() : ""
                    ).replaceAll("^, |, $", "")
                    .replaceAll(", ,", ",");
        }

        return BookingResponse.builder()
                .id(booking.getId())
                .bookingCode(booking.getBookingCode())
                .customerId(booking.getCustomer() != null
                        ? booking.getCustomer().getId() : null)
                .customerName(booking.getCustomer() != null
                        ? booking.getCustomer().getFullName() : null)
                .customerPhone(booking.getCustomer() != null
                        ? booking.getCustomer().getPhone() : null)
                .partnerId(booking.getPartner() != null
                        ? booking.getPartner().getId() : null)
                .partnerName(booking.getPartner() != null
                        ? booking.getPartner().getBusinessName()
                        : "CleanMate Partner")
                .addressId(booking.getAddress() != null
                        ? booking.getAddress().getId() : null)
                .receiverName(booking.getAddress() != null
                        ? booking.getAddress().getReceiverName() : null)
                .receiverPhone(booking.getAddress() != null
                        ? booking.getAddress().getPhone() : null)
                .fullAddress(fullAddress)
                .latitude(booking.getAddress() != null
                        ? booking.getAddress().getLatitude() : null)
                .longitude(booking.getAddress() != null
                        ? booking.getAddress().getLongitude() : null)
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
