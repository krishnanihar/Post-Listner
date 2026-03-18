import { useEffect, useRef } from 'react'

export default function TraceCanvas({ avd, phase }) {
  const canvasRef = useRef(null)
  const dataRef = useRef({
    spectrumLines: [],
    depthVerticals: [],
    textureDots: [],
    momentWave: [],
  })
  const frameRef = useRef(null)

  useEffect(() => {
    const unsub = avd.subscribe(() => {
      const history = avd.getHistory()
      const phaseData = avd.getPhaseData()

      // Spectrum lines from pair choices
      if (phaseData.spectrum?.pairs?.length) {
        dataRef.current.spectrumLines = phaseData.spectrum.pairs.map((p, i) => ({
          y: 0.15 + i * 0.08,
          x: p.choice === 'left' ? 0.2 : 0.8,
          confidence: p.confidence,
          width: 0.3 + p.confidence * 0.4,
        }))
      }

      // Depth verticals
      if (phaseData.depth?.finalLayer > 1) {
        const count = phaseData.depth.finalLayer
        dataRef.current.depthVerticals = Array.from({ length: count }, (_, i) => ({
          x: 0.3 + i * 0.05,
          height: 0.2 + (i / count) * 0.5,
        }))
      }

      // Texture dots
      if (phaseData.textures?.preferred?.length || phaseData.textures?.rejected?.length) {
        const all = [
          ...phaseData.textures.preferred.map((n, i) => ({ name: n, bright: true, idx: i })),
          ...phaseData.textures.neutral.map((n, i) => ({ name: n, bright: false, idx: i + 3 })),
        ]
        dataRef.current.textureDots = all.map((t, i) => ({
          x: 0.15 + (i % 4) * 0.2,
          y: 0.55 + Math.floor(i / 4) * 0.1,
          bright: t.bright,
          r: t.bright ? 3 : 1.5,
        }))
      }

      // Moment waveform from arousal history
      if (phaseData.moment?.totalTaps > 0) {
        const pts = Math.min(50, phaseData.moment.totalTaps)
        dataRef.current.momentWave = Array.from({ length: pts }, (_, i) => ({
          x: 0.1 + (i / pts) * 0.8,
          y: 0.85 + Math.sin(i * 0.5) * 0.03 * (phaseData.moment.peakTapRate || 1),
        }))
      }
    })

    return unsub
  }, [avd])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const draw = () => {
      const w = canvas.width = window.innerWidth * window.devicePixelRatio
      const h = canvas.height = window.innerHeight * window.devicePixelRatio
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      ctx.clearRect(0, 0, w, h)

      const data = dataRef.current
      const time = Date.now() * 0.001

      // Spectrum: horizontal lines
      ctx.globalAlpha = 0.25
      data.spectrumLines.forEach(line => {
        ctx.strokeStyle = line.confidence > 0.5 ? '#D4A053' : '#5A5A65'
        ctx.lineWidth = 0.5 * window.devicePixelRatio
        ctx.beginPath()
        const cx = line.x * w
        const y = line.y * h
        const halfW = line.width * w * 0.5
        ctx.moveTo(cx - halfW, y)
        ctx.lineTo(cx + halfW, y)
        ctx.stroke()
      })

      // Depth: vertical lines
      ctx.globalAlpha = 0.2
      ctx.strokeStyle = '#D4A053'
      data.depthVerticals.forEach(vert => {
        ctx.lineWidth = 0.5 * window.devicePixelRatio
        ctx.beginPath()
        const x = vert.x * w
        const midY = 0.5 * h
        const halfH = vert.height * h * 0.5
        // Subtle breathing
        const breathe = 1 + Math.sin(time * 0.8 + vert.x * 10) * 0.03
        ctx.moveTo(x, midY - halfH * breathe)
        ctx.lineTo(x, midY + halfH * breathe)
        ctx.stroke()
      })

      // Texture: dots
      data.textureDots.forEach(dot => {
        ctx.globalAlpha = dot.bright ? 0.35 : 0.12
        ctx.fillStyle = '#D4A053'
        ctx.beginPath()
        ctx.arc(dot.x * w, dot.y * h, dot.r * window.devicePixelRatio, 0, Math.PI * 2)
        ctx.fill()
      })

      // Moment: waveform
      if (data.momentWave.length > 1) {
        ctx.globalAlpha = 0.2
        ctx.strokeStyle = '#D4A053'
        ctx.lineWidth = 1 * window.devicePixelRatio
        ctx.beginPath()
        data.momentWave.forEach((pt, i) => {
          const x = pt.x * w
          const y = pt.y * h + Math.sin(time * 1.5 + i * 0.3) * 2
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.stroke()
      }

      ctx.globalAlpha = 1
      frameRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(frameRef.current)
  }, [phase])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.25 }}
    />
  )
}
