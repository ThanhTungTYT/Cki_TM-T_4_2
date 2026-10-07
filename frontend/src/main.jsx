import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <GoogleOAuthProvider clientId="573598459716-goncvqtstlaetnavhs1v7f8sef4afdqg.apps.googleusercontent.com">
            <App />
        </GoogleOAuthProvider>
    </StrictMode>,
)