// Reflection-screen line generators. Each signal renders as:
//   { signal: <what we observed>, interpretation: <what it points to> }.
// Designed to be read line-by-line on cream paper, italic serif.

import { computeBpm } from './moment.js'

function dominantSide(pairs) {
  let left = 0, right = 0
  const labels = { left: [], right: [] }
  for (const p of pairs) {
    if (p.choice === 'left') { left++; labels.left.push(p.label) }
    if (p.choice === 'right') { right++; labels.right.push(p.label) }
  }
  if (right >= left) return { count: right, total: pairs.length, side: 'right', samples: labels.right }
  return { count: left, total: pairs.length, side: 'left', samples: labels.left }
}

function buildSpectrumLine(phaseData) {
  const pairs = phaseData.spectrum?.pairs || []
  if (pairs.length === 0) {
    return {
      signal: 'no spectrum data',
      interpretation: 'a blank page is also a kind of answer',
    }
  }
  const dom = dominantSide(pairs)
  const sample = dom.samples[0] || 'a word'
  const otherSample = dom.samples[1] || ''
  const examples = otherSample ? `${sample}, ${otherSample}` : sample

  return {
    signal: `${examples} chosen ${dom.count} of ${dom.total} times`,
    interpretation: `you favor ${examples.split(',')[0]} — your hand keeps reaching the same way`,
  }
}

function buildDepthLine(phaseData) {
  const layer = phaseData.depth?.finalLayer || 1
  let interp
  if (layer <= 2) interp = 'you stayed close to the surface — repetition was a kind of refuge'
  else if (layer <= 5) interp = 'you went in until the room had shape'
  else interp = 'you stayed until the layers stopped arriving'

  return {
    signal: `you held ${layer} of 8 layers`,
    interpretation: interp,
  }
}

function buildTexturesLine(phaseData) {
  const kept = phaseData.textures?.preferred || []
  if (kept.length === 0) {
    return {
      signal: 'no textures kept',
      interpretation: 'you let everything go — spareness is also a kind of taste',
    }
  }
  const list = kept.slice(0, 3).join(', ')
  const interp = kept.length === 1
    ? `you only kept ${list} — that means something`
    : `you kept ${list} — these are the ones you'll come back to`
  return {
    signal: `kept: ${list}`,
    interpretation: interp,
  }
}

function buildMomentLine(phaseData) {
  const bpm = computeBpm(phaseData.moment)
  if (bpm === null) {
    return {
      signal: 'no tempo recorded',
      interpretation: 'you held a stillness — that is also a tempo',
    }
  }
  let interp
  if (bpm < 70) interp = 'a contemplative pace — the tempo of a long thought'
  else if (bpm < 100) interp = 'a walking pace — measured, deliberate'
  else if (bpm < 130) interp = 'a steady drive — the tempo of moving forward'
  else interp = 'a quickened pulse — the tempo of something arriving'

  return {
    signal: `your tap tempo: ${bpm} BPM`,
    interpretation: interp,
  }
}

export function buildReflectionLines(avd, phaseData) {
  return {
    spectrum: buildSpectrumLine(phaseData),
    depth: buildDepthLine(phaseData),
    textures: buildTexturesLine(phaseData),
    moment: buildMomentLine(phaseData),
  }
}
