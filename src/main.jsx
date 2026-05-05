import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

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

const rootEl = document.getElementById('root')
const root = createRoot(rootEl)

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error || event.message)
})
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason)
})

import('./App.jsx')
  .then((mod) => {
    const App = mod.default
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    )
  })
  .catch((error) => {
    console.error('Failed to load App module:', error)
    root.render(
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f3f6fb' }}>
        <section style={{ background: '#fff', border: '1px solid #dde5f1', borderRadius: 12, padding: 16, maxWidth: 720, width: '90%' }}>
          <h1 style={{ marginTop: 0 }}>啟動失敗</h1>
          <p>請截圖這段訊息給我：</p>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(error?.message || error)}</pre>
        </section>
      </main>,
    )
  })
