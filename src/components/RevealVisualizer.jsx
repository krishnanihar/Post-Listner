import { useEffect, useRef, useCallback } from 'react'

// ─── DATA EXTRACTION ───────────────────────────────────────────────────────────

function extractVisualDNA(avd) {
  const { a, v, d } = avd.getAVD()
  const pd = avd.getPhaseData()

  const spectrumChoices = pd.spectrum?.pairs || []
  const totalReversals = spectrumChoices.reduce((sum, p) => sum + (p.reversals || 0), 0)
  const avgConfidence = spectrumChoices.reduce((sum, p) => sum + (p.confidence || 0.5), 0) / Math.max(1, spectrumChoices.length)
  const avgReactionMs = spectrumChoices.reduce((sum, p) => sum + (p.reactionMs || 2000), 0) / Math.max(1, spectrumChoices.length)
  const choiceSequence = spectrumChoices.map(p => p.choice === 'left' ? -1 : 1)
  const decisiveness = Math.max(0, Math.min(1, 1 - (totalReversals / 16) * 0.5 - (avgReactionMs / 8000) * 0.5))

  const depthData = pd.depth || {}
  const finalLayer = depthData.finalLayer || 1
  const maxLayer = depthData.maxLayer || 1
  const reEngaged = depthData.reEngaged || false
  const curiosity = reEngaged ? 0.8 + (maxLayer / 8) * 0.2 : maxLayer / 8

  const textureData = pd.textures || {}
  const preferred = textureData.preferred || []
  const neutral = textureData.neutral || []
  const selectivity = 1 - (preferred.length / 8)

  const momentData = pd.moment || {}
  const totalTaps = momentData.totalTaps || 0
  const preDropSilence = momentData.preDropSilence || false
  const peakTapRate = momentData.peakTapRate || 0
  const tapsDuringBuild = momentData.tapsDuringBuild || 0
  const tapsDuringRelease = momentData.tapsDuringRelease || 0
  const buildReleaseRatio = tapsDuringRelease > 0
    ? tapsDuringBuild / (tapsDuringBuild + tapsDuringRelease)
    : 0.5

  return {
    a, v, d,
    choiceSequence,
    decisiveness,
    curiosity,
    selectivity,
    totalTaps,
    peakTapRate,
    preDropSilence,
    buildReleaseRatio,
    preferred,
    finalLayer,
    reEngaged,
    avgConfidence,
    spectrumChoices,
  }
}

// ─── COLOR HELPERS ──────────────────────────────────────────────────────────────

function getPrimaryColor(v) {
  // Interpolate between cool blue-gray and warm amber based on valence
  const r = Math.round(100 + (212 - 100) * v)
  const g = Math.round(140 + (160 - 140) * v)
  const b = Math.round(180 + (83 - 180) * v)
  return { r, g, b }
}

function rgba({ r, g, b }, alpha) {
  return `rgba(${r},${g},${b},${alpha})`
}

// ─── FORM GEOMETRY ──────────────────────────────────────────────────────────────

function buildFormPoints(dna, cx, cy, baseRadius, time) {
  const segments = 8
  const points = []
  const angleStep = (Math.PI * 2) / segments

  for (let i = 0; i < segments; i++) {
    const angle = angleStep * i - Math.PI / 2 // start from top

    // Base radius modulated by choice + confidence
    const choice = dna.choiceSequence[i] || 0
    const conf = dna.spectrumChoices[i]?.confidence || 0.5
    const radiusMod = 1 + choice * 0.15 * conf

    // Weight distribution: shift vertical emphasis
    const verticalFactor = Math.sin(angle)
    let weightMod = 1
    if (dna.buildReleaseRatio > 0.6) {
      weightMod = 1 + (verticalFactor < 0 ? 0.1 : -0.05) // heavier top
    } else if (dna.buildReleaseRatio < 0.4) {
      weightMod = 1 + (verticalFactor > 0 ? 0.1 : -0.05) // heavier bottom
    }

    // Void: indent segment 4 (5th pair, 0-indexed) if preDropSilence
    let voidMod = 1
    if (dna.preDropSilence && i === 4) {
      voidMod = 0.4
    }

    const r = baseRadius * radiusMod * weightMod * voidMod

    // Breathing animation
    const breathe = 1 + Math.sin(time * 0.5 + i * 0.4) * 0.025

    const finalR = r * breathe
    points.push({
      angle,
      radius: finalR,
      x: cx + Math.cos(angle) * finalR,
      y: cy + Math.sin(angle) * finalR,
      segmentIndex: i,
    })
  }
  return points
}

