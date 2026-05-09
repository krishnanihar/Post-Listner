#!/usr/bin/env node
/**
 * Generate Suno V5.5-compatible prompts for the 24 archetype × variation pairs (v2).
 *
 * v2 incorporates the chills/frisson research from
 * Research/Designing Ego-Feeding-Then-Dissolving Experiences.md and
 * Research/recognition-problem-reveal-moment.md §"What frissons reveal".
 *
 * Each archetype carries an explicit chill-trigger arc (first ~30 s of the
 * track, calibrated to the Reveal listening window) and a bridge directive
 * (second chill-point), per the research's prescribed triggers:
 *   - sudden harmonic shifts
 *   - vocal or instrumental crescendos
 *   - entrance of a new timbre
 *   - appoggiaturas (clashing notes that resolve)
 *   - violation of expectation followed by resolution
 *
 * Prompt formula follows
 * Research/generative-music-differentiation-engines.md §"The optimal prompt formula"
 * and Research/taste-extraction-postlistener-orchestra.md §4 worked example:
 *   {genre}, {bpm} BPM, in {key}, {dynamic}, {instruments}, {mood},
 *   {production aesthetic}, {mix}, {era}, instrumental only
 *
 * Section structure goes in the Lyrics box with hint-tags:
 *   [Intro: ...] [Build: ...] [Bloom: ...] (chill-point 1)
 *   [Verse] [Chorus] [Verse] [Chorus]
 *   [Bridge: ...] (chill-point 2)
 *   [Outro] [End]
 *
 * Usage:
 *   node scripts/generate-suno-prompts.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ARCHETYPES } from '../src/lib/archetypes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// Per-archetype master config. Mood/production capped to ONE descriptor each
// (no synonym stacking — see generative-music-differentiation-engines.md:71).
// AVD anchors → key/dynamic/mix derived deterministically.
const ARCHETYPE_BASE = {
  'late-night-architect': {
    // (a:.35, v:.45, d:.85) — introspective, intricate
    genres: ['lo-fi piano', 'neo-classical'],
    instruments: ['felt piano', 'lone violin'],
    mood: 'introspective',
    production: 'close-miked',
    key: 'A minor',
    dynamic: 'soft and intimate',
    mix: 'wide-stereo audiophile mix',
    chill1: 'lone violin enters, sparse harmonic resolution',
    bridge: 'modulation to relative major, field-recording texture',
    avoid: ['no LOFI HIP HOP RADIO BEATS', 'no bombastic'],
  },
  'hearth-keeper': {
    // (a:.4, v:.78, d:.5) — warm, sung, acoustic
    genres: ['warm folk', 'americana'],
    instruments: ['fingerpicked acoustic guitar', 'felt cello'],
    mood: 'tender',
    production: 'live-room acoustic',
    key: 'G major',
    dynamic: 'gentle and warm',
    mix: 'intimate stereo, room mics',
    chill1: 'cello and brushed drums layer in beneath the guitar',
    bridge: 'gentle modulation, cello takes the lead',
    avoid: ['no indie pop', 'no overproduced radio sound'],
  },
  'velvet-mystic': {
    // (a:.3, v:.72, d:.82) — lush, chamber, dream-pop
    genres: ['chamber strings', 'dream-pop'],
    instruments: ['bowed strings', 'shimmer reverb piano'],
    mood: 'reverent',
    production: 'cathedral reverb',
    key: 'D major',
    dynamic: 'pp restrained',
    mix: 'wide-stereo audiophile mix',
    chill1: 'choral pad enters, full string section, harmonic resolution',
    bridge: 'cathedral swell, modulation upward',
    avoid: ['no generic trailer cinematic', 'no saccharine'],
  },
  'quiet-insurgent': {
    // (a:.62, v:.28, d:.55) — minor-key tension, post-rock, indie
    genres: ['post-rock', 'minor-key indie'],
    instruments: ['tremolo electric guitar', 'restrained drums'],
    mood: 'foreboding',
    production: 'tape-warm distortion',
    key: 'E minor',
    dynamic: 'mf withheld tension',
    mix: 'mid-fi tape stereo',
    chill1: 'full band enters, driving but withheld',
    bridge: 'half-step modulation, no resolution',
    avoid: ['no triumphant climax', 'no aggressive drop'],
  },
  'slow-glow': {
    // (a:.32, v:.6, d:.45) — downtempo, lo-fi, chillwave
    genres: ['downtempo soul', 'trip-hop'],
    instruments: ['warm Rhodes', 'tape-saturated drums'],
    mood: 'patient',
    production: 'analog tape warmth',
    key: 'D Dorian',
    dynamic: 'soft and unhurried',
    mix: 'warm mid-fi stereo',
    chill1: 'tape-warm bass enters, groove locks in',
    bridge: 'filter sweep, vibraphone entrance',
    avoid: ['no four-on-the-floor', 'no lo-fi hip hop radio beats'],
  },
  'sky-seeker': {
    // (a:.78, v:.75, d:.78) — cinematic, triumphant, awe
    genres: ['cinematic ambient', 'post-classical'],
    instruments: ['expansive strings', 'sustained brass'],
    mood: 'awe-inducing',
    production: 'hall ambience',
    key: 'C major',
    dynamic: 'f expansive crescendo',
    mix: 'wide-stereo audiophile mix',
    chill1: 'full orchestral crescendo, brass entrance, harmonic peak',
    bridge: 'triumphant modulation, second crescendo',
    avoid: ['no generic trailer cinematic'],
  },
}

// Era → ONE production-aesthetic tag (collapsed from v1's two-tag pattern).
// Pre-1900 special-cases the Velvet Mystic 1810s-orchestral-revisited case.
function eraDescriptor(era) {
  if (!era || era < 1900) return 'Romantic-era orchestral, 19th-century concert hall'
  if (era < 1970) return '1960s vintage analog'
  if (era < 1980) return '1970s analog tape'
  if (era < 1990) return '1980s analog synth'
  if (era < 2000) return '1990s mid-fi tape'
  if (era < 2010) return '2000s clean digital'
  if (era < 2020) return '2010s contemporary'
  return '2020s modern production'
}

// Always-include exclusions — instrumental + safety against extreme dynamics.
const ALWAYS_EXCLUDE = ['no vocals', 'no lyrics']

// Hyphen/space-insensitive normalisation for genre dedup.
const norm = s => s.toLowerCase().replace(/[\s-]+/g, '')

function extractVariationGenre(microgenreLabel) {
  if (!microgenreLabel) return null
  const afterDot = microgenreLabel.split('·')[1] || microgenreLabel
  const beforeFor = afterDot.split(/\bfor\b/)[0] || afterDot
  return beforeFor
    .replace(/\d{4}s?/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/revisited/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// BPM still drawn from a per-archetype default — research recommends BPM
// shifts of ±20 to clear perceptual thresholds, so we keep one value per
// archetype rather than per variation.
const ARCHETYPE_BPM = {
  'late-night-architect': 70,
  'hearth-keeper': 90,
  'velvet-mystic': 80,
  'quiet-insurgent': 90,
  'slow-glow': 85,
  'sky-seeker': 100,
}

function buildStyleBox(archetypeId, variation) {
  const base = ARCHETYPE_BASE[archetypeId]
  if (!base) throw new Error(`Unknown archetype: ${archetypeId}`)

  // Genre slot (max 3): two archetype anchors + variation's microgenre head,
  // deduplicated against archetype tokens.
  const variationGenre = extractVariationGenre(variation.microgenreLabel)
  const genres = [...base.genres]
  if (variationGenre && !genres.some(g => norm(g).includes(norm(variationGenre)) || norm(variationGenre).includes(norm(g)))) {
    genres.push(variationGenre)
  }
  const genreList = genres.slice(0, 3).join(', ')

  return [
    genreList,
    `${ARCHETYPE_BPM[archetypeId]} BPM`,
    `in ${base.key}`,
    base.dynamic,
    base.instruments.slice(0, 2).join(', '),
    base.mood,
    base.production,
    base.mix,
    eraDescriptor(variation.era),
    'instrumental only',
  ].join(', ')
}

function buildExcludeBox(archetypeId) {
  const base = ARCHETYPE_BASE[archetypeId]
  // Cap at 4 — Suno's preprocessor processes more reliably with short
  // exclusion lists. Always-2 + archetype-specific 2 = 4 total.
  return [...ALWAYS_EXCLUDE, ...base.avoid.slice(0, 2)].join(', ')
}

// Lyrics box — instrumental section tags with chill-point hints baked into
// the section bracket (Suno parses bracket descriptors as arrangement hints,
// not as lyric content). Order encodes the first-30s arc:
//   [Intro] sparse opening
//   [Build] gradual layering
//   [Bloom] chill-point 1 (new timbre / harmonic resolution)
//   [Verse][Chorus][Verse][Chorus] — body
//   [Bridge] chill-point 2 (modulation / texture shift)
//   [Outro][End]
function buildStructure(archetypeId) {
  const base = ARCHETYPE_BASE[archetypeId]
  const intro = `[Intro: solo ${base.instruments[0]}, 8 seconds]`
  const build = `[Build: gradual layering, 12 seconds]`
  const bloom = `[Bloom: ${base.chill1}]`
  const bridge = `[Bridge: ${base.bridge}]`
  return [
    intro,
    build,
    bloom,
    '[Verse]',
    '[Chorus]',
    '[Verse]',
    '[Chorus]',
    bridge,
    '[Outro]',
    '[End]',
  ].join('\n')
}

function buildTitle(archetypeId, variation) {
  const m = variation.microgenreLabel.match(/for\s+(.+)$/)
  const tail = m ? m[1] : variation.id.replace(/-/g, ' ')
  return tail.replace(/^\w/, c => c.toUpperCase())
}

function buildPrompts() {
  const out = {}
  for (const archetype of ARCHETYPES) {
    for (const variation of archetype.variations) {
      const key = `${archetype.id}/${variation.id}`
      out[key] = {
        archetypeId: archetype.id,
        variationId: variation.id,
        archetypeDisplayName: archetype.displayName,
        microgenreLabel: variation.microgenreLabel,
        era: variation.era,
        title: buildTitle(archetype.id, variation),
        style: buildStyleBox(archetype.id, variation),
        exclude: buildExcludeBox(archetype.id),
        structure: buildStructure(archetype.id),
        instrumental: true,
        targetDuration: '2:30–3:00',
        sunoVersion: 'V5.5',
      }
    }
  }
  return out
}

function renderMarkdown(prompts) {
  const groups = {}
  for (const p of Object.values(prompts)) {
    groups[p.archetypeId] = groups[p.archetypeId] || []
    groups[p.archetypeId].push(p)
  }

  const lines = [
    '# Suno V5.5 prompts — 24 archetype × variation tracks (v2)',
    '',
    'Generated by `scripts/generate-suno-prompts.js`. v2 grounds the structural arc',
    'in the chills/frisson research (Designing Ego-Feeding-Then-Dissolving Experiences,',
    'recognition-problem-reveal-moment §"What frissons reveal").',
    '',
    'Each prompt engineers two chill-points: a `[Bloom]` at ~0:25 (timbre entrance,',
    'within the Reveal listening window) and a `[Bridge]` at ~1:30 (harmonic shift).',
    '',
    'Paste each block into Suno (Custom mode, V5.5):',
    '- **Style** field → the `Style:` line below',
    '- **Exclude Styles** field → the `Exclude:` line below',
    '- **Lyrics** field → the section structure (instrumental — section hints, no lyric content)',
    '- **Instrumental toggle** → ON',
    '',
    '---',
    '',
  ]

  for (const archetypeId of Object.keys(groups)) {
    const first = groups[archetypeId][0]
    lines.push(`## ${first.archetypeDisplayName}`)
    lines.push('')
    for (const p of groups[archetypeId]) {
      lines.push(`### ${p.title} *(${p.microgenreLabel})*`)
      lines.push(`- **Key:** \`${p.archetypeId}/${p.variationId}\``)
      lines.push(`- **Style:** ${p.style}`)
      lines.push(`- **Exclude:** ${p.exclude}`)
      lines.push(`- **Target duration:** ${p.targetDuration}`)
      lines.push('- **Lyrics box (paste exactly — section hints only, no lyric content):**')
      lines.push('  ```')
      for (const tag of p.structure.split('\n')) lines.push(`  ${tag}`)
      lines.push('  ```')
      lines.push('')
    }
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

function main() {
  const prompts = buildPrompts()
  const docsDir = path.join(ROOT, 'docs')
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true })

  const jsonPath = path.join(docsDir, 'suno-prompts.json')
  const mdPath = path.join(docsDir, 'suno-prompts.md')

  fs.writeFileSync(jsonPath, JSON.stringify(prompts, null, 2))
  fs.writeFileSync(mdPath, renderMarkdown(prompts))

  const count = Object.keys(prompts).length
  console.log(`Generated ${count} Suno V5.5 prompts (v2 — chill-point grounded).`)
  console.log(`  JSON:     ${path.relative(ROOT, jsonPath)}`)
  console.log(`  Markdown: ${path.relative(ROOT, mdPath)}`)
}

main()
