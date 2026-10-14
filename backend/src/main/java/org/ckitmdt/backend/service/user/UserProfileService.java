
package org.ckitmdt.backend.service.user;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.user.UpdateProfileRequest;
import org.ckitmdt.backend.dto.user.UserProfileResponse;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;

@Service
@RequiredArgsConstructor
public class UserProfileService {

    private final UserRepository userRepository;

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
}
