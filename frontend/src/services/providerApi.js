// =========================================================
// PROVIDER PORTAL API — F01 Cổng thông tin Đối tác
// Base URL: /api/provider
// =========================================================

const BASE_URL = 'http://localhost:8080/api';

function getAuthHeaders(extra = {}) {
    const token =
        sessionStorage.getItem('accessToken') ||
        localStorage.getItem('accessToken');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extra,
    };
}

async function handleResponse(res, defaultMsg = 'Có lỗi xảy ra.') {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || data.detail || data.error || defaultMsg);
    }
    return data;
}

// ---------- Dashboard ----------
export const providerDashboardApi = {
    async get() {
        const res = await fetch(`${BASE_URL}/provider/dashboard`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể tải tổng quan.');
    },
};

// ---------- Bookings ----------
export const providerBookingApi = {
    async list() {
        const res = await fetch(`${BASE_URL}/provider/bookings`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể tải danh sách đơn hàng.');
    },

    async get(id) {
        const res = await fetch(`${BASE_URL}/provider/bookings/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể tải chi tiết đơn hàng.');
    },

    async accept(id) {
        const res = await fetch(
            `${BASE_URL}/provider/bookings/${id}/actions/accept`,
            {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'ACCEPT' }),
            }
        );
        return handleResponse(res, 'Không thể chấp nhận đơn hàng.');
    },

    async reject(id, reason) {
        const res = await fetch(
            `${BASE_URL}/provider/bookings/${id}/actions/reject`,
            {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'REJECT', reason }),
            }
        );
        return handleResponse(res, 'Không thể từ chối đơn hàng.');
    },

    // Phân công nhân viên
    async getAssignments(bookingId) {
        const res = await fetch(
            `${BASE_URL}/provider/bookings/${bookingId}/assignments`,
            { headers: getAuthHeaders() }
        );
        return handleResponse(res, 'Không thể tải phân công.');
    },

    async assign(bookingId, employeeId, note = '') {
        const res = await fetch(
            `${BASE_URL}/provider/bookings/${bookingId}/assignments`,
            {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ employeeId, note }),
            }
        );
        return handleResponse(res, 'Không thể phân công nhân viên.');
    },

    async removeAssignment(bookingId, assignmentId) {
        const res = await fetch(
            `${BASE_URL}/provider/bookings/${bookingId}/assignments/${assignmentId}`,
            {
                method: 'DELETE',
                headers: getAuthHeaders(),
            }
        );
        return handleResponse(res, 'Không thể xóa phân công.');
    },
};

// ---------- Employees ----------
export const providerEmployeeApi = {
    async list() {
        const res = await fetch(`${BASE_URL}/provider/employees`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể tải danh sách nhân viên.');
    },

    async create(payload) {
        const res = await fetch(`${BASE_URL}/provider/employees`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(res, 'Không thể tạo nhân viên.');
    },

    async updateStatus(id, status) {
        const res = await fetch(`${BASE_URL}/provider/employees/${id}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status }),
        });
        return handleResponse(res, 'Không thể cập nhật trạng thái nhân viên.');
    },
};

// ---------- Schedule ----------
export const providerScheduleApi = {
    async get(fromDate, toDate) {
        const params = new URLSearchParams();
        if (fromDate) params.set('fromDate', fromDate);
        if (toDate) params.set('toDate', toDate);
        const res = await fetch(`${BASE_URL}/provider/schedule?${params}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể tải lịch làm việc.');
    },
};

// ---------- Revenue / Earnings ----------
export const providerRevenueApi = {
    async get(fromDate, toDate) {
        const params = new URLSearchParams();
        if (fromDate) params.set('fromDate', fromDate);
        if (toDate) params.set('toDate', toDate);
        const res = await fetch(`${BASE_URL}/provider/earnings?${params}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể tải doanh thu.');
    },
};
