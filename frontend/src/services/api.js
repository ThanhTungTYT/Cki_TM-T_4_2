const BASE_URL = 'http://localhost:8080/api';

export const publicServicesApi = {
    async getServiceDetail(serviceId, { signal } = {}) {
        const res = await fetch(`${BASE_URL}/v1/services/${encodeURIComponent(serviceId)}`, { signal });
        return handleResponse(res, 'Không thể tải thông tin dịch vụ.');
    },

    async getFilters({ signal } = {}) {
        const res = await fetch(`${BASE_URL}/v1/services/filters`, { signal });
        return handleResponse(res, 'Không thể tải bộ lọc dịch vụ.');
    },

    async search(params, { signal } = {}) {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                query.set(key, String(value));
            }
        });
        const res = await fetch(`${BASE_URL}/v1/services?${query}`, { signal });
        return handleResponse(res, 'Không thể tải danh sách dịch vụ.');
    },

    async getProviderProfile(providerId, { signal } = {}) {
        const res = await fetch(`${BASE_URL}/v1/services/providers/${encodeURIComponent(providerId)}`, { signal });
        return handleResponse(res, 'Không thể tải hồ sơ nhà cung cấp.');
    }
};

export const publicProvidersApi = {
    async getAll({ signal } = {}) {
        const res = await fetch(`${BASE_URL}/v1/providers`, { signal });
        return handleResponse(res, 'Không thể tải danh sách nhà cung cấp.');
    }
};

// =========================
// AUTH HEADERS
// =========================
function getAuthHeaders(extraHeaders = {}) {
    const token =
        sessionStorage.getItem('accessToken') ||
        localStorage.getItem('accessToken');

    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extraHeaders
    };
}

// =========================
// HANDLE API RESPONSE
// =========================
async function handleResponse(res, defaultMessage = 'Có lỗi xảy ra.') {
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(
            data.message ||
            data.detail ||
            data.error ||
            defaultMessage
        );
    }

    return data;
}

