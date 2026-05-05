import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unknown error' }
  }

  componentDidCatch(error) {
    console.error('App crashed:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f3f6fb' }}>
          <section style={{ background: '#fff', border: '1px solid #dde5f1', borderRadius: 12, padding: 16, maxWidth: 720, width: '90%' }}>
            <h1 style={{ marginTop: 0 }}>頁面錯誤</h1>
            <p>請截圖這段訊息給我：</p>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.message}</pre>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
