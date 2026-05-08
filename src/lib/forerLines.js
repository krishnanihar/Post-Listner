// Mirror copy generators. All functions take phaseData (and optionally `now` Date)
// and return strings rendered during the Mirror beat in Reveal.

import { computeBpm } from './moment.js'

function dominantSpectrumLabel(pairs) {
  if (!pairs?.length) return null
  const counts = {}
  for (const p of pairs) {
    if (!p.label) continue
    counts[p.label] = (counts[p.label] || 0) + 1
  }
  let topLabel = null, topCount = 0
  for (const [k, v] of Object.entries(counts)) {
    if (v > topCount) { topCount = v; topLabel = k }
  }
  return topLabel
}

function tempoDescriptor(moment) {
  const bpm = computeBpm(moment)
  if (bpm === null) return 'held still'
  if (bpm < 70) return 'tapped slow'
  if (bpm < 100) return 'kept a walking pulse'
  if (bpm < 130) return 'tapped with momentum'
  return 'tapped fast'
}

function depthDescriptor(layer) {
  if (layer <= 2) return 'stayed close to the surface'
  if (layer <= 5) return 'went past the surface'
  return 'held all the way down'
}

export function buildBecauseLine(phaseData) {
  const label = dominantSpectrumLabel(phaseData.spectrum?.pairs) || 'a word'
  const layer = phaseData.depth?.finalLayer || 1

  return [
    `because you chose ${label}`,
    `because you ${depthDescriptor(layer)}`,
    `because you ${tempoDescriptor(phaseData.moment)}`,
  ]
}

export function buildMemoryCallback(phaseData) {
  const songs = phaseData.autobio?.songs || []
  if (songs.length > 0) {
    const first = songs[0]
    if (first.year) {
      return `when you said ${first.title} from ${first.year}, i knew`
    }
    return `when you said ${first.title}, i knew`
  }
  const label = dominantSpectrumLabel(phaseData.spectrum?.pairs)
  if (label) {
    return `you said ${label} more than once. i listened.`
  }
  return null
}

export function buildTimeOfDayLine(now = new Date()) {
  const hour = now.getHours()
  if (hour >= 23 || hour < 4) {
    return 'you came to me at this hour. that means something.'
  }
  if (hour >= 4 && hour < 9) {
    return 'you got here early. most people sleep through this.'
  }
  if (hour >= 11 && hour < 14) {
    return 'the middle of the day is hard for music. you came anyway.'
  }
  if (hour >= 18 && hour < 23) {
    return 'the light is going. that helps.'
  }
  return 'this hour suits you.'
}

export function buildLatencyLine(phaseData) {
  const pairs = phaseData.spectrum?.pairs || []
  if (pairs.length === 0) return null
  const total = pairs.reduce((s, p) => s + (p.reactionMs || 0), 0)
  const avg = total / pairs.length
  if (avg > 3500) return 'you took your time. that\'s what i needed from you.'
  if (avg < 1500) return 'you knew what you wanted. that helped.'
  return null
}

function pad2(n) { return n < 10 ? `0${n}` : `${n}` }

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function buildTemporalFrame(now = new Date()) {
  const h24 = now.getHours()
  const min = now.getMinutes()
  const period = h24 >= 12 ? 'PM' : 'AM'
  const h12 = ((h24 % 12) || 12)
  const time = `${h12}:${pad2(min)} ${period}`
  const date = `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`
  return `Composed at ${time} on ${date}. Has never existed before.`
}
