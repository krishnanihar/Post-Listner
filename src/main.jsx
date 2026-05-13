import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Stage from './phases/Stage.jsx'
import ConductorView from './conductor/ConductorView.jsx'
import ConductCodex from './conductor-codex/ConductCodex.jsx'
import ConductGlb from './conductor-glb/ConductGlb.jsx'

const ROUTES = {
  '/conduct': ConductorView,
  '/conduct-codex': ConductCodex,
  '/conduct-glb': ConductGlb,
}

// Device + session detection at the root:
//   1. Explicit /conduct-* routes → existing dev/experimental views
//   2. Desktop with no ?s= param → Stage (QR pairing screen)
//   3. Desktop with ?s= or mobile with ?s= → App (existing rite, possibly session-joined)
//   4. Mobile without ?s= → App (existing solo experience, no desktop)
function pickRoot() {
  const explicit = ROUTES[window.location.pathname]
  if (explicit) return explicit

  const isDesktop = !window.matchMedia('(pointer: coarse)').matches
  const hasSession = new URLSearchParams(window.location.search).has('s')

  if (isDesktop && !hasSession) return Stage
  return App
}

const Root = pickRoot()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
