import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCartShopping,
    faTrash,
    faPlus,
    faMinus,
    faCalendarDays,
    faBuilding,
    faArrowRight,
    faBroom,
    faShieldHalved,
    faArrowLeft
} from '@fortawesome/free-solid-svg-icons';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useCart, useCartDispatch } from '../context/CartContext';
import './cart.css';

function formatPrice(amount) {
    return (amount || 0).toLocaleString('vi-VN') + 'đ';
}

function Cart() {
    const { cartItems, totalItems, subtotal } = useCart();
    const dispatch = useCartDispatch();
    const navigate = useNavigate();

    // Gom nhóm các dịch vụ theo từng Provider
    const providerGroups = useMemo(() => {
        const groups = {};
        cartItems.forEach(item => {
            const pName = item.providerName || 'Đơn vị vệ sinh CleanMate';
            const pId = item.providerId || 1;
            if (!groups[pName]) {
                groups[pName] = {
                    providerName: pName,
                    providerId: pId,
                    items: [],
                    subtotal: 0,
                    totalQuantity: 0
                };
            }
            groups[pName].items.push(item);
            groups[pName].subtotal += item.estimatedPrice || 0;
            groups[pName].totalQuantity += item.quantity || 1;
        });
        return Object.values(groups);
    }, [cartItems]);

    const handleUpdateQty = (item, delta) => {
        const next = item.quantity + delta;
        if (next < 1) return;
        dispatch({ type: 'UPDATE_ITEM', payload: { id: item.id, quantity: next } });
    };

    const handleRemoveItem = (id) => {
        dispatch({ type: 'REMOVE_ITEM', payload: id });
    };

    const handleClearCart = () => {
        if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ giỏ dịch vụ?')) {
            dispatch({ type: 'CLEAR_CART' });
        }
    };

    const handleCheckoutGroup = (group) => {
        // Điều hướng sang trang checkout cho riêng Provider này
        navigate(`/checkout?providerId=${group.providerId}&providerName=${encodeURIComponent(group.providerName)}`);
    };

    return (
        <div className="cart-page">
            <Header />

            <div className="breadcrumb">
                <Link to="/">Trang chủ</Link>
                <span>›</span>
                <strong>Giỏ dịch vụ</strong>
            </div>

            <main className="cart-container">
                <div className="cart-header-section">
                    <div>
                        <h1>Giỏ dịch vụ của bạn</h1>
                        <p>Quản lý các dịch vụ vệ sinh đã chọn trước khi tiến hành đặt lịch</p>
                    </div>
                    {cartItems.length > 0 && (
                        <button className="cart-clear-all-btn" onClick={handleClearCart}>
                            <FontAwesomeIcon icon={faTrash} /> Xóa tất cả
                        </button>
                    )}
                </div>

                {cartItems.length === 0 ? (
                    <div className="cart-empty-card">
                        <div className="empty-icon-box">
                            <FontAwesomeIcon icon={faCartShopping} />
                        </div>
                        <h2>Giỏ dịch vụ đang trống</h2>
                        <p>Bạn chưa thêm bất kỳ dịch vụ vệ sinh nào vào giỏ hàng.</p>
                        <Link to="/services" className="btn-explore-services">
                            <FontAwesomeIcon icon={faBroom} /> Khám phá dịch vụ ngay
                        </Link>
                    </div>
                ) : (
                    <div className="cart-content-layout">
                        {/* CỘT TRÁI: DANH SÁCH NHÓM THEO PROVIDER */}
                        <div className="cart-groups-column">
                            {providerGroups.map((group) => (
                                <div className="provider-cart-card" key={group.providerName}>
                                    <div className="provider-card-header">
                                        <div className="provider-info-badge">
                                            <div className="provider-icon-circle">
                                                <FontAwesomeIcon icon={faBuilding} />
                                            </div>
                                            <div>
                                                <h3>{group.providerName}</h3>
                                                <span className="provider-verified">
                                                    <FontAwesomeIcon icon={faShieldHalved} /> Đối tác xác minh
                                                </span>
                                            </div>
                                        </div>
                                        <span className="provider-item-count">
                                            {group.items.length} dịch vụ ({group.totalQuantity} lượt)
                                        </span>
                                    </div>

                                    <div className="provider-item-list">
                                        {group.items.map((item) => (
                                            <div className="cart-table-row" key={item.id}>
                                                <div className="item-main-details">
                                                    <h4>{item.serviceName}</h4>
                                                    {item.packageName && (
                                                        <span className="item-pkg-tag">
                                                            {item.packageName}
                                                        </span>
                                                    )}
                                                    {item.scheduledDate && (
                                                        <span className="item-date-tag">
                                                            <FontAwesomeIcon icon={faCalendarDays} /> {item.scheduledDate} ({item.scheduledTime || '08:30'})
                                                        </span>
                                                    )}
                                                    {item.note && (
                                                        <p className="item-user-note">
                                                            <em>Ghi chú: {item.note}</em>
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="item-pricing-control">
                                                    <div className="item-unit-price">
                                                        <small>Đơn giá</small>
                                                        <span>{formatPrice(item.unitPrice)}</span>
                                                    </div>

                                                    <div className="item-qty-selector">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateQty(item, -1)}
                                                            disabled={item.quantity <= 1}
                                                        >
                                                            <FontAwesomeIcon icon={faMinus} />
                                                        </button>
                                                        <span>{item.quantity}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateQty(item, 1)}
                                                        >
                                                            <FontAwesomeIcon icon={faPlus} />
                                                        </button>
                                                    </div>

                                                    <div className="item-total-price">
                                                        <small>Thành tiền</small>
                                                        <strong>{formatPrice(item.estimatedPrice)}</strong>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className="btn-delete-item"
                                                        onClick={() => handleRemoveItem(item.id)}
                                                        title="Xóa dịch vụ này"
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="provider-card-footer">
                                        <div className="provider-subtotal-block">
                                            <span>Tạm tính nhà cung cấp này:</span>
                                            <strong>{formatPrice(group.subtotal)}</strong>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn-checkout-provider"
                                            onClick={() => handleCheckoutGroup(group)}
                                        >
                                            Đặt lịch đơn vị này <FontAwesomeIcon icon={faArrowRight} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* CỘT PHẢI: TỔNG QUAN GIỎ HÀNG */}
                        <div className="cart-summary-column">
                            <div className="cart-summary-card">
                                <h3>Tóm tắt giỏ dịch vụ</h3>

                                <div className="summary-row">
                                    <span>Tổng số dịch vụ</span>
                                    <strong>{cartItems.length} dịch vụ</strong>
                                </div>

                                <div className="summary-row">
                                    <span>Tổng số lượt thực hiện</span>
                                    <strong>{totalItems} lượt</strong>
                                </div>

                                <div className="summary-row">
                                    <span>Số nhà cung cấp</span>
                                    <strong>{providerGroups.length} đơn vị</strong>
                                </div>

                                <div className="summary-divider" />

                                <div className="summary-total-row">
                                    <span>Tổng cộng toàn bộ</span>
                                    <strong className="summary-total-price">{formatPrice(subtotal)}</strong>
                                </div>

                                <div className="summary-notice-box">
                                    <FontAwesomeIcon icon={faShieldHalved} />
                                    <p>
                                        <strong>Quy định đặt lịch:</strong> Mỗi đơn đặt sẽ được xác nhận riêng theo từng nhà cung cấp để đảm bảo chất lượng và đúng khung giờ hẹn.
                                    </p>
                                </div>

                                <Link to="/services" className="btn-continue-shopping">
                                    <FontAwesomeIcon icon={faArrowLeft} /> Thêm dịch vụ khác
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}

export default Cart;
