// 6 archetypes × 4 variations grid for PostListener Mirror.
// Forer templates follow Furnham & Schofield 1987 recipe:
//   2 flattering specificity sentences + 1 unfalsifiable image / mild challenge.
// Variation labels follow Daylist's "playful insider-y specificity" pattern.

export const ARCHETYPES = [
  {
    id: 'late-night-architect',
    displayName: 'The Late-Night Architect',
    // Higher D (depth/structure), lower-mid A, mid V — introspective, intricate.
    scoringWeights: { a: 0.35, v: 0.45, d: 0.85 },
    spectrumAffinities: { warmth: 0.4, shadow: 0.6, density: 0.7, air: 0.3 },
    forerTemplate: [
      'You appreciate music that rewards a second listen — the kind with hidden depth.',
      'You give an entire night to a song that earns it, but you resist anything that demands attention up front.',
      'You keep your saddest songs for cab rides home.',
      'There is a song you only listen to alone, and you don\'t know why. ___',
    ],
    variations: [
      { id: 'lo-fi-piano-2010s', microgenreLabel: '2010s · lo-fi piano for cab rides home', era: 2015 },
      { id: 'synth-melancholy-1980s', microgenreLabel: '1980s · synth-melancholy for the kitchen at midnight', era: 1985 },
      { id: 'neo-classical-2020s', microgenreLabel: '2020s · neo-classical with field recordings', era: 2022 },
      { id: 'ecm-jazz-piano-1970s', microgenreLabel: '1970s · ECM jazz piano for unfinished conversations', era: 1975 },
    ],
  },
  {
    id: 'hearth-keeper',
    displayName: 'The Hearth-Keeper',
    // Mid A, high V (warmth), mid D — warm, sung, acoustic.
    scoringWeights: { a: 0.4, v: 0.78, d: 0.5 },
    spectrumAffinities: { warmth: 0.9, shadow: 0.1, density: 0.55, air: 0.45 },
    forerTemplate: [
      'You are drawn to music that arrives like a person sitting down beside you.',
      'You trust warmth more than spectacle, and you can tell the difference.',
      "There's a song you only play when no one else is in the house.",
      'There is a song that belongs to a person you no longer speak to. ___',
    ],
    variations: [
      { id: 'folk-2010s', microgenreLabel: '2010s · folk for the long drive back', era: 2014 },
      { id: 'slow-rnb-1970s', microgenreLabel: '1970s · slow R&B for two in a room', era: 1973 },
      { id: 'acoustic-soft-2000s', microgenreLabel: '2000s · acoustic-soft for early Sundays', era: 2005 },
      { id: 'americana-1960s', microgenreLabel: '1960s · Americana for the porch hour', era: 1965 },
    ],
  },
  {
    id: 'velvet-mystic',
    displayName: 'The Velvet Mystic',
    // Low A, high V, high D — lush orchestral, dream-pop, chamber.
    scoringWeights: { a: 0.3, v: 0.72, d: 0.82 },
    spectrumAffinities: { warmth: 0.6, shadow: 0.4, density: 0.85, air: 0.7 },
    forerTemplate: [
      'You hear architecture in music — height, light, the way a room holds sound.',
      "You're moved by what other people find too quiet.",
      'You collect songs the way other people collect rooms.',
      'There is a song you have never told anyone you love. ___',
    ],
    variations: [
      { id: 'chamber-strings-2020s', microgenreLabel: '2020s · chamber-strings for the ceremony', era: 2021 },
      { id: 'dream-pop-1990s', microgenreLabel: '1990s · dream-pop for the stairwell', era: 1993 },
      { id: 'orchestral-revisited', microgenreLabel: '1810s-orchestral revisited', era: 1815 },
      { id: 'ambient-choral-2010s', microgenreLabel: '2010s · ambient-choral for empty cathedrals', era: 2016 },
    ],
  },
  {
    id: 'quiet-insurgent',
    displayName: 'The Quiet Insurgent',
    // Mid-high A, low V (minor-key tension), mid D — post-rock, indie.
    scoringWeights: { a: 0.62, v: 0.28, d: 0.55 },
    spectrumAffinities: { warmth: 0.3, shadow: 0.7, density: 0.6, air: 0.4 },
    forerTemplate: [
      "You're loyal to music that holds tension without resolving it — the kind that ends the way a question ends.",
      'You prefer the half-spoken thing to the chorus.',
      "You have a song you've never put on a playlist for anyone.",
      'There is a song you keep at the back of the queue on purpose. ___',
    ],
    variations: [
      { id: 'post-rock-2000s', microgenreLabel: '2000s · post-rock for the slow burn', era: 2003 },
      { id: 'minor-indie-1990s', microgenreLabel: '1990s · minor-key indie for the walk home', era: 1995 },
      { id: 'restrained-punk-2010s', microgenreLabel: '2010s · restrained punk for the rooftop', era: 2014 },
      { id: 'post-punk-1980s', microgenreLabel: '1980s · post-punk for the kitchen floor', era: 1981 },
    ],
  },
  {
    id: 'slow-glow',
    displayName: 'The Slow Glow',
    // Low-mid A, mid-high V, mid D — downtempo, lo-fi, chillwave.
    scoringWeights: { a: 0.32, v: 0.6, d: 0.45 },
    spectrumAffinities: { warmth: 0.7, shadow: 0.3, density: 0.4, air: 0.6 },
    forerTemplate: [
      'You like music that takes its time and assumes you will too.',
      'You hear groove as a kind of patience, not a kind of speed.',
      'You play certain songs only after the room has gone warm.',
      'There is a song that only sounds right after midnight. ___',
    ],
    variations: [
      { id: 'downtempo-soul-2020s', microgenreLabel: '2020s · downtempo soul for steam and tile', era: 2022 },
      { id: 'chillwave-2010s', microgenreLabel: '2010s · chillwave for warm pavement', era: 2013 },
      { id: 'trip-hop-1990s', microgenreLabel: '1990s · trip-hop for headlight rain', era: 1996 },
      { id: 'soft-funk-1970s', microgenreLabel: '1970s · soft funk for low-light rooms', era: 1976 },
    ],
  },
  {
    id: 'sky-seeker',
    displayName: 'The Sky-Seeker',
    // High A, high V, high D — cinematic, triumphant, awe-inducing.
    scoringWeights: { a: 0.78, v: 0.75, d: 0.78 },
    spectrumAffinities: { warmth: 0.55, shadow: 0.45, density: 0.85, air: 0.75 },
    forerTemplate: [
      "You're drawn to music that makes the ceiling feel higher.",
      'You give yourself permission to be moved — most people don\'t.',
      "There's a moment you keep waiting for in songs, and you know it when it arrives.",
      "There is a song you have never listened to without something arriving in you. ___",
    ],
    variations: [
      { id: 'cinematic-ambient-2010s', microgenreLabel: '2010s · cinematic ambient for the long climb', era: 2015 },
      { id: 'post-classical-2020s', microgenreLabel: '2020s · post-classical for first light', era: 2023 },
      { id: 'triumphant-rock-1990s', microgenreLabel: '1990s · triumphant rock for the highway', era: 1994 },
      { id: 'electronic-orchestral-2000s', microgenreLabel: '2000s · electronic-orchestral for the threshold', era: 2007 },
    ],
  },
]

export function getArchetype(id) {
  return ARCHETYPES.find(a => a.id === id)
}

export function getVariation(archetypeId, variationId) {
  const a = getArchetype(archetypeId)
  if (!a) return null
  return a.variations.find(v => v.id === variationId)
}
