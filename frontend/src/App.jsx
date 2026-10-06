import { useState } from 'react'
import Home from "./pages/home"

function App() {
    const [message, setMessage] = useState('')

    const callBackend = async () => {
        try {
            const response = await fetch('/api/hello')
            const data = await response.text()

            setMessage(data)
        } catch (error) {
            console.error(error)
            setMessage('Không thể kết nối Backend')
        }
    }

    return (
        <Home />
    )
}

export default App