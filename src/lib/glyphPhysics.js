// Pure force-field physics for one particle. Called per-particle, per-frame
// from BackgroundGlyph's rAF loop. Mutates the passed particle in place
// (perf — we'd allocate ~1000 objects per frame otherwise) and returns it
// for chaining. No canvas or DOM dependencies.
//
// Force model:
//   - Released particles spring toward target (tx,ty). Un-released ones
//     spring toward scatter (sx,sy) so they don't drift off-screen.
//   - Phone motion contributes a constant-direction force (the caller
//     passes the current motion vector).
//   - Settled particles (those that arrived at target a while ago) have
//     their motion-force coupling scaled down by SETTLED_MOTION_COUPLING
//     so the formed geometry breathes gently with phone tilt instead of
//     dissolving back into the cloud.
//   - Velocity is damped each step by DAMPING (per-second exponential).
//
// Conceptually:
//   v += (spring_force + motion_force) * dt
//   v *= (1 - DAMPING * dt)
//   pos += v * dt
//
// All quantities in the same normalised ±50 origin-centered space the
// particles live in. dt is in seconds.

export const PHYSICS = {
  // Spring strength toward target (for released particles). Higher = snappier.
  SPRING_RELEASED: 6.0,
  // Spring strength toward scatter (for un-released particles). Looser.
  SPRING_UNRELEASED: 0.8,
  // Velocity damping (per-second, exponential). Higher = stickier.
  DAMPING: 3.0,
  // Constant scaling on the motion force vector before it's added to velocity.
  // Tuned so a phone tilt of pan=1 (max) imparts a noticeable but not
  // overwhelming drift on un-released particles.
  MOTION_FORCE: 40.0,
  // Coupling factor applied to motion force for settled particles.
  // 0.1 = settled particles feel 10× less motion than active ones.
  SETTLED_MOTION_COUPLING: 0.1,
  // How long after releasedAt before the particle counts as "settled".
  // After this, motion coupling drops to SETTLED_MOTION_COUPLING.
  SETTLED_AFTER_MS: 1500,
}

// Step one particle forward by dt seconds.
// p: particle object with x, y, vx, vy, tx, ty, sx, sy, releasedAt
// dt: time step in seconds
// motionForce: { x, y } — phone-motion force vector in particle-space units
// nowMs: current performance.now() — used to determine settled state
//
// Mutates p in place. Returns p for chaining.
export function stepParticle(p, dt, motionForce, nowMs) {
  const released = p.releasedAt > 0 && nowMs >= p.releasedAt
  const settled = released && (nowMs - p.releasedAt) > PHYSICS.SETTLED_AFTER_MS

  // Spring target: released → its real target; otherwise its scatter point.
  const targetX = released ? p.tx : p.sx
  const targetY = released ? p.ty : p.sy
  const springK = released ? PHYSICS.SPRING_RELEASED : PHYSICS.SPRING_UNRELEASED

  // Force = spring (target - pos) * k + motion * MOTION_FORCE * coupling
  const motionCoupling = settled ? PHYSICS.SETTLED_MOTION_COUPLING : 1.0
  const fx = (targetX - p.x) * springK + motionForce.x * PHYSICS.MOTION_FORCE * motionCoupling
  const fy = (targetY - p.y) * springK + motionForce.y * PHYSICS.MOTION_FORCE * motionCoupling

  // v = (v + F*dt) * (1 - DAMPING*dt). The (1 - k*dt) factor is a
  // first-order approximation of exp(-k*dt); fine for dt ~ 1/60.
  const damp = Math.max(0, 1 - PHYSICS.DAMPING * dt)
  p.vx = (p.vx + fx * dt) * damp
  p.vy = (p.vy + fy * dt) * damp
  p.x += p.vx * dt
  p.y += p.vy * dt
  return p
}
