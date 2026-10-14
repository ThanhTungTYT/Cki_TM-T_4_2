import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faTrash, faPlus, faMinus, faCartShopping } from '@fortawesome/free-solid-svg-icons';
import { useCart, useCartDispatch } from '../context/CartContext';
import './CartDrawer.css';

function formatPrice(amount) {
    return (amount || 0).toLocaleString('vi-VN') + 'đ';
}

function CartDrawer({ isOpen, onClose }) {
    const { cartItems, subtotal, totalItems } = useCart();
    const dispatch = useCartDispatch();

    const updateQty = (item, delta) => {
        const next = item.quantity + delta;
        if (next < 1) return;
        dispatch({ type: 'UPDATE_ITEM', payload: { id: item.id, quantity: next } });
    };

    return (
        <>
            <div className={`cart-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
            <div className={`cart-drawer ${isOpen ? 'open' : ''}`}>
                <div className="cart-drawer-header">
                    <div className="cart-drawer-title">
                        <FontAwesomeIcon icon={faCartShopping} />
                        <span>Giỏ dịch vụ</span>
                        {totalItems > 0 && <span className="cart-count">{totalItems}</span>}
                    </div>
                    <button className="cart-close-btn" onClick={onClose} aria-label="Đóng giỏ hàng">
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>

                <div className="cart-drawer-body">
                    {cartItems.length === 0 ? (
                        <div className="cart-empty">
                            <FontAwesomeIcon icon={faCartShopping} />
                            <p>Giỏ dịch vụ đang trống</p>
                            <span>Thêm dịch vụ để bắt đầu đặt lịch</span>
                        </div>
                    ) : (
                        cartItems.map(item => (
                            <div className="cart-item" key={item.id}>
                                <div className="cart-item-info">
                                    <p className="cart-item-name">{item.serviceName}</p>
                                    {item.packageName && (
                                        <span className="cart-item-package">{item.packageName}</span>
                                    )}
                                    <strong className="cart-item-price">
                                        {formatPrice(item.estimatedPrice)}
                                    </strong>
                                </div>
                                <div className="cart-item-actions">
                                    <div className="qty-control">
                                        <button onClick={() => updateQty(item, -1)} aria-label="Giảm số lượng">
                                            <FontAwesomeIcon icon={faMinus} />
                                        </button>
                                        <span>{item.quantity}</span>
                                        <button onClick={() => updateQty(item, 1)} aria-label="Tăng số lượng">
                                            <FontAwesomeIcon icon={faPlus} />
                                        </button>
                                    </div>
                                    <button
                                        className="cart-remove-btn"
                                        onClick={() => dispatch({ type: 'REMOVE_ITEM', payload: item.id })}
                                        aria-label="Xóa khỏi giỏ"
                                    >
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {cartItems.length > 0 && (
                    <div className="cart-drawer-footer">
                        <div className="cart-subtotal">
                            <span>Tạm tính</span>
                            <strong>{formatPrice(subtotal)}</strong>
                        </div>
                        <button className="cart-book-btn" onClick={onClose}>
                            Đặt lịch ngay
                        </button>
                        <button
                            className="cart-clear-btn"
                            onClick={() => dispatch({ type: 'CLEAR_CART' })}
                        >
                            Xoá giỏ
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}

export default CartDrawer;