function drawFormRing(ctx, points, dna, ringIndex, totalRings, color, time, drawProgress) {
  const scale = 0.4 + (ringIndex / Math.max(1, totalRings - 1)) * 0.6
  const opacity = 0.6 - (ringIndex / Math.max(1, totalRings)) * 0.35

  // Spiral offset if reEngaged
  const spiralOffset = dna.reEngaged ? ringIndex * 0.08 : 0

  // Ring pulse offset during playing
  const pulseOffset = Math.sin(time * 0.7 - ringIndex * 0.3) * 0.01

  const adjustedScale = scale + pulseOffset

  // Determine how many segments to draw based on drawProgress (0-1)
  const segsToDraw = Math.min(points.length, Math.floor(drawProgress * points.length) + 1)
  const partialProgress = (drawProgress * points.length) % 1

  if (segsToDraw === 0) return

  ctx.save()
  ctx.globalAlpha = opacity * Math.min(1, drawProgress * 2)

  // Get center from average of all points
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length

  ctx.beginPath()

  for (let i = 0; i <= segsToDraw; i++) {
    const idx = i % points.length
    const pt = points[idx]

    // Apply ring scale and spiral
    const dx = (pt.x - cx) * adjustedScale
    const dy = (pt.y - cy) * adjustedScale
    const angle = Math.atan2(dy, dx) + spiralOffset
    const dist = Math.sqrt(dx * dx + dy * dy)

    let px = cx + Math.cos(angle) * dist
    let py = cy + Math.sin(angle) * dist

    // Apply texture-specific treatments per segment
    px += getTextureDistortion(dna, pt.segmentIndex, time, 'x')
    py += getTextureDistortion(dna, pt.segmentIndex, time, 'y')

    // Partial segment fade-in (overshoot then settle)
    if (i === segsToDraw && partialProgress < 1) {
      const overshoot = 1 + Math.sin(partialProgress * Math.PI) * 0.15
      const sdx = px - cx
      const sdy = py - cy
      px = cx + sdx * overshoot
      py = cy + sdy * overshoot
    }

    if (dna.decisiveness > 0.6) {
      // Angular: straight lines
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    } else {
      // Smooth: quadratic curves
      if (i === 0) {
        ctx.moveTo(px, py)
      } else {
        const prev = points[(i - 1) % points.length]
        const pdx = (prev.x - cx) * adjustedScale
        const pdy = (prev.y - cy) * adjustedScale
        const pAngle = Math.atan2(pdy, pdx) + spiralOffset
        const pDist = Math.sqrt(pdx * pdx + pdy * pdy)
        const ppx = cx + Math.cos(pAngle) * pDist + getTextureDistortion(dna, prev.segmentIndex, time, 'x')
        const ppy = cy + Math.sin(pAngle) * pDist + getTextureDistortion(dna, prev.segmentIndex, time, 'y')
        const cpx = (ppx + px) / 2
        const cpy = (ppy + py) / 2
        ctx.quadraticCurveTo(ppx, ppy, cpx, cpy)
      }
    }
  }

  if (segsToDraw >= points.length) {
    ctx.closePath()
  }

  // Stroke style
  ctx.strokeStyle = rgba(color, 1)
  ctx.lineWidth = (1.5 - ringIndex * 0.1) * window.devicePixelRatio

  // Glitch texture: intermittent gaps
  if (hasTexture(dna, 'glitch', points[0]?.segmentIndex)) {
    ctx.setLineDash([8, 4])
  }

  ctx.stroke()
  ctx.setLineDash([])

  // Draw texture accents on segments
  if (drawProgress >= 1) {
    drawTextureAccents(ctx, points, dna, adjustedScale, spiralOffset, cx, cy, color, time)
  }

  ctx.restore()
}

