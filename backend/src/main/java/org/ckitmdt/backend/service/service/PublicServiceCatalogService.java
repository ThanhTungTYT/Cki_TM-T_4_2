package org.ckitmdt.backend.service.service;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.service.*;
import org.ckitmdt.backend.entity.PartnerService;
import org.ckitmdt.backend.entity.ServicePackage;
import org.ckitmdt.backend.repository.PartnerServiceRepository;
import org.ckitmdt.backend.repository.ReviewRepository;
import org.ckitmdt.backend.repository.ServicePackageRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PublicServiceCatalogService {
    private static final int DEFAULT_PAGE_SIZE = 6;
    private static final int MAX_PAGE_SIZE = 24;

    private final PartnerServiceRepository partnerServiceRepository;
    private final ServicePackageRepository servicePackageRepository;
    private final ReviewRepository reviewRepository;

    @Transactional(readOnly = true)
    public PublicServicePageDto search(
            String keyword,
            String category,
            String area,
            BigDecimal maxPrice,
            Double minRating,
            String pricingType,
            String sortBy,
            int page,
            int size) {
        if (page < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Số trang không hợp lệ.");
        }
        if (maxPrice != null && maxPrice.signum() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Giá tối đa không hợp lệ.");
        }
        if (minRating != null && (minRating < 0 || minRating > 5)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mức đánh giá phải nằm trong khoảng 0 đến 5.");
        }

        int pageSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);
        Specification<PartnerService> specification = PublicServiceSpecifications.filtered(
                keyword, category, area, maxPrice, minRating, pricingType, sortBy);
        Pageable pageable = PageRequest.of(page, pageSize, Sort.unsorted());
        Page<PartnerService> result = partnerServiceRepository.findAll(specification, pageable);
        List<Long> serviceIds = result.getContent().stream()
                .map(offer -> offer.getService().getId()).distinct().toList();
        List<Long> partnerIds = result.getContent().stream()
                .map(offer -> offer.getPartner().getId()).distinct().toList();
        Map<Long, ReviewRepository.ServiceReviewStats> reviewStats = serviceIds.isEmpty()
                ? Map.of()
                : reviewRepository.summarizeByServiceIds(serviceIds).stream()
                        .collect(Collectors.toMap(ReviewRepository.ServiceReviewStats::getServiceId, stats -> stats));
        Map<Long, ReviewRepository.PartnerReviewStats> partnerStats = partnerIds.isEmpty() ? Map.of()
                : reviewRepository.summarizeByPartnerIds(partnerIds).stream()
                        .collect(Collectors.toMap(ReviewRepository.PartnerReviewStats::getPartnerId, stats -> stats));

        return PublicServicePageDto.builder()
                .content(result.getContent().stream()
                        .map(offer -> toDto(offer, reviewStats.get(offer.getService().getId()),
                                partnerStats.get(offer.getPartner().getId()))).toList())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .page(result.getNumber())
                .size(result.getSize())
                .build();
    }

    @Transactional(readOnly = true)
    public PublicServiceFilterOptionsDto filterOptions() {
        List<PartnerService> offers = partnerServiceRepository.findAll(
                PublicServiceSpecifications.activeOffers());

        Map<Long, Long> categoryCounts = new TreeMap<>();
        Map<String, Long> areaCounts = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        Map<String, Long> pricingCounts = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        BigDecimal maxPrice = BigDecimal.ZERO;

        for (PartnerService offer : offers) {
            categoryCounts.merge(offer.getService().getCategory().getId(), 1L, Long::sum);
            String area = providerArea(offer.getPartner().getAddress());
            if (!area.isBlank()) areaCounts.merge(area, 1L, Long::sum);
            String pricingType = offer.getService().getPricingType();
            if (pricingType != null && !pricingType.isBlank()) pricingCounts.merge(pricingType, 1L, Long::sum);
            BigDecimal price = effectivePrice(offer);
            if (price.compareTo(maxPrice) > 0) maxPrice = price;
        }

        List<PublicServiceFilterOptionsDto.FilterOptionDto> categories = new ArrayList<>();
        Map<Long, String> categoryNames = new TreeMap<>();
        offers.forEach(offer -> categoryNames.put(
                offer.getService().getCategory().getId(), offer.getService().getCategory().getName()));
        categoryCounts.forEach((id, count) -> categories.add(option(String.valueOf(id), categoryNames.get(id), count)));

        List<PublicServiceFilterOptionsDto.FilterOptionDto> areas = areaCounts.entrySet().stream()
                .map(entry -> option(entry.getKey(), entry.getKey(), entry.getValue())).toList();
        List<PublicServiceFilterOptionsDto.FilterOptionDto> pricingTypes = pricingCounts.entrySet().stream()
                .map(entry -> option(entry.getKey(), entry.getKey(), entry.getValue())).toList();

        return PublicServiceFilterOptionsDto.builder()
                .categories(categories)
                .areas(areas)
                .pricingTypes(pricingTypes)
                .priceLimit(maxPrice)
                .build();
    }

    private PublicServiceFilterOptionsDto.FilterOptionDto option(String value, String label, long count) {
        return PublicServiceFilterOptionsDto.FilterOptionDto.builder()
                .value(value).label(label).count(count).build();
    }

    private PublicServiceListItemDto toDto(PartnerService offer, ReviewRepository.ServiceReviewStats stats,
                                           ReviewRepository.PartnerReviewStats partnerStats) {
        var service = offer.getService();
        var partner = offer.getPartner();
        List<ServicePackageListItemDto> packages = servicePackageRepository
                .findByServiceId(service.getId()).stream()
                .filter(item -> item.getStatus() == null || "ACTIVE".equalsIgnoreCase(item.getStatus()))
                .sorted(Comparator.comparing(ServicePackage::getId))
                .map(item -> ServicePackageListItemDto.builder()
                        .id(item.getId())
                        .name(item.getName())
                        .durationMinutes(item.getDurationMinutes())
                        .employeeCount(item.getEmployeeCount())
                        .minArea(item.getMinArea())
                        .maxArea(item.getMaxArea())
                        .price(item.getPrice())
                        .build())
                .toList();

        return PublicServiceListItemDto.builder()
                .id(service.getId())
                .name(service.getName())
                .description(service.getDescription())
                .thumbnailUrl(service.getThumbnailUrl())
                .providerId(partner.getId())
                .providerName(partner.getBusinessName())
                .categoryId(service.getCategory().getId())
                .categoryName(service.getCategory().getName())
                .pricingType(service.getPricingType())
                .basePrice(effectivePrice(offer))
                .estimatedMinutes(service.getEstimatedMinutes())
                .rating(stats == null || stats.getAverageRating() == null ? 0D : stats.getAverageRating())
                .reviews(stats == null ? 0L : stats.getReviewCount())
                .providerRating(partnerStats == null ? null : BigDecimal.valueOf(partnerStats.getAverageRating()))
                .providerReviews(partnerStats == null ? 0L : partnerStats.getReviewCount())
                .providerCompletedJobs(partner.getTotalCompletedJobs())
                .location(providerLocation(partner.getAddress()))
                .packages(packages)
                .build();
    }

    private BigDecimal effectivePrice(PartnerService offer) {
        BigDecimal price = offer.getPrice();
        if (price == null) price = offer.getService().getBasePrice();
        return price == null ? BigDecimal.ZERO : price;
    }

    private String providerLocation(String address) {
        return address == null || address.isBlank() ? "Chưa cập nhật khu vực" : address.trim();
    }

    private String providerArea(String address) {
        if (address == null || address.isBlank()) return "";
        String[] parts = address.split(",");
        if (parts.length < 2) return address.trim();
        return String.join(",", java.util.Arrays.copyOfRange(parts, Math.max(0, parts.length - 2), parts.length))
                .trim();
    }
}
