// Reflection-screen line generators. Each signal renders as:
//   { signal: <what we observed>, interpretation: <what it points to> }.
// Designed to be read line-by-line on cream paper, italic serif.

import { computeBpm } from './moment.js'
import { dominantGemsTag } from './gemsTags.js'
import { buildEraLine } from './era.js'

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

function buildGemsLine(phaseData) {
  const dom = dominantGemsTag(phaseData.gems?.excerpts)
  if (!dom) {
    return {
      signal: 'no emotion tiles selected',
      interpretation: 'you held back. some things resist naming.',
    }
  }
  const interp = {
    nostalgic:   'you let nostalgia land — most people skip past it',
    awed:        'you stayed open to wonder — that\'s harder than it sounds',
    tender:      'tenderness reached you — you let it',
    melancholic: 'you let the sad ones in. you weren\'t looking away',
    defiant:     'you found something to push against',
    peaceful:    'you let the room be quiet',
  }[dom] || 'something landed'
  return {
    signal: `${dom} kept showing up`,
    interpretation: interp,
  }
}

function buildAutobioLine(phaseData) {
  const songs = phaseData.autobio?.songs || []
  if (songs.length === 0) {
    return {
      signal: 'no songs named',
      interpretation: 'sometimes the song comes later',
    }
  }
  const cluster = phaseData.autobio?.eraSummary
  const eraLine = buildEraLine(cluster)
  if (eraLine) {
    // Strong interpretation when bump-period clustering detected
    // (Krumhansl & Zupnick 2013: ages 14–22 leave the deepest musical imprint).
    const interpretation = cluster?.tightCluster
      ? 'this is the music your body remembers — your formative window'
      : cluster?.clustered
        ? 'your taste has a centre of gravity — that decade is part of you'
        : 'a body remembers the music it grew up beside'
    return { signal: eraLine, interpretation }
  }
  const first = songs[0]
  return {
    signal: `you started with ${first.title}`,
    interpretation: 'the first song matters more than you think',
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
    gems: buildGemsLine(phaseData),
    moment: buildMomentLine(phaseData),
    autobio: buildAutobioLine(phaseData),
  }
}
