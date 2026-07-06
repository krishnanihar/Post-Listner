import { forwardRef } from 'react'

// Nocturne — the Trace canvas. A thin forwardRef wrapper around the canvas the
// Throne feedback glyph draws on, extracted so the glyph lives in the world
// module (canon §7). The caller (Orchestra) holds the ref exactly as it held
// the raw <canvas ref>, and keeps driving drawTraceGlyph imperatively from its
// conducting loop inside its try/catch — so the isolation-from-the-audio-loop
// pattern and the per-frame timing are BEHAVIOR-IDENTICAL to the shipped glyph.
//
// The default fills its parent (Throne overlay); pass `style` to override.
const TraceGlyph = forwardRef(function TraceGlyph({ style, ...rest }, ref) {
  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', ...style }}
      {...rest}
    />
  )
})

export default TraceGlyph
