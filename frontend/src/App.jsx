import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from "./pages/home";
import Login from "./pages/login";
import Register from "./pages/register";
import Services from "./pages/services";
import ServiceDetail from "./pages/service-detail";
import Provider from "./pages/provider";
import Profile from "./pages/Profile";
import VerifyOtp from "./pages/verify-otp";
import Cart from "./pages/cart";
import Checkout from "./pages/checkout";
import CustomerBookings from "./pages/customer-bookings";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAccounts from "./pages/admin/AdminAccounts";
import AdminServices from "./pages/admin/AdminServices";
import AdminProviders from "./pages/admin/AdminProviders";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminTransactions from "./pages/admin/AdminTransactions";
import AdminReports from "./pages/admin/AdminReports";
import ForgotPassword from "./pages/forgot-password";
import AdminRefundManagement from './components/AdminRefundManagement';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Trang tổng quan Admin - CN10, CN11 */}
                <Route path="/admin" element={<AdminDashboard />} />

                {/* Trang Quản lý tài khoản - CN12 */}
                <Route path="/admin/accounts" element={<AdminAccounts />} />

                {/* Trang Quản lý dịch vụ Admin */}
                <Route path="/admin/services" element={<AdminServices />} />

                <Route path="/admin/providers" element={<AdminProviders />} />
                <Route path="/admin/orders" element={<AdminOrders />} />
                <Route path="/admin/transactions" element={<AdminTransactions />} />
                <Route path="/admin/reports" element={<AdminReports />} />

                {/* Trang chủ */}
                <Route path="/" element={<Home />} />

                {/* Trang Đăng nhập */}
                <Route path="/login" element={<Login />} />

                {/* Trang Đăng ký */}
                <Route path="/register" element={<Register />} />

                {/* Trang Dịch vụ */}
                <Route path="/services" element={<Services />} />
                {/* Trang chi tiết dịch vụ */}
                <Route path="/service-detail/:id" element={<ServiceDetail />} />

                {/* Trang Giỏ dịch vụ */}
                <Route path="/cart" element={<Cart />} />

                {/* Trang Đặt lịch & Xác nhận (CN07) */}
                <Route path="/checkout" element={<Checkout />} />

                {/* Trang Theo dõi đơn & State Machine (CN17) */}
                <Route path="/customer/bookings" element={<CustomerBookings />} />

                {/* Trang chi tiết nhà cung cấp */}
                <Route path="/provider/:id" element={<Provider />} />

                {/* Trang Quản lý Hồ sơ cá nhân */}
                <Route path="/profile" element={<Profile />} />

                <Route path="/verify-otp" element={<VerifyOtp />} />

                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route
                    path="/admin/refunds"
                    element={<AdminRefundManagement />}
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;