function getTextureDistortion(dna, segIndex, time, axis) {
  if (!dna.preferred || segIndex === undefined) return 0
  const texMap = getTextureSegmentMap(dna)

  if (texMap[segIndex] === 'strings') {
    // Wavy distortion
    return Math.sin(time * 3 + segIndex * 2) * 3 * (axis === 'y' ? 1 : 0.5)
  }
  if (texMap[segIndex] === 'distortion') {
    // Jagged noise
    return (Math.sin(time * 17 + segIndex * 7.3) * Math.cos(time * 11 + segIndex * 3.1)) * 4
  }
  return 0
}

function getTextureSegmentMap(dna) {
  const map = {}
  const textures = dna.preferred || []
  textures.forEach((tex, i) => {
    // Map each preferred texture to 1-2 segments
    const seg1 = i % 8
    map[seg1] = tex
    if (textures.length <= 4) {
      map[(seg1 + 4) % 8] = tex // mirror if few textures
    }
  })
  return map
}

function hasTexture(dna, textureName, segIndex) {
  const map = getTextureSegmentMap(dna)
  return Object.values(map).includes(textureName)
}

function drawTextureAccents(ctx, points, dna, scale, spiralOffset, cx, cy, color, time) {
  const texMap = getTextureSegmentMap(dna)

  points.forEach((pt, i) => {
    const tex = texMap[pt.segmentIndex]
    if (!tex) return

    const dx = (pt.x - cx) * scale
    const dy = (pt.y - cy) * scale
    const angle = Math.atan2(dy, dx) + spiralOffset
    const dist = Math.sqrt(dx * dx + dy * dy)
    const px = cx + Math.cos(angle) * dist
    const py = cy + Math.sin(angle) * dist

    ctx.save()

    if (tex === 'keys') {
      // Small dots along the line
      ctx.globalAlpha = 0.4
      ctx.fillStyle = rgba(color, 1)
      for (let d = 0; d < 5; d++) {
        const t = d / 5
        const next = points[(i + 1) % points.length]
        const ndx = (next.x - cx) * scale
        const ndy = (next.y - cy) * scale
        const nAngle = Math.atan2(ndy, ndx) + spiralOffset
        const nDist = Math.sqrt(ndx * ndx + ndy * ndy)
        const npx = cx + Math.cos(nAngle) * nDist
        const npy = cy + Math.sin(nAngle) * nDist
        const dotX = px + (npx - px) * t
        const dotY = py + (npy - py) * t
        ctx.beginPath()
        ctx.arc(dotX, dotY, 1.5 * window.devicePixelRatio, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    if (tex === 'voice') {
      // Double-line: draw a parallel offset path
      ctx.globalAlpha = 0.25
      ctx.strokeStyle = rgba(color, 1)
      ctx.lineWidth = 0.8 * window.devicePixelRatio
      const offset = 4 * window.devicePixelRatio
      const perpAngle = angle + Math.PI / 2
      ctx.beginPath()
      ctx.arc(px + Math.cos(perpAngle) * offset, py + Math.sin(perpAngle) * offset, 2, 0, Math.PI * 2)
      ctx.stroke()
    }

    if (tex === 'rhythm') {
      // Tick marks perpendicular to path
      ctx.globalAlpha = 0.35
      ctx.strokeStyle = rgba(color, 1)
      ctx.lineWidth = 0.8 * window.devicePixelRatio
      for (let t = 0; t < 4; t++) {
        const frac = t / 4
        const next = points[(i + 1) % points.length]
        const ndx = (next.x - cx) * scale
        const ndy = (next.y - cy) * scale
        const nAngle = Math.atan2(ndy, ndx) + spiralOffset
        const nDist = Math.sqrt(ndx * ndx + ndy * ndy)
        const npx = cx + Math.cos(nAngle) * nDist
        const npy = cy + Math.sin(nAngle) * nDist
        const tickX = px + (npx - px) * frac
        const tickY = py + (npy - py) * frac
        const tickAngle = Math.atan2(npy - py, npx - px) + Math.PI / 2
        const tickLen = 5 * window.devicePixelRatio
        ctx.beginPath()
        ctx.moveTo(tickX - Math.cos(tickAngle) * tickLen, tickY - Math.sin(tickAngle) * tickLen)
        ctx.lineTo(tickX + Math.cos(tickAngle) * tickLen, tickY + Math.sin(tickAngle) * tickLen)
        ctx.stroke()
      }
    }

    if (tex === 'field') {
      // Soft glow using shadow
      ctx.globalAlpha = 0.15
      ctx.shadowColor = rgba(color, 0.5)
      ctx.shadowBlur = 15 * window.devicePixelRatio
      ctx.fillStyle = rgba(color, 1)
      ctx.beginPath()
      ctx.arc(px, py, 3 * window.devicePixelRatio, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }

    if (tex === 'synthesizer') {
      // Subtle pulse/breathe circle
      const pulseR = 4 + Math.sin(time * 2 + i) * 2
      ctx.globalAlpha = 0.2
      ctx.strokeStyle = rgba(color, 1)
      ctx.lineWidth = 0.5 * window.devicePixelRatio
      ctx.beginPath()
      ctx.arc(px, py, pulseR * window.devicePixelRatio, 0, Math.PI * 2)
      ctx.stroke()
    }

    ctx.restore()
  })
}

// ─── PARTICLES (FIELD) ─────────────────────────────────────────────────────────

function createParticles(dna, canvasW, canvasH) {
  const baseCount = 40
  const tapBonus = Math.min(110, dna.totalTaps * 0.5)
  let count = Math.round(baseCount + tapBonus)
  // Selectivity reduces count but increases brightness
  count = Math.round(count * (0.5 + (1 - dna.selectivity) * 0.5))
  count = Math.min(150, count)

  const particles = []
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvasW,
      y: Math.random() * canvasH,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: 1 + Math.random() * 2,
      brightness: dna.selectivity > 0.5 ? 0.4 + Math.random() * 0.2 : 0.25 + Math.random() * 0.15,
      orbitAngle: Math.random() * Math.PI * 2,
      orbitSpeed: 0.002 + Math.random() * 0.004,
      arrived: false,
    })
  }
  return particles
}

function updateParticles(particles, formPoints, dna, cx, cy, formRadius, stage, freqBands, dt) {
  const convergenceSpeed = 0.3 + dna.decisiveness * 0.7

  particles.forEach(p => {
    if (stage === 'computing' && !p.arrived) {
      // Drift toward form perimeter
      const targetAngle = p.orbitAngle
      const targetX = cx + Math.cos(targetAngle) * formRadius * 1.2
      const targetY = cy + Math.sin(targetAngle) * formRadius * 1.2
      const dx = targetX - p.x
      const dy = targetY - p.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < 5) {
        p.arrived = true
      } else {
        p.x += dx * convergenceSpeed * dt * 0.02
        p.y += dy * convergenceSpeed * dt * 0.02
      }
    } else {
      // Orbit the form
      p.orbitAngle += p.orbitSpeed * dt

      let orbitRadius = formRadius * 1.1

      // Audio reactivity during playing
      if (stage === 'playing' && freqBands) {
        orbitRadius += freqBands.bass * formRadius * 0.15
        p.orbitSpeed = 0.002 + freqBands.mid * 0.008
        p.size = (1 + Math.random() * 2) * (1 + freqBands.high * 0.5)
      }

      const targetX = cx + Math.cos(p.orbitAngle) * orbitRadius
      const targetY = cy + Math.sin(p.orbitAngle) * orbitRadius
      p.x += (targetX - p.x) * 0.03
      p.y += (targetY - p.y) * 0.03
    }
  })
}

function drawParticles(ctx, particles, color) {
  // Draw connecting lines first (behind particles)
  ctx.save()
  const maxDist = 60 * window.devicePixelRatio
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x
      const dy = particles[i].y - particles[j].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < maxDist) {
        const alpha = (1 - dist / maxDist) * 0.07
        ctx.globalAlpha = alpha
        ctx.strokeStyle = rgba(color, 1)
        ctx.lineWidth = 0.5 * window.devicePixelRatio
        ctx.beginPath()
        ctx.moveTo(particles[i].x, particles[i].y)
        ctx.lineTo(particles[j].x, particles[j].y)
        ctx.stroke()
      }
    }
  }

  // Draw particles
  particles.forEach(p => {
    ctx.globalAlpha = p.brightness
    ctx.fillStyle = rgba(color, 1)
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * window.devicePixelRatio, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.restore()
}

// ─── PULSE (AUDIO-REACTIVE) ────────────────────────────────────────────────────

function drawPulse(ctx, freqBands, cx, cy, formRadius, color, time, dna, sparks) {
  if (!freqBands) return

  ctx.save()

  // Bass ring
  const bassRadius = formRadius * (1.3 + freqBands.bass * 0.3)
  ctx.globalAlpha = 0.05 + freqBands.bass * 0.03
  ctx.strokeStyle = rgba(color, 1)
  ctx.lineWidth = 1 * window.devicePixelRatio
  ctx.beginPath()
  ctx.arc(cx, cy, bassRadius, 0, Math.PI * 2)
  ctx.stroke()

  // High sparkle: spawn sparks at random form-contour points
  if (freqBands.high > 0.4) {
    const sparkAngle = Math.random() * Math.PI * 2
    const sparkR = formRadius * (0.9 + Math.random() * 0.3)
    sparks.push({
      x: cx + Math.cos(sparkAngle) * sparkR,
      y: cy + Math.sin(sparkAngle) * sparkR,
      life: 1,
      maxLife: 0.2 + Math.random() * 0.2, // 200-400ms in seconds
    })
  }

  // Draw and age sparks
  for (let i = sparks.length - 1; i >= 0; i--) {
    const spark = sparks[i]
    spark.life -= 1 / 60 / spark.maxLife
    if (spark.life <= 0) {
      sparks.splice(i, 1)
      continue
    }
    ctx.globalAlpha = spark.life * 0.7
    ctx.fillStyle = rgba(color, 1)
    ctx.beginPath()
    ctx.arc(spark.x, spark.y, 1.5 * window.devicePixelRatio, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

// ─── AUDIO ANALYSER ─────────────────────────────────────────────────────────────

function connectAnalyser(audioElement) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const source = audioCtx.createMediaElementSource(audioElement)
  const analyser = audioCtx.createAnalyser()
  analyser.fftSize = 256
  source.connect(analyser)
  analyser.connect(audioCtx.destination)
  return { analyser, audioCtx }
}

function getFrequencyBands(analyser) {
  const data = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(data)
  const len = data.length
  const bassEnd = Math.floor(len * 0.15)
  const midEnd = Math.floor(len * 0.5)

  const bass = Array.from(data.slice(0, bassEnd)).reduce((a, b) => a + b, 0) / (bassEnd * 255)
  const mid = Array.from(data.slice(bassEnd, midEnd)).reduce((a, b) => a + b, 0) / ((midEnd - bassEnd) * 255)
  const high = Array.from(data.slice(midEnd)).reduce((a, b) => a + b, 0) / ((len - midEnd) * 255)
  return { bass, mid, high }
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────────

export default function RevealVisualizer({ avd, stage, audioElement }) {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)
  const dnaRef = useRef(null)
  const particlesRef = useRef(null)
  const analyserRef = useRef(null)
  const audioCtxRef = useRef(null)
  const connectedElementRef = useRef(null)
  const sparksRef = useRef([])
  const drawStartRef = useRef(null)
  const lastTimeRef = useRef(null)

  // Extract DNA once
  useEffect(() => {
    if (avd) {
      dnaRef.current = extractVisualDNA(avd)
    }
  }, [avd])

  // Audio analyser removed — Orchestra owns the MediaElementSource.
  // Visualization renders from AVD data without audio reactivity.

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    drawStartRef.current = Date.now()
    lastTimeRef.current = performance.now()

    // Frame skip for 30fps target
    let lastFrameTime = 0
    const frameInterval = 1000 / 30

    const render = (timestamp) => {
      frameRef.current = requestAnimationFrame(render)

      // Throttle to ~30fps
      if (timestamp - lastFrameTime < frameInterval) return
      lastFrameTime = timestamp

      const dna = dnaRef.current
      if (!dna) return

      const dpr = window.devicePixelRatio || 1
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const cx = w / 2
      const cy = h * 0.38
      const baseRadius = Math.min(w, h) * 0.2
      const time = (Date.now() - drawStartRef.current) / 1000
      const color = getPrimaryColor(dna.v)

      // Initialize particles once
      if (!particlesRef.current) {
        particlesRef.current = createParticles(dna, w * dpr, h * dpr)
        // Convert particle positions to CSS pixels
        particlesRef.current.forEach(p => {
          p.x = Math.random() * w
          p.y = Math.random() * h
        })
      }

      // Compute draw progress (0-1) over 10 seconds during computing
      let formDrawProgress = 1
      if (stage === 'computing') {
        formDrawProgress = Math.min(1, time / 10)
      }

      // Slow rotation during playing
      let rotationAngle = 0
      if (stage === 'playing' || stage === 'reveal' || stage === 'choices') {
        rotationAngle = time * (Math.PI * 2 / 120) // full rotation in 120s
      }

      // Build form points
      const formPoints = buildFormPoints(dna, cx, cy, baseRadius, time)

      // Apply rotation
      if (rotationAngle !== 0) {
        formPoints.forEach(pt => {
          const dx = pt.x - cx
          const dy = pt.y - cy
          const cos = Math.cos(rotationAngle)
          const sin = Math.sin(rotationAngle)
          pt.x = cx + dx * cos - dy * sin
          pt.y = cy + dx * sin + dy * cos
        })
      }

      // Get frequency bands if playing
      let freqBands = null
      if (analyserRef.current && (stage === 'playing' || stage === 'reveal' || stage === 'choices')) {
        freqBands = getFrequencyBands(analyserRef.current)
      }

      // Amplitude breathing
      let amplitudeScale = 1
      if (freqBands) {
        const rms = (freqBands.bass + freqBands.mid + freqBands.high) / 3
        amplitudeScale = 1 + rms * 0.06
      }

      // Apply amplitude scale to form points
      if (amplitudeScale !== 1) {
        formPoints.forEach(pt => {
          pt.x = cx + (pt.x - cx) * amplitudeScale
          pt.y = cy + (pt.y - cy) * amplitudeScale
        })
      }

      // ─── Draw layers ───

      // Layer 2: Field (particles) — behind form
      const dt = 1 // normalized time step at 30fps
      updateParticles(particlesRef.current, formPoints, dna, cx, cy, baseRadius, stage, freqBands, dt)
      drawParticles(ctx, particlesRef.current, color)

      // Layer 1: Form (concentric rings)
      const ringCount = Math.max(1, dna.finalLayer)

      // During computing, reveal rings progressively
      let ringsToShow = ringCount
      if (stage === 'computing') {
        ringsToShow = Math.min(ringCount, Math.floor(formDrawProgress * ringCount) + 1)
      }

      // Mid shimmer: boost outer ring opacity during audio
      for (let r = 0; r < ringsToShow; r++) {
        let ringProgress = 1
        if (stage === 'computing') {
          // Each ring draws as form progresses
          const ringStart = r / ringCount
          const ringEnd = (r + 1) / ringCount
          ringProgress = Math.max(0, Math.min(1, (formDrawProgress - ringStart) / (ringEnd - ringStart)))
        }

        // Compute segment draw progress within this ring
        const segProgress = ringProgress

        drawFormRing(ctx, formPoints, dna, r, ringCount, color, time, segProgress)
      }

      // Layer 3: Pulse (audio-reactive, playing only)
      if (freqBands) {
        drawPulse(ctx, freqBands, cx, cy, baseRadius, color, time, dna, sparksRef.current)
      }
    }

    frameRef.current = requestAnimationFrame(render)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [stage])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {})
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  )
}
