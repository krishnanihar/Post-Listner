// All times are ABSOLUTE seconds from time 0:00 (button press)

export const VOICES = [
  // THRONE — Admirer Warm
  { file: '/chamber/voices/admirer-warm-01.mp3', time: 75, duck: true },
  { file: '/chamber/voices/admirer-warm-02.mp3', time: 100, duck: true },
  { file: '/chamber/voices/admirer-warm-03.mp3', time: 125, duck: true },
  { file: '/chamber/voices/admirer-warm-04.mp3', time: 155, duck: true },

  // ASCENT — Admirer Cooling + Guide
  { file: '/chamber/voices/admirer-cool-01.mp3', time: 200, duck: true },
  { file: '/chamber/voices/guide-01.mp3', time: 220, duck: true },
  { file: '/chamber/voices/admirer-cool-02.mp3', time: 240, duck: true },
  { file: '/chamber/voices/admirer-cool-03.mp3', time: 285, duck: true },
  { file: '/chamber/voices/guide-02.mp3', time: 315, duck: true },
  { file: '/chamber/voices/admirer-cool-04.mp3', time: 330, duck: true },
  { file: '/chamber/voices/guide-03.mp3', time: 345, duck: true },
  { file: '/chamber/voices/guide-04.mp3', time: 348, duck: true },
  { file: '/chamber/voices/guide-05.mp3', time: 355, duck: true },

  // DISSOLUTION — Admirer Cold + Witness + Guide (NO DUCKING)
  { file: '/chamber/voices/admirer-cold-01.mp3', time: 380, duck: false },
  { file: '/chamber/voices/admirer-cold-02.mp3', time: 400, duck: false },
  { file: '/chamber/voices/witness-01.mp3', time: 440, duck: false },
  { file: '/chamber/voices/witness-02.mp3', time: 465, duck: false },
  { file: '/chamber/voices/witness-03.mp3', time: 490, duck: false },
  { file: '/chamber/voices/guide-06.mp3', time: 495, duck: false },
  { file: '/chamber/voices/witness-04.mp3', time: 515, duck: false },
  { file: '/chamber/voices/guide-07.mp3', time: 530, duck: false },
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
