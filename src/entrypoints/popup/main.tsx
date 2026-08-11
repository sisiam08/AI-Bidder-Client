import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from '../../lib/toast'
import App from './App'
import '../style.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          fontFamily: 'IBM Plex Sans, sans-serif',
          fontSize: '13px',
          fontWeight: 600,
        },
      }}
    />
  </React.StrictMode>,
)
