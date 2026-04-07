// src/score/voice.js
const cache = new Map()

export async function playVoice(path) {
  let audio = cache.get(path)
  if (!audio) {
    audio = new Audio(path)
    audio.preload = 'auto'
    cache.set(path, audio)
  }
  audio.currentTime = 0
  try {
    await audio.play()
    return new Promise(resolve => {
      audio.addEventListener('ended', resolve, { once: true })
    })
  } catch (e) {
    console.warn('voice play failed', path, e)
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
