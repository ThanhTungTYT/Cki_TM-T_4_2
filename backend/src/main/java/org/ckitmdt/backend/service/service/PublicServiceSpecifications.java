package org.ckitmdt.backend.service.service;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.ckitmdt.backend.entity.PartnerService;
import org.ckitmdt.backend.entity.Review;
import org.ckitmdt.backend.entity.ServicePackage;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class PublicServiceSpecifications {
    private PublicServiceSpecifications() {}

    public static Specification<PartnerService> activeOffers() {
        return (root, query, cb) -> cb.and(
                cb.equal(cb.upper(root.get("status")), "ACTIVE"),
                cb.equal(cb.upper(root.get("service").get("status")), "ACTIVE"),
                cb.equal(cb.upper(root.get("service").get("category").get("status")), "ACTIVE"),
                cb.equal(cb.upper(root.get("partner").get("status")), "ACTIVE"),
                cb.equal(cb.upper(root.get("partner").get("user").get("status")), "ACTIVE")
        );
    }

    public static Specification<PartnerService> filtered(
            String keyword,
            String category,
            String area,
            BigDecimal maxPrice,
            Double minRating,
            String pricingType,
            String sortBy) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(cb.upper(root.get("status")), "ACTIVE"));
            predicates.add(cb.equal(cb.upper(root.get("service").get("status")), "ACTIVE"));
            predicates.add(cb.equal(cb.upper(root.get("service").get("category").get("status")), "ACTIVE"));
            predicates.add(cb.equal(cb.upper(root.get("partner").get("status")), "ACTIVE"));
            predicates.add(cb.equal(cb.upper(root.get("partner").get("user").get("status")), "ACTIVE"));

            if (category != null && !category.isBlank()) {
                List<Long> categoryIds = java.util.Arrays.stream(category.split(","))
                        .map(String::trim).filter(value -> !value.isBlank())
                        .map(PublicServiceSpecifications::parseCategory).toList();
                if (!categoryIds.isEmpty()) predicates.add(root.get("service").get("category").get("id").in(categoryIds));
            }

            if (area != null && !area.isBlank()) {
                for (String areaPart : area.split(",")) {
                    if (!areaPart.isBlank()) {
                        predicates.add(cb.like(fold(cb, root.get("partner").get("address")), pattern(areaPart)));
                    }
                }
            }

            if (maxPrice != null) {
                Expression<BigDecimal> price = cb.coalesce(root.get("price"), root.get("service").get("basePrice"));
                predicates.add(cb.lessThanOrEqualTo(price, maxPrice));
            }

            if (minRating != null) {
                predicates.add(cb.greaterThanOrEqualTo(
                        partnerAverageRating(root, query, cb), minRating));
            }

            if (pricingType != null && !pricingType.isBlank()) {
                List<String> pricingTypes = java.util.Arrays.stream(pricingType.split(","))
                        .map(PublicServiceSpecifications::normalize).filter(value -> !value.isBlank()).toList();
                if (!pricingTypes.isEmpty()) predicates.add(fold(cb, root.get("service").get("pricingType")).in(pricingTypes));
            }

            String normalizedKeyword = normalize(keyword);
            if (!normalizedKeyword.isBlank()) {
                for (String term : normalizedKeyword.split("\\s+")) {
                    String termPattern = "%" + term + "%";
                    List<Predicate> searchable = new ArrayList<>();
                    searchable.add(cb.like(fold(cb, root.get("service").get("name")), termPattern));
                    searchable.add(cb.like(fold(cb, root.get("service").get("description")), termPattern));
                    searchable.add(cb.like(fold(cb, root.get("partner").get("businessName")), termPattern));
                    searchable.add(cb.like(fold(cb, root.get("service").get("category").get("name")), termPattern));

                    Subquery<Long> packages = query.subquery(Long.class);
                    Root<ServicePackage> servicePackage = packages.from(ServicePackage.class);
                    packages.select(servicePackage.get("id"));
                    packages.where(
                            cb.equal(servicePackage.get("service").get("id"), root.get("service").get("id")),
                            cb.or(cb.isNull(servicePackage.get("status")), cb.equal(cb.upper(servicePackage.get("status")), "ACTIVE")),
                            cb.like(fold(cb, servicePackage.get("name")), termPattern)
                    );
                    searchable.add(cb.exists(packages));

                    searchable.add(cb.like(fold(cb, root.get("partner").get("address")), termPattern));
                    predicates.add(cb.or(searchable.toArray(Predicate[]::new)));
                }
            }

            if (query.getResultType() != Long.class && query.getResultType() != long.class) {
                applySort(root, query, cb, sortBy);
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static Long parseCategory(String category) {
        try {
            return Long.valueOf(category);
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Danh mục dịch vụ không hợp lệ.");
        }
    }

    private static void applySort(
            Root<PartnerService> root,
            CriteriaQuery<?> query,
            CriteriaBuilder cb,
            String sortBy) {
        Expression<BigDecimal> price = cb.coalesce(root.get("price"), root.get("service").get("basePrice"));
        Subquery<Long> reviewCount = query.subquery(Long.class);
        Root<Review> review = reviewCount.from(Review.class);
        reviewCount.select(cb.count(review));
        reviewCount.where(cb.equal(review.get("service").get("id"), root.get("service").get("id")));

        if ("price-asc".equals(sortBy)) {
            query.orderBy(cb.asc(price), cb.asc(root.get("id")));
        } else if ("price-desc".equals(sortBy)) {
            query.orderBy(cb.desc(price), cb.asc(root.get("id")));
        } else if ("rating".equals(sortBy)) {
            query.orderBy(cb.desc(partnerAverageRating(root, query, cb)), cb.asc(root.get("id")));
        } else if ("reviews".equals(sortBy)) {
            Subquery<Long> providerReviewCount = query.subquery(Long.class);
            Root<Review> providerReview = providerReviewCount.from(Review.class);
            providerReviewCount.select(cb.count(providerReview));
            providerReviewCount.where(cb.equal(providerReview.get("partner").get("id"), root.get("partner").get("id")));
            query.orderBy(cb.desc(providerReviewCount), cb.asc(root.get("id")));
        } else {
            query.orderBy(cb.desc(reviewCount), cb.asc(root.get("id")));
        }
    }

    private static Expression<Double> serviceAverageRating(
            Root<PartnerService> root, CriteriaQuery<?> query, CriteriaBuilder cb) {
        Subquery<Double> average = query.subquery(Double.class);
        Root<Review> review = average.from(Review.class);
        average.select(cb.avg(review.<Integer>get("rating")));
        average.where(cb.equal(review.get("service").get("id"), root.get("service").get("id")));
        return cb.coalesce(average, 0D);
    }

    private static Expression<Double> partnerAverageRating(
            Root<PartnerService> root, CriteriaQuery<?> query, CriteriaBuilder cb) {
        Subquery<Double> average = query.subquery(Double.class);
        Root<Review> review = average.from(Review.class);
        average.select(cb.avg(review.<Integer>get("rating")));
        average.where(cb.equal(review.get("partner").get("id"), root.get("partner").get("id")));
        return cb.coalesce(average, 0D);
    }

    private static String pattern(String value) {
        return "%" + normalize(value) + "%";
    }

    private static String normalize(String value) {
        if (value == null) return "";
        String normalized = Normalizer.normalize(value.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd');
        return normalized.replaceAll("[^a-z0-9]+", " ").trim();
    }

    private static Expression<String> fold(CriteriaBuilder cb, Expression<String> value) {
        Expression<String> result = cb.lower(value);
        String[] accented = {"á", "à", "ả", "ã", "ạ", "ă", "ắ", "ằ", "ẳ", "ẵ", "ặ", "â", "ấ", "ầ", "ẩ", "ẫ", "ậ", "é", "è", "ẻ", "ẽ", "ẹ", "ê", "ế", "ề", "ể", "ễ", "ệ", "í", "ì", "ỉ", "ĩ", "ị", "ó", "ò", "ỏ", "õ", "ọ", "ô", "ố", "ồ", "ổ", "ỗ", "ộ", "ơ", "ớ", "ờ", "ở", "ỡ", "ợ", "ú", "ù", "ủ", "ũ", "ụ", "ư", "ứ", "ừ", "ử", "ữ", "ự", "ý", "ỳ", "ỷ", "ỹ", "ỵ", "đ"};
        String[] plain = {"a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "a", "e", "e", "e", "e", "e", "e", "e", "e", "e", "e", "e", "i", "i", "i", "i", "i", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "o", "u", "u", "u", "u", "u", "u", "u", "u", "u", "u", "u", "y", "y", "y", "y", "y", "d"};
        for (int i = 0; i < accented.length; i++) {
            result = cb.function("replace", String.class, result, cb.literal(accented[i]), cb.literal(plain[i]));
        }
        return result;
    }
}
