package org.ckitmdt.backend.controller.service;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.dto.service.PublicProviderSummaryDto;
import org.ckitmdt.backend.service.service.ServiceDetailService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/providers")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class PublicProviderController {
    private final ServiceDetailService serviceDetailService;

    @GetMapping
    public ResponseEntity<List<PublicProviderSummaryDto>> getPublicProviders() {
        return ResponseEntity.ok(serviceDetailService.getPublicProviders());
    }
}
