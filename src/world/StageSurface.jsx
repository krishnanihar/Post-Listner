import Paper from '../score/Paper'
import { NOCTURNE_ENABLED } from './flags.js'

// Nocturne (canon §2) — the Act-I surface. When the flag is OFF this is exactly
// the shipped cream <Paper> (byte-identical). When ON it is TRANSPARENT, so the
// WorldStage lamp pool + the accumulating Trace show through: light is the
// material of the living instrument, and Act I happens inside the lamp's pool
// rather than on a paper card. The phase's ink is flipped to light centrally by
// phaseTheme, so the overlays' var(--ink) content reads on the dark stage.
export default function StageSurface({ children }) {
  if (!NOCTURNE_ENABLED) return <Paper variant="cream">{children}</Paper>
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {children}
    </div>
  )
}
