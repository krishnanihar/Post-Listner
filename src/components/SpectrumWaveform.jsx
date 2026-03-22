import { useRef, useEffect } from 'react'

export default function SpectrumWaveform({ position, active }) {
  const svgRef = useRef(null)
  const mainPathRef = useRef(null)
  const secondPathRef = useRef(null)
  const dotRef = useRef(null)
  const timeRef = useRef(0)
  const lastFrameRef = useRef(null)
  const rafRef = useRef(null)
  const positionRef = useRef(position)

  // Keep position ref in sync without restarting the RAF loop
  useEffect(() => {
    positionRef.current = position
  }, [position])

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      lastFrameRef.current = null
      return
    }

    function tick(timestamp) {
      if (lastFrameRef.current !== null) {
        const dt = (timestamp - lastFrameRef.current) / 1000
        timeRef.current += Math.min(dt, 0.1) // cap to avoid jumps after tab switch
      }
      lastFrameRef.current = timestamp
      const t = timeRef.current
      const svg = svgRef.current
      if (!svg) return

      const pos = positionRef.current

      // Use viewBox width (400) for coordinate space, not clientWidth
      const w = 400

      // Normalized position 0-1 (left=0, right=1)
      const sp = (pos + 1) / 2
      const absPos = Math.abs(pos)

      // Waveform parameters
      const freq = 0.055 + 0.225 * sp
      const baseAmp = 14 + (5 - 14) * sp
      const speed = 0.5 + 3.3 * sp
      const lineAlpha = 0.08 + absPos * 0.52
      const jag = Math.max(0, -pos) * 0.6

      // Build main path
      let mainD = ''
      let secD = ''
      const cy = 30 // center Y in SVG viewBox (60px tall)

      for (let x = 0; x <= w; x += 2) {
        const xn = x / w
        const df = Math.abs(xn - sp)
        const prox = Math.max(0, 1 - df * 2.5)
        const amp = baseAmp * (0.1 + prox * 0.9) * Math.max(0.08, absPos * 1.3)
        const ph = t * speed

        // Main wave
        let y = cy
        if (jag > 0.05) {
          const sw = ((x * freq + ph) % (Math.PI * 2)) / (Math.PI * 2)
          const sn = Math.sin(x * freq + ph)
          y += (sn * (1 - jag) + (sw * 2 - 1) * jag) * amp
          if (jag > 0.2) y += Math.sin(x * 0.7 + t * 11) * Math.cos(x * 0.3 + t * 7) * amp * jag * 0.3
        } else {
          y += Math.sin(x * freq + ph) * amp
          if (sp > 0.6) y += Math.sin(x * freq * 2.5 + ph * 1.7) * amp * 0.25 * (sp - 0.6) * 2.5
        }

        mainD += (x === 0 ? 'M' : 'L') + x + ' ' + y

        // Secondary wave
        let y2 = cy
        const amp2 = amp * 0.5
        const ph2 = t * speed + 1.3
        if (jag > 0.05) {
          const sw2 = ((x * freq * 0.8 + ph2) % (Math.PI * 2)) / (Math.PI * 2)
          const sn2 = Math.sin(x * freq * 0.8 + ph2)
          y2 += (sn2 * (1 - jag) + (sw2 * 2 - 1) * jag) * amp2
        } else {
          y2 += Math.sin(x * freq * 0.8 + ph2) * amp2
        }
        secD += (x === 0 ? 'M' : 'L') + x + ' ' + y2
      }

      if (mainPathRef.current) {
        mainPathRef.current.setAttribute('d', mainD)
        mainPathRef.current.setAttribute('stroke-opacity', lineAlpha)
      }
      if (secondPathRef.current) {
        secondPathRef.current.setAttribute('d', secD)
        secondPathRef.current.setAttribute('stroke-opacity', absPos > 0.1 ? lineAlpha * 0.25 : 0)
      }

      // Position indicator dot
      if (dotRef.current) {
        const dotX = sp * w
        const amp = baseAmp * Math.max(0.08, absPos * 1.3)
        const dotY = cy + Math.sin(dotX * freq + t * speed) * amp * 0.1
        dotRef.current.setAttribute('cx', dotX)
        dotRef.current.setAttribute('cy', dotY)
        dotRef.current.setAttribute('fill-opacity', 0.3 + absPos * 0.7)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [active])

  if (!active) return null

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 400 60"
      preserveAspectRatio="none"
      className="absolute pointer-events-none"
      style={{
        bottom: '16%',
        left: '12%',
        right: '12%',
        width: '76%',
        height: 52,
      }}
    >
      <path
        ref={mainPathRef}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        ref={secondPathRef}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="0.5"
        strokeLinecap="round"
      />
      <circle
        ref={dotRef}
        r="2.5"
        fill="var(--accent)"
      />
    </svg>
  )
}
