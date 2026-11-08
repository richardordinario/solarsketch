import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './fonts.css'
import './index.css'
import App from './App.tsx'
import { bootstrap } from './store/persistence'

const root = createRoot(document.getElementById('root')!)

// Open storage and the last project (or the sample) before the first render.
/** The splash (index.html) stays up at least this long from page load, so it reads as a splash, not a flash. */
const SPLASH_MIN_MS = 1200

function hideSplash() {
  const splash = document.getElementById('splash')
  if (!splash) return
  const delay = Math.max(0, SPLASH_MIN_MS - performance.now())
  setTimeout(() => {
    splash.classList.add('splash-out')
    // transitionend never fires with reduced motion (no transition), so remove on a timer.
    setTimeout(() => splash.remove(), 300)
  }, delay)
}

// Open storage and the last project (or the sample) before the first render.
bootstrap()
  .catch(() => undefined)
  .finally(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    requestAnimationFrame(() => requestAnimationFrame(hideSplash))
  })
