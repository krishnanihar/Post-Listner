// StemPlayer — sample-aligned playback of 4 looped stems.
//
// Owns 4 AudioBufferSourceNodes (vocals/drums/bass/other) running on a shared
// AudioContext and started at a single anchor time so they remain phase-locked
// across loop boundaries. During Reveal, all 4 sum into one mono gain node for
// a flat preview mix. At Orchestra hand-off the player detaches each source
// from the sum bus, leaving them alive and routable into the spatial graph.
//
// BufferSourceNode is single-shot — once started it cannot be paused/restarted.
// "Pause" here means setting the sum gain to 0; "stop" actually halts sources
// and the player becomes unusable.
//
// Fallback shape: when stems aren't available, pass `{ kind: 'master', buffer }`
// to the static factory; the player fans the single buffer out to all 4 stem
// names so the Orchestra still receives 4 entry nodes.

const STEM_KEYS = ['vocals', 'drums', 'bass', 'other']

export default class StemPlayer {
  /**
   * @param {AudioContext} ctx
   * @param {{vocals: AudioBuffer, drums: AudioBuffer, bass: AudioBuffer, other: AudioBuffer}} buffers
   */
  constructor(ctx, buffers) {
    this.ctx = ctx
    this.buffers = buffers
    this.sources = null
    this.sumGain = ctx.createGain()
    this.sumGain.gain.value = 0
    this.attachedDest = null
    this.started = false
    this.detached = false
    this.startedAt = 0
  }

  /**
   * Load all 4 stems from URLs, decode them, and return a ready-to-start
   * StemPlayer. Falls back to a duplicated single buffer when any stem fails.
   *
   * @param {AudioContext} ctx
   * @param {{vocals: string, drums: string, bass: string, other: string}} urls
   * @param {string} [fallbackUrl] — single master to fan out if any stem fails
   */
  static async load(ctx, urls, fallbackUrl = null) {
    try {
      const buffers = await loadAndDecode(ctx, urls)
      return new StemPlayer(ctx, buffers)
    } catch (err) {
      console.warn('StemPlayer.load: stem fetch failed, attempting fallback', err)
      if (!fallbackUrl) throw err
      const single = await loadAndDecode(ctx, { only: fallbackUrl })
      const buf = single.only
      return new StemPlayer(ctx, {
        vocals: buf, drums: buf, bass: buf, other: buf,
      })
    }
  }

  /** Start all 4 sources with a shared anchor time so they're sample-aligned. */
  start(anchorOffset = 0.05) {
    if (this.started) return
    this.started = true
    const startAt = this.ctx.currentTime + anchorOffset
    this.startedAt = startAt
    this.sources = {}
    for (const name of STEM_KEYS) {
      const buf = this.buffers[name]
      if (!buf) continue
      const src = this.ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      src.connect(this.sumGain)
      src.start(startAt)
      this.sources[name] = src
    }
    this.sumGain.connect(this.ctx.destination)
    this.attachedDest = this.ctx.destination
  }

  /** Volume control over the simple sum bus (used during Reveal). */
  setVolume(target, fadeMs = 0) {
    const now = this.ctx.currentTime
    const param = this.sumGain.gain
    if (fadeMs > 0) {
      param.cancelScheduledValues(now)
      param.setValueAtTime(param.value, now)
      param.linearRampToValueAtTime(target, now + fadeMs / 1000)
    } else {
      param.setValueAtTime(target, now)
    }
  }

  /** Current volume of the sum bus (best-effort — Web Audio AudioParam.value
   *  doesn't always reflect ramp position on Safari). */
  getVolume() {
    return this.sumGain.gain.value
  }

  /**
   * Disconnect the 4 sources from the sum bus and return them so a downstream
   * graph (e.g. OrchestraEngine.connectStems) can take ownership. The sources
   * keep playing — caller must reconnect them within a few audio frames or
   * the listener hears silence.
   *
   * @returns {{vocals: AudioBufferSourceNode, drums: AudioBufferSourceNode, bass: AudioBufferSourceNode, other: AudioBufferSourceNode}}
   */
  detachAndGetSources() {
    if (!this.sources) return null
    if (this.detached) return this.sources
    this.detached = true
    for (const name of STEM_KEYS) {
      const src = this.sources[name]
      if (!src) continue
      try { src.disconnect(this.sumGain) } catch { /* already disconnected */ }
    }
    try { this.sumGain.disconnect() } catch { /* nothing to disconnect */ }
    this.attachedDest = null
    return this.sources
  }

  /** Force-stop all sources. Player becomes unusable after this. */
  stop() {
    if (!this.sources) return
    for (const src of Object.values(this.sources)) {
      try { src.stop() } catch { /* already stopped */ }
    }
    this.sources = null
  }

  /** Mute (sources keep running, volume → 0). Fade-friendly alternative to stop. */
  pause() {
    this.setVolume(0)
  }

  /** Compatibility shim — Orchestra.jsx currently calls `.pause()` on the ref. */
  get currentTime() {
    return this.ctx.currentTime - this.startedAt
  }
}

async function loadAndDecode(ctx, urlMap) {
  const entries = Object.entries(urlMap)
  const buffers = await Promise.all(entries.map(async ([key, url]) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`)
    const arrayBuf = await res.arrayBuffer()
    const audioBuf = await ctx.decodeAudioData(arrayBuf)
    return [key, audioBuf]
  }))
  return Object.fromEntries(buffers)
}
