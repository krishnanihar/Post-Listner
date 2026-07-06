// GenerativePlayer — plays ONE generated mix as 4 conductable spatial bands.
//
// It mirrors StemPlayer's exact contract so it's a drop-in at the Act1→Act2
// seam: load() → start() silent → setVolume() → detachAndGetSources() →
// OrchestraEngine.connectStems(). The difference is internal: instead of 4
// separate stem buffers, it decodes one generated track, RMS-normalizes it, and
// runs a single looped BufferSourceNode through a 4-band Linkwitz-Riley splitter
// (src/orchestra/spectralBands.js). detachAndGetSources() returns the 4 band
// output nodes in the same {vocals,drums,bass,other} shape the engine expects.
//
// Because all four bands come from ONE source, they are perfectly sample-
// aligned by construction — the continuity invariant holds trivially. The song
// keeps playing across detach; the caller must reconnect the returned nodes
// within a few audio frames (same rule as StemPlayer).

import { buildBandSplitter, BAND_NAMES } from '../orchestra/spectralBands.js'

// Target loudness for normalization (~-17 dBFS RMS). Generated tracks vary in
// level; this lands them near the catalog's perceived loudness so the Orchestra
// mix stays consistent whichever path won. Gain is clamped to avoid pumping a
// near-silent buffer to full scale.
const TARGET_RMS = 0.14
const NORM_MIN = 0.25
const NORM_MAX = 4.0

export default class GenerativePlayer {
  /**
   * @param {AudioContext} ctx
   * @param {AudioBuffer} buffer — the decoded generated mix
   */
  constructor(ctx, buffer) {
    this.ctx = ctx
    this.buffer = buffer
    // The encoded (undecoded) track bytes, retained by load() so the winning
    // mix can be archived. The orchestrator frees this via releaseEncoded()
    // once persisted. Null when constructed directly (no source bytes).
    this.encodedBytes = null
    this.source = null
    this.bandOutputs = null
    this._disposeSplitter = null

    this.normGain = ctx.createGain()
    this.normGain.gain.value = 1

    this.sumGain = ctx.createGain()
    this.sumGain.gain.value = 0

    this.started = false
    this.detached = false
    this.startedAt = 0
    this.attachedDest = null
  }

  /**
   * Fetch + decode a generated track (blob: or http URL), returning a ready-to-
   * start GenerativePlayer with normalization pre-computed.
   * @param {AudioContext} ctx
   * @param {string} url
   */
  static async load(ctx, url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`GenerativePlayer.load: fetch ${url} failed: ${res.status}`)
    const arr = await res.arrayBuffer()
    // decodeAudioData DETACHES (neuters) its input ArrayBuffer per the Web Audio
    // spec, leaving `arr` at 0 bytes. Copy the encoded bytes BEFORE decoding so
    // the retained copy survives for archiving (putAudio).
    const encoded = arr.slice(0)
    const buffer = await ctx.decodeAudioData(arr)
    // The generated blob is now decoded into an AudioBuffer; release the (multi-
    // MB) object URL so it isn't pinned to the document for the session.
    if (typeof url === 'string' && url.startsWith('blob:')) {
      try { URL.revokeObjectURL(url) } catch { /* not a revocable URL */ }
    }
    const player = new GenerativePlayer(ctx, buffer)
    // Retain the (pre-decode) encoded-bytes copy so the winning mix can be
    // persisted to the local archive (putAudio). The orchestrator frees these
    // via releaseEncoded() after storing, since the ArrayBuffer is multi-MB.
    player.encodedBytes = encoded
    player.normGain.gain.value = computeNormalizationGain(buffer, TARGET_RMS)
    return player
  }

  /** Drop the retained encoded bytes once archived, to free ~MBs of memory. */
  releaseEncoded() { this.encodedBytes = null }

  /** Song length (seconds) — Orchestra reads this to time its end-fade. */
  get duration() { return this.buffer?.duration || 0 }

  /** Tells OrchestraEngine to use the band gain-comp table (setSourceMode). */
  get sourceMode() { return 'bands' }

  /**
   * Compatibility shim for Orchestra's `Math.max(handoff.buffers?.*.duration)`
   * fallback — every band derives from the one buffer, so all four report the
   * same (correct) duration.
   */
  get buffers() {
    const b = this.buffer
    return { vocals: b, drums: b, bass: b, other: b }
  }

  /** Start the single source + band splitter, summed silently into the ctx. */
  start(anchorOffset = 0.05) {
    if (this.started) return
    this.started = true
    const startAt = this.ctx.currentTime + anchorOffset
    this.startedAt = startAt

    const source = this.ctx.createBufferSource()
    source.buffer = this.buffer
    source.loop = true
    source.connect(this.normGain)
    this.source = source

    const { outputs, dispose } = buildBandSplitter(this.ctx, this.normGain)
    this.bandOutputs = outputs
    this._disposeSplitter = dispose
    for (const name of BAND_NAMES) outputs[name].connect(this.sumGain)

    this.sumGain.connect(this.ctx.destination)
    this.attachedDest = this.ctx.destination

    source.start(startAt)
  }

  /** Volume over the silent preview sum bus (mirrors StemPlayer). */
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

  getVolume() { return this.sumGain.gain.value }

  /**
   * Disconnect the 4 band outputs from the preview sum bus and return them so
   * OrchestraEngine.connectStems can take ownership. The source keeps playing.
   * @returns {{vocals: AudioNode, drums: AudioNode, bass: AudioNode, other: AudioNode}}
   */
  detachAndGetSources() {
    if (!this.bandOutputs) return null
    if (this.detached) return this.bandOutputs
    this.detached = true
    for (const name of BAND_NAMES) {
      try { this.bandOutputs[name].disconnect(this.sumGain) } catch { /* already gone */ }
    }
    try { this.sumGain.disconnect() } catch { /* nothing to disconnect */ }
    this.attachedDest = null
    // bandOutputs is already keyed {bass,drums,vocals,other}; connectStems reads
    // by name so key order is irrelevant. Return the stored map (idempotent).
    return this.bandOutputs
  }

  /** Force-stop. The single source dies → all 4 bands go silent. Unusable after. */
  stop() {
    if (this.source) {
      try { this.source.stop() } catch { /* already stopped */ }
    }
    this.source = null
    if (this._disposeSplitter) { try { this._disposeSplitter() } catch { /* ignore */ } }
  }

  pause() { this.setVolume(0) }

  get currentTime() { return this.ctx.currentTime - this.startedAt }
}

// RMS over the first channel (strided for speed on long buffers), turned into a
// clamped make-up gain toward the target. Exported for unit testing.
export function computeNormalizationGain(buffer, targetRms = TARGET_RMS) {
  if (!buffer || typeof buffer.getChannelData !== 'function') return 1
  const data = buffer.getChannelData(0)
  const n = data.length
  if (!n) return 1
  const stride = Math.max(1, Math.floor(n / 200000))
  let sum = 0
  let count = 0
  for (let i = 0; i < n; i += stride) {
    const s = data[i]
    sum += s * s
    count++
  }
  const rms = Math.sqrt(sum / Math.max(1, count))
  if (rms < 1e-5) return 1
  return Math.max(NORM_MIN, Math.min(NORM_MAX, targetRms / rms))
}
