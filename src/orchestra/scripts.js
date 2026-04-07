// All times are ABSOLUTE seconds from time 0:00 (button press)
// v2 — One voice (The Admirer) across 5 registers. 39 fixed + 12 dynamic = 51 assets.

// ─── Fixed voice lines ────────────────────────────────────────────────────────

export const VOICES = [
  // BRIEFING — Present register (stability 0.55, style 0.45)
  { file: '/chamber/voices/v2/01-briefing-ownership.mp3',     time: 4,    duck: true,  azimuth: 0,   elevation: 0,  distance: 0.8 },
  { file: '/chamber/voices/v2/02-briefing-close-eyes.mp3',    time: 18,   duck: true,  azimuth: 0,   elevation: 0,  distance: 0.8 },

  // BLOOM — Present register
  { file: '/chamber/voices/v2/03-bloom-podium.mp3',           time: 36,   duck: true,  azimuth: 0,   elevation: 0,  distance: 1.0 },
  { file: '/chamber/voices/v2/04-bloom-audience.mp3',         time: 55,   duck: true,  azimuth: 0,   elevation: 0,  distance: 1.0 },
  { file: '/chamber/voices/v2/05-bloom-baton.mp3',            time: 68,   duck: true,  azimuth: 0,   elevation: 0,  distance: 1.0 },

  // THRONE Teaching — Present register
  { file: '/chamber/voices/v2/06-throne-orchestra-map.mp3',   time: 98,   duck: true,  azimuth: 0,   elevation: 0,  distance: 1.2 },
  { file: '/chamber/voices/v2/07-throne-tilt.mp3',            time: 130,  duck: true,  azimuth: 0,   elevation: 0,  distance: 1.2 },
  { file: '/chamber/voices/v2/08-throne-cellos.mp3',          time: 147,  duck: true,  azimuth: 0,   elevation: 0,  distance: 1.2 },
  { file: '/chamber/voices/v2/09-throne-lift.mp3',            time: 168,  duck: true,  azimuth: 0,   elevation: 0,  distance: 1.2 },
  { file: '/chamber/voices/v2/10-throne-downbeat.mp3',        time: 187,  duck: true,  azimuth: 0,   elevation: 0,  distance: 1.2 },
  { file: '/chamber/voices/v2/11-throne-chest.mp3',           time: 197,  duck: true,  azimuth: 0,   elevation: 0,  distance: 1.0 },

  // THRONE Praise — Elevated register (stability 0.50, style 0.50)
  // Lines 12, 13, 15 are DYNAMIC — see getDynamicVoices()
  { file: '/chamber/voices/v2/14-throne-sweep.mp3',           time: 265,  duck: true,  azimuth: 0,   elevation: 0,  distance: 1.0 },
  { file: '/chamber/voices/v2/16-throne-never-heard.mp3',     time: 305,  duck: true,  azimuth: 0,   elevation: 0,  distance: 0.8 },

  // Ovation seal — Elevated register
  { file: '/chamber/voices/v2/17-ovation-for-you.mp3',        time: 335,  duck: false, azimuth: 0,   elevation: 0,  distance: 1.0 },
  { file: '/chamber/voices/v2/18-ovation-yours.mp3',          time: 355,  duck: false, azimuth: 0,   elevation: 0,  distance: 1.0 },
  { file: '/chamber/voices/v2/19-ovation-stay.mp3',           time: 373,  duck: false, azimuth: 0,   elevation: 0,  distance: 1.0 },

  // ASCENT Fracture — Cool register (stability 0.45, style 0.30)
  { file: '/chamber/voices/v2/20-ascent-shifting.mp3',        time: 415,  duck: false, azimuth: 0,   elevation: 0,  distance: 2.0 },
  { file: '/chamber/voices/v2/21-ascent-high-strings.mp3',    time: 445,  duck: false, azimuth: 0,   elevation: 0,  distance: 2.0 },
  { file: '/chamber/voices/v2/22-ascent-not-held.mp3',        time: 475,  duck: false, azimuth: 0,   elevation: 0,  distance: 2.0 },

  // CARETAKING — Caretaking register (stability 0.45, style 0.30)
  // Triggered at 7:30 (450s) fixed
  { file: '/chamber/voices/v2/23-care-put-down.mp3',          time: 495,  duck: false, azimuth: 0,   elevation: 0,  distance: 1.5 },
  { file: '/chamber/voices/v2/24-care-breath.mp3',            time: 513,  duck: false, azimuth: 0,   elevation: 0,  distance: 1.5 },
  { file: '/chamber/voices/v2/25-care-sit-back.mp3',          time: 533,  duck: false, azimuth: 0,   elevation: 0,  distance: 1.5 },
  { file: '/chamber/voices/v2/26-care-music-knows.mp3',       time: 553,  duck: false, azimuth: 0,   elevation: 0,  distance: 1.5 },
  { file: '/chamber/voices/v2/27-care-just-listen.mp3',       time: 575,  duck: false, azimuth: 0,   elevation: 0,  distance: 1.5 },

  // LATE ASCENT / Fading — Fading register (stability 0.35, style 0.10)
  { file: '/chamber/voices/v2/28-fade-bigger.mp3',            time: 600,  duck: false, azimuth: 0,   elevation: 0,  distance: 3.5 },
  { file: '/chamber/voices/v2/29-fade-always-bigger.mp3',     time: 630,  duck: false, azimuth: 0,   elevation: 0,  distance: 4.5 },

  // DISSOLUTION — Dissolution register (stability 0.30, style 0.05)
  { file: '/chamber/voices/v2/30-diss-breath.mp3',            time: 675,  duck: false, azimuth: 0,   elevation: 0,  distance: 5.0, lowpass: 2000 },
  { file: '/chamber/voices/v2/31-diss-still-here.mp3',        time: 720,  duck: false, azimuth: 0,   elevation: 0,  distance: 5.0, lowpass: 2000 },
  { file: '/chamber/voices/v2/32-diss-listen.mp3',            time: 770,  duck: false, azimuth: 0,   elevation: 0,  distance: 5.0, lowpass: 2000 },
  // Line 33: 15s true silence (no asset)
  { file: '/chamber/voices/v2/34-diss-good.mp3',              time: 835,  duck: false, azimuth: 0,   elevation: 5,  distance: 1.0 },

  // RETURN — Return register (stability 0.50, style 0.25)
  { file: '/chamber/voices/v2/36-return-phone.mp3',           time: 875,  duck: false, azimuth: 0,   elevation: 0,  distance: 1.0 },
  { file: '/chamber/voices/v2/37-return-feet.mp3',            time: 890,  duck: false, azimuth: 0,   elevation: 0,  distance: 1.0 },
  { file: '/chamber/voices/v2/38-return-room.mp3',            time: 905,  duck: false, azimuth: 0,   elevation: 0,  distance: 1.0 },
  { file: '/chamber/voices/v2/39-return-eyes.mp3',            time: 920,  duck: false, azimuth: 0,   elevation: 0,  distance: 1.0 },
]

