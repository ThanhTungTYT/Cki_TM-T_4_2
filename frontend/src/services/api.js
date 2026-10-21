
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

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(
                data.message ||
                data.detail ||
                data.error ||
                'Không thể gửi yêu cầu hoàn tiền.'
            );
        }

        return data;
    },

    // Admin/Staff lấy danh sách yêu cầu hoàn tiền
    async getAdminRefunds() {
        const res = await fetch(`${BASE_URL}/refunds/admin`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(
                data.message ||
                data.detail ||
                data.error ||
                'Không thể tải danh sách yêu cầu hoàn tiền.'
            );
        }

        return Array.isArray(data) ? data : [];
    },

    // Admin/Staff duyệt hoặc từ chối yêu cầu
    async reviewRefund(id, payload) {
        const res = await fetch(
            `${BASE_URL}/refunds/${id}/review`,
            {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(
                data.message ||
                data.detail ||
                data.error ||
                'Không thể xử lý yêu cầu hoàn tiền.'
            );
        }

        return data;
    }
};
