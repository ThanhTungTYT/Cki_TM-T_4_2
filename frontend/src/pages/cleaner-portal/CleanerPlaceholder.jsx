
import { useLocation } from 'react-router-dom';

const PAGE_INFO = {
    jobs: {
        title: 'Công việc của tôi',
        description: 'Theo dõi và quản lý các công việc được phân công.',
        icon: '📋'
    },
    calendar: {
        title: 'Lịch làm việc',
        description: 'Theo dõi lịch làm việc và thời gian thực hiện công việc.',
        icon: '🗓️'
    },
    history: {
        title: 'Lịch sử công việc',
        description: 'Xem lại các công việc bạn đã thực hiện.',
        icon: '🕘'
    },
    notifications: {
        title: 'Thông báo',
        description: 'Cập nhật các thông báo liên quan đến công việc.',
        icon: '🔔'
    },
    profile: {
        title: 'Hồ sơ của tôi',
        description: 'Quản lý thông tin cá nhân và tài khoản của bạn.',
        icon: '👤'
    }
};

function CleanerPlaceholder() {
    const location = useLocation();
    const currentPage = location.pathname.split('/').filter(Boolean).pop();

    const page = PAGE_INFO[currentPage] || {
        title: 'Chức năng Cleaner',
        description: 'Khu vực chức năng dành cho nhân viên vệ sinh.',
        icon: '🧹'
    };

    return (
        <div className="cl-page">
            <div className="cl-page-heading">
                <div>
                    <h1>{page.title}</h1>
                    <p>{page.description}</p>
                </div>
            </div>

            <section className="cl-panel cl-placeholder-panel">
                <div className="cl-placeholder-icon">
                    {page.icon}
                </div>

                <h2>{page.title}</h2>

                <p>
                    Giao diện chức năng đang được xây dựng.
                    Nội dung sẽ được triển khai trong các bước tiếp theo.
                </p>
            </section>
        </div>
    );
}

export default CleanerPlaceholder;
