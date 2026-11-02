package org.ckitmdt.backend.service.service;

import org.ckitmdt.backend.dto.service.QuoteRequestDto;
import org.ckitmdt.backend.dto.service.QuoteResponseDto;
import org.ckitmdt.backend.dto.service.ServiceDetailProviderDto;
import org.ckitmdt.backend.dto.service.ServiceDetailResponseDto;
import org.ckitmdt.backend.dto.service.ServicePackageListItemDto;
import org.ckitmdt.backend.entity.Address;
import org.ckitmdt.backend.entity.PartnerService;
import org.ckitmdt.backend.entity.Service;
import org.ckitmdt.backend.entity.ServicePackage;
import org.ckitmdt.backend.repository.AddressRepository;
import org.ckitmdt.backend.repository.PartnerServiceRepository;
import org.ckitmdt.backend.repository.ReviewRepository;
import org.ckitmdt.backend.repository.ServicePackageRepository;
import org.ckitmdt.backend.repository.ServiceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;

@org.springframework.stereotype.Service
public class ServiceDetailService {

    @Autowired
    private ServiceRepository serviceRepository;

    @Autowired
    private ServicePackageRepository servicePackageRepository;

    @Autowired
    private PartnerServiceRepository partnerServiceRepository;

    @Autowired
    private AddressRepository addressRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    @Transactional(readOnly = true)
    public ServiceDetailResponseDto getServiceDetail(Long id) {

        Service service = serviceRepository.findByIdAndStatusNot(id, "DELETED")
                .filter(item -> "ACTIVE".equalsIgnoreCase(item.getStatus()))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Dịch vụ không tồn tại hoặc hiện không hoạt động."
                ));

        List<ServicePackageListItemDto> packages =
                servicePackageRepository.findByServiceId(service.getId())
                        .stream()
                        .filter(item -> item.getStatus() == null
                                || "ACTIVE".equalsIgnoreCase(item.getStatus()))
                        .sorted(Comparator.comparing(ServicePackage::getId))
                        .map(this::toPackageDto)
                        .toList();

        List<ServiceDetailProviderDto> providers =
                partnerServiceRepository.findByService_Id(service.getId())
                        .stream()
                        .filter(this::isActiveProviderOffer)
                        .map(this::toProviderDto)
                        .sorted(Comparator.comparing(
                                ServiceDetailProviderDto::getRatingAverage,
                                Comparator.nullsLast(Comparator.reverseOrder())
                        ))
                        .toList();

        return ServiceDetailResponseDto.builder()
                .id(service.getId())
                .name(service.getName())
                .slug(service.getSlug())
                .description(service.getDescription())
                .thumbnailUrl(service.getThumbnailUrl())
                .pricingType(service.getPricingType())
                .basePrice(service.getBasePrice())
                .estimatedMinutes(service.getEstimatedMinutes())
                .status(service.getStatus())
                .categoryId(service.getCategory() != null
                        ? service.getCategory().getId() : null)
                .categoryName(service.getCategory() != null
                        ? service.getCategory().getName() : null)
                .createdAt(service.getCreatedAt())
                .updatedAt(service.getUpdatedAt())
                .packages(packages)
                .providers(providers)
                .build();
    }

    private boolean isActiveProviderOffer(PartnerService offer) {
        return offer != null
                && offer.getPartner() != null
                && offer.getPartner().getUser() != null
                && "ACTIVE".equalsIgnoreCase(offer.getStatus())
                && "ACTIVE".equalsIgnoreCase(offer.getPartner().getStatus())
                && "ACTIVE".equalsIgnoreCase(
                offer.getPartner().getUser().getStatus()
        );
    }

    private ServicePackageListItemDto toPackageDto(ServicePackage item) {
        return ServicePackageListItemDto.builder()
                .id(item.getId())
                .name(item.getName())
                .durationMinutes(item.getDurationMinutes())
                .employeeCount(item.getEmployeeCount())
                .minArea(item.getMinArea())
                .maxArea(item.getMaxArea())
                .price(item.getPrice())
                .build();
    }

    private ServiceDetailProviderDto toProviderDto(PartnerService offer) {

        var partner = offer.getPartner();

        List<Address> addresses = addressRepository.findProviderAddresses(
                partner.getUser().getId()
        );

        String address = addresses.stream()
                .findFirst()
                .map(item -> {
                    StringBuilder result = new StringBuilder();

                    appendAddress(result, item.getStreetAddress());
                    appendAddress(result, item.getWard());
                    appendAddress(result, item.getDistrict());
                    appendAddress(result, item.getProvince());

                    return result.length() > 0
                            ? result.toString()
                            : "Chưa cập nhật địa chỉ";
                })
                .orElse("Chưa cập nhật địa chỉ");

        BigDecimal price = offer.getPrice();

        if (price == null) {
            price = offer.getService().getBasePrice();
        }

        return ServiceDetailProviderDto.builder()
                .providerId(partner.getId())
                .businessName(partner.getBusinessName())
                .description(partner.getDescription())
                .avatarUrl(partner.getUser().getAvatarUrl())
                .address(address)
                .price(price)
                .ratingAverage(partner.getRatingAverage())
                .totalCompletedJobs(partner.getTotalCompletedJobs())
                .totalReviews(reviewRepository.countByPartner_Id(partner.getId()))
                .build();
    }

    private void appendAddress(StringBuilder result, String value) {
        if (value != null && !value.isBlank()) {
            if (result.length() > 0) {
                result.append(", ");
            }
            result.append(value.trim());
        }
    }

    public QuoteResponseDto calculateQuote(QuoteRequestDto request) {

        if (request == null || request.getServiceId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng chọn dịch vụ."
            );
        }

        Service service = serviceRepository.findByIdAndStatusNot(
                        request.getServiceId(), "DELETED")
                .filter(item -> "ACTIVE".equalsIgnoreCase(item.getStatus()))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Dịch vụ không tồn tại hoặc hiện không hoạt động."
                ));

        int quantity = request.getQuantity() == null
                ? 1
                : request.getQuantity();

        if (quantity < 1 || quantity > 1000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Số lượng phải từ 1 đến 1000."
            );
        }

        BigDecimal unitPrice = service.getBasePrice() != null
                ? service.getBasePrice()
                : BigDecimal.ZERO;

        BigDecimal totalPrice = unitPrice.multiply(
                BigDecimal.valueOf(quantity)
        );

        return QuoteResponseDto.builder()
                .serviceId(service.getId())
                .serviceName(service.getName())
                .unitPrice(unitPrice)
                .quantity(quantity)
                .pricingType(service.getPricingType())
                .totalEstimatedPrice(totalPrice)
                .build();
    }
}