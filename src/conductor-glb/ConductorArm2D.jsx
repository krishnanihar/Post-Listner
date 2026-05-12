/* 2D SVG arm overlay for /conduct-glb. Reads pitch/roll from the
 * shared phone state and drives a 2-bone arm (shoulder → elbow → hand)
 * with big amplitude so phone gestures produce unmistakable motion.
 *
 * Lives as an absolutely-positioned <svg> on top of the R3F Canvas.
 * Pointer events disabled so it doesn't intercept clicks. The shoulder
 * anchor point is reported up from ConductorGlbScene each frame so the
 * arm stays attached even if the Canvas size or camera changes.
 *
 * Motion model:
 *   handPx = shoulderPx + (roll, -pitch) × REACH
 *   elbowPx = 2-bone planar IK midpoint (law of cosines)
 *
 * Pitch is negated for Y because SVG Y grows downward.
 */
import { useEffect, useRef, useState } from 'react'
import { usePhone } from './ConductGlb'

const INK = '#1C1814'

// Reach: phone full deflection (±1) moves the hand this many pixels.
const REACH_PX = 320

// Rest offset: where the hand sits when phone is centered. Parked
// OUTSIDE the figure's silhouette (screen-left = figure's right) so the
// hand reads as a hanging arm against the parchment, not collapsed
// into the body. Phone motion then sweeps it from this visible rest.
const REST_DX = -70  // outward (screen-left) past the body edge
const REST_DY = 130  // hand at low chest height

// Bone lengths in pixels.
const UPPER_LEN = 170
const FOREARM_LEN = 150

// Arm taper widths (px). Wider at shoulder, narrower at wrist —
// matches an organic limb silhouette rather than a stick.
const SHOULDER_W = 60
const ELBOW_W = 44
const WRIST_W = 32

// Spring-style smoothing so the arm follows the phone but doesn't
// jitter on noise.
const SMOOTH_TC = 0.10 // seconds — lower = snappier

function damp(current, target, tc, dt) {
  if (tc <= 0) return target
  const k = 1 - Math.exp(-dt / tc)
  return current + (target - current) * k
}

// Planar 2-bone IK. Given shoulder S, hand H, two bone lengths L1, L2,
// find elbow E. Bend direction picks which of the two solutions to use
// (positive = bend "downward" from the S→H line, useful so the elbow
// naturally drops below).
function elbowFromIK(sx, sy, hx, hy, L1, L2, bend) {
  const dx = hx - sx
  const dy = hy - sy
  const dist = Math.hypot(dx, dy)
  // Clamp the reach: if hand is further than L1+L2, place elbow on
  // the straight line so the arm just fully extends.
  const reach = Math.min(dist, L1 + L2 - 0.01)
  const cosA = (L1 * L1 + reach * reach - L2 * L2) / (2 * L1 * reach || 1)
  const a = Math.acos(Math.max(-1, Math.min(1, cosA)))
  const baseAngle = Math.atan2(dy, dx)
  const elbowAngle = baseAngle + a * bend
  return {
    x: sx + Math.cos(elbowAngle) * L1,
    y: sy + Math.sin(elbowAngle) * L1,
  }
}

export default function ConductorArm2D({ shoulder }) {
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

      const state = stateRef.current
      const controls = state.controls
      const calibrated = state.calibrated
      const targetPitch = calibrated ? controls.pitch : 0
      const targetRoll = calibrated ? controls.roll : 0

      smoothed.current.pitch = damp(smoothed.current.pitch, targetPitch, SMOOTH_TC, dt)
      smoothed.current.roll = damp(smoothed.current.roll, targetRoll, SMOOTH_TC, dt)

      // Downbeat pulse: scale boost decays over 250ms.
      const beatAt = controls.lastDownbeatAt || 0
      const age = beatAt ? (performance.now() - beatAt) / 1000 : 999
      const pulse = age < 0.25 ? (1 - age / 0.25) * (controls.downbeatIntensity || 0) : 0

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

  if (!shoulder) return null

  // Convert shoulder fraction (0..1 viewport coords) to pixel position.
  // The SVG covers the full viewport via 100vw/100vh.
  const sx = shoulder.x * (shoulder.width || window.innerWidth)
  const sy = shoulder.y * (shoulder.height || window.innerHeight)

  // Hand: REST + phone offset. The hand sits below+forward of the
  // shoulder when phone is centered, then phone roll/pitch sweeps it
  // around. Big amplitude so even small phone tilts move the hand
  // unmistakably.
  //
  // Conducting convention: pitch forward (positive) = downstroke =
  // hand drops DOWN (SVG y increases). Pitch back = lift UP.
  // Roll right (positive) = hand to screen-right. Roll left = to
  // screen-left. (Viewer-intuitive: phone goes where hand goes.)
  const hx = sx + REST_DX + pose.roll * REACH_PX
  const hy = sy + REST_DY + pose.pitch * REACH_PX

  const elbow = elbowFromIK(sx, sy, hx, hy, UPPER_LEN, FOREARM_LEN, 1)
  const pulse = pose.pulse

  // Build a single tapered SVG path that wraps the entire arm. The
  // path traces ONE side of the arm from shoulder → elbow → wrist,
  // then crosses the hand, then traces the OTHER side back from wrist
  // → elbow → shoulder. With cubic smoothing at the joints it reads
  // as a single fluid limb (silhouette style), not two glued sticks.
  //
  // For each joint we need a perpendicular direction so we can offset
  // by the local half-width.
  function perp(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    return { x: -dy / len, y: dx / len }
  }
  const pSE = perp(sx, sy, elbow.x, elbow.y)            // shoulder→elbow normal
  const pEW = perp(elbow.x, elbow.y, hx, hy)            // elbow→wrist normal
  // Average the two normals at the elbow so the join is smooth.
  const pE = { x: (pSE.x + pEW.x) * 0.5, y: (pSE.y + pEW.y) * 0.5 }
  const pELen = Math.hypot(pE.x, pE.y) || 1
  pE.x /= pELen; pE.y /= pELen

  const sw = SHOULDER_W / 2
  const ew = (ELBOW_W + pulse * 4) / 2
  const ww = (WRIST_W + pulse * 4) / 2

  // Outer side of arm (right side as we walk shoulder→hand).
  const sOuter  = { x: sx + pSE.x * sw, y: sy + pSE.y * sw }
  const eOuter  = { x: elbow.x + pE.x * ew, y: elbow.y + pE.y * ew }
  const wOuter  = { x: hx + pEW.x * ww, y: hy + pEW.y * ww }
  // Inner side.
  const sInner  = { x: sx - pSE.x * sw, y: sy - pSE.y * sw }
  const eInner  = { x: elbow.x - pE.x * ew, y: elbow.y - pE.y * ew }
  const wInner  = { x: hx - pEW.x * ww, y: hy - pEW.y * ww }

  // Path: outer shoulder → outer elbow (Q-smoothed) → outer wrist
  //       → hand cap (arc to inner wrist) → inner wrist → inner elbow
  //       (Q-smoothed) → inner shoulder → close at shoulder cap.
  const handR = (WRIST_W + 8 + pulse * 8) / 2
  const armPath = [
    `M ${sOuter.x} ${sOuter.y}`,
    `Q ${eOuter.x} ${eOuter.y} ${wOuter.x} ${wOuter.y}`,
    `A ${handR} ${handR} 0 0 1 ${wInner.x} ${wInner.y}`,
    `Q ${eInner.x} ${eInner.y} ${sInner.x} ${sInner.y}`,
    // Round the shoulder cap.
    `A ${sw} ${sw} 0 0 1 ${sOuter.x} ${sOuter.y}`,
    'Z',
  ].join(' ')

  // Hand: an organic oval rather than a perfect circle, oriented along
  // the forearm direction so it reads as a hand, not a ball.
  const handAngle = Math.atan2(hy - elbow.y, hx - elbow.x) * 180 / Math.PI
  const handRx = 26 + pulse * 6
  const handRy = 18 + pulse * 4

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      <path d={armPath} fill={INK} />
      <ellipse
        cx={hx}
        cy={hy}
        rx={handRx}
        ry={handRy}
        fill={INK}
        transform={`rotate(${handAngle} ${hx} ${hy})`}
      />
    </svg>
  )
}
