// src/lib/textureToAvd.js
// Maps a classified answer texture (Admirer spec §3.3) to a signed AVD target,
// and blends the observed answer with the question's own intent (read-trust
// alpha, spec §3.2). Pure — consumed by Admirer.jsx's onRecordAnswer.

export const TEXTURE_BASE = {
  calm:        { a: -0.5, v: 0.6, d: 0.0 },
  sharp:       { a: 0.6, v: -0.5, d: -0.2 },
  melancholic: { a: -0.4, v: -0.5, d: 0.6 },
  exalted:     { a: 0.6, v: 0.6, d: 0.6 },
}

// Read-trust: weight the observed answer over the question's intent.
export const READ_TRUST_ALPHA = 0.6

function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

// Texture + intensity → AVD target. A weaker answer (low intensity) lands
// closer to neutral. Unknown texture → neutral (no movement).
export function textureToTarget(texture, intensity = 1) {
  const base = TEXTURE_BASE[texture]
  if (!base) return { a: 0, v: 0, d: 0 }
  const k = clamp01(intensity)
  return { a: base.a * k, v: base.v * k, d: base.d * k }
}

// direction = alpha·observed + (1-alpha)·intent, per axis (spec §3.2).
export function blendTarget(observed, intent = { a: 0, v: 0, d: 0 }, alpha = READ_TRUST_ALPHA) {
  return {
    a: alpha * observed.a + (1 - alpha) * intent.a,
    v: alpha * observed.v + (1 - alpha) * intent.v,
    d: alpha * observed.d + (1 - alpha) * intent.d,
  }
}
