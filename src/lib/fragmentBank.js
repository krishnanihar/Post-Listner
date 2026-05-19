// Locate-phase fragment bank. Phase A: 8 fragments hand-picked from the
// existing Suno-generated archetype masters in src/lib/archetypes.js.
// Each fragment carries descriptors so the agent can choose a meaningful
// next pair (e.g. "warm vs. shadowed at the same tempo").
//
// In Phase A we play the full master MP3 from the masters CDN — the agent
// is responsible for ending the fragment after a few seconds via its own
// pacing. A future iteration may pre-slice 8-12 second clips.

import { getMasterUrl } from './stemsCatalog.js'

// Each fragment is one (archetype, variation) draw with named descriptors.
// The 8 below were chosen to cover the descriptor space coarsely:
// warmth/shadow × patient/lifted × acoustic/synth × old/new.
export const FRAGMENTS = [
  {
    id: 'warm-acoustic-now',
    url: getMasterUrl('hearth-keeper', 'acoustic-soft-2000s'),
    descriptors: { tempo: 'medium', mood: 'warm', era: 2005, instrumentation: 'acoustic' },
  },
  {
    id: 'warm-folk-recent',
    url: getMasterUrl('hearth-keeper', 'folk-2010s'),
    descriptors: { tempo: 'medium', mood: 'warm', era: 2014, instrumentation: 'acoustic' },
  },
  {
    id: 'shadow-piano-late',
    url: getMasterUrl('late-night-architect', 'lo-fi-piano-2010s'),
    descriptors: { tempo: 'slow', mood: 'shadowed', era: 2015, instrumentation: 'acoustic' },
  },
  {
    id: 'shadow-synth-old',
    url: getMasterUrl('late-night-architect', 'synth-melancholy-1980s'),
    descriptors: { tempo: 'slow', mood: 'shadowed', era: 1985, instrumentation: 'synth' },
  },
  {
    id: 'lifted-cinematic',
    url: getMasterUrl('sky-seeker', 'cinematic-ambient-2010s'),
    descriptors: { tempo: 'medium', mood: 'expansive', era: 2015, instrumentation: 'orchestral' },
  },
  {
    id: 'lifted-postclassical',
    url: getMasterUrl('sky-seeker', 'post-classical-2020s'),
    descriptors: { tempo: 'slow', mood: 'expansive', era: 2023, instrumentation: 'orchestral' },
  },
  {
    id: 'patient-glow',
    url: getMasterUrl('slow-glow', 'downtempo-soul-2020s'),
    descriptors: { tempo: 'slow', mood: 'patient', era: 2022, instrumentation: 'electronic' },
  },
  {
    id: 'tense-postrock',
    url: getMasterUrl('quiet-insurgent', 'post-rock-2000s'),
    descriptors: { tempo: 'medium', mood: 'tense', era: 2003, instrumentation: 'ensemble' },
  },
]

export function getFragment(id) {
  return FRAGMENTS.find(f => f.id === id) || null
}

export function listFragmentIds() {
  return FRAGMENTS.map(f => f.id)
}
