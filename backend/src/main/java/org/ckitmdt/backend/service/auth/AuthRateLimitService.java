package org.ckitmdt.backend.service.auth;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

@Service
public class AuthRateLimitService {
    private static final int MAX_TRACKED_KEYS = 10_000;
    private final Map<String, Window> windows = new HashMap<>();
    private int callsSinceCleanup;

    public synchronized void consume(String key, int limit, long windowMillis, String message) {
        long now = System.currentTimeMillis();
        Window window = windows.get(key);
        if (window == null || now - window.startedAt() >= windowMillis) {
            if (windows.size() >= MAX_TRACKED_KEYS) cleanup(now, windowMillis);
            if (windows.size() >= MAX_TRACKED_KEYS && window == null) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Hệ thống đang nhận quá nhiều yêu cầu xác thực. Vui lòng thử lại sau.");
            }
            window = new Window(now, 0);
        }
        if (window.count() >= limit) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, message);
        }
        windows.put(key, new Window(window.startedAt(), window.count() + 1));

        if (++callsSinceCleanup >= 256) {
            cleanup(now, windowMillis);
            callsSinceCleanup = 0;
        }
    }

    private void cleanup(long now, long fallbackWindowMillis) {
        Iterator<Map.Entry<String, Window>> iterator = windows.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<String, Window> entry = iterator.next();
            if (now - entry.getValue().startedAt() >= Math.max(fallbackWindowMillis, 60 * 60 * 1000L)) {
                iterator.remove();
            }
        }
    }

    private record Window(long startedAt, int count) {}
}
