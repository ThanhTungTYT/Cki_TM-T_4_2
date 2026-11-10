import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { clearStoredAuth } from '../utils/authSession';

function readStoredValue(key) {
    return sessionStorage.getItem(key) || localStorage.getItem(key);
}

function tokenClaims(token) {
    try {
        const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    } catch {
        return null;
    }
}

function normalizeRole(role) {
    return String(role || '').trim().toUpperCase().replace(/^ROLE_/, '');
}

export default function ProtectedRoute({ children, roles = ['CUSTOMER'] }) {
    const location = useLocation();
    const [checkedAt, setCheckedAt] = useState(Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setCheckedAt(Date.now()), 15_000);
        return () => window.clearInterval(timer);
    }, []);
    const token = readStoredValue('accessToken');
    const claims = token ? tokenClaims(token) : null;
    const expired = claims?.exp && Number(claims.exp) * 1000 <= checkedAt;

    if (!token || !claims || expired) {
        clearStoredAuth();
        const reason = expired ? 'expired' : token ? 'invalid' : 'login-required';
        return <Navigate to="/login" replace state={{ from: location, reason }} />;
    }

    let user = {};
    try {
        user = JSON.parse(readStoredValue('user') || '{}');
    } catch {
        user = {};
    }

    const role = normalizeRole(user.role || claims?.role);
    if (!roles.includes('*') && !roles.map(normalizeRole).includes(role)) {
        return <Navigate to="/" replace state={{ reason: 'role-not-authorized' }} />;
    }

    return children;
}
