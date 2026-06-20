// src/lib/equalPower.js
// Constant-power crossfade: as balance sweeps [-1,1], left²+right²=1 so the
// perceived loudness stays flat. Used by the Lean texture pair and the Face
// ring spotlight. Pure — unit-tested.
export function equalPowerGains(balance) {
  const b = Math.max(-1, Math.min(1, balance))
  const t = (b + 1) / 2 // 0..1
  return {
    left: Math.cos((t * Math.PI) / 2),
    right: Math.sin((t * Math.PI) / 2),
  }
}
