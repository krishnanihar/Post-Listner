// Nocturne — the resting scene per phase (Phase 1 baseline; Act I/II beats
// refine these live via worldStore.setScene). Pure: maps a phase id to a scene
// partial the App commands on phase entry. The continuous-world replacement for
// phaseTheme's two-theme model — but phaseTheme.inkForPhase is KEPT (record
// surfaces still read --ink), this only drives the light.
//
//   Overture (entry)   — a single intimate lamp fading up, candle-warm.
//   Act I (admirer)    — the same intimate pool; beats tip/deepen/grow it live.
//   Act II (orchestra) — starts intimate, opens toward the hall at bloom
//                        (worldStore.openHall drives breadth off the timeline).
//   Coda (settle)      — back to lamplight; the record is paper, drawn in DOM.
//
// Canon: docs/superpowers/specs/2026-07-06-nocturne-design-canon.md §6.

// Every resting scene below carries an explicit `intensity`; the live per-frame
// pool nudge/breadth override (worldStore's tipPool/liveBreadth) is layered on
// top of these by WorldStage, never baked in here.
const SCENES = {
  entry: { pool: { x: 0.5, y: 0.52, radius: 0.24 }, warmth: 0.5, breadth: 0, intensity: 0.95 },
  admirer: { pool: { x: 0.5, y: 0.5, radius: 0.3 }, warmth: 0.5, breadth: 0.05, intensity: 1 },
  orchestra: { pool: { x: 0.5, y: 0.5, radius: 0.32 }, warmth: 0.45, breadth: 0.1, intensity: 1 },
  settle: { pool: { x: 0.5, y: 0.5, radius: 0.26 }, warmth: 0.55, breadth: 0, intensity: 0.9 },
}

export function sceneForPhase(phase) {
  return SCENES[phase] || SCENES.entry
}
