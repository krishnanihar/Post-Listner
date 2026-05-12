/* Full 2D SVG conductor figure for /conduct-glb.
 *
 * Traces the GLB back-view silhouette (head + hair tuft + headphones +
 * torso + coat) as hand-authored SVG paths in a 1080×1080 viewBox, and
 * drives each part with phone pitch/roll so the whole figure feels
 * alive — not just one twitching hand.
 *
 * Layered (back → front):
 *   1. Coat hem      — sways with roll
 *   2. Torso/coat    — leans with roll, breath-bobs with pitch
 *   3. Right arm     — 2-bone IK to a hand position derived from phone
 *   4. Head + hair tuft + headphones — tilts with pitch + roll
 *
 * Inputs from usePhone():
 *   controls.pitch  ∈ [-1, +1]   phone tipped forward = positive
 *   controls.roll   ∈ [-1, +1]   phone tilted right   = positive
 *   controls.lastDownbeatAt + downbeatIntensity → arm pulse
 */
import { useEffect, useRef, useState } from 'react'
import { usePhone } from './ConductGlb'

const INK = '#1C1814'
const PAPER = '#F2EBD8'

// Smoothing time constant (seconds). Lower = snappier response.
const SMOOTH_TC = 0.10

// Phone deflection scaling — how much each input axis moves things.
const ARM_REACH_X = 280        // hand sweeps ± this many viewBox units on roll
const ARM_REACH_Y = 280        // hand sweeps ± this on pitch
const ARM_REST_DX = -110       // hand parked outside the body silhouette at rest
const ARM_REST_DY = 220        // hand parked below shoulder at rest
const UPPER_LEN = 200
const FOREARM_LEN = 180

const BODY_ROLL_DEG = 8        // whole upper body lean
const BODY_BREATH_PX = 14      // vertical translate from pitch
const HEAD_PITCH_DEG = 16      // head tilt forward/back
const HEAD_ROLL_DEG = 12       // head tilt side-to-side
const COAT_SWAY_DEG = 6        // coat hem sway

// Anatomy anchors (viewBox coords).
const NECK_PIVOT_X = 540
const NECK_PIVOT_Y = 360
const WAIST_PIVOT_X = 540
const WAIST_PIVOT_Y = 760
const SHOULDER_X = 410        // figure's right shoulder (screen-left in back view)
const SHOULDER_Y = 410

function damp(current, target, tc, dt) {
  if (tc <= 0) return target
  const k = 1 - Math.exp(-dt / tc)
  return current + (target - current) * k
}

// 2-bone planar IK: returns elbow position given shoulder S, hand H,
// two bone lengths and a bend direction (+1 = elbow drops below the
// S→H line).
function elbowFromIK(sx, sy, hx, hy, L1, L2, bend) {
  const dx = hx - sx, dy = hy - sy
  const dist = Math.hypot(dx, dy)
  const reach = Math.min(dist, L1 + L2 - 0.01)
  const cosA = (L1 * L1 + reach * reach - L2 * L2) / (2 * L1 * reach || 1)
  const a = Math.acos(Math.max(-1, Math.min(1, cosA)))
  const baseAngle = Math.atan2(dy, dx)
  const elbowAngle = baseAngle + a * bend
  return { x: sx + Math.cos(elbowAngle) * L1, y: sy + Math.sin(elbowAngle) * L1 }
}