// =========================
// CART API
// =========================
export const cartApi = {
    async getCart() {
        const res = await fetch(`${BASE_URL}/cart`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        return handleResponse(res, 'Không thể tải giỏ hàng.');
    },

    async addToCart(payload) {
        const res = await fetch(`${BASE_URL}/cart/items`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        return handleResponse(res, 'Không thể thêm dịch vụ vào giỏ hàng.');
    },

    async updateCartItem(id, payload) {
        const res = await fetch(`${BASE_URL}/cart/items/${id}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        return handleResponse(res, 'Không thể cập nhật giỏ hàng.');
    },

    async removeFromCart(id) {
        const res = await fetch(`${BASE_URL}/cart/items/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        return handleResponse(res, 'Không thể xóa dịch vụ khỏi giỏ hàng.');
    },

    async clearCart(partnerId = null) {
        const url = partnerId == null
            ? `${BASE_URL}/cart`
            : `${BASE_URL}/cart?partnerId=${encodeURIComponent(partnerId)}`;

        const res = await fetch(url, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        return handleResponse(res, 'Không thể xóa giỏ hàng.');
    }
};

// =========================
// BOOKING API
// =========================
export const bookingApi = {
    async getAvailability(payload, signal) {
        const res = await fetch(`${BASE_URL}/bookings/availability`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
            signal
        });
        return handleResponse(res, 'Không thể tải lịch khả dụng.');
    },

    async getCalendarAvailability(payload, signal) {
        const res = await fetch(`${BASE_URL}/bookings/availability/calendar`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
            signal
        });
        return handleResponse(res, 'Không thể tải trạng thái ngày khả dụng.');
    },

    async getQuote(payload) {
        const res = await fetch(`${BASE_URL}/bookings/quote`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        return handleResponse(res, 'Không thể tính giá đơn đặt dịch vụ.');
    },

    async createBooking(payload, idempotencyKey) {
        const res = await fetch(`${BASE_URL}/bookings`, {
            method: 'POST',
            headers: getAuthHeaders(
                idempotencyKey
                    ? { 'Idempotency-Key': idempotencyKey }
                    : {}
            ),
            body: JSON.stringify(payload)
        });

        return handleResponse(res, 'Không thể tạo đơn đặt dịch vụ.');
    },

    async getMyBookings() {
        const res = await fetch(`${BASE_URL}/bookings/me`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        return handleResponse(res, 'Không thể tải danh sách đơn hàng.');
    },

    async getCleanerBookings() {
        const res = await fetch(`${BASE_URL}/bookings/cleaner/me`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        return handleResponse(res, 'Không thể tải danh sách công việc được giao.');
    },

    async getCleanerAssignments() {
        const res = await fetch(
            `${BASE_URL}/bookings/cleaner/me/assignments`,
            {
                method: 'GET',
                headers: getAuthHeaders()
            }
        );

        return handleResponse(
            res,
            'Không thể tải danh sách phân công của nhân viên.'
        );
    },

    async getBooking(id) {
        const res = await fetch(`${BASE_URL}/bookings/${id}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        return handleResponse(res, 'Không thể tải thông tin đơn hàng.');
    },

    async reschedulePendingBooking(id, scheduledStart) {
        const res = await fetch(`${BASE_URL}/bookings/${id}/schedule`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ scheduledStart })
        });
        return handleResponse(res, 'Unable to reschedule booking.');
    },

    async executeAction(id, payload) {
        const res = await fetch(`${BASE_URL}/bookings/${id}/actions`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        return handleResponse(res, 'Không thể thực hiện thao tác với đơn hàng.');
    },

    async executeCleanerAssignmentAction(assignmentId, action, note) {
        const res = await fetch(
            `${BASE_URL}/bookings/cleaner/assignments/${assignmentId}/actions/${action}`,
            {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ note })
            }
        );

        return handleResponse(
            res,
            'Không thể cập nhật trạng thái phân công của nhân viên.'
        );
    }
};

// =========================
// CLEANER NOTIFICATION API
// =========================
export const cleanerNotificationApi = {
    async getAll() {
        const res = await fetch(`${BASE_URL}/cleaner/notifications`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        return handleResponse(res, 'Không thể tải thông báo của nhân viên.');
    },

    async markRead(id) {
        const res = await fetch(`${BASE_URL}/cleaner/notifications/${encodeURIComponent(id)}/read`, {
            method: 'PATCH',
            headers: getAuthHeaders()
        });
        return handleResponse(res, 'Không thể đánh dấu thông báo đã đọc.');
    }
};

// =========================
// REFUND API - CN18
// =========================
export const refundApi = {
    // Khách hàng gửi yêu cầu hoàn tiền
    async requestRefund(bookingId, reason) {
        const res = await fetch(
            `${BASE_URL}/refunds/bookings/${bookingId}/request`,
            {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ reason })
            }
        );

        return handleResponse(res, 'Không thể gửi yêu cầu hoàn tiền.');
    },

    // Admin/Staff lấy danh sách yêu cầu hoàn tiền
    async getMyRefunds() {
        const res = await fetch(`${BASE_URL}/refunds/mine`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        const data = await handleResponse(res, 'Unable to load refund requests.');
        return Array.isArray(data) ? data : [];
    },

    async getAdminRefunds() {
        const res = await fetch(`${BASE_URL}/refunds/admin`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const data = await handleResponse(
            res,
            'Không thể tải danh sách yêu cầu hoàn tiền.'
        );

        return Array.isArray(data) ? data : [];
    },

    // Admin/Staff duyệt hoặc từ chối yêu cầu hoàn tiền
    async recordTransfer(id, payload) {
        const res = await fetch(`${BASE_URL}/refunds/${id}/transfer`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(res, 'Unable to record refund transfer.');
    },

    async reviewRefund(id, payload) {
        const res = await fetch(`${BASE_URL}/refunds/${id}/review`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        return handleResponse(res, 'Không thể xử lý yêu cầu hoàn tiền.');
    }
};

export const reviewApi = {
    async getServiceReviews(serviceId, page = 0, signal) {
        const res = await fetch(
            `${BASE_URL}/v1/services/${serviceId}/reviews?page=${page}`,
            {
                method: 'GET',
                headers: getAuthHeaders(),
                signal
            }
        );
        return handleResponse(res, 'Không thể tải bình luận.');
    },

    async createServiceReview(serviceId, payload) {
        const res = await fetch(`${BASE_URL}/v1/services/${serviceId}/reviews`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(res, 'Không thể gửi đánh giá.');
    },

    async deleteServiceReview(serviceId, reviewId) {
        const res = await fetch(
            `${BASE_URL}/v1/services/${serviceId}/reviews/${reviewId}`,
            {
                method: 'DELETE',
                headers: getAuthHeaders()
            }
        );
        if (!res.ok) {
            await handleResponse(res, 'Không thể xóa bình luận.');
        }
    }
};