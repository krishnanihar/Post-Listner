// src/score/voice.js
const cache = new Map()
let activeVoice = null

export async function playVoice(path) {
  // Stop previous voice to prevent overlap
  if (activeVoice) {
    activeVoice.pause()
    activeVoice.currentTime = 0
  }

  let audio = cache.get(path)
  if (!audio) {
    audio = new Audio(path)
    audio.preload = 'auto'
    cache.set(path, audio)
  }
  audio.currentTime = 0
  activeVoice = audio
  try {
    await audio.play()
    return new Promise(resolve => {
      audio.addEventListener('ended', () => {
        if (activeVoice === audio) activeVoice = null
        resolve()
      }, { once: true })
    })
  } catch (e) {
    console.warn('voice play failed', path, e)
    if (activeVoice === audio) activeVoice = null
  }
}

export function preloadVoices(paths) {
  for (const p of paths) {
    if (!cache.has(p)) {
      const a = new Audio(p)
      a.preload = 'auto'
      cache.set(p, a)
    }
  }
}
