package org.ckitmdt.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @GetMapping("/test")
    public ResponseEntity<String> testAdmin() {
        return ResponseEntity.ok(
                "Bạn đang truy cập với quyền ADMIN"
        );
    }
}