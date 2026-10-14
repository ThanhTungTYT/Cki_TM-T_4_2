import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { CartProvider } from './context/CartContext'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <GoogleOAuthProvider clientId="573598459716-goncvqtstlaetnavhs1v7f8sef4afdqg.apps.googleusercontent.com">
            <CartProvider>
                <App />
            </CartProvider>
        </GoogleOAuthProvider>
    </StrictMode>,
)