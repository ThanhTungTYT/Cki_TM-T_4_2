package org.ckitmdt.backend.controller.provider;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.Employee;
import org.ckitmdt.backend.entity.Partner;
import org.ckitmdt.backend.entity.PartnerService;
import org.ckitmdt.backend.entity.User;
import org.ckitmdt.backend.repository.EmployeeRepository;
import org.ckitmdt.backend.repository.PartnerRepository;
import org.ckitmdt.backend.repository.PartnerServiceRepository;
import org.ckitmdt.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class ProviderSecurityHelper {

    private final UserRepository userRepository;
    private final PartnerRepository partnerRepository;
    private final EmployeeRepository employeeRepository;
    private final PartnerServiceRepository partnerServiceRepository;

    public User currentUser(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập.");
        }
        User user = userRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Không tìm thấy tài khoản."));
        String role = normalize(user.getRole());
        if (!Set.of("PROVIDER", "PARTNER").contains(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ nhà cung cấp mới được sử dụng chức năng này.");
        }
        return user;
    }

    public Partner currentPartner(Authentication auth) {
        User user = currentUser(auth);
        return partnerRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tài khoản chưa có hồ sơ nhà cung cấp."));
    }

    public Employee ownedEmployee(Long id, Partner partner) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy nhân viên."));
        if (employee.getPartner() == null || !employee.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền quản lý nhân viên này.");
        }
        return employee;
    }

    public PartnerService ownedService(Long id, Partner partner) {
        PartnerService service = partnerServiceRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy dịch vụ của bạn."));
        if (service.getPartner() == null || !service.getPartner().getId().equals(partner.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không sở hữu dịch vụ này.");
        }
        return service;
    }

    public static String text(Object value) {
        return value != null ? value.toString().trim() : null;
    }

    public static String normalize(String value) {
        return value != null ? value.trim().toUpperCase(Locale.ROOT) : "";
    }

    public static Long requiredLong(Map<String, Object> body, String key) {
        Object val = body != null ? body.get(key) : null;
        if (val == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trường " + key + " là bắt buộc.");
        }
        try {
            return Long.valueOf(val.toString().trim());
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trường " + key + " không hợp lệ.");
        }
    }

    public static BigDecimal requiredPrice(Map<String, Object> body, String key) {
        Object val = body != null ? body.get(key) : null;
        if (val == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trường " + key + " là bắt buộc.");
        }
        try {
            BigDecimal price = new BigDecimal(val.toString().trim());
            if (price.compareTo(BigDecimal.ZERO) < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trường " + key + " phải >= 0.");
            }
            return price;
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trường " + key + " không hợp lệ.");
        }
    }

    public static Integer requiredPositiveInt(Map<String, Object> body, String key) {
        Object val = body != null ? body.get(key) : null;
        if (val == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trường " + key + " là bắt buộc.");
        }
        try {
            int num = Integer.parseInt(val.toString().trim());
            if (num <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trường " + key + " phải > 0.");
            }
            return num;
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trường " + key + " không hợp lệ.");
        }
    }
}
