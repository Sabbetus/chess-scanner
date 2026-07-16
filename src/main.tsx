import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Clickjacking protection: GitHub Pages can't send X-Frame-Options/frame-ancestors
// headers, so refuse to run inside a frame. Try to break out to the top-level page;
// if a sandboxed iframe blocks the navigation, still fail closed by not rendering.
if (window.top !== window.self) {
  try {
    window.top!.location.href = window.location.href
  } catch {
    // navigation blocked by the framing page's sandbox; nothing more we can do
  }
  throw new Error('Refusing to run framed')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
