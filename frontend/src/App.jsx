import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from "./pages/home";
import Login from "./pages/login";
import Register from "./pages/register";
import Services from "./pages/services";
import Provider from "./pages/provider";
import Profile from "./pages/Profile";


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

                {/* Trang chi tiết nhà cung cấp */}
                <Route path="/provider/:id" element={<Provider />} />

                {/* Trang Quản lý Hồ sơ cá nhân */}
                <Route path="/profile" element={<Profile />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;