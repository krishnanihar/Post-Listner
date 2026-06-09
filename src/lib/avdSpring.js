// Critically-damped (ζ = 1) spring integrator for per-frame visual easing of
// the AVD shader uniforms (Ship-Blockers §2: ω = 6 rad/s ⇒ ~250 ms response,
// no overshoot). Analytic integration (Ryan Juckett, "Damped Springs") so the
// step is stable at any dt and never overshoots the target.

export const SPRING_OMEGA = 6 // rad/s

// Map signed AVD [-1, 1] to [0, 1] for shader/uniform consumers that want a
// unit range.
export function toUnit(signed) {
  return (signed + 1) / 2
}

// One spring step. Returns { value, velocity }. Pass the previous value +
// velocity back in each frame. `omega` defaults to SPRING_OMEGA.
export function stepSpring(value, velocity, target, dt, omega = SPRING_OMEGA) {
  const err = value - target
  const exp = Math.exp(-omega * dt)
  const newValue = target + (err + (velocity + omega * err) * dt) * exp
  const newVelocity = (velocity - (velocity + omega * err) * omega * dt) * exp
  return { value: newValue, velocity: newVelocity }
}
