
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { cartApi } from '../services/api';

const CartContext = createContext(null);
const CartDispatchContext = createContext(null);
const STORAGE_KEY = 'cleanmate_cart';

function getToken() {
    return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
}

function normalizeCartResponse(response) {
    const items = [];

    (response?.groups || []).forEach(group => {
        (group.items || []).forEach(item => {
            const scheduledStart = item.scheduledStart || '';
            items.push({
                id: item.id,
                serviceId: item.serviceId,
                serviceName: item.serviceName || '',
                serviceThumbnail: item.serviceThumbnail || '',
                packageId: item.packageId ?? null,
                packageName: item.packageName || '',
                providerId: item.partnerId ?? group.partnerId ?? null,
                providerName: item.partnerName || group.partnerName || '',
                quantity: Number(item.quantity || 1),
                unitPrice: Number(item.unitPrice || 0),
                estimatedPrice: Number(item.estimatedPrice || 0),
                scheduledDate: scheduledStart ? scheduledStart.split('T')[0] : '',
                scheduledTime: scheduledStart ? scheduledStart.split('T')[1]?.substring(0, 5) || '' : '',
                scheduledStart,
                note: item.note || '',
                notes: item.note || ''
            });
        });
    });

    return items;
}

function readGuestCart() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveGuestCart(items) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
    }
}

