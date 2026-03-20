// All times are ABSOLUTE seconds from time 0:00 (button press)

// Voice spatial layout (from v1 VOICE_POSITIONS + VOICE_SPREAD):
//   Admirer: base az 0°, el 0°, dist 1.5m, spread ±25°
//   Guide:   base az 90°, el 15°, dist 3.0m, spread ±30°
//   Witness: base az 180°, el 30°, dist 5.0m, spread ±40°

export const VOICES = [
  // THRONE — Admirer Warm (front, close, spread ±25°)
  { file: '/chamber/voices/admirer-warm-01.mp3', time: 75,  duck: true, azimuth: -12, elevation: 0,  distance: 1.5, category: 'admirer' },
  { file: '/chamber/voices/admirer-warm-02.mp3', time: 100, duck: true, azimuth: 12,  elevation: 0,  distance: 1.5, category: 'admirer' },
  { file: '/chamber/voices/admirer-warm-03.mp3', time: 125, duck: true, azimuth: -25, elevation: 0,  distance: 1.5, category: 'admirer' },
  { file: '/chamber/voices/admirer-warm-04.mp3', time: 155, duck: true, azimuth: 25,  elevation: 0,  distance: 1.5, category: 'admirer' },

  // ASCENT — Admirer Cool (front) + Guide (right, mid-height, far)
  { file: '/chamber/voices/admirer-cool-01.mp3', time: 200, duck: true, azimuth: -8,  elevation: 0,  distance: 1.5, category: 'admirer' },
  { file: '/chamber/voices/guide-01.mp3',        time: 220, duck: true, azimuth: 75,  elevation: 15, distance: 3.0, category: 'guide' },
  { file: '/chamber/voices/admirer-cool-02.mp3', time: 240, duck: true, azimuth: 8,   elevation: 0,  distance: 1.5, category: 'admirer' },
  { file: '/chamber/voices/admirer-cool-03.mp3', time: 285, duck: true, azimuth: -20, elevation: 0,  distance: 1.5, category: 'admirer' },
  { file: '/chamber/voices/guide-02.mp3',        time: 315, duck: true, azimuth: 90,  elevation: 15, distance: 3.0, category: 'guide' },
  { file: '/chamber/voices/admirer-cool-04.mp3', time: 330, duck: true, azimuth: 20,  elevation: 0,  distance: 1.5, category: 'admirer' },
  { file: '/chamber/voices/guide-03.mp3',        time: 345, duck: true, azimuth: 0,   elevation: 70,  distance: 2.0, category: 'guide' },  // "Above you." — overhead
  { file: '/chamber/voices/guide-04.mp3',        time: 348, duck: true, azimuth: 0,   elevation: -40, distance: 2.0, category: 'guide' },  // "Below you." — below
  { file: '/chamber/voices/guide-05.mp3',        time: 355, duck: true, azimuth: 0,   elevation: 0,   distance: 0.3, category: 'guide' },  // "Inside." — inside the head

  // DISSOLUTION — Admirer Cold + Witness (behind, high, very far) + Guide (NO DUCKING)
  { file: '/chamber/voices/admirer-cold-01.mp3', time: 380, duck: false, azimuth: -5,  elevation: 0,  distance: 1.5, category: 'admirer' },
  { file: '/chamber/voices/admirer-cold-02.mp3', time: 400, duck: false, azimuth: 5,   elevation: 0,  distance: 1.5, category: 'admirer' },
  { file: '/chamber/voices/witness-01.mp3',      time: 440, duck: false, azimuth: 160, elevation: 30, distance: 5.0, category: 'witness' },
  { file: '/chamber/voices/witness-02.mp3',      time: 465, duck: false, azimuth: 200, elevation: 30, distance: 5.0, category: 'witness' },
  { file: '/chamber/voices/witness-03.mp3',      time: 490, duck: false, azimuth: 140, elevation: 30, distance: 5.0, category: 'witness' },
  { file: '/chamber/voices/guide-06.mp3',        time: 495, duck: false, azimuth: 90,  elevation: 20, distance: 4.0, category: 'guide' },  // "Let go." — drifting away
  { file: '/chamber/voices/witness-04.mp3',      time: 515, duck: false, azimuth: 220, elevation: 30, distance: 5.0, category: 'witness' },
  { file: '/chamber/voices/guide-07.mp3',        time: 530, duck: false, azimuth: 0,   elevation: 5,  distance: 1.0, category: 'guide' },  // "Good." — intimate, close
]

export const WHISPERS = [
  { file: '/chamber/whispers/whisper-01.mp3', time: 420, azimuth: 270, elevation: 10 },
  { file: '/chamber/whispers/whisper-02.mp3', time: 445, azimuth: 90, elevation: 20 },
  { file: '/chamber/whispers/whisper-03.mp3', time: 485, azimuth: 180, elevation: 40 },
  { file: '/chamber/whispers/whisper-04.mp3', time: 505, azimuth: null, elevation: null },
  { file: '/chamber/whispers/whisper-05.mp3', time: 520, azimuth: null, elevation: null },
]

export const OVATION_FILE = '/chamber/crowd/ovation.mp3'
export const AUDIENCE_FILES = ['/chamber/crowd/ambient-01.mp3', '/chamber/crowd/ambient-02.mp3']
export const TRACK_B_FILE = '/chamber/tracks/aftermath.mp3'
export const HALL_IR_FILE = '/chamber/hall-ir.wav'

export function getAllPaths() {
  const paths = new Set()
  VOICES.forEach(v => paths.add(v.file))
  WHISPERS.forEach(w => paths.add(w.file))
  paths.add(OVATION_FILE)
  AUDIENCE_FILES.forEach(f => paths.add(f))
  paths.add(TRACK_B_FILE)
  paths.add(HALL_IR_FILE)
  return Array.from(paths)
}
