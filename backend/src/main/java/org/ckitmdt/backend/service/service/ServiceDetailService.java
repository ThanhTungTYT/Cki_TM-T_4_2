package org.ckitmdt.backend.service.service;

import org.ckitmdt.backend.dto.service.QuoteRequestDto;
import org.ckitmdt.backend.dto.service.QuoteResponseDto;
import org.ckitmdt.backend.dto.service.ServiceDetailResponseDto;
import org.ckitmdt.backend.entity.Service;
import org.ckitmdt.backend.repository.ServiceRepository;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;

@org.springframework.stereotype.Service
public class ServiceDetailService {

    @Autowired
    private ServiceRepository serviceRepository;

    public ServiceDetailResponseDto getServiceDetail(Long id) {
        Service service = serviceRepository.findByIdAndStatusNot(id, "DELETED")
                .orElseThrow(() -> new RuntimeException("Dịch vụ không tồn tại hoặc đã bị ẩn"));

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
                .categoryId(service.getCategory() != null ? service.getCategory().getId() : null)
                .categoryName(service.getCategory() != null ? service.getCategory().getName() : null)
                .createdAt(service.getCreatedAt())
                .updatedAt(service.getUpdatedAt())
                .build();
    }

    public QuoteResponseDto calculateQuote(QuoteRequestDto request) {
        Service service = serviceRepository.findById(request.getServiceId())
                .orElseThrow(() -> new RuntimeException("Dịch vụ không tồn tại"));

        int qty = (request.getQuantity() == null || request.getQuantity() < 1) ? 1 : request.getQuantity();
        BigDecimal unitPrice = service.getBasePrice() != null ? service.getBasePrice() : BigDecimal.ZERO;
        BigDecimal totalPrice = unitPrice.multiply(BigDecimal.valueOf(qty));

        return QuoteResponseDto.builder()
                .serviceId(service.getId())
                .serviceName(service.getName())
                .unitPrice(unitPrice)
                .quantity(qty)
                .pricingType(service.getPricingType())
                .totalEstimatedPrice(totalPrice)
                .build();
    }
}