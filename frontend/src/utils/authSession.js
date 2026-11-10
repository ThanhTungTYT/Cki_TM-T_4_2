export function clearStoredAuth() {
    for (const key of ['accessToken', 'user', 'token']) {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
    }
}

export function expireStoredAuth(reason = 'expired') {
    clearStoredAuth();
    window.dispatchEvent(new CustomEvent('cleanmate:auth-expired', { detail: { reason } }));
}
