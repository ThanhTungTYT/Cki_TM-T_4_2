
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Home from './pages/home';
import Rewards from './pages/rewards';
import Login from './pages/login';
import Register from './pages/register';
import Services from './pages/services';
import ServiceDetail from './pages/service-detail';
import Provider from './pages/provider';
import Providers from './pages/providers';
import Profile from './pages/profile';
import VerifyOtp from './pages/verify-otp';
import Cart from './pages/cart';
import Checkout from './pages/checkout';
import CustomerBookings from './pages/customer-bookings';
import CustomerBookingHistory from './pages/customer-booking-history';
import CustomerReports from './pages/customer-reports';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminAccounts from './pages/admin/AdminAccounts';
import AdminServices from './pages/admin/AdminServices';
import AdminProviders from './pages/admin/AdminProviders';
import AdminOrders from './pages/admin/AdminOrders';
import AdminTransactions from './pages/admin/AdminTransactions';
import AdminProviderSettlements from './pages/admin/AdminProviderSettlements';
import AdminProviderServiceApprovals from './pages/admin/AdminProviderServiceApprovals';
import AdminComplaintManagement from './pages/admin/AdminComplaintManagement';
import ForgotPassword from './pages/forgot-password';
import AdminRefundManagement from './pages/admin/AdminRefundManagement';
import AdminProviderChangeRequests from './pages/admin/AdminProviderChangeRequests';
import AdminPromotions from './pages/admin/AdminPromotions';
import AdminStaffOperations from './pages/admin/AdminStaffOperations';
import AdminOutboxManagement from './pages/admin/AdminOutboxManagement';
import AdminRewardOrders from './pages/admin/AdminRewardOrders';
import PaymentResult from './pages/PaymentResult';
import ProviderLayout from './pages/provider-portal/ProviderLayout';
import ProviderDashboard from './pages/provider-portal/ProviderDashboard';
import ProviderBookings from './pages/provider-portal/ProviderBookings';
import ProviderBookingDetail from './pages/provider-portal/ProviderBookingDetail';
import ProviderEmployees from './pages/provider-portal/ProviderEmployees';
import ProviderSchedule from './pages/provider-portal/ProviderSchedule';
import ProviderServices from './pages/provider-portal/ProviderServices';
import ProviderComplaints from './pages/provider-portal/ProviderComplaints';
import ProviderRevenue from './pages/provider-portal/ProviderRevenue';
import ProviderReviews from './pages/provider-portal/ProviderReviews';
import CleanerLayout from './pages/cleaner-portal/CleanerLayout';
import CleanerDashboard from './pages/cleaner-portal/CleanerDashboard';
import CleanerPlaceholder from './pages/cleaner-portal/CleanerPlaceholder';
import CleanerCalendar from './pages/cleaner-portal/CleanerCalendar';
import CleanerHistory from './pages/cleaner-portal/CleanerHistory';
import CleanerNotifications from './pages/cleaner-portal/CleanerNotifications';
import CleanerJobs from './pages/cleaner-portal/CleanerJobs';
import CleanerProfile from './pages/cleaner-portal/CleanerProfile';
import ProtectedRoute from './components/ProtectedRoute';

function AuthSessionExpiryHandler() {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const onExpired = event => {
            navigate('/login', {
                replace: true,
                state: {
                    from: location,
                    reason: event.detail?.reason || 'expired'
                }
            });
        };

        window.addEventListener('cleanmate:auth-expired', onExpired);

        return () => {
            window.removeEventListener('cleanmate:auth-expired', onExpired);
        };
    }, [location, navigate]);

    return null;
}

function HomeRoute() {
    let user = {};

    try {
        user = JSON.parse(
            sessionStorage.getItem('user') ||
            localStorage.getItem('user') ||
            '{}'
        );
    } catch {
        user = {};
    }

    const role = String(user.role || '')
        .trim()
        .toUpperCase()
        .replace(/^ROLE_/, '');

    if (role === 'CLEANER' || role === 'EMPLOYEE') {
        return <Navigate to="/cleaner/dashboard" replace />;
    }

    if (role === 'STAFF') {
        return <Navigate to="/admin/staff-operations" replace />;
    }

    return <Home />;
}

function AdminOnly({ children }) {
    return (
        <ProtectedRoute roles={['ADMIN']}>
            {children}
        </ProtectedRoute>
    );
}

