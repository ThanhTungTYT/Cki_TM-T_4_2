
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import './service-detail.css';

const services = [
    {
        id: 1,
        name: 'Vệ sinh nhà ở định kỳ',
        provider: 'Công ty TNHH Vệ sinh CleanPro',
        rating: 4.9,
        reviews: 120,
        location: 'Quận 1, TP. HCM',
        price: 120000,
        priceUnit: 'giờ',
        type: 'Vệ sinh nhà ở',
        description:
            'Dịch vụ vệ sinh nhà ở định kỳ giúp không gian sống luôn sạch sẽ, gọn gàng. Nhân viên thực hiện vệ sinh phòng khách, phòng ngủ, nhà bếp và các khu vực sinh hoạt theo nhu cầu.',
        duration: '2–4 giờ',
        image: 'https://placehold.co/900x500/eaf2ff/2563eb?text=Ve+sinh+nha+o'
    },
    {
        id: 2,
        name: 'Tổng dọn dẹp nhà trọn gói',
        provider: 'CleanPro Việt Nam',
        rating: 4.8,
        reviews: 850,
        location: 'Quận 7, TP. HCM',
        price: 1200000,
        priceUnit: 'lần',
        type: 'Tổng vệ sinh',
        description:
            'Dịch vụ tổng vệ sinh nhà ở, hỗ trợ làm sạch nhiều khu vực trong nhà, phù hợp khi cần tổng dọn dẹp định kỳ hoặc trước những dịp đặc biệt.',
        duration: '3–6 giờ',
        image: 'https://placehold.co/900x500/eaf2ff/2563eb?text=Tong+ve+sinh'
    },
    {
        id: 3,
        name: 'Vệ sinh máy lạnh 1.5 HP',
        provider: 'Dịch vụ vệ sinh Hoàng',
        rating: 4.7,
        reviews: 620,
        location: 'Quận 3, TP. HCM',
        price: 180000,
        priceUnit: 'lần',
        type: 'Vệ sinh máy lạnh',
        description:
            'Dịch vụ vệ sinh máy lạnh giúp loại bỏ bụi bẩn tích tụ, làm sạch các bộ phận có thể tiếp cận và hỗ trợ thiết bị hoạt động ổn định hơn.',
        duration: '45–60 phút',
        image: 'https://placehold.co/900x500/eaf2ff/2563eb?text=Ve+sinh+may+lanh'
    }
];

function ServiceDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const service = services.find(
        (item) => item.id === Number(id)
    );

    if (!service) {
        return (
            <div className="detail-page">
                <Header />

                <div className="detail-not-found">
                    <h2>Không tìm thấy dịch vụ</h2>
                    <button onClick={() => navigate('/services')}>
                        Quay lại danh sách dịch vụ
                    </button>
                </div>

                <Footer />
            </div>
        );
    }

    return (
        <div className="detail-page">
            <Header />

            <div className="detail-breadcrumb">
                <span onClick={() => navigate('/')}>
                    Trang chủ
                </span>
                {' › '}
                <span onClick={() => navigate('/services')}>
                    Dịch vụ
                </span>
                {' › '}
                <strong>{service.name}</strong>
            </div>

            <main className="detail-container">
                <section className="detail-main">
                    <img
                        className="detail-image"
                        src={service.image}
                        alt={service.name}
                    />

                    <div className="detail-information">
                        <span className="detail-category">
                            {service.type}
                        </span>

                        <h1>{service.name}</h1>

                        <p className="detail-provider">
                            Đơn vị cung cấp: {service.provider}
                        </p>

                        <div className="detail-rating">
                            <span>
                                ⭐ {service.rating} ({service.reviews} đánh giá)
                            </span>
                            <span>
                                📍 {service.location}
                            </span>
                        </div>

                        <hr />

                        <h2>Mô tả dịch vụ</h2>
                        <p className="detail-description">
                            {service.description}
                        </p>

                        <h2>Thông tin dịch vụ</h2>

                        <div className="detail-specifications">
                            <div>
                                <span>Loại dịch vụ</span>
                                <strong>{service.type}</strong>
                            </div>

                            <div>
                                <span>Thời gian dự kiến</span>
                                <strong>{service.duration}</strong>
                            </div>

                            <div>
                                <span>Khu vực</span>
                                <strong>{service.location}</strong>
                            </div>
                        </div>
                    </div>
                </section>

                <aside className="detail-booking">
                    <span className="detail-price-label">
                        Giá dịch vụ
                    </span>

                    <div className="detail-price">
                        {service.price.toLocaleString('vi-VN')}đ
                        <small>/{service.priceUnit}</small>
                    </div>

                    <p className="detail-note">
                        Giá tham khảo, có thể thay đổi theo nhu cầu thực tế.
                    </p>

                    <button
                        className="detail-book-button"
                        onClick={() =>
                            alert('Chức năng đặt dịch vụ sẽ được bổ sung sau.')
                        }
                    >
                        Đặt dịch vụ
                    </button>

                    <button
                        className="detail-contact-button"
                        onClick={() =>
                            alert('Chức năng liên hệ sẽ được bổ sung sau.')
                        }
                    >
                        Liên hệ nhà cung cấp
                    </button>
                </aside>
            </main>

            <Footer />
        </div>
    );
}

export default ServiceDetail;
