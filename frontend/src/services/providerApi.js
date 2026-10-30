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
    async get(fromDate, toDate) {
        const params = new URLSearchParams();
        if (fromDate) params.set('fromDate', fromDate);
        if (toDate) params.set('toDate', toDate);
        const query = params.toString() ? `?${params.toString()}` : '';
        const res = await fetch(`${BASE_URL}/provider/dashboard${query}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể tải tổng quan.');
    },
};

// ---------- Profile ----------
export const providerProfileApi = {
    async get() {
        const res = await fetch(`${BASE_URL}/provider/profile`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể tải hồ sơ doanh nghiệp.');
    },
};

// ---------- Change Requests (Yêu cầu thay đổi thông tin/vị trí) ----------
export const providerChangeRequestApi = {
    async list() {
        const res = await fetch(`${BASE_URL}/provider/change-requests`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể tải danh sách yêu cầu thay đổi.');
    },

    async create(payload) {
        const res = await fetch(`${BASE_URL}/provider/change-requests`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(res, 'Không thể gửi yêu cầu thay đổi.');
    },

    async withdraw(id) {
        const res = await fetch(`${BASE_URL}/provider/change-requests/${id}/withdraw`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể rút yêu cầu thay đổi.');
    },
};

// ---------- Services Management & Catalog ----------
export const providerServicesApi = {
    async list() {
        const res = await fetch(`${BASE_URL}/provider/services`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể tải danh sách dịch vụ đang cung cấp.');
    },

    async getCatalog() {
        const res = await fetch(`${BASE_URL}/provider/services/catalog`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể tải danh mục dịch vụ sàn.');
    },

    async requestService(payload) {
        const res = await fetch(`${BASE_URL}/provider/service-requests`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(res, 'Không thể gửi đề nghị dịch vụ.');
    },

    async pause(id) {
        const res = await fetch(`${BASE_URL}/provider/services/${id}/pause`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể tạm dừng dịch vụ.');
    },

    async resume(id) {
        const res = await fetch(`${BASE_URL}/provider/services/${id}/resume`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể kích hoạt lại dịch vụ.');
    },
};

// ---------- Complaints (Khiếu nại) ----------
export const providerComplaintsApi = {
    async list() {
        const res = await fetch(`${BASE_URL}/provider/complaints`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể tải danh sách khiếu nại.');
    },

    async get(id) {
        const res = await fetch(`${BASE_URL}/provider/complaints/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể tải chi tiết khiếu nại.');
    },

    async respond(id, payload) {
        const res = await fetch(`${BASE_URL}/provider/complaints/${id}/responses`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(res, 'Không thể gửi phản hồi giải trình.');
    },
};

// ---------- Admin Provider Change Requests Review ----------
export const adminProviderChangeRequestApi = {
    async list(status) {
        const query = status ? `?status=${encodeURIComponent(status)}` : '';
        const res = await fetch(`${BASE_URL}/admin/provider-change-requests${query}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể tải danh sách yêu cầu chờ duyệt.');
    },

    async get(id) {
        const res = await fetch(`${BASE_URL}/admin/provider-change-requests/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể tải chi tiết yêu cầu.');
    },

    async approve(id) {
        const res = await fetch(`${BASE_URL}/admin/provider-change-requests/${id}/approve`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        return handleResponse(res, 'Không thể phê duyệt yêu cầu.');
    },

    async reject(id, rejectReason) {
        const res = await fetch(`${BASE_URL}/admin/provider-change-requests/${id}/reject`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ rejectReason }),
        });
        return handleResponse(res, 'Không thể từ chối yêu cầu.');
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
