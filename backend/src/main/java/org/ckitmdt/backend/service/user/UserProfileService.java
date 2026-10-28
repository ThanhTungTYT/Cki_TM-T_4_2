
package org.ckitmdt.backend.service.user;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.user.UpdateProfileRequest;
import org.ckitmdt.backend.dto.user.UserProfileResponse;
import org.ckitmdt.backend.dto.user.UserAddressRequest;
import org.ckitmdt.backend.dto.user.UserAddressResponse;
import org.ckitmdt.backend.entity.Address;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.AddressRepository;
import org.ckitmdt.backend.repository.BookingRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserProfileService {

    private final UserRepository userRepository;
    private final AddressRepository addressRepository;
    private final BookingRepository bookingRepository;

    private User findUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy người dùng"
                ));
    }

    private UserProfileResponse toResponse(User user) {
        return new UserProfileResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getDateOfBirth(),
                user.getGender()
        );
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(String email) {
        return toResponse(findUser(email));
    }

    @Transactional
    public UserProfileResponse updateProfile(
            String email,
            UpdateProfileRequest request
    ) {
        User user = findUser(email);

        String fullName = request.fullName() == null
                ? ""
                : request.fullName().trim();

        if (fullName.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Họ và tên không được để trống"
            );
        }

        if (fullName.length() > 100) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Họ và tên không được quá 100 ký tự"
            );
        }

        String phone = request.phone() == null
                ? ""
                : request.phone().trim();

        if (!phone.isEmpty()
                && !phone.matches("^0[0-9]{9}$")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Số điện thoại không hợp lệ"
            );
        }

        String gender = request.gender() == null
                ? ""
                : request.gender().trim();

        if (!gender.isEmpty()
                && !Set.of("MALE", "FEMALE", "OTHER")
                .contains(gender)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Giới tính không hợp lệ"
            );
        }

        if (request.dateOfBirth() != null
                && request.dateOfBirth().isAfter(
                java.time.LocalDate.now()
        )) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Ngày sinh không được lớn hơn ngày hiện tại"
            );
        }

        user.setFullName(fullName);
        user.setPhone(phone.isEmpty() ? null : phone);
        user.setDateOfBirth(request.dateOfBirth());
        user.setGender(gender.isEmpty() ? null : gender);

        User savedUser = userRepository.save(user);

        return toResponse(savedUser);
    }

    @Transactional(readOnly = true)
    public List<UserAddressResponse> getAddresses(String email) {
        User user = findUser(email);
        return addressRepository.findByUserIdOrderByIdDesc(user.getId())
                .stream().map(this::toAddressResponse).toList();
    }

    @Transactional
    public UserAddressResponse addAddress(String email, UserAddressRequest request) {
        User user = findUser(email);
        validateAddress(request);
        List<Address> existing = addressRepository.findByUserId(user.getId());
        boolean makeDefault = Boolean.TRUE.equals(request.isDefault()) || existing.isEmpty();
        if (makeDefault) existing.forEach(address -> address.setIsDefault(false));

        LocalDateTime now = LocalDateTime.now();
        Address address = Address.builder()
                .user(user)
                .receiverName(clean(request.receiverName()))
                .phone(clean(request.phone()))
                .province(clean(request.province()))
                .district(clean(request.district()))
                .ward(clean(request.ward()))
                .streetAddress(clean(request.streetAddress()))
                .isDefault(makeDefault)
                .createdAt(now)
                .updatedAt(now)
                .build();
        if (makeDefault) addressRepository.saveAll(existing);
        return toAddressResponse(addressRepository.save(address));
    }

    @Transactional
    public UserAddressResponse updateAddress(String email, Long addressId, UserAddressRequest request) {
        User user = findUser(email);
        validateAddress(request);
        Address address = addressRepository.findByIdAndUserId(addressId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy địa chỉ"));
        List<Address> existing = addressRepository.findByUserId(user.getId());
        boolean makeDefault = Boolean.TRUE.equals(request.isDefault());
        if (makeDefault) existing.stream().filter(item -> !item.getId().equals(addressId))
                .forEach(item -> item.setIsDefault(false));
        address.setReceiverName(clean(request.receiverName()));
        address.setPhone(clean(request.phone()));
        address.setProvince(clean(request.province()));
        address.setDistrict(clean(request.district()));
        address.setWard(clean(request.ward()));
        address.setStreetAddress(clean(request.streetAddress()));
        address.setIsDefault(makeDefault);
        address.setUpdatedAt(LocalDateTime.now());
        if (makeDefault) addressRepository.saveAll(existing);
        return toAddressResponse(addressRepository.save(address));
    }

    @Transactional
    public void deleteAddress(String email, Long addressId) {
        User user = findUser(email);
        Address address = addressRepository.findByIdAndUserId(addressId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy địa chỉ"));
        if (bookingRepository.existsByAddress_Id(addressId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Địa chỉ đã được sử dụng trong đơn đặt lịch nên không thể xóa");
        }
        List<Address> remaining = addressRepository.findByUserIdOrderByIdDesc(user.getId()).stream()
                .filter(item -> !item.getId().equals(addressId)).toList();
        boolean wasDefault = Boolean.TRUE.equals(address.getIsDefault());
        addressRepository.delete(address);
        if (wasDefault && !remaining.isEmpty()) {
            Address nextDefault = remaining.get(0);
            nextDefault.setIsDefault(true);
            nextDefault.setUpdatedAt(LocalDateTime.now());
            addressRepository.save(nextDefault);
        }
    }

    private void validateAddress(UserAddressRequest request) {
        if (request == null || blank(request.receiverName()) || blank(request.phone())
                || blank(request.province()) || blank(request.district())
                || blank(request.ward()) || blank(request.streetAddress())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng nhập đầy đủ thông tin địa chỉ");
        }
        if (!clean(request.phone()).matches("^0[0-9]{9}$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Số điện thoại không hợp lệ");
        }
    }

    private boolean blank(String value) { return value == null || value.trim().isEmpty(); }
    private String clean(String value) { return value == null ? "" : value.trim(); }

    private UserAddressResponse toAddressResponse(Address address) {
        return new UserAddressResponse(address.getId(), address.getReceiverName(), address.getPhone(),
                address.getProvince(), address.getDistrict(), address.getWard(), address.getStreetAddress(),
                address.getIsDefault(), address.getLatitude(), address.getLongitude());
    }
}
