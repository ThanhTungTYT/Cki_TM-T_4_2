package org.ckitmdt.backend.service.booking;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.booking.CleanerAssignmentViewResponse;
import org.ckitmdt.backend.dto.booking.CleanerBookingItemViewResponse;
import org.ckitmdt.backend.dto.booking.CleanerBookingViewResponse;
import org.ckitmdt.backend.entity.Address;
import org.ckitmdt.backend.entity.Booking;
import org.ckitmdt.backend.entity.BookingAssignment;
import org.ckitmdt.backend.entity.BookingItem;
import org.ckitmdt.backend.entity.Employee;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.BookingAssignmentRepository;
import org.ckitmdt.backend.repository.BookingItemRepository;
import org.ckitmdt.backend.repository.EmployeeRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class CleanerAssignmentQueryService {

    private final BookingAssignmentRepository assignmentRepository;
    private final BookingItemRepository bookingItemRepository;
    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;

    /**
     * Lấy toàn bộ phân công của Cleaner đang đăng nhập.
     */
    @Transactional(readOnly = true)
    public List<CleanerAssignmentViewResponse> getMyAssignments(
            String userEmail
    ) {
        Employee employee = getCurrentEmployee(userEmail);

        return assignmentRepository
                .findByEmployee_IdOrderByAssignedAtDesc(employee.getId())
                .stream()
                .filter(assignment ->
                        isValidAssignmentForEmployee(assignment, employee)
                )
                .map(this::toResponse)
                .toList();
    }

    /**
     * Lấy chi tiết một phân công.
     * Cleaner không thể dùng ID để xem việc của người khác.
     */
    @Transactional(readOnly = true)
    public CleanerAssignmentViewResponse getMyAssignment(
            Long assignmentId,
            String userEmail
    ) {
        Employee employee = getCurrentEmployee(userEmail);

        BookingAssignment assignment = assignmentRepository
                .findById(assignmentId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy phân công công việc."
                ));

        if (!isValidAssignmentForEmployee(assignment, employee)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Không tìm thấy phân công công việc."
            );
        }

        return toResponse(assignment);
    }

    /**
     * Xác định Employee từ tài khoản đang đăng nhập.
     * Không nhận employeeId từ Frontend.
     */
    private Employee getCurrentEmployee(String userEmail) {

        if (userEmail == null || userEmail.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Vui lòng đăng nhập."
            );
        }

        User cleaner = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Không tìm thấy tài khoản đăng nhập."
                ));

        if (!isCleanerRole(cleaner.getRole())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Tài khoản không có quyền Cleaner."
            );
        }

        if (!isActive(cleaner.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Tài khoản Cleaner hiện không hoạt động."
            );
        }

        Employee employee = employeeRepository
                .findByUser_Id(cleaner.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy hồ sơ nhân viên."
                ));

        if (!isActive(employee.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Hồ sơ nhân viên hiện không hoạt động."
            );
        }

        if (employee.getPartner() == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Nhân viên chưa được liên kết với Provider."
            );
        }

        Partner partner = employee.getPartner();

        if (!isActive(partner.getStatus())
                || partner.getUser() == null
                || !isActive(partner.getUser().getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Provider liên kết hiện không hoạt động."
            );
        }

        return employee;
    }

    /**
     * Kiểm tra quan hệ:
     * Employee = Assignment = Provider = Booking.
     */
    private boolean isValidAssignmentForEmployee(
            BookingAssignment assignment,
            Employee employee
    ) {
        if (assignment == null
                || employee == null
                || assignment.getEmployee() == null
                || assignment.getPartner() == null
                || assignment.getBooking() == null
                || employee.getPartner() == null
                || assignment.getBooking().getPartner() == null
                || assignment.getPartner().getUser() == null) {
            return false;
        }

        Long employeeId = employee.getId();

        Long assignmentEmployeeId =
                assignment.getEmployee().getId();

        Long employeePartnerId =
                employee.getPartner().getId();

        Long assignmentPartnerId =
                assignment.getPartner().getId();

        Long bookingPartnerId =
                assignment.getBooking().getPartner().getId();

        return Objects.equals(employeeId, assignmentEmployeeId)
                && Objects.equals(employeePartnerId, assignmentPartnerId)
                && Objects.equals(assignmentPartnerId, bookingPartnerId)
                && isActive(assignment.getPartner().getStatus())
                && isActive(assignment.getPartner().getUser().getStatus());
    }

    /**
     * Chuyển Assignment thành DTO chỉ dành cho Cleaner.
     */
    private CleanerAssignmentViewResponse toResponse(
            BookingAssignment assignment
    ) {
        Employee employee = assignment.getEmployee();

        User employeeUser =
                employee != null ? employee.getUser() : null;

        return CleanerAssignmentViewResponse.builder()
                .assignmentId(assignment.getId())
                .assignmentStatus(assignment.getStatus())
                .assignedAt(assignment.getAssignedAt())
                .acceptedAt(assignment.getAcceptedAt())
                .startedAt(assignment.getStartedAt())
                .completedAt(assignment.getCompletedAt())
                .assignmentNote(assignment.getNote())
                .employeeId(employee != null ? employee.getId() : null)
                .employeeCode(
                        employee != null ? employee.getEmployeeCode() : null
                )
                .employeeName(
                        employeeUser != null
                                ? employeeUser.getFullName()
                                : null
                )
                .employeePhone(
                        employeeUser != null
                                ? employeeUser.getPhone()
                                : null
                )
                .booking(toBookingResponse(assignment.getBooking()))
                .build();
    }

    /**
     * Chỉ trả dữ liệu Booking mà Cleaner cần để thực hiện công việc.
     *
     * Không trả:
     * - Tổng tiền, giá dịch vụ, giảm giá.
     * - Thông tin thanh toán.
     * - Thông tin hoàn tiền.
     * - Tọa độ doanh nghiệp.
     */
    private CleanerBookingViewResponse toBookingResponse(
            Booking booking
    ) {
        if (booking == null) {
            return null;
        }

        List<CleanerBookingItemViewResponse> items =
                bookingItemRepository.findByBookingId(booking.getId())
                        .stream()
                        .map(this::toBookingItemResponse)
                        .toList();

        Address address = booking.getAddress();

        String fullAddress = booking.getFullAddressSnapshot();

        if (fullAddress == null || fullAddress.isBlank()) {
            fullAddress = formatAddress(address);
        }

        String receiverName = booking.getReceiverNameSnapshot();

        if (receiverName == null || receiverName.isBlank()) {
            receiverName = address != null
                    ? address.getReceiverName()
                    : null;
        }

        if ((receiverName == null || receiverName.isBlank())
                && booking.getCustomer() != null) {
            receiverName = booking.getCustomer().getFullName();
        }

        String receiverPhone = booking.getReceiverPhoneSnapshot();

        if (receiverPhone == null || receiverPhone.isBlank()) {
            receiverPhone = address != null
                    ? address.getPhone()
                    : null;
        }

        if ((receiverPhone == null || receiverPhone.isBlank())
                && booking.getCustomer() != null) {
            receiverPhone = booking.getCustomer().getPhone();
        }

        return CleanerBookingViewResponse.builder()
                .id(booking.getId())
                .bookingCode(booking.getBookingCode())
                .customerName(
                        booking.getCustomer() != null
                                ? booking.getCustomer().getFullName()
                                : null
                )
                .customerPhone(
                        booking.getCustomer() != null
                                ? booking.getCustomer().getPhone()
                                : null
                )
                .partnerName(
                        booking.getPartner() != null
                                ? booking.getPartner().getBusinessName()
                                : null
                )
                .addressId(
                        address != null ? address.getId() : null
                )
                .receiverName(receiverName)
                .receiverPhone(receiverPhone)
                .fullAddress(fullAddress)
                .latitude(booking.getLatitudeSnapshot() != null
                        ? booking.getLatitudeSnapshot()
                        : (address != null ? address.getLatitude() : null))
                .longitude(booking.getLongitudeSnapshot() != null
                        ? booking.getLongitudeSnapshot()
                        : (address != null ? address.getLongitude() : null))
                .scheduledStart(booking.getScheduledStart())
                .scheduledEnd(booking.getScheduledEnd())
                .status(booking.getStatus())
                .customerNote(booking.getCustomerNote())
                .version(booking.getVersion())
                .createdAt(booking.getCreatedAt())
                .completedAt(booking.getCompletedAt())
                .items(items)
                .build();
    }

    private CleanerBookingItemViewResponse toBookingItemResponse(
            BookingItem item
    ) {
        String serviceName = item.getServiceName();

        if ((serviceName == null || serviceName.isBlank())
                && item.getService() != null) {
            serviceName = item.getService().getName();
        }

        String packageName = item.getServicePackage() != null
                ? item.getServicePackage().getName()
                : null;

        return CleanerBookingItemViewResponse.builder()
                .id(item.getId())
                .serviceName(serviceName)
                .packageName(packageName)
                .quantity(item.getQuantity())
                .employeeCount(item.getEmployeeCount())
                .durationMinutes(item.getDurationMinutes())
                .note(item.getNote())
                .build();
    }

    private String formatAddress(Address address) {
        if (address == null) {
            return null;
        }

        return Stream.of(
                        address.getStreetAddress(),
                        address.getWard(),
                        address.getDistrict(),
                        address.getProvince()
                )
                .filter(value -> value != null && !value.isBlank())
                .collect(Collectors.joining(", "));
    }

    private boolean isCleanerRole(String role) {
        if (role == null || role.isBlank()) {
            return false;
        }

        String normalized = role.trim().toUpperCase(Locale.ROOT);

        if (normalized.startsWith("ROLE_")) {
            normalized = normalized.substring(5);
        }

        return normalized.equals("CLEANER")
                || normalized.equals("EMPLOYEE");
    }

    private boolean isActive(String status) {
        return status != null
                && "ACTIVE".equalsIgnoreCase(status.trim());
    }
}