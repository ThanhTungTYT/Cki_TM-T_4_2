import { useState } from 'react'

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
      <div>
        <h1>React + Spring Boot</h1>

        <button onClick={callBackend}>
          Test Backend
        </button>

        <p>{message}</p>
      </div>
  )
}

export default App