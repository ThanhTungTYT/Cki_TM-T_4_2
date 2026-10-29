import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/home';
import Login from './pages/login';
import Register from './pages/register';
import Services from './pages/services';
import ServiceDetail from './pages/service-detail';
import Provider from './pages/provider';
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
import AdminComplaintManagement from './pages/admin/AdminComplaintManagement';
import ForgotPassword from './pages/forgot-password';
import AdminRefundManagement from './pages/admin/AdminRefundManagement';
import PaymentResult from './pages/PaymentResult';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/services" element={<Services />} />
                <Route path="/service-detail/:id" element={<ServiceDetail />} />
                <Route path="/provider/:id" element={<Provider />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/verify-otp" element={<VerifyOtp />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/payment-result" element={<PaymentResult />} />

                <Route path="/customer/bookings" element={<CustomerBookings />} />
                <Route path="/customer/bookings/history" element={<CustomerBookingHistory />} />
                <Route path="/customer/reports" element={<CustomerReports />} />

                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/accounts" element={<AdminAccounts />} />
                <Route path="/admin/services" element={<AdminServices />} />
                <Route path="/admin/providers" element={<AdminProviders />} />
                <Route path="/admin/orders" element={<AdminOrders />} />
                <Route path="/admin/transactions" element={<AdminTransactions />} />
                <Route path="/admin/complaints" element={<AdminComplaintManagement />} />
                <Route path="/admin/refunds" element={<AdminRefundManagement />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;