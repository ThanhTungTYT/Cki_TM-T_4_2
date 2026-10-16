import { createContext, useContext, useReducer, useEffect, useMemo } from 'react';

const CartContext = createContext(null);
const CartDispatchContext = createContext(null);

const STORAGE_KEY = 'cleanmate_cart';

function cartReducer(state, action) {
    switch (action.type) {
        case 'LOAD_CART':
            return action.payload;

        case 'ADD_ITEM': {
            const item = action.payload;
            const existing = state.find(
                i => i.serviceId === item.serviceId && i.packageId === item.packageId
            );
            if (existing) {
                return state.map(i =>
                    i === existing
                        ? { ...i, quantity: i.quantity + item.quantity, estimatedPrice: i.unitPrice * (i.quantity + item.quantity) }
                        : i
                );
            }
            return [...state, { ...item, id: Date.now() }];
        }

        case 'UPDATE_ITEM':
            return state.map(i =>
                i.id === action.payload.id
                    ? { ...i, ...action.payload, estimatedPrice: i.unitPrice * action.payload.quantity }
                    : i
            );

        case 'REMOVE_ITEM':
            return state.filter(i => i.id !== action.payload);

        case 'REMOVE_PROVIDER_ITEMS':
            return state.filter(i => (i.providerId || 1) !== action.payload);

        case 'CLEAR_CART':
            return [];

        default:
            return state;
    }
}

function getInitialCart() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (err) {
        console.error('Failed to parse cart from localStorage:', err);
    }
    return [];
}

export function CartProvider({ children }) {
    const [cartItems, dispatch] = useReducer(cartReducer, [], getInitialCart);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
    }, [cartItems]);

    return (
        <CartContext.Provider value={cartItems}>
            <CartDispatchContext.Provider value={dispatch}>
                {children}
            </CartDispatchContext.Provider>
        </CartContext.Provider>
    );
}

export function useCart() {
    const cartItems = useContext(CartContext) || [];
    const totalItems = useMemo(() => cartItems.reduce((sum, i) => sum + i.quantity, 0), [cartItems]);
    const subtotal = useMemo(() => cartItems.reduce((sum, i) => sum + i.estimatedPrice, 0), [cartItems]);
    return { cartItems, totalItems, subtotal };
}

export function useCartDispatch() {
    return useContext(CartDispatchContext);
}
