
package org.ckitmdt.backend.service.booking;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.ckitmdt.backend.dto.booking.*;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.BookingAssignment;
import org.ckitmdt.backend.entity.BookingStatusHistory;
import org.ckitmdt.backend.entity.Employee;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.repository.EmployeeRepository;
import org.ckitmdt.backend.repository.PartnerRepository;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.BookingAssignmentRepository;
import org.ckitmdt.backend.repository.BookingItemRepository;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.BookingStatusHistoryRepository;
import org.ckitmdt.backend.repository.CancellationRefundRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.ckitmdt.backend.repository.PaymentRepository;
import org.ckitmdt.backend.entity.Payment;
import org.ckitmdt.backend.entity.AdminNotification;
import org.ckitmdt.backend.repository.AdminNotificationRepository;
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
    private final BookingAssignmentRepository bookingAssignmentRepository;
    private final BookingStatusHistoryRepository bookingStatusHistoryRepository;
    private final CancellationRefundRepository cancellationRefundRepository;
    private final BookingItemRepository bookingItemRepository;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final org.ckitmdt.backend.service.BookingRewardLifecycleService rewardLifecycleService;
    private final org.ckitmdt.backend.service.CustomerNotificationService customerNotificationService;
    private final EmployeeRepository employeeRepository;
    private final PartnerRepository partnerRepository;
    private final AdminNotificationRepository adminNotificationRepository;

    @Transactional
    public BookingResponse executeAction(
            Long bookingId,
            BookingActionRequest request,
            String userEmail) {

        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy đơn hàng với ID: " + bookingId
                ));

        User currentUser = null;

        if (userEmail != null && !userEmail.isBlank()) {
            currentUser = userRepository.findByEmail(userEmail).orElse(null);
        }

        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Dữ liệu yêu cầu không hợp lệ."
            );
        }

        if (request.getVersion() != null
                && !request.getVersion().equals(booking.getVersion())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Đơn hàng đã được cập nhật bởi thao tác khác. Vui lòng tải lại dữ liệu mới nhất."
            );
        }

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

        BookingStatusEnum currentStatus;

        try {
            currentStatus = BookingStatusEnum.valueOf(booking.getStatus());
        } catch (Exception e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Trạng thái đơn hàng không hợp lệ: " + booking.getStatus()
            );
        }

        validateActorPermission(booking, currentUser, action);

        if (action == BookingActionEnum.CANCEL && currentUser != null) {
            String uRole = normalizeRole(currentUser.getRole());
            boolean isPartnerActor = booking.getPartner() != null && booking.getPartner().getUser() != null && booking.getPartner().getUser().getId().equals(currentUser.getId());
            if ((isStaffRole(uRole) || isPartnerActor) && (request.getNote() == null || request.getNote().isBlank())) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        (isPartnerActor ? "Nhà cung cấp" : "Admin/Staff") + " phải ghi rõ lý do khi hủy đơn hàng."
                );
            }
        }

        if (action == BookingActionEnum.PROVIDER_CONFIRM_CASH_PAYMENT) {
            if (currentStatus != BookingStatusEnum.PENDING_COMPLETION
                    && currentStatus != BookingStatusEnum.COMPLETED) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Chỉ có thể xác nhận tiền mặt sau khi dịch vụ đã hoàn tất."
                );
            }

            Payment cashPayment = paymentRepository.findByBooking_Id(bookingId)
                    .stream()
                    .filter(payment -> "CASH".equalsIgnoreCase(payment.getPaymentProvider()))
                    .findFirst()
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Đơn này không sử dụng phương thức thanh toán tiền mặt."
                    ));

            if (!"PENDING".equalsIgnoreCase(cashPayment.getStatus())) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Khoản tiền mặt không còn ở trạng thái chờ xác nhận."
                );
            }

            LocalDateTime paidAt = LocalDateTime.now();

            cashPayment.setStatus("SUCCESS");
            cashPayment.setPaidAt(paidAt);
            cashPayment.setTransactionCode("CASH-" + booking.getBookingCode());

            paymentRepository.save(cashPayment);

            booking.setUpdatedAt(paidAt);

            Booking savedBooking = bookingRepository.save(booking);

            bookingStatusHistoryRepository.save(BookingStatusHistory.builder()
                    .booking(savedBooking)
                    .oldStatus(currentStatus.name())
                    .newStatus(currentStatus.name())
                    .changedBy(currentUser)
                    .note("Đối tác xác nhận đã thu đủ tiền mặt từ khách hàng.")
                    .createdAt(paidAt)
                    .build());

            rewardLifecycleService.processBooking(savedBooking.getId());
            return mapToBookingResponse(savedBooking);
        }

        if (currentStatus == BookingStatusEnum.PENDING_PAYMENT
                && booking.getHoldExpiresAt() != null
                && LocalDateTime.now().isAfter(booking.getHoldExpiresAt())
                && action != BookingActionEnum.CUSTOMER_PAY_SUCCESS) {

            String oldStatus = booking.getStatus();

            booking.setStatus(BookingStatusEnum.EXPIRED.name());
            booking.setUpdatedAt(LocalDateTime.now());

            Booking expiredBooking = bookingRepository.save(booking);

            bookingStatusHistoryRepository.save(BookingStatusHistory.builder()
                    .booking(expiredBooking)
                    .oldStatus(oldStatus)
                    .newStatus(BookingStatusEnum.EXPIRED.name())
                    .changedBy(currentUser)
                    .note("Hết hạn giữ chỗ")
                    .createdAt(LocalDateTime.now())
                    .build());

            customerNotificationService.notifyBookingStatus(expiredBooking);

            return mapToBookingResponse(expiredBooking);
        }

        BookingStatusEnum targetStatus = determineNextStatus(
                currentStatus,
                action
        );

        LocalDateTime now = LocalDateTime.now();


        // Kiểm tra xem tất cả cleaner hoạt động đã nộp kết quả hoàn thành chưa
        if (action == BookingActionEnum.SUBMIT_COMPLETION) {
            List<BookingAssignment> activeAssignments = bookingAssignmentRepository.findByBooking_IdOrderByIdAsc(booking.getId())
                    .stream()
                    .filter(a -> !"DECLINED".equalsIgnoreCase(a.getStatus()) && !"CANCELLED".equalsIgnoreCase(a.getStatus()))
                    .toList();
            boolean allSubmitted = !activeAssignments.isEmpty() && activeAssignments.stream()
                    .allMatch(a -> "WORK_SUBMITTED".equalsIgnoreCase(a.getStatus()) || "COMPLETED".equalsIgnoreCase(a.getStatus()));
            if (!allSubmitted) {
                targetStatus = BookingStatusEnum.IN_PROGRESS;
            }
        }

        String oldStatus = booking.getStatus();

        booking.setStatus(targetStatus.name());
        if (targetStatus == BookingStatusEnum.PENDING_PROVIDER) {
            booking.setProviderDeadlineAt(BookingService.calculateProviderDeadline(booking.getScheduledStart(), now));
        }
        booking.setUpdatedAt(now);

        if (targetStatus == BookingStatusEnum.COMPLETED) {
            booking.setCompletedAt(now);
            List<BookingAssignment> assignments = bookingAssignmentRepository.findByBooking_IdOrderByIdAsc(booking.getId());
            for (BookingAssignment a : assignments) {
                if (!"CANCELLED".equalsIgnoreCase(a.getStatus()) && !"DECLINED".equalsIgnoreCase(a.getStatus())) {
                    a.setStatus("COMPLETED");
                    if (a.getCompletedAt() == null) a.setCompletedAt(now);
                    bookingAssignmentRepository.save(a);

                    Employee emp = a.getEmployee();
                    if (emp != null) {
                        emp.setTotalCompletedJobs((emp.getTotalCompletedJobs() != null ? emp.getTotalCompletedJobs() : 0) + 1);
                        employeeRepository.save(emp);
                    }
                }
            }
            if (booking.getPartner() != null) {
                Partner p = booking.getPartner();
                p.setTotalCompletedJobs((p.getTotalCompletedJobs() != null ? p.getTotalCompletedJobs() : 0) + 1);
                partnerRepository.save(p);
            }
        }

        if (targetStatus == BookingStatusEnum.CANCELLED
                || targetStatus == BookingStatusEnum.REJECTED) {
            booking.setCancelledAt(now);

            if (request.getNote() != null
                    && !request.getNote().isBlank()) {
                booking.setCancelReason(request.getNote());
            }

            List<BookingAssignment> assignments = bookingAssignmentRepository.findByBooking_IdOrderByIdAsc(booking.getId());
            for (BookingAssignment a : assignments) {
                if (!"COMPLETED".equalsIgnoreCase(a.getStatus())) {
                    a.setStatus("CANCELLED");
                    bookingAssignmentRepository.save(a);
                }
            }
        }

        Booking savedBooking = bookingRepository.save(booking);

        bookingStatusHistoryRepository.save(BookingStatusHistory.builder()
                .booking(savedBooking)
                .oldStatus(oldStatus)
                .newStatus(targetStatus.name())
                .changedBy(currentUser)
                .note(request.getNote() != null
                        ? request.getNote()
                        : "Thực hiện hành động: " + action.name())
                .createdAt(LocalDateTime.now())
                .build());

        log.info(
                "Booking [{}] chuyển trạng thái {} -> {} qua hành động [{}], user [{}]",
                savedBooking.getBookingCode(),
                oldStatus,
                targetStatus.name(),
                action.name(),
                currentUser != null ? currentUser.getEmail() : "SYSTEM"
        );

        customerNotificationService.notifyBookingStatus(savedBooking);
        rewardLifecycleService.processBooking(savedBooking.getId());
        return mapToBookingResponse(savedBooking);
    }

    /**
     * Đồng bộ hóa và tập trung logic chuyển trạng thái đơn hàng (A02).
     * Tất cả các dịch vụ (CleanerAssignmentService, ProviderBookingController, ...) đều ủy quyền chuyển trạng thái qua phương thức này.
     */
    @Transactional
    public Booking transitionBooking(
            Booking booking,
            BookingStatusEnum targetStatus,
            User currentUser,
            String note
    ) {
        String oldStatus = booking.getStatus();
        LocalDateTime now = LocalDateTime.now();

        booking.setStatus(targetStatus.name());
        booking.setUpdatedAt(now);

        if (targetStatus == BookingStatusEnum.COMPLETED) {
            booking.setCompletedAt(now);
            List<BookingAssignment> assignments = bookingAssignmentRepository.findByBooking_IdOrderByIdAsc(booking.getId());
            for (BookingAssignment a : assignments) {
                if (!"CANCELLED".equalsIgnoreCase(a.getStatus()) && !"DECLINED".equalsIgnoreCase(a.getStatus())) {
                    a.setStatus("COMPLETED");
                    if (a.getCompletedAt() == null) a.setCompletedAt(now);
                    bookingAssignmentRepository.save(a);

                    Employee emp = a.getEmployee();
                    if (emp != null) {
                        emp.setTotalCompletedJobs((emp.getTotalCompletedJobs() != null ? emp.getTotalCompletedJobs() : 0) + 1);
                        employeeRepository.save(emp);
                    }
                }
            }
            if (booking.getPartner() != null) {
                Partner p = booking.getPartner();
                p.setTotalCompletedJobs((p.getTotalCompletedJobs() != null ? p.getTotalCompletedJobs() : 0) + 1);
                partnerRepository.save(p);
            }
        }

        if (targetStatus == BookingStatusEnum.CANCELLED || targetStatus == BookingStatusEnum.REJECTED) {
            booking.setCancelledAt(now);
            if (note != null && !note.isBlank()) {
                booking.setCancelReason(note);
            }
            List<BookingAssignment> assignments = bookingAssignmentRepository.findByBooking_IdOrderByIdAsc(booking.getId());
            for (BookingAssignment a : assignments) {
                if (!"COMPLETED".equalsIgnoreCase(a.getStatus())) {
                    a.setStatus("CANCELLED");
                    bookingAssignmentRepository.save(a);
                }
            }
        }

        Booking savedBooking = bookingRepository.save(booking);

        bookingStatusHistoryRepository.save(BookingStatusHistory.builder()
                .booking(savedBooking)
                .oldStatus(oldStatus)
                .newStatus(targetStatus.name())
                .changedBy(currentUser)
                .note(note != null && !note.isBlank() ? note : "Chuyển trạng thái sang " + targetStatus.name())
                .createdAt(now)
                .build());

        log.info(
                "Booking [{}] chuyển trạng thái {} -> {} qua transitionBooking, user [{}]",
                savedBooking.getBookingCode(),
                oldStatus,
                targetStatus.name(),
                currentUser != null ? currentUser.getEmail() : "SYSTEM"
        );

        customerNotificationService.notifyBookingStatus(savedBooking);
        return savedBooking;
    }

    @Transactional
    public void expirePendingPayment(Long bookingId) {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId).orElse(null);

        if (booking == null
                || !BookingStatusEnum.PENDING_PAYMENT.name().equals(booking.getStatus())
                || booking.getHoldExpiresAt() == null
                || LocalDateTime.now().isBefore(booking.getHoldExpiresAt())) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        String oldStatus = booking.getStatus();

        booking.setStatus(BookingStatusEnum.EXPIRED.name());
        booking.setUpdatedAt(now);

        Booking saved = bookingRepository.save(booking);

        bookingStatusHistoryRepository.save(BookingStatusHistory.builder()
                .booking(saved)
                .oldStatus(oldStatus)
                .newStatus(BookingStatusEnum.EXPIRED.name())
                .note("Hết thời gian giữ chỗ mà chưa nhận được thanh toán.")
                .createdAt(now)
                .build());

        customerNotificationService.notifyBookingStatus(saved);
        rewardLifecycleService.processBooking(saved.getId());
    }

    @Transactional
    public void expirePendingProvider(Long bookingId) {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId).orElse(null);

        if (booking == null
                || !BookingStatusEnum.PENDING_PROVIDER.name().equals(booking.getStatus())
                || booking.getProviderDeadlineAt() == null
                || LocalDateTime.now().isBefore(booking.getProviderDeadlineAt())) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        String oldStatus = booking.getStatus();

        booking.setStatus(BookingStatusEnum.EXPIRED.name());
        booking.setUpdatedAt(now);
        booking.setCancelReason("Đối tác quá hạn tiếp nhận đơn hàng.");

        Booking saved = bookingRepository.save(booking);

        bookingStatusHistoryRepository.save(BookingStatusHistory.builder()
                .booking(saved)
                .oldStatus(oldStatus)
                .newStatus(BookingStatusEnum.EXPIRED.name())
                .note("Hết thời gian chờ đối tác tiếp nhận đơn hàng.")
                .createdAt(now)
                .build());

        // Thông báo cho khách hàng
        customerNotificationService.notifyBookingStatus(saved);

        // Thông báo cho Admin (đơn tiền mặt không cần hoàn tiền, chỉ thông báo)
        adminNotificationRepository.save(AdminNotification.builder()
                .type("BOOKING_PROVIDER_EXPIRED")
                .title("Đơn hàng quá hạn tiếp nhận")
                .message("Đơn hàng #" + saved.getBookingCode() + " đã quá hạn mà đối tác không tiếp nhận. Đơn đã được tự động kết thúc.")
                .referenceType("BOOKING")
                .referenceId(saved.getId())
                .createdAt(now)
                .build());

        rewardLifecycleService.processBooking(saved.getId());
    }

    private BookingStatusEnum determineNextStatus(
            BookingStatusEnum currentStatus,
            BookingActionEnum action) {

        return switch (currentStatus) {
            case PENDING_PAYMENT -> switch (action) {
                case CUSTOMER_PAY_SUCCESS -> BookingStatusEnum.PENDING_PROVIDER;
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
                case START_TRAVEL -> BookingStatusEnum.EN_ROUTE;
                case START_JOB -> BookingStatusEnum.IN_PROGRESS;
                default -> invalidTransition(currentStatus, action);
            };

            case IN_PROGRESS -> switch (action) {
                case START_JOB -> BookingStatusEnum.IN_PROGRESS;
                case SUBMIT_COMPLETION -> BookingStatusEnum.PENDING_COMPLETION;
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

        boolean isAdmin = isAdminRole(role);
        boolean isStaff = isStaffRole(role);

        boolean isCustomer = booking.getCustomer() != null
                && booking.getCustomer().getId().equals(user.getId());

        boolean isPartner = booking.getPartner() != null
                && booking.getPartner().getUser() != null
                && booking.getPartner().getUser().getId().equals(user.getId());

        boolean isAssignedCleaner = isAssignedCleaner(booking, user, role);

        switch (action) {
            case CUSTOMER_PAY_SUCCESS -> throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Chỉ hệ thống thanh toán mới được xác nhận thanh toán thành công."
            );

            case CUSTOMER_ACCEPT -> {
                if (!isCustomer) {
                    throw new ResponseStatusException(
                            HttpStatus.FORBIDDEN,
                            "Chỉ khách hàng tạo đơn mới có quyền xác nhận hoàn thành."
                    );
                }
            }

            case PROVIDER_ACCEPT, PROVIDER_REJECT -> {
                if (!isPartner && !isAdmin) {
                    throw new ResponseStatusException(
                            HttpStatus.FORBIDDEN,
                            "Chỉ nhà cung cấp của đơn hàng hoặc Admin mới có quyền xử lý yêu cầu này."
                    );
                }
            }

            case ASSIGN_CLEANER -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Hãy sử dụng chức năng phân công nhân viên của nhà cung cấp để tạo bản ghi phân công thực tế."
            );

            case PROVIDER_CONFIRM_CASH_PAYMENT -> {
                if (!isPartner) {
                    throw new ResponseStatusException(
                            HttpStatus.FORBIDDEN,
                            "Chỉ nhà cung cấp của đơn hàng mới có quyền xác nhận đã thu tiền mặt."
                    );
                }
            }

            case START_TRAVEL, START_JOB, SUBMIT_COMPLETION -> {
                if (!isPartner) {
                    throw new ResponseStatusException(
                            HttpStatus.FORBIDDEN,
                            "Cleaner phải cập nhật tiến độ thông qua phân công công việc."
                    );
                }
            }

            case CANCEL -> {
                if (!isCustomer && !isPartner && !isAdmin && !isStaff) {
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
                        case "PENDING_PAYMENT", "PENDING_PROVIDER", "CONFIRMED", "ASSIGNED" -> true;
                        default -> false;
                    };

                    if (!canCancel) {
                        throw new ResponseStatusException(
                                HttpStatus.FORBIDDEN,
                                "Đơn đã bắt đầu di chuyển hoặc thực hiện dịch vụ. Vui lòng gửi khiếu nại để nhân viên hỗ trợ."
                        );
                    }
                }

                if (isPartner) {
                    boolean canCancel = switch (status) {
                        case "PENDING_PROVIDER", "CONFIRMED", "ASSIGNED" -> true;
                        default -> false;
                    };

                    if (!canCancel) {
                        throw new ResponseStatusException(
                                HttpStatus.FORBIDDEN,
                                "Nhà cung cấp không thể hủy đơn ở trạng thái hiện tại."
                        );
                    }


                }

                if ((isAdmin || isStaff)
                        && (status.equals("COMPLETED")
                        || status.equals("CANCELLED")
                        || status.equals("REJECTED")
                        || status.equals("EXPIRED"))) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Không thể hủy đơn đã kết thúc."
                    );
                }
            }
        }
    }

    private boolean isAssignedCleaner(
            Booking booking,
            User user,
            String role) {

        if (!isCleanerRole(role)
                || booking == null
                || booking.getId() == null) {
            return false;
        }

        return bookingAssignmentRepository
                .findByBooking_IdOrderByIdAsc(booking.getId())
                .stream()
                .filter(assignment -> assignment.getEmployee() != null)
                .filter(assignment -> assignment.getEmployee().getUser() != null)
                .anyMatch(assignment ->
                        assignment.getEmployee().getUser().getId().equals(user.getId())
                                && "ACTIVE".equalsIgnoreCase(assignment.getEmployee().getStatus())
                                && "ACTIVE".equalsIgnoreCase(assignment.getEmployee().getUser().getStatus())
                                && (assignment.getStatus() == null
                                || "ASSIGNED".equalsIgnoreCase(assignment.getStatus())
                                || "ACCEPTED".equalsIgnoreCase(assignment.getStatus())
                                || "EN_ROUTE".equalsIgnoreCase(assignment.getStatus())
                                || "IN_PROGRESS".equalsIgnoreCase(assignment.getStatus())
                                || "WORK_SUBMITTED".equalsIgnoreCase(assignment.getStatus()))
                );
    }

    private String normalizeRole(String role) {
        return role == null
                ? ""
                : role.trim().toUpperCase(Locale.ROOT);
    }

    private boolean isAdminRole(String role) {
        return "ADMIN".equals(role)
                || "ROLE_ADMIN".equals(role);
    }

    private boolean isStaffRole(String role) {
        return isAdminRole(role)
                || "STAFF".equals(role)
                || "ROLE_STAFF".equals(role);
    }

    private boolean isCleanerRole(String role) {
        return "CLEANER".equals(role)
                || "ROLE_CLEANER".equals(role)
                || "EMPLOYEE".equals(role)
                || "ROLE_EMPLOYEE".equals(role);
    }

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

        String role = user == null ? "" : normalizeRole(user.getRole());

        boolean isAdmin = isAdminRole(role);
        boolean isStaff = isStaffRole(role);
        boolean isCleaner = user != null
                && isAssignedCleaner(booking, user, role);

        boolean hasUnpaidCashPayment = (isPartner || isAdmin)
                && paymentRepository.findByBooking_Id(booking.getId())
                .stream()
                .anyMatch(payment ->
                        "CASH".equalsIgnoreCase(payment.getPaymentProvider())
                                && "PENDING".equalsIgnoreCase(payment.getStatus())
                );

        switch (status) {
            case PENDING_PAYMENT -> {
                if (isCustomer || isAdmin || isStaff || isPartner) {
                    allowed.add(BookingActionEnum.CANCEL.name());
                }
            }

            case PENDING_PROVIDER -> {
                if (isPartner || isAdmin) {
                    allowed.add(BookingActionEnum.PROVIDER_ACCEPT.name());
                    allowed.add(BookingActionEnum.PROVIDER_REJECT.name());
                }

                if (isCustomer || isAdmin || isStaff) {
                    allowed.add(BookingActionEnum.CANCEL.name());
                }
            }

            case CONFIRMED -> {
                if (isCustomer || isAdmin || isStaff || isPartner) {
                    allowed.add(BookingActionEnum.CANCEL.name());
                }
            }

            case ASSIGNED -> {
                if (isPartner) {
                    allowed.add(BookingActionEnum.START_TRAVEL.name());
                    allowed.add(BookingActionEnum.START_JOB.name());
                }

                if (isCustomer || isAdmin || isStaff) {
                    allowed.add(BookingActionEnum.CANCEL.name());
                }
            }

            case EN_ROUTE -> {
                if (isPartner) {
                    allowed.add(BookingActionEnum.START_JOB.name());
                }
            }

            case IN_PROGRESS -> {
                if (isPartner) {
                    allowed.add(BookingActionEnum.SUBMIT_COMPLETION.name());
                }
            }
            case PENDING_COMPLETION -> {
                if (isCustomer) {
                    allowed.add(BookingActionEnum.CUSTOMER_ACCEPT.name());
                }

                if (isPartner && hasUnpaidCashPayment) {
                    allowed.add(BookingActionEnum.PROVIDER_CONFIRM_CASH_PAYMENT.name());
                }

                if (isAdmin || isStaff) {
                    allowed.add(BookingActionEnum.CANCEL.name());
                }
            }

            default -> {
            }
        }

        if (status == BookingStatusEnum.COMPLETED && hasUnpaidCashPayment) {
            allowed.add(BookingActionEnum.PROVIDER_CONFIRM_CASH_PAYMENT.name());
        }

        return allowed;
    }

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
                        .employeeCount(item.getEmployeeCount())
                        .durationMinutes(item.getDurationMinutes())
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

        List<Payment> payments = paymentRepository.findByBooking_Id(booking.getId());

        List<BookingPaymentSummaryResponse> paymentRecords = payments.stream()
                .map(payment -> BookingPaymentSummaryResponse.builder()
                        .id(payment.getId())
                        .method(payment.getPaymentMethod())
                        .provider(payment.getPaymentProvider())
                        .amount(payment.getAmount())
                        .status(payment.getStatus())
                        .createdAt(payment.getCreatedAt())
                        .paidAt(payment.getPaidAt())
                        .build())
                .toList();

        List<BookingRefundSummaryResponse> refundRecords = cancellationRefundRepository
                .findByBooking_IdOrderByRequestedAtAsc(booking.getId())
                .stream()
                .map(refund -> BookingRefundSummaryResponse.builder()
                        .id(refund.getId())
                        .requestedAmount(refund.getRequestedAmount())
                        .approvedAmount(refund.getApprovedAmount())
                        .status(refund.getStatus())
                        .requestedAt(refund.getRequestedAt())
                        .reviewedAt(refund.getReviewedAt())
                        .transferredAt(refund.getTransferredAt())
                        .build())
                .toList();

        boolean cashPayment = payments.stream()
                .anyMatch(payment ->
                        "CASH".equalsIgnoreCase(payment.getPaymentProvider())
                );

        boolean alreadyPaid = payments.stream().anyMatch(this::isSuccessfulPayment);

        String paymentMethod = cashPayment ? "CASH" : "VNPAY";
        String paymentStatus = alreadyPaid ? "PAID"
                : payments.stream().anyMatch(payment -> "REVIEW".equalsIgnoreCase(payment.getStatus())) ? "REVIEW"
                : payments.stream().anyMatch(payment -> "PENDING".equalsIgnoreCase(payment.getStatus())) ? "PENDING"
                : payments.stream().anyMatch(payment -> "FAILED".equalsIgnoreCase(payment.getStatus())) ? "FAILED"
                : "UNPAID";

        List<BookingAssignment> assignments = bookingAssignmentRepository.findByBooking_IdOrderByIdAsc(booking.getId());
        List<CleanerAssignmentResponse> assignmentResponses = assignments.stream()
                .map(a -> {
                    Employee emp = a.getEmployee();
                    User empUser = emp != null ? emp.getUser() : null;
                    return CleanerAssignmentResponse.builder()
                            .assignmentId(a.getId())
                            .assignmentStatus(a.getStatus())
                            .assignedAt(a.getAssignedAt())
                            .acceptedAt(a.getAcceptedAt())
                            .startedAt(a.getStartedAt())
                            .completedAt(a.getCompletedAt())
                            .assignmentNote(a.getNote())
                            .employeeId(emp != null ? emp.getId() : null)
                            .employeeCode(emp != null ? emp.getEmployeeCode() : null)
                            .employeeName(empUser != null ? empUser.getFullName() : null)
                            .employeePhone(empUser != null ? empUser.getPhone() : null)
                            .build();
                })
                .collect(Collectors.toList());

        BookingAssignment primaryAssignment = assignments.stream()
                .filter(a -> !"CANCELLED".equalsIgnoreCase(a.getStatus()) && !"DECLINED".equalsIgnoreCase(a.getStatus()))
                .findFirst()
                .orElse(null);

        String cleanerName = null;
        String cleanerPhone = null;
        String cleanerAvatar = null;
        java.math.BigDecimal cleanerRating = null;
        Integer cleanerCompletedJobs = null;

        if (primaryAssignment != null && primaryAssignment.getEmployee() != null) {
            Employee emp = primaryAssignment.getEmployee();
            User empUser = emp.getUser();
            if (empUser != null) {
                cleanerName = empUser.getFullName();
                cleanerPhone = empUser.getPhone();
                cleanerAvatar = empUser.getAvatarUrl();
            }
            cleanerCompletedJobs = emp.getTotalCompletedJobs();
            cleanerRating = emp.getRatingAverage();
        }

        return BookingResponse.builder()
                .cleanerName(cleanerName)
                .cleanerPhone(cleanerPhone)
                .cleanerAvatar(cleanerAvatar)
                .cleanerRating(cleanerRating)
                .cleanerCompletedJobs(cleanerCompletedJobs)
                .assignments(assignmentResponses)
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
                .receiverName(booking.getReceiverNameSnapshot() != null
                        ? booking.getReceiverNameSnapshot()
                        : booking.getAddress() != null ? booking.getAddress().getReceiverName() : null)
                .receiverPhone(booking.getReceiverPhoneSnapshot() != null
                        ? booking.getReceiverPhoneSnapshot()
                        : booking.getAddress() != null ? booking.getAddress().getPhone() : null)
                .fullAddress(booking.getFullAddressSnapshot() != null
                        ? booking.getFullAddressSnapshot() : fullAddress)
                .latitude(booking.getLatitudeSnapshot() != null
                        ? booking.getLatitudeSnapshot()
                        : booking.getAddress() != null ? booking.getAddress().getLatitude() : null)
                .longitude(booking.getLongitudeSnapshot() != null
                        ? booking.getLongitudeSnapshot()
                        : booking.getAddress() != null ? booking.getAddress().getLongitude() : null)
                .scheduledStart(booking.getScheduledStart())
                .scheduledEnd(booking.getScheduledEnd())
                .subtotal(booking.getSubtotal())
                .discountAmount(booking.getDiscountAmount())
                .pointsDiscount(booking.getPointsDiscount())
                .totalAmount(booking.getTotalAmount())
                .status(booking.getStatus())
                .paymentMethod(paymentMethod)
                .paymentStatus(paymentStatus)
                .customerNote(booking.getCustomerNote())
                .cancelReason(booking.getCancelReason())
                .holdExpiresAt(booking.getHoldExpiresAt())
                .providerDeadlineAt(booking.getProviderDeadlineAt())
                .version(booking.getVersion())
                .createdAt(booking.getCreatedAt())
                .completedAt(booking.getCompletedAt())
                .cancelledAt(booking.getCancelledAt())
                .items(items)
                .statusHistory(historyList)
                .paymentRecords(paymentRecords)
                .refundRecords(refundRecords)
                .build();
    }

    private boolean isSuccessfulPayment(Payment payment) {
        if (payment == null || payment.getStatus() == null) return false;
        return switch (payment.getStatus().trim().toUpperCase(Locale.ROOT)) {
            case "SUCCESS", "PAID", "SUCCESSFUL", "COMPLETED", "SUCCEEDED" -> true;
            default -> false;
        };
    }
}
