// Derive an ElevenLabs Music API composition plan from session signals.
// Per Research/generative-music-differentiation-engines.md the prompt needs
// 4–7 distinct descriptors across orthogonal dimensions (genre, tempo,
// instruments, vocal/instrumental, mood, production aesthetic).

import { getArchetype, getVariation } from './archetypes.js'

// Archetype → prompt fragment library. Each archetype's variations would
// ideally tweak these, but Phase 3 keeps it archetype-level for now.
const ARCHETYPE_STYLES = {
  'late-night-architect':
    ['lo-fi piano', 'introspective', 'nocturnal ambient', 'sparse', '70 BPM'],
  'hearth-keeper':
    ['warm folk', 'fingerpicked acoustic guitar', 'intimate', '90 BPM', 'felt cello'],
  'velvet-mystic':
    ['chamber strings', 'dream-pop', 'lush orchestral', '80 BPM', 'reverberant'],
  'quiet-insurgent':
    ['post-rock instrumental', 'minor key', 'restrained tension', '90 BPM', 'driving but withheld'],
  'slow-glow':
    ['downtempo soul', 'lo-fi groove', 'warm low-pass', '85 BPM', 'analog tape saturation'],
  'sky-seeker':
    ['cinematic ambient', 'triumphant', 'expansive', '100 BPM', 'big-sky orchestral'],
}

function eraStyles(eraMedian) {
  if (typeof eraMedian !== 'number' || eraMedian <= 0) return []
  if (eraMedian < 1980) return ['1970s vintage', 'analog tape', 'warm']
  if (eraMedian < 1995) return ['1980s analog', 'tape warmth']
  if (eraMedian < 2010) return ['1990s production', 'mid-fidelity']
  if (eraMedian < 2020) return ['2010s contemporary', 'modern production']
  return ['2020s contemporary', 'neo-classical', 'modern']
}

function gemsStyles(tag) {
  if (!tag) return []
  return {
    nostalgic:   ['nostalgic', 'warm memory'],
    awed:        ['expansive', 'reverent'],
    tender:      ['tender', 'intimate'],
    melancholic: ['melancholy minor', 'pensive'],
    defiant:     ['urgent', 'forward-leaning'],
    peaceful:    ['calm sustained', 'still'],
  }[tag] || []
}

function hedonicNegatives(hedonic) {
  // hedonic === false: user did not enjoy the build-and-drop arousal peak.
  // Bias the generated track away from triumphant / overproduced styles.
  if (hedonic === false) {
    return ['triumphant climax', 'saccharine', 'bombastic', 'overproduced', 'aggressive drop']
  }
  return []
}

const ALWAYS_NEGATIVE = ['vocals', 'singing', 'lyrics']

export function buildCompositionPlan({ archetypeId, variationId, eraMedian, dominantGemsTag, hedonic }) {
  const archetype = getArchetype(archetypeId)
  if (!archetype) return null
  const variation = variationId ? getVariation(archetypeId, variationId) : null

  const positive_global_styles = [
    ...(ARCHETYPE_STYLES[archetypeId] || []),
    ...eraStyles(eraMedian),
    ...gemsStyles(dominantGemsTag),
    'instrumental',
  ]
  const negative_global_styles = [
    ...ALWAYS_NEGATIVE,
    ...hedonicNegatives(hedonic),
  ]

  // Single-section 30s composition for Phase 3.0. Phase 3.x can split into
  // intro/build/climax once the Reveal duration extends.
  const sections = [{
    section_name: 'main',
    positive_local_styles: variation ? [variation.microgenreLabel] : ['expressive'],
    negative_local_styles: [],
    duration_ms: 30000,
    lines: [],
  }]

  return {
    positive_global_styles,
    negative_global_styles,
    sections,
  }
}
