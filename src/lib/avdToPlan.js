// AVD vector + faced archetype + era → an ElevenLabs music_v2 composition plan.
//
// This is the generative analogue of avdToStems.js: instead of picking one of
// 24 fixed tracks, it authors a per-session instrumental piece keyed to the
// continuous signed AVD vector (a,v,d) ∈ [-1,1]³, the world the listener faced,
// and the era year they searched. Pure + deterministic (no RNG) so it's unit-
// testable and reproducible.
//
// The plan is structured to the Orchestra's dramaturgy — a sparse intro, a
// build, a full body, a resolve — so the piece breathes wherever the listener
// catches it (the track loops silently across the Act1→Act2 gap, then the gain
// blooms in). force_instrumental is prompt-mode only, so instrumental output is
// guaranteed here via EMPTY section `lines` + negative "vocals" styles.
//
// Field names are the ElevenLabs Music API's snake_case request schema
// (verified against /v1/music/plan 2026-07-06): positive_global_styles,
// negative_global_styles, and sections of { section_name, positive_local_styles,
// negative_local_styles, duration_ms, lines }.

import { ARCHETYPES } from './archetypes.js'

// Per-archetype style seeds — the sonic identity of each world, drawn from its
// scoringWeights + variation microgenres. Editable data.
const ARCHETYPE_STYLES = {
  'late-night-architect': ['introspective', 'intricate', 'nocturnal', 'lo-fi piano', 'spacious'],
  'hearth-keeper':        ['warm', 'intimate', 'acoustic', 'folk', 'gentle'],
  'velvet-mystic':        ['lush', 'orchestral', 'dream-pop', 'chamber strings', 'reverberant'],
  'quiet-insurgent':      ['minor-key', 'brooding', 'post-rock', 'restrained', 'tense'],
  'slow-glow':            ['downtempo', 'groovy', 'warm', 'chillwave', 'patient'],
  'sky-seeker':           ['cinematic', 'expansive', 'triumphant', 'post-classical', 'soaring'],
}

const DEFAULT_STYLES = ['ambient', 'instrumental', 'atmospheric']

// AVD axis → descriptive style words. Signed [-1,1].
function arousalWords(a) {
  if (a < -0.33) return ['slow tempo', 'sparse', 'calm', 'unhurried']
  if (a > 0.33) return ['driving', 'energetic', 'propulsive']
  return ['steady tempo', 'measured']
}
function valenceWords(v) {
  if (v < -0.33) return ['melancholic', 'minor key', 'wistful']
  if (v > 0.33) return ['warm', 'major key', 'uplifting']
  return ['bittersweet', 'ambiguous tonality']
}
function depthWords(d) {
  if (d < -0.33) return ['minimal', 'open space', 'few elements', 'dry']
  if (d > 0.33) return ['layered', 'dense', 'textured', 'deep reverb']
  return ['moderately layered']
}

// Approximate BPM from arousal, for the prose prompt fallback.
export function arousalToBpm(a) {
  return Math.round(70 + (a + 1) / 2 * 70) // -1→70, 0→105, +1→140
}

// Era year → production-era descriptor.
export function eraWords(year) {
  if (!year || typeof year !== 'number') return []
  if (year < 1970) return ['vintage analog production', '1960s character']
  if (year < 1980) return ['warm 1970s analog production']
  if (year < 1990) return ['1980s synthesis', 'gated reverb']
  if (year < 2000) return ['1990s production']
  if (year < 2010) return ['2000s production']
  if (year < 2020) return ['2010s production', 'modern clarity']
  return ['contemporary hi-fi production']
}

// Section arc — fractions of total duration. Sums to 1.
const SECTION_ARC = [
  { name: 'Intro',   frac: 0.14, styles: ['sparse', 'building', 'anticipatory'] },
  { name: 'Build',   frac: 0.22, styles: ['rising', 'gathering', 'momentum'] },
  { name: 'Body',    frac: 0.42, styles: ['full', 'present', 'realized'] },
  { name: 'Resolve', frac: 0.22, styles: ['settling', 'resolving', 'exhale'] },
]

const clampSigned = (x) => Math.max(-1, Math.min(1, x))

/**
 * Build the composition plan.
 * @param {{avd:{a,v,d}, archetypeId:string, eraYear?:number, durationMs?:number}} opts
 * @returns composition_plan object (positiveGlobalStyles / negativeGlobalStyles / sections)
 */
export function buildCompositionPlan({ avd, archetypeId, eraYear, durationMs = 210000 } = {}) {
  const a = clampSigned(avd?.a ?? 0)
  const v = clampSigned(avd?.v ?? 0)
  const d = clampSigned(avd?.d ?? 0)

  const base = ARCHETYPE_STYLES[archetypeId] || DEFAULT_STYLES
  const positive_global_styles = dedupe([
    ...base,
    ...arousalWords(a),
    ...valenceWords(v),
    ...depthWords(d),
    ...eraWords(eraYear),
    'instrumental',
    'completely instrumental',
  ])
  const negative_global_styles = ['vocals', 'vocal', 'singing', 'lyrics', 'spoken word', 'harsh', 'abrasive']

  const sections = buildSections(durationMs)

  return { positive_global_styles, negative_global_styles, sections }
}

// A prose prompt as a fallback path (used if plan generation is rejected).
export function buildPrompt({ avd, archetypeId, eraYear } = {}) {
  const a = clampSigned(avd?.a ?? 0)
  const v = clampSigned(avd?.v ?? 0)
  const d = clampSigned(avd?.d ?? 0)
  const base = ARCHETYPE_STYLES[archetypeId] || DEFAULT_STYLES
  const words = dedupe([
    ...base, ...arousalWords(a), ...valenceWords(v), ...depthWords(d), ...eraWords(eraYear),
  ])
  return `A ${words.join(', ')} instrumental at roughly ${arousalToBpm(a)} BPM. ` +
    'No vocals. It should build from a sparse intro to a full body and then resolve.'
}

function buildSections(durationMs) {
  const sections = SECTION_ARC.map((s) => ({
    section_name: s.name,
    positive_local_styles: s.styles,
    negative_local_styles: ['vocals', 'singing'],
    duration_ms: Math.round(durationMs * s.frac),
    lines: [], // empty = instrumental (the API's instrumental signal for plans)
  }))
  // Absorb rounding drift into the last section so the durations sum exactly.
  const summed = sections.reduce((acc, s) => acc + s.duration_ms, 0)
  sections[sections.length - 1].duration_ms += durationMs - summed
  return sections
}

function dedupe(arr) {
  const seen = new Set()
  const out = []
  for (const x of arr) {
    if (!x || seen.has(x)) continue
    seen.add(x)
    out.push(x)
  }
  return out
}

// Re-export for callers that want the archetype list without a second import.
export { ARCHETYPES }
