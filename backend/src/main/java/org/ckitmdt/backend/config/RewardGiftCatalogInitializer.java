package org.ckitmdt.backend.config;

import lombok.RequiredArgsConstructor;
import org.ckitmdt.backend.entity.RewardGift;
import org.ckitmdt.backend.repository.RewardGiftRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component @RequiredArgsConstructor
public class RewardGiftCatalogInitializer implements ApplicationRunner {
    private final RewardGiftRepository gifts;

    @Override @Transactional
    public void run(ApplicationArguments args) {
        add("DETERGENT", "Bột giặt", "Một phần bột giặt chăm sóc quần áo cho gia đình.", "🧺", 3000);
        add("MOP", "Cây lau nhà", "Cây lau nhà tiện dụng cho không gian sạch sẽ.", "🧹", 5000);
        add("CLEANING_KIT", "Bộ khăn vệ sinh", "Bộ khăn mềm dùng vệ sinh các bề mặt trong nhà.", "🧽", 2000);
    }

    private void add(String code, String name, String description, String icon, int cost) {
        if (gifts.existsByCode(code)) return;
        gifts.save(RewardGift.builder().code(code).name(name).description(description).icon(icon)
                .pointsCost(cost).stock(20).active(true).build());
    }
}
