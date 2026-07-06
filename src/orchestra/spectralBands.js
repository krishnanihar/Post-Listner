// Spectral band-splitter — the crux of keeping a *generated* mix a living,
// conductable instrument without Demucs stems.
//
// A single generated track is one mixed file. The Orchestra's expressive range
// (pan / filter / spotlight / downbeat / dynamics per source) comes from having
// 4 INDEPENDENT sources placed around the listener. This module manufactures
// those 4 sources from one mix by splitting it into frequency bands with 4th-
// order Linkwitz-Riley crossovers, then handing each band to the existing
// spatial graph exactly where a Demucs stem used to go:
//
//   bass  → the low register (kick + bass)        → OrchestraEngine BASS slot
//   drums → the low-mid (body, snare, rhythm)     → OrchestraEngine DRUMS slot
//   vocals→ the presence band (leads / melody)    → OrchestraEngine VOCALS slot
//   other → the air band (cymbals, shimmer, space)→ OrchestraEngine OTHER slot
//
// LR4 crossovers sum flat (two cascaded Butterworth biquads, Q=0.707 per edge),
// so the split loses nothing — the four bands ARE the mix, just separable in
// space and independently conductable. Because all four derive from ONE
// BufferSourceNode they are inherently sample-aligned (no cross-source drift is
// even possible), which is stronger than the 4-stem invariant it replaces.

// Crossover frequencies (Hz). Chosen so each band carries a musically distinct
// register: sub/bass, low-mid body, vocal/lead presence, air/cymbals.
export const BAND_EDGES = { low: 120, lowMid: 800, highMid: 3500 }

// Band name → { hp, lp } cutoffs (null end = open). Keys are the lowercase stem
// names OrchestraEngine.connectStems expects ({vocals, drums, bass, other}).
export const BAND_SPEC = {
  bass:   { hp: null,              lp: BAND_EDGES.low },
  drums:  { hp: BAND_EDGES.low,    lp: BAND_EDGES.lowMid },
  vocals: { hp: BAND_EDGES.lowMid, lp: BAND_EDGES.highMid },
  other:  { hp: BAND_EDGES.highMid, lp: null },
}

export const BAND_NAMES = Object.keys(BAND_SPEC)

// Two cascaded 2nd-order biquads = one 4th-order Linkwitz-Riley edge (24 dB/oct,
// flat magnitude sum with the complementary edge). Q = 1/√2 (Butterworth).
const LR4_Q = 0.7071067811865476

function makeEdge(ctx, type, freq) {
  const a = ctx.createBiquadFilter()
  const b = ctx.createBiquadFilter()
  for (const f of [a, b]) {
    f.type = type
    f.frequency.value = freq
    f.Q.value = LR4_Q
  }
  a.connect(b)
  return { input: a, output: b }
}

/**
 * Split `source` (any AudioNode carrying the full mix) into 4 band-output
 * GainNodes. Returns { outputs: {vocals, drums, bass, other}, dispose }.
 * `outputs[name]` is the band's summed output — connect it wherever a stem
 * source would go. `dispose()` disconnects every internal node for teardown.
 */
export function buildBandSplitter(ctx, source) {
  const outputs = {}
  const created = []
  for (const [name, spec] of Object.entries(BAND_SPEC)) {
    const edges = []
    if (spec.hp != null) edges.push(makeEdge(ctx, 'highpass', spec.hp))
    if (spec.lp != null) edges.push(makeEdge(ctx, 'lowpass', spec.lp))

    const bandGain = ctx.createGain()
    bandGain.gain.value = 1

    // source → edge0.in → … → edgeN.out → bandGain
    let prevOut = source
    for (const edge of edges) {
      prevOut.connect(edge.input)
      prevOut = edge.output
      created.push(edge.input, edge.output)
    }
    prevOut.connect(bandGain)
    created.push(bandGain)
    outputs[name] = bandGain
  }

  const dispose = () => {
    for (const n of created) {
      try { n.disconnect() } catch { /* already disconnected */ }
    }
  }

  return { outputs, dispose }
}