// Build a tapered arm path from shoulder → elbow → wrist with widths
// SW (shoulder), EW (elbow), WW (wrist). Returns a closed SVG path.
function armPath(S, E, W, SW, EW, WW) {
  function perp(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    return { x: -dy / len, y: dx / len }
  }
  const pSE = perp(S.x, S.y, E.x, E.y)
  const pEW = perp(E.x, E.y, W.x, W.y)
  const pE = { x: (pSE.x + pEW.x) / 2, y: (pSE.y + pEW.y) / 2 }
  const pELen = Math.hypot(pE.x, pE.y) || 1
  pE.x /= pELen; pE.y /= pELen
  const sw = SW / 2, ew = EW / 2, ww = WW / 2
  const sOut = { x: S.x + pSE.x * sw, y: S.y + pSE.y * sw }
  const eOut = { x: E.x + pE.x * ew,  y: E.y + pE.y * ew }
  const wOut = { x: W.x + pEW.x * ww, y: W.y + pEW.y * ww }
  const sIn  = { x: S.x - pSE.x * sw, y: S.y - pSE.y * sw }
  const eIn  = { x: E.x - pE.x * ew,  y: E.y - pE.y * ew }
  const wIn  = { x: W.x - pEW.x * ww, y: W.y - pEW.y * ww }
  return [
    `M ${sOut.x} ${sOut.y}`,
    `Q ${eOut.x} ${eOut.y} ${wOut.x} ${wOut.y}`,
    `A ${ww} ${ww} 0 0 1 ${wIn.x} ${wIn.y}`,
    `Q ${eIn.x} ${eIn.y} ${sIn.x} ${sIn.y}`,
    `A ${sw} ${sw} 0 0 1 ${sOut.x} ${sOut.y}`,
    'Z',
  ].join(' ')
}