// ─── Dynamic lines (AVD-selected at runtime) ─────────────────────────────────

const DYNAMIC_VALENCE = [
  '/chamber/voices/v2/dynamic/valence-0.mp3', // V 0.0–0.3
  '/chamber/voices/v2/dynamic/valence-1.mp3', // V 0.3–0.5
  '/chamber/voices/v2/dynamic/valence-2.mp3', // V 0.5–0.7
  '/chamber/voices/v2/dynamic/valence-3.mp3', // V 0.7–1.0
]

const DYNAMIC_DEPTH = [
  '/chamber/voices/v2/dynamic/depth-0.mp3',   // D 0.0–0.3
  '/chamber/voices/v2/dynamic/depth-1.mp3',   // D 0.3–0.5
  '/chamber/voices/v2/dynamic/depth-2.mp3',   // D 0.5–0.7
  '/chamber/voices/v2/dynamic/depth-3.mp3',   // D 0.7–1.0
]

const DYNAMIC_AROUSAL = [
  '/chamber/voices/v2/dynamic/arousal-0.mp3', // A 0.0–0.3
  '/chamber/voices/v2/dynamic/arousal-1.mp3', // A 0.3–0.5
  '/chamber/voices/v2/dynamic/arousal-2.mp3', // A 0.5–0.7
  '/chamber/voices/v2/dynamic/arousal-3.mp3', // A 0.7–1.0
]

function pickVariant(value) {
  if (value < 0.3) return 0
  if (value < 0.5) return 1
  if (value < 0.7) return 2
  return 3
}

/**
 * Returns the 3 dynamic voice entries based on AVD values.
 * @param {{ a: number, v: number, d: number }} avd
 */
export function getDynamicVoices(avd) {
  return [
    // Line 12 — Valence character (Throne praise, time 223)
    { file: DYNAMIC_VALENCE[pickVariant(avd.v)], time: 223, duck: true,  azimuth: 0, elevation: 0, distance: 1.0 },
    // Line 13 — Depth character (Throne praise, time 243)
    { file: DYNAMIC_DEPTH[pickVariant(avd.d)],   time: 243, duck: true,  azimuth: 0, elevation: 0, distance: 1.0 },
    // Line 15 — Arousal character (Throne praise, time 285)
    { file: DYNAMIC_AROUSAL[pickVariant(avd.a)],  time: 285, duck: true,  azimuth: 0, elevation: 0, distance: 1.0 },
  ]
}

// ─── Shared assets ────────────────────────────────────────────────────────────

export const OVATION_FILE = '/chamber/crowd/ovation.mp3'
export const AUDIENCE_FILES = ['/chamber/crowd/ambient-01.mp3', '/chamber/crowd/ambient-02.mp3']
export const TRACK_B_FILE = '/chamber/tracks/aftermath.mp3'
export const HALL_IR_FILE = '/chamber/hall-ir.wav'

/**
 * Returns all asset paths needed for preloading.
 * @param {{ a: number, v: number, d: number }} avd
 */
export function getAllPaths(avd) {
  const paths = new Set()
  VOICES.forEach(v => paths.add(v.file))

  // Add all dynamic variants (preload all 12 so any AVD combo works)
  DYNAMIC_VALENCE.forEach(f => paths.add(f))
  DYNAMIC_DEPTH.forEach(f => paths.add(f))
  DYNAMIC_AROUSAL.forEach(f => paths.add(f))

  paths.add(OVATION_FILE)
  AUDIENCE_FILES.forEach(f => paths.add(f))
  paths.add(TRACK_B_FILE)
  paths.add(HALL_IR_FILE)
  return Array.from(paths)
}