function AdminAndStaff({ children }) {
    return (
        <ProtectedRoute roles={['ADMIN', 'STAFF']}>
            {children}
        </ProtectedRoute>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AuthSessionExpiryHandler />

            <Routes>
                <Route path="/" element={<HomeRoute />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/services" element={<Services />} />
                <Route path="/service-detail/:id" element={<ServiceDetail />} />
                <Route path="/provider/:id" element={<Provider />} />
                <Route path="/providers" element={<Providers />} />
                <Route path="/rewards" element={<Rewards />} />
                <Route path="/cart" element={<Cart />} />

                <Route
                    path="/checkout"
                    element={
                        <ProtectedRoute>
                            <Checkout />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/profile"
                    element={
                        <ProtectedRoute roles={['*']}>
                            <Profile />
                        </ProtectedRoute>
                    }
                />

                <Route path="/verify-otp" element={<VerifyOtp />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/payment-result" element={<PaymentResult />} />

                <Route
                    path="/customer/bookings"
                    element={
                        <ProtectedRoute roles={['CUSTOMER']}>
                            <CustomerBookings />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/customer/bookings/history"
                    element={
                        <ProtectedRoute roles={['CUSTOMER']}>
                            <CustomerBookingHistory />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/customer/reports"
                    element={
                        <ProtectedRoute roles={['CUSTOMER']}>
                            <CustomerReports />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/admin"
                    element={
                        <AdminOnly>
                            <AdminDashboard />
                        </AdminOnly>
                    }
                />

                <Route
                    path="/admin/accounts"
                    element={
                        <AdminOnly>
                            <AdminAccounts />
                        </AdminOnly>
                    }
                />

                <Route
                    path="/admin/services"
                    element={
                        <AdminOnly>
                            <AdminServices />
                        </AdminOnly>
                    }
                />

                <Route
                    path="/admin/providers"
                    element={
                        <AdminOnly>
                            <AdminProviders />
                        </AdminOnly>
                    }
                />

                <Route
                    path="/admin/provider-requests"
                    element={
                        <AdminOnly>
                            <AdminProviderChangeRequests />
                        </AdminOnly>
                    }
                />

                <Route
                    path="/admin/orders"
                    element={
                        <AdminOnly>
                            <AdminOrders />
                        </AdminOnly>
                    }
                />

                <Route
                    path="/admin/transactions"
                    element={
                        <AdminOnly>
                            <AdminTransactions />
                        </AdminOnly>
                    }
                />

                <Route
                    path="/admin/provider-settlements"
                    element={
                        <AdminOnly>
                            <AdminProviderSettlements />
                        </AdminOnly>
                    }
                />

                <Route
                    path="/admin/provider-service-approvals"
                    element={
                        <AdminOnly>
                            <AdminProviderServiceApprovals />
                        </AdminOnly>
                    }
                />

                <Route
                    path="/admin/complaints"
                    element={
                        <AdminAndStaff>
                            <AdminComplaintManagement />
                        </AdminAndStaff>
                    }
                />

                <Route
                    path="/admin/refunds"
                    element={
                        <AdminOnly>
                            <AdminRefundManagement />
                        </AdminOnly>
                    }
                />

                <Route
                    path="/admin/promotions"
                    element={
                        <AdminOnly>
                            <AdminPromotions />
                        </AdminOnly>
                    }
                />

                <Route
                    path="/admin/reward-orders"
                    element={
                        <AdminAndStaff>
                            <AdminRewardOrders />
                        </AdminAndStaff>
                    }
                />

                <Route
                    path="/admin/staff-operations"
                    element={
                        <AdminAndStaff>
                            <AdminStaffOperations />
                        </AdminAndStaff>
                    }
                />

                <Route
                    path="/admin/outbox"
                    element={
                        <AdminOnly>
                            <AdminOutboxManagement />
                        </AdminOnly>
                    }
                />

                <Route path="/cleaner" element={<CleanerLayout />}>
                    <Route
                        index
                        element={<Navigate to="dashboard" replace />}
                    />
                    <Route path="dashboard" element={<CleanerDashboard />} />
                    <Route path="jobs" element={<CleanerJobs />} />
                    <Route path="calendar" element={<CleanerCalendar />} />
                    <Route path="history" element={<CleanerHistory />} />
                    <Route
                        path="notifications"
                        element={<CleanerNotifications />}
                    />
                    <Route path="profile" element={<CleanerProfile />} />
                    <Route path="*" element={<CleanerPlaceholder />} />
                </Route>

                <Route path="/provider-portal" element={<ProviderLayout />}>
                    <Route
                        index
                        element={<Navigate to="dashboard" replace />}
                    />
                    <Route
                        path="dashboard"
                        element={<ProviderDashboard />}
                    />
                    <Route
                        path="bookings"
                        element={<ProviderBookings />}
                    />
                    <Route
                        path="bookings/:id"
                        element={<ProviderBookingDetail />}
                    />
                    <Route
                        path="services"
                        element={<ProviderServices />}
                    />
                    <Route
                        path="employees"
                        element={<ProviderEmployees />}
                    />
                    <Route
                        path="schedule"
                        element={<ProviderSchedule />}
                    />
                    <Route
                        path="complaints"
                        element={<ProviderComplaints />}
                    />
                    <Route
                        path="revenue"
                        element={<ProviderRevenue />}
                    />
                    <Route
                        path="reviews"
                        element={<ProviderReviews />}
                    />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