function cartReducer(state, action) {
    switch (action.type) {
        case 'LOAD_CART':
            return Array.isArray(action.payload) ? action.payload : [];
        case 'ADD_ITEM': {
            const item = action.payload;
            const existing = state.find(i =>
                Number(i.serviceId) === Number(item.serviceId) &&
                Number(i.packageId || 0) === Number(item.packageId || 0) &&
                Number(i.providerId || 0) === Number(item.providerId || 0)
            );

            if (existing) {
                return state.map(i => {
                    if (i.id !== existing.id) return i;
                    const quantity = Number(i.quantity || 1) + Number(item.quantity || 1);
                    return {
                        ...i,
                        quantity,
                        estimatedPrice: Number(i.unitPrice || 0) * quantity
                    };
                });
            }

            return [...state, {
                ...item,
                id: item.id ?? `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                quantity: Number(item.quantity || 1),
                unitPrice: Number(item.unitPrice || 0),
                estimatedPrice: Number(item.estimatedPrice ?? Number(item.unitPrice || 0) * Number(item.quantity || 1))
            }];
        }
        case 'UPDATE_ITEM':
            return state.map(item => {
                if (String(item.id) !== String(action.payload.id)) return item;
                const updated = { ...item, ...action.payload };
                updated.estimatedPrice = Number(updated.unitPrice || 0) * Number(updated.quantity || 1);
                return updated;
            });
        case 'REMOVE_ITEM':
            return state.filter(item => String(item.id) !== String(action.payload));
        case 'REMOVE_PROVIDER_ITEMS':
            return state.filter(item => Number(item.providerId || 0) !== Number(action.payload || 0));
        case 'CLEAR_CART':
            return [];
        default:
            return state;
    }
}

export function CartProvider({ children }) {
    const [cartItems, setCartItems] = useState(() => getToken() ? [] : readGuestCart());
    const [isCartLoading, setIsCartLoading] = useState(false);
    const [cartError, setCartError] = useState('');
    const stateRef = useRef(cartItems);
    const tokenRef = useRef(getToken());

    useEffect(() => {
        stateRef.current = cartItems;
    }, [cartItems]);

    const loadServerCart = useCallback(async () => {
        if (!getToken()) {
            setCartItems(readGuestCart());
            setIsCartLoading(false);
            return;
        }

        setIsCartLoading(true);
        setCartError('');

        try {
            const response = await cartApi.getCart();
            setCartItems(normalizeCartResponse(response));
        } catch (error) {
            setCartError(error.message || 'Không thể tải giỏ hàng.');
            setCartItems([]);
        } finally {
            setIsCartLoading(false);
        }
    }, []);

    useEffect(() => {
        const syncAuth = () => {
            const nextToken = getToken();
            if (nextToken === tokenRef.current) return;

            tokenRef.current = nextToken;
            setCartError('');

            if (nextToken) {
                setCartItems([]);
                loadServerCart();
            } else {
                setCartItems(readGuestCart());
            }
        };

        const onStorage = event => {
            if (event.key === 'accessToken' || event.key === null) syncAuth();
        };

        window.addEventListener('storage', onStorage);
        window.addEventListener('cleanmate-auth-changed', syncAuth);
        window.addEventListener('focus', syncAuth);

        if (getToken()) loadServerCart();

        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('cleanmate-auth-changed', syncAuth);
            window.removeEventListener('focus', syncAuth);
        };
    }, [loadServerCart]);

    useEffect(() => {
        if (!getToken()) saveGuestCart(cartItems);
    }, [cartItems]);

    const dispatch = useCallback(async action => {
        const token = getToken();

        if (action.type === 'LOAD_CART') {
            setCartItems(Array.isArray(action.payload) ? action.payload : []);
            return;
        }

        if (!token) {
            setCartItems(current => {
                const next = cartReducer(current, action);
                saveGuestCart(next);
                return next;
            });
            return;
        }

        try {
            setCartError('');

            if (action.type === 'ADD_ITEM') {
                const item = action.payload;
                const payload = {
                    serviceId: item.serviceId,
                    packageId: item.packageId ?? null,
                    partnerId: item.providerId ?? item.partnerId ?? null,
                    quantity: Number(item.quantity || 1),
                    scheduledStart: item.scheduledStart || (
                        item.scheduledDate && item.scheduledTime
                            ? `${item.scheduledDate}T${item.scheduledTime}:00`
                            : null
                    ),
                    note: item.note || item.notes || ''
                };

                const response = await cartApi.addToCart(payload);
                setCartItems(normalizeCartResponse(response));
                return;
            }

            if (action.type === 'UPDATE_ITEM') {
                const item = stateRef.current.find(i => String(i.id) === String(action.payload.id));
                if (!item) return;

                const response = await cartApi.updateCartItem(item.id, {
                    quantity: action.payload.quantity,
                    note: action.payload.note ?? item.note ?? ''
                });
                setCartItems(normalizeCartResponse(response));
                return;
            }

            if (action.type === 'REMOVE_ITEM') {
                const response = await cartApi.removeFromCart(action.payload);
                setCartItems(normalizeCartResponse(response));
                return;
            }

            if (action.type === 'CLEAR_CART') {
                const response = await cartApi.clearCart();
                setCartItems(normalizeCartResponse(response));
                return;
            }

            if (action.type === 'REMOVE_PROVIDER_ITEMS') {
                const partnerId = Number(action.payload);
                if (!Number.isFinite(partnerId) || partnerId <= 0) {
                    await loadServerCart();
                    return;
                }

                const response = await cartApi.clearCart(partnerId);
                setCartItems(normalizeCartResponse(response));
            }
        } catch (error) {
            setCartError(error.message || 'Không thể cập nhật giỏ hàng.');
            await loadServerCart();
        }
    }, [loadServerCart]);

    const contextValue = useMemo(() => ({
        cartItems,
        isCartLoading,
        cartError
    }), [cartItems, isCartLoading, cartError]);

    return (
        <CartContext.Provider value={contextValue}>
            <CartDispatchContext.Provider value={dispatch}>
                {children}
            </CartDispatchContext.Provider>
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    const cartItems = context?.cartItems || [];

    const totalItems = useMemo(
        () => cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        [cartItems]
    );

    const subtotal = useMemo(
        () => cartItems.reduce((sum, item) => sum + Number(item.estimatedPrice || 0), 0),
        [cartItems]
    );

    return {
        cartItems,
        totalItems,
        subtotal,
        isCartLoading: context?.isCartLoading || false,
        cartError: context?.cartError || ''
    };
}

export function useCartDispatch() {
    return useContext(CartDispatchContext);
}
