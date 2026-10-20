
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import './service-detail.css';

const services = [
    {
        id: 1,
        name: 'Vệ sinh nhà ở định kỳ',
        provider: 'Công ty TNHH Vệ sinh CleanPro',
        providerId: 1,
        rating: 4.9,
        reviews: 120,
        location: 'Quận 1, TP. HCM',
        price: 120000,
        priceUnit: 'giờ',
        type: 'Vệ sinh nhà ở',
        description:
            'Dịch vụ vệ sinh nhà ở định kỳ giúp không gian sống luôn sạch sẽ, gọn gàng. Nhân viên hỗ trợ vệ sinh phòng khách, phòng ngủ, nhà bếp và các khu vực sinh hoạt theo nhu cầu.',
        duration: '2–4 giờ',
        image: 'https://placehold.co/900x500/eaf2ff/2563eb?text=Ve+sinh+nha+o',
        includes: [
            'Lau dọn phòng khách và phòng ngủ',
            'Vệ sinh nhà bếp và các bề mặt',
            'Quét và lau sàn nhà',
            'Sắp xếp đồ đạc cơ bản'
        ],
        excludes: [
            'Vệ sinh ngoài trời ở độ cao nguy hiểm',
            'Dịch vụ sửa chữa thiết bị',
            'Công việc ngoài phạm vi đã thống nhất'
        ]
    },
    {
        id: 2,
        name: 'Tổng dọn dẹp nhà trọn gói',
        provider: 'CleanPro Việt Nam',
        providerId: 2,
        rating: 4.8,
        reviews: 850,
        location: 'Quận 7, TP. HCM',
        price: 1200000,
        priceUnit: 'lần',
        type: 'Tổng vệ sinh',
        description:
            'Dịch vụ tổng vệ sinh nhà ở, hỗ trợ làm sạch nhiều khu vực trong nhà. Phù hợp khi cần tổng dọn dẹp định kỳ, trước khi chuyển nhà hoặc trước những dịp đặc biệt.',
        duration: '3–6 giờ',
        image: 'https://placehold.co/900x500/eaf2ff/2563eb?text=Tong+ve+sinh',
        includes: [
            'Vệ sinh phòng khách và phòng ngủ',
            'Vệ sinh nhà bếp và nhà vệ sinh',
            'Lau sàn và các bề mặt dễ tiếp cận',
            'Thu gom rác vệ sinh thông thường'
        ],
        excludes: [
            'Vận chuyển đồ đạc cồng kềnh',
            'Sửa chữa hoặc lắp đặt thiết bị',
            'Vệ sinh chuyên dụng ngoài thỏa thuận'
        ]
    },
    {
        id: 3,
        name: 'Vệ sinh máy lạnh 1.5 HP',
        provider: 'Dịch vụ vệ sinh Hoàng Gia',
        providerId: 3,
        rating: 4.7,
        reviews: 620,
        location: 'Quận 3, TP. HCM',
        price: 180000,
        priceUnit: 'lần',
        type: 'Vệ sinh máy lạnh',
        description:
            'Dịch vụ vệ sinh máy lạnh giúp loại bỏ bụi bẩn tích tụ, làm sạch các bộ phận có thể tiếp cận và hỗ trợ thiết bị hoạt động ổn định hơn.',
        duration: '45–60 phút',
        image: 'https://placehold.co/900x500/eaf2ff/2563eb?text=Ve+sinh+may+lanh',
        includes: [
            'Kiểm tra tình trạng thiết bị bên ngoài',
            'Vệ sinh lưới lọc và các bộ phận phù hợp',
            'Vệ sinh khu vực thi công',
            'Kiểm tra hoạt động cơ bản sau vệ sinh'
        ],
        excludes: [
            'Thay thế linh kiện',
            'Sửa chữa lỗi kỹ thuật',
            'Nạp gas nếu chưa được báo giá và thống nhất'
        ]
    },
    {
        id: 4,
        name: 'Giặt sấy sofa nệm bằng hơi nước',
        provider: 'Vệ sinh Xanh Sài Gòn',
        providerId: 4,
        rating: 4.6,
        reviews: 340,
        location: 'Bình Thạnh, TP. HCM',
        price: 300000,
        priceUnit: 'lần',
        type: 'Vệ sinh sofa/nệm',
        description:
            'Dịch vụ vệ sinh sofa và nệm nhằm loại bỏ bụi bẩn trên bề mặt, hỗ trợ làm sạch khu vực sử dụng thường xuyên. Phương pháp thực hiện tùy thuộc vào chất liệu và tình trạng sản phẩm.',
        duration: '1–2 giờ',
        image: 'https://placehold.co/900x500/eaf2ff/2563eb?text=Giat+sofa+nem',
        includes: [
            'Kiểm tra chất liệu trước khi vệ sinh',
            'Làm sạch bề mặt phù hợp với chất liệu',
            'Vệ sinh khu vực sau khi thi công'
        ],
        excludes: [
            'Cam kết loại bỏ hoàn toàn mọi vết bẩn lâu ngày',
            'Sửa chữa sofa hoặc nệm',
            'Xử lý chuyên dụng chưa được báo giá'
        ]
    },
    {
        id: 5,
        name: 'Vệ sinh kính văn phòng',
        provider: 'Công ty Sạch Bóng',
        providerId: 5,
        rating: 4.8,
        reviews: 210,
        location: 'Thủ Đức, TP. HCM',
        price: 400000,
        priceUnit: 'lần',
        type: 'Vệ sinh văn phòng',
        description:
            'Dịch vụ vệ sinh kính văn phòng hỗ trợ làm sạch bề mặt kính, vách kính và các khu vực được thống nhất trước khi thi công. Giá thực tế phụ thuộc diện tích và độ khó của công việc.',
        duration: 'Theo diện tích',
        image: 'https://placehold.co/900x500/eaf2ff/2563eb?text=Ve+sinh+kinh',
        includes: [
            'Làm sạch bề mặt kính trong phạm vi thỏa thuận',
            'Lau các vết bẩn thông thường',
            'Thu dọn dụng cụ sau thi công'
        ],
        excludes: [
            'Thi công ngoài trời ở độ cao nếu chưa có phương án an toàn',
            'Sửa chữa hoặc thay kính',
            'Các hạng mục ngoài phạm vi báo giá'
        ]
    },
    {
        id: 6,
        name: 'Dọn dẹp căn hộ sau xây dựng',
        provider: 'CleanPro Việt Nam',
        providerId: 2,
        rating: 4.5,
        reviews: 95,
        location: 'Quận 2, TP. HCM',
        price: 1500000,
        priceUnit: 'lần',
        type: 'Vệ sinh sau xây dựng',
        description:
            'Dịch vụ dọn dẹp sau xây dựng hỗ trợ làm sạch bụi bẩn và các vết bám thông thường sau quá trình thi công. Phạm vi công việc cần được thống nhất theo diện tích và tình trạng thực tế.',
        duration: '4–8 giờ',
        image: 'https://placehold.co/900x500/eaf2ff/2563eb?text=Ve+sinh+sau+xay+dung',
        includes: [
            'Thu gom bụi bẩn thông thường',
            'Lau sàn và các bề mặt phù hợp',
            'Làm sạch cửa và khu vực dễ tiếp cận',
            'Thu dọn khu vực sau vệ sinh'
        ],
        excludes: [
            'Vận chuyển phế thải xây dựng khối lượng lớn',
            'Xử lý hóa chất nguy hiểm',
            'Thi công trên cao không có phương án an toàn'
        ]
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
                    <p>Dịch vụ có thể không tồn tại hoặc đã được thay đổi.</p>
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
                <span onClick={() => navigate('/')}>Trang chủ</span>
                {' › '}
                <span onClick={() => navigate('/services')}>Dịch vụ</span>
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
                            Đơn vị cung cấp:{' '}
                            <button
                                type="button"
                                className="detail-provider-link"
                                onClick={() =>
                                    navigate(`/provider/${service.providerId}`)
                                }
                            >
                                {service.provider}
                            </button>
                        </p>

                        <div className="detail-rating">
                            <span>
                                ⭐ {service.rating} ({service.reviews} đánh giá)
                            </span>
                            <span>📍 {service.location}</span>
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
                                <span>Khu vực phục vụ</span>
                                <strong>{service.location}</strong>
                            </div>

                            <div>
                                <span>Nhà cung cấp</span>
                                <strong>{service.provider}</strong>
                            </div>
                        </div>

                        <h2>Dịch vụ bao gồm</h2>
                        <ul className="detail-list">
                            {service.includes.map((item, index) => (
                                <li key={index}>✓ {item}</li>
                            ))}
                        </ul>

                        <h2>Không bao gồm</h2>
                        <ul className="detail-list detail-list-excludes">
                            {service.excludes.map((item, index) => (
                                <li key={index}>• {item}</li>
                            ))}
                        </ul>

                        <p className="detail-disclaimer">
                            Thông tin trên là dữ liệu mẫu phục vụ giao diện.
                            Phạm vi thực tế cần được nhà cung cấp xác nhận
                            trước khi đặt dịch vụ.
                        </p>
                    </div>
                </section>

                <aside className="detail-booking">
                    <span className="detail-price-label">
                        Giá tham khảo
                    </span>

                    <div className="detail-price">
                        {service.price.toLocaleString('vi-VN')}đ
                        <small>/{service.priceUnit}</small>
                    </div>

                    <p className="detail-note">
                        Giá có thể thay đổi tùy diện tích, tình trạng thực tế
                        và yêu cầu của khách hàng.
                    </p>

                    <button
                        className="detail-book-button"
                        onClick={() => navigate('/services')}
                    >
                        Xem và chọn gói dịch vụ
                    </button>

                    <button
                        className="detail-contact-button"
                        onClick={() =>
                            navigate(`/provider/${service.providerId}`)
                        }
                    >
                        Xem nhà cung cấp
                    </button>

                    <button
                        className="detail-back-button"
                        onClick={() => navigate('/services')}
                    >
                        ← Quay lại danh sách
                    </button>
                </aside>
            </main>

            <Footer />
        </div>
    );
}

export default ServiceDetail;