export default function ConductorFigure2D() {
  const { stateRef } = usePhone()
  const smoothed = useRef({ pitch: 0, roll: 0 })
  const lastTime = useRef(0)
  const [pose, setPose] = useState({ pitch: 0, roll: 0, pulse: 0 })

  useEffect(() => {
    let raf = 0
    let mounted = true
    const tick = (now) => {
      if (!mounted) return
      const dt = lastTime.current ? Math.min(0.1, (now - lastTime.current) / 1000) : 0.016
      lastTime.current = now

      const s = stateRef.current
      const c = s.controls
      const targetPitch = s.calibrated ? c.pitch : 0
      const targetRoll  = s.calibrated ? c.roll  : 0
      smoothed.current.pitch = damp(smoothed.current.pitch, targetPitch, SMOOTH_TC, dt)
      smoothed.current.roll  = damp(smoothed.current.roll,  targetRoll,  SMOOTH_TC, dt)

      const beatAt = c.lastDownbeatAt || 0
      const age = beatAt ? (now - beatAt) / 1000 : 999
      const pulse = age < 0.25 ? (1 - age / 0.25) * (c.downbeatIntensity || 0) : 0

      setPose({
        pitch: smoothed.current.pitch,
        roll: smoothed.current.roll,
        pulse,
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { mounted = false; cancelAnimationFrame(raf) }
  }, [stateRef])

  // Phone-derived transforms.
  const bodyRollDeg = pose.roll * BODY_ROLL_DEG
  const bodyBreathPx = pose.pitch * BODY_BREATH_PX
  const headPitchDeg = -pose.pitch * HEAD_PITCH_DEG  // forward tilt = chin down = negative rotate
  const headRollDeg  = -pose.roll  * HEAD_ROLL_DEG
  const coatSwayDeg  = pose.roll * COAT_SWAY_DEG

  // Hand world position (in body-local coords, BEFORE the body's roll
  // transform is applied). The arm is parented to the body group so it
  // inherits the lean automatically.
  const handX = SHOULDER_X + ARM_REST_DX + pose.roll * ARM_REACH_X
  const handY = SHOULDER_Y + ARM_REST_DY + pose.pitch * ARM_REACH_Y
  const elbow = elbowFromIK(SHOULDER_X, SHOULDER_Y, handX, handY, UPPER_LEN, FOREARM_LEN, 1)
  const armD = armPath(
    { x: SHOULDER_X, y: SHOULDER_Y },
    elbow,
    { x: handX, y: handY },
    90,            // shoulder width
    60 + pose.pulse * 6,  // elbow
    44 + pose.pulse * 8,  // wrist
  )
  const handAngle = Math.atan2(handY - elbow.y, handX - elbow.x) * 180 / Math.PI

  return (
    <svg
      viewBox="0 0 1080 1080"
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <defs>
        {/* Subtle starfield pattern — small white dots on dark ink. */}
        <pattern id="starfield" width="42" height="42" patternUnits="userSpaceOnUse">
          <rect width="42" height="42" fill={INK} />
          <circle cx="6" cy="10" r="0.9" fill={PAPER} opacity="0.55" />
          <circle cx="22" cy="4" r="0.6" fill={PAPER} opacity="0.4" />
          <circle cx="35" cy="18" r="1.1" fill={PAPER} opacity="0.7" />
          <circle cx="13" cy="28" r="0.7" fill={PAPER} opacity="0.5" />
          <circle cx="30" cy="34" r="0.5" fill={PAPER} opacity="0.4" />
          <circle cx="3" cy="38" r="0.8" fill={PAPER} opacity="0.55" />
        </pattern>
      </defs>

      {/* COAT HEM — back layer. Sways with roll, hinged at the waist. */}
      <g transform={`rotate(${coatSwayDeg} ${WAIST_PIVOT_X} ${WAIST_PIVOT_Y})`}>
        <path
          d="
            M 380 760
            C 360 880, 320 980, 290 1080
            L 790 1080
            C 760 980, 720 880, 700 760
            Z
          "
          fill="url(#starfield)"
        />
      </g>

      {/* BODY GROUP — torso + arm + head all parented here. Leans with
          roll (rotate at waist), bobs with breath (translate Y). */}
      <g
        transform={`
          translate(0 ${bodyBreathPx})
          rotate(${bodyRollDeg} ${WAIST_PIVOT_X} ${WAIST_PIVOT_Y})
        `}
      >
        {/* TORSO + shoulders. Tapered cylinder with broader shoulders
            and a slight V-neck shape at the top. */}
        <path
          d="
            M 410 410
            C 405 470, 400 540, 405 620
            C 410 700, 420 760, 440 800
            L 640 800
            C 660 760, 670 700, 675 620
            C 680 540, 675 470, 670 410
            C 660 395, 640 385, 600 380
            L 480 380
            C 440 385, 420 395, 410 410
            Z
          "
          fill="url(#starfield)"
        />

        {/* RIGHT ARM. Lives in body-group so it inherits the lean. */}
        <path d={armD} fill="url(#starfield)" />
        {/* Hand — oriented oval. */}
        <ellipse
          cx={handX}
          cy={handY}
          rx={32 + pose.pulse * 6}
          ry={22 + pose.pulse * 4}
          fill={INK}
          transform={`rotate(${handAngle} ${handX} ${handY})`}
        />

        {/* HEAD GROUP — hair tuft, head, headphones. Tilts with pitch +
            roll around the neck pivot. */}
        <g transform={`rotate(${headPitchDeg + headRollDeg} ${NECK_PIVOT_X} ${NECK_PIVOT_Y})`}>
          {/* Headphone band — arcs over the crown of the head. Stays
              behind hair tuft, in front of head shape. */}
          {/* Head silhouette: rounded back-of-skull with hair texture. */}
          <path
            d="
              M 540 130
              C 460 130, 410 180, 410 260
              C 410 310, 425 350, 470 365
              L 610 365
              C 655 350, 670 310, 670 260
              C 670 180, 620 130, 540 130
              Z
            "
            fill="url(#starfield)"
          />
          {/* Hair tuft — irregular blob silhouette on top-back of skull. */}
          <path
            d="
              M 470 145
              C 460 120, 480 95, 510 100
              C 525 80, 555 85, 565 105
              C 585 95, 605 110, 600 135
              C 615 145, 615 165, 600 175
              C 585 165, 565 170, 550 175
              C 530 170, 510 168, 490 175
              C 475 170, 462 158, 470 145
              Z
            "
            fill={INK}
          />
          {/* Headphone band — half-torus arc above head. */}
          <path
            d="M 410 245 Q 540 175 670 245"
            fill="none"
            stroke={INK}
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* Earpieces — small cups on each side. */}
          <ellipse cx="408" cy="265" rx="20" ry="28" fill={INK} />
          <ellipse cx="672" cy="265" rx="20" ry="28" fill={INK} />
        </g>
      </g>
    </svg>
  )
}
