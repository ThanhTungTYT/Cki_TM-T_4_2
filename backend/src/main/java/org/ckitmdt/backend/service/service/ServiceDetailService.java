package org.ckitmdt.backend.service.service;

import org.ckitmdt.backend.dto.service.QuoteRequestDto;
import org.ckitmdt.backend.dto.service.QuoteResponseDto;
import org.ckitmdt.backend.dto.service.ServiceDetailProviderDto;
import org.ckitmdt.backend.dto.service.ServiceDetailResponseDto;
import org.ckitmdt.backend.dto.service.ServicePackageListItemDto;
import org.ckitmdt.backend.dto.service.PublicProviderProfileDto;
import org.ckitmdt.backend.dto.service.PublicProviderServiceDto;
import org.ckitmdt.backend.dto.service.PublicProviderSummaryDto;
import org.ckitmdt.backend.entity.PartnerService;
import org.ckitmdt.backend.entity.Service;
import org.ckitmdt.backend.entity.ServicePackage;
import org.ckitmdt.backend.repository.PartnerServiceRepository;
import org.ckitmdt.backend.repository.PartnerRepository;
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
    private ReviewRepository reviewRepository;

    @Autowired
    private PartnerRepository partnerRepository;

    @Transactional(readOnly = true)
    public ServiceDetailResponseDto getServiceDetail(Long id) {

        Service service = serviceRepository.findByIdAndStatusNot(id, "DELETED")
                .filter(item -> "ACTIVE".equalsIgnoreCase(item.getStatus()))
                .filter(item -> item.getCategory() != null
                        && "ACTIVE".equalsIgnoreCase(item.getCategory().getStatus()))
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

        List<PartnerService> activeOffers = partnerServiceRepository.findByService_Id(service.getId())
                .stream().filter(this::isActiveProviderOffer).toList();
        List<Long> partnerIds = activeOffers.stream().map(offer -> offer.getPartner().getId()).distinct().toList();
        var partnerStats = partnerIds.isEmpty() ? java.util.Map.<Long, ReviewRepository.PartnerReviewStats>of()
                : reviewRepository.summarizeByPartnerIds(partnerIds).stream()
                        .collect(java.util.stream.Collectors.toMap(
                                ReviewRepository.PartnerReviewStats::getPartnerId, stats -> stats));

        List<ServiceDetailProviderDto> providers = activeOffers.stream()
                        .map(offer -> toProviderDto(offer, partnerStats.get(offer.getPartner().getId())))
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

    @Transactional(readOnly = true)
    public PublicProviderProfileDto getProviderProfile(Long providerId) {
        var partner = partnerRepository.findById(providerId)
                .filter(item -> "ACTIVE".equalsIgnoreCase(item.getStatus())
                        && item.getUser() != null
                        && "ACTIVE".equalsIgnoreCase(item.getUser().getStatus()))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Nhà cung cấp không tồn tại hoặc hiện không hoạt động."));

        List<PartnerService> offers = partnerServiceRepository.findByPartner_Id(providerId).stream()
                .filter(this::isActiveProviderOffer)
                .filter(offer -> offer.getService() != null
                        && "ACTIVE".equalsIgnoreCase(offer.getService().getStatus())
                        && offer.getService().getCategory() != null
                        && "ACTIVE".equalsIgnoreCase(offer.getService().getCategory().getStatus()))
                .toList();
        List<Long> serviceIds = offers.stream().map(offer -> offer.getService().getId()).distinct().toList();
        var serviceStats = serviceIds.isEmpty() ? java.util.Map.<Long, ReviewRepository.ServiceReviewStats>of()
                : reviewRepository.summarizeByServiceIds(serviceIds).stream()
                        .collect(java.util.stream.Collectors.toMap(
                                ReviewRepository.ServiceReviewStats::getServiceId, stats -> stats));
        var partnerStats = reviewRepository.summarizeByPartnerIds(List.of(providerId)).stream()
                .findFirst().orElse(null);

        List<PublicProviderServiceDto> services = offers.stream().map(offer -> {
            var service = offer.getService();
            var stats = serviceStats.get(service.getId());
            BigDecimal price = offer.getPrice() != null ? offer.getPrice() : service.getBasePrice();
            return PublicProviderServiceDto.builder()
                    .id(service.getId())
                    .name(service.getName())
                    .description(service.getDescription())
                    .thumbnailUrl(service.getThumbnailUrl())
                    .pricingType(service.getPricingType())
                    .basePrice(price)
                    .rating(stats == null ? null : stats.getAverageRating())
                    .reviews(stats == null ? 0L : stats.getReviewCount())
                    .build();
        }).toList();

        return PublicProviderProfileDto.builder()
                .providerId(partner.getId())
                .businessName(partner.getBusinessName())
                .description(partner.getDescription())
                .avatarUrl(partner.getUser().getAvatarUrl())
                .address(partner.getAddress())
                .ratingAverage(partnerStats == null || partnerStats.getAverageRating() == null
                        ? null : BigDecimal.valueOf(partnerStats.getAverageRating()))
                .totalReviews(partnerStats == null ? 0L : partnerStats.getReviewCount())
                .totalCompletedJobs(partner.getTotalCompletedJobs())
                .services(services)
                .build();
    }

    @Transactional(readOnly = true)
    public List<PublicProviderSummaryDto> getPublicProviders() {
        List<PartnerService> offers = partnerServiceRepository.findAll(PublicServiceSpecifications.activeOffers())
                .stream()
                .filter(offer -> offer.getService() != null
                        && offer.getService().getCategory() != null
                        && "ACTIVE".equalsIgnoreCase(offer.getService().getCategory().getStatus()))
                .toList();
        List<Long> partnerIds = offers.stream().map(offer -> offer.getPartner().getId()).distinct().toList();
        if (partnerIds.isEmpty()) return List.of();

        var reviewStats = reviewRepository.summarizeByPartnerIds(partnerIds).stream()
                .collect(java.util.stream.Collectors.toMap(
                        ReviewRepository.PartnerReviewStats::getPartnerId, stats -> stats));
        var serviceCounts = offers.stream().collect(java.util.stream.Collectors.groupingBy(
                offer -> offer.getPartner().getId(), java.util.stream.Collectors.mapping(
                        offer -> offer.getService().getId(),
                        java.util.stream.Collectors.collectingAndThen(java.util.stream.Collectors.toSet(),
                                ids -> (long) ids.size()))));

        return partnerRepository.findAllById(partnerIds).stream()
                .filter(partner -> partner.getUser() != null
                        && "ACTIVE".equalsIgnoreCase(partner.getUser().getStatus()))
                .sorted(java.util.Comparator.comparing(partner -> partner.getBusinessName().toLowerCase()))
                .map(partner -> {
                    var stats = reviewStats.get(partner.getId());
                    return PublicProviderSummaryDto.builder()
                            .providerId(partner.getId())
                            .businessName(partner.getBusinessName())
                            .description(partner.getDescription())
                            .avatarUrl(partner.getUser().getAvatarUrl())
                            .address(partner.getAddress())
                            .ratingAverage(stats == null || stats.getAverageRating() == null
                                    ? null : BigDecimal.valueOf(stats.getAverageRating()))
                            .totalReviews(stats == null ? 0L : stats.getReviewCount())
                            .totalCompletedJobs(partner.getTotalCompletedJobs())
                            .serviceCount(serviceCounts.getOrDefault(partner.getId(), 0L))
                            .build();
                }).toList();
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

    private ServiceDetailProviderDto toProviderDto(
            PartnerService offer, ReviewRepository.PartnerReviewStats reviewStats) {

        var partner = offer.getPartner();

        BigDecimal price = offer.getPrice();

        if (price == null) {
            price = offer.getService().getBasePrice();
        }

        return ServiceDetailProviderDto.builder()
                .providerId(partner.getId())
                .businessName(partner.getBusinessName())
                .description(partner.getDescription())
                .avatarUrl(partner.getUser().getAvatarUrl())
                .address(partner.getAddress())
                .price(price)
                .ratingAverage(reviewStats == null || reviewStats.getAverageRating() == null
                        ? null : BigDecimal.valueOf(reviewStats.getAverageRating()))
                .totalCompletedJobs(partner.getTotalCompletedJobs())
                .totalReviews(reviewStats == null ? 0L : reviewStats.getReviewCount())
                .build();
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
