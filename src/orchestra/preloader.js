import { getAllPaths } from './scripts.js'

let preloadPromise = null
let cachedBuffers = null

export function startOrchestraPreload(audioCtx) {
  if (preloadPromise) return preloadPromise
  const paths = getAllPaths()
  preloadPromise = (async () => {
    const buffers = new Map()
    for (const p of paths) {
      try {
        const res = await fetch(p)
        const arrayBuf = await res.arrayBuffer()
        const audioBuf = await audioCtx.decodeAudioData(arrayBuf)
        buffers.set(p, audioBuf)
      } catch (e) {
        console.warn(`orchestra preload: failed ${p}`, e)
      }
    }
    cachedBuffers = buffers
    return buffers
  })()
  return preloadPromise
}

export function getPreloadedBuffers() { return cachedBuffers }
export function isPreloadComplete() { return cachedBuffers !== null }
