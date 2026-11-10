async function request(path, options = {}) {
    const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
    const response = await fetch(`/api/rewards${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.detail || data.message || (response.status === 401 || response.status === 403 ? 'Vui lòng đăng nhập bằng tài khoản khách hàng.' : 'Không thể xử lý yêu cầu Ccoin. Vui lòng thử lại.'));
        error.status = response.status;
        throw error;
    }
    return data;
}

export const rewardApi = {
    wallet: () => request('/me'),
    vouchers: () => request('/vouchers'),
    gifts: () => request('/gifts'),
    history: () => request('/redemptions'),
    redeem: body => request('/redemptions', { method: 'POST', body: JSON.stringify(body) }),
    confirmReceived: id => request(`/redemptions/${id}/received`, { method: 'POST' }),
    cancelRedemption: id => request(`/redemptions/${id}/cancel`, { method: 'POST' }),
    updateRedemptionAddress: (id, address) => request(`/redemptions/${id}/address`, {
        method: 'PATCH', body: JSON.stringify({ address })
    })
};
