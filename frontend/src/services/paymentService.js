const getToken = () => {
    return sessionStorage.getItem('accessToken')
        || localStorage.getItem('accessToken');
};

export const createVNPayPayment = async (bookingId) => {
    const token = getToken();

    if (!token) {
        throw new Error('Vui lòng đăng nhập trước khi thanh toán');
    }

    const response = await fetch('/api/payments/vnpay/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ bookingId })
    });

    if (!response.ok) {
        throw new Error('Không thể tạo giao dịch VNPay');
    }

    return response.json();
};

export const getVNPayStatus = async (txnRef) => {
    const token = getToken();

    if (!token) {
        throw new Error('Vui lòng đăng nhập để kiểm tra thanh toán');
    }

    const response = await fetch(
        `/api/payments/vnpay/status/${encodeURIComponent(txnRef)}`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    if (!response.ok) {
        throw new Error('Không thể kiểm tra trạng thái thanh toán');
    }

    return response.json();
};