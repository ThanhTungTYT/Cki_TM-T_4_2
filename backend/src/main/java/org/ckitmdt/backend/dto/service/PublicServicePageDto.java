package org.ckitmdt.backend.dto.service;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class PublicServicePageDto {
    List<PublicServiceListItemDto> content;
    long totalElements;
    int totalPages;
    int page;
    int size;
}
