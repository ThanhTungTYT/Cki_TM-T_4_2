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


function App() {
    return (
        <BrowserRouter>
            <Routes>
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

                {/* Trang chi tiết nhà cung cấp */}
                <Route path="/provider/:id" element={<Provider />} />

                {/* Trang Quản lý Hồ sơ cá nhân */}
                <Route path="/profile" element={<Profile />} />

                <Route path="/verify-otp" element={<VerifyOtp />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;