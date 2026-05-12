import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ConductorView from './conductor/ConductorView.jsx'
import ConductCodex from './conductor-codex/ConductCodex.jsx'

const ROUTES = {
  '/conduct': ConductorView,
  '/conduct-codex': ConductCodex,
}

const Root = ROUTES[window.location.pathname] || App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
