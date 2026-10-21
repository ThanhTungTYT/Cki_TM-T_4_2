package org.ckitmdt.backend.controller.service;

import org.ckitmdt.backend.dto.service.QuoteRequestDto;
import org.ckitmdt.backend.dto.service.QuoteResponseDto;
import org.ckitmdt.backend.dto.service.ServiceDetailResponseDto;
import org.ckitmdt.backend.service.service.ServiceDetailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/services")
@CrossOrigin(origins = "*")
public class ServiceDetailController {

    @Autowired
    private ServiceDetailService serviceDetailService;

    @GetMapping("/{id}")
    public ResponseEntity<ServiceDetailResponseDto> getServiceById(@PathVariable Long id) {
        return ResponseEntity.ok(serviceDetailService.getServiceDetail(id));
    }

    @PostMapping("/quotes")
    public ResponseEntity<QuoteResponseDto> calculateQuote(@RequestBody QuoteRequestDto request) {
        return ResponseEntity.ok(serviceDetailService.calculateQuote(request));
    }
}