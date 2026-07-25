import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/config'
import App from './App.tsx'

// Suppress AbortError from Supabase during navigation/unmount
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'AbortError') {
    event.preventDefault()
  }
})

createRoot(document.getElementById('root')!).render(<App />)
