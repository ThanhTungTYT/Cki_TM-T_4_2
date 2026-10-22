const BASE_URL = 'http://localhost:8080/api';

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

    async getBooking(id) {
        const res = await fetch(`${BASE_URL}/bookings/${id}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        return handleResponse(res, 'Không thể tải thông tin đơn hàng.');
    },

    async executeAction(id, payload) {
        const res = await fetch(`${BASE_URL}/bookings/${id}/actions`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        return handleResponse(res, 'Không thể thực hiện thao tác với đơn hàng.');
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
    async reviewRefund(id, payload) {
        const res = await fetch(`${BASE_URL}/refunds/${id}/review`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        return handleResponse(res, 'Không thể xử lý yêu cầu hoàn tiền.');
    }
};