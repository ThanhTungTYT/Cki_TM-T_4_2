const BASE_URL = 'http://localhost:8080/api';

function getAuthHeaders(extraHeaders = {}) {
    const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
    const headers = {
        'Content-Type': 'application/json',
        ...extraHeaders
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

export const cartApi = {
    async getCart() {
        const res = await fetch(`${BASE_URL}/cart`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error((await res.json()).message || 'Không thể lấy giỏ hàng');
        return res.json();
    },

    async addToCart(itemData) {
        const res = await fetch(`${BASE_URL}/cart/items`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(itemData)
        });
        if (!res.ok) throw new Error((await res.json()).message || 'Không thể thêm vào giỏ hàng');
        return res.json();
    },

    async updateItem(itemId, updateData) {
        const res = await fetch(`${BASE_URL}/cart/items/${itemId}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(updateData)
        });
        if (!res.ok) throw new Error((await res.json()).message || 'Không thể cập nhật mục');
        return res.json();
    },

    async removeItem(itemId) {
        const res = await fetch(`${BASE_URL}/cart/items/${itemId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error((await res.json()).message || 'Không thể xóa mục');
        return res.json();
    },

    async clearCart(partnerId = null) {
        const url = partnerId ? `${BASE_URL}/cart?partnerId=${partnerId}` : `${BASE_URL}/cart`;
        const res = await fetch(url, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error((await res.json()).message || 'Không thể làm sạch giỏ hàng');
        return res.json();
    }
};

export const bookingApi = {
    async getQuote(quoteRequest) {
        const res = await fetch(`${BASE_URL}/bookings/quote`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(quoteRequest)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Không thể tính toán báo giá' }));
            throw new Error(err.message || 'Không thể tính toán báo giá');
        }
        return res.json();
    },

    async createBooking(bookingRequest, idempotencyKey) {
        const headers = getAuthHeaders();
        if (idempotencyKey) {
            headers['Idempotency-Key'] = idempotencyKey;
        }
        const res = await fetch(`${BASE_URL}/bookings`, {
            method: 'POST',
            headers,
            body: JSON.stringify(bookingRequest)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Đặt lịch không thành công' }));
            throw new Error(err.message || 'Đặt lịch không thành công');
        }
        return res.json();
    },

    async getMyBookings() {
        const res = await fetch(`${BASE_URL}/bookings/me`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Không thể tải danh sách đơn hàng' }));
            throw new Error(err.message || 'Không thể tải danh sách đơn hàng');
        }
        return res.json();
    },

    async getBooking(id) {
        const res = await fetch(`${BASE_URL}/bookings/${id}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Không thể tải thông tin đơn hàng' }));
            throw new Error(err.message || 'Không thể tải thông tin đơn hàng');
        }
        return res.json();
    },

    async executeAction(id, action, note = '', version = null) {
        const actionSlug = action.toLowerCase().replace(/_/g, '-');
        const res = await fetch(`${BASE_URL}/bookings/${id}/actions/${actionSlug}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                action,
                note,
                version
            })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Không thể thực hiện hành động này' }));
            throw new Error(err.message || 'Không thể thực hiện hành động này');
        }
        return res.json();
    }
};
