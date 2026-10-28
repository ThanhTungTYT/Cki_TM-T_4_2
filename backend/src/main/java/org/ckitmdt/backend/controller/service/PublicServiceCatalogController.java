package org.ckitmdt.backend.controller.service;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.service.PublicServiceFilterOptionsDto;
import org.ckitmdt.backend.dto.service.PublicServicePageDto;
import org.ckitmdt.backend.service.service.PublicServiceCatalogService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/v1/services")
@RequiredArgsConstructor
public class PublicServiceCatalogController {
    private final PublicServiceCatalogService catalogService;

    @GetMapping
    public ResponseEntity<PublicServicePageDto> search(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String area,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) Double minRating,
            @RequestParam(required = false) String pricingType,
            @RequestParam(defaultValue = "popular") String sortBy,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "6") int size) {
        return ResponseEntity.ok(catalogService.search(
                keyword, category, area, maxPrice, minRating, pricingType, sortBy, page, size));
    }

    @GetMapping("/filters")
    public ResponseEntity<PublicServiceFilterOptionsDto> filterOptions() {
        return ResponseEntity.ok(catalogService.filterOptions());
    }
}
