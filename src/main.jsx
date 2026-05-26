import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ConductorView from './conductor/ConductorView.jsx'
import ConductCodex from './conductor-codex/ConductCodex.jsx'
import ConductGlb from './conductor-glb/ConductGlb.jsx'
import Desktop from './desktop/Desktop.jsx'
import CloudTest from './journal/CloudTest.jsx'
import AureolaTest from './aureola/AureolaTest.jsx'
import AureolaIntegrationTest from './aureola-integration/AureolaIntegrationTest.jsx'
import AureolaThreePlaneTest from './aureola-three-plane/AureolaThreePlaneTest.jsx'

const ROUTES = {
  '/conduct': ConductorView,
  '/conduct-codex': ConductCodex,
  '/conduct-glb': ConductGlb,
  '/journal': Desktop,
  '/cloud-test': CloudTest,
  '/aureola-test': AureolaTest,
  '/aureola-integration-test': AureolaIntegrationTest,
  '/aureola-three-plane-test': AureolaThreePlaneTest,
}

// Device + session detection at the root:
//   1. Explicit /conduct-* routes → existing dev/experimental views
//   2. Desktop with no ?s= param → Desktop (auth-gated journal + live mirror)
//   3. Desktop with ?s= or mobile with ?s= → App (existing rite, possibly session-joined)
//   4. Mobile without ?s= → App (existing solo experience, no desktop)
function pickRoot() {
  const explicit = ROUTES[window.location.pathname]
  if (explicit) return explicit

  const isDesktop = !window.matchMedia('(pointer: coarse)').matches
  const hasSession = new URLSearchParams(window.location.search).has('s')

  if (isDesktop && !hasSession) return Desktop
  return App
}

const Root = pickRoot()

// StrictMode intentionally removed for the musicking branch: ElevenLabs
// Conversational AI agents can't survive React's dev-mode double-mount
// (mount → cleanup tears the LiveKit session down → remount races into
// a still-disconnecting SDK). Re-enable once the hook has a session
// registry that absorbs StrictMode cleanly.
createRoot(document.getElementById('root')).render(<Root />)
