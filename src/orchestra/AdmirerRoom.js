// AdmirerRoom — a small Web-Audio HRTF "room" for the Admirer's voice during
// the conversation phase. It mirrors the per-source signal chain of
// OrchestraEngine (mono → HRTF panner + pre-HRTF reverb send → 6 image-source
// early reflections + binaural hall-IR convolver → master lowpass → output),
// but for one source instead of four. setExpansion(t) interpolates the room
// between the INTIMATE (t=0) and EXPANDED (t=1) presets in roomPresets.js, so
// the closed conversation room can audibly open into the orchestra.
//
// The Admirer's voice is a bank of pre-baked TTS clips played through this room
// via playVoiceClip() — there is no live agent and no MediaStream capture.

import { EARLY_REFLECTIONS } from './constants.js'
import { sphericalToCartesian } from '../chamber/utils/math.js'
import { roomAt } from '../lib/roomPresets.js'
import { equalPowerGains } from '../lib/equalPower.js'

const HALL_IR_URL = '/chamber/hall-ir.wav'
const VOICE_ELEVATION_DEG = 5
const VOICE_DISTANCE_M = 1.6

// Largest azimuth swing the phone's roll can give the voice. Wide enough to
// be clearly heard — a comfortable wrist roll carries the voice most of the
// way to one side; the voice still has a place, it just has a big one.
export const MAX_AZIMUTH_OFFSET_DEG = 75
const ROLL_DEADZONE_DEG = 3
// Roll this far past the resting baseline gives the full swing — a ~40°
// wrist roll, not the full 90°, so the whole range is comfortably reachable.
const ROLL_FULL_DEG = 40

function dbToLinear(db) {
  return Math.pow(10, db / 20)
}

// Map a baseline-relative device roll (degrees — the caller subtracts the
// phone's resting position) to an azimuth offset for the voice. A small
// deadzone keeps a still hand from nudging it; past ROLL_FULL_DEG the swing
// saturates. Pure — unit-tested.
export function rollToAzimuthOffset(relRoll) {
  if (relRoll == null || Number.isNaN(relRoll)) return 0
  const clamped = Math.max(-ROLL_FULL_DEG, Math.min(ROLL_FULL_DEG, relRoll))
  const mag = Math.abs(clamped)
  if (mag < ROLL_DEADZONE_DEG) return 0
  const sign = clamped < 0 ? -1 : 1
  const past = (mag - ROLL_DEADZONE_DEG) / (ROLL_FULL_DEG - ROLL_DEADZONE_DEG)
  return sign * past * MAX_AZIMUTH_OFFSET_DEG
}


export default class AdmirerRoom {
  constructor(ctx) {
    this.ctx = ctx
    this._t = 0
    this._rafId = null
    this._disposed = false
    this.voiceSource = null
    this.convolver = null
    this.hallWetGain = null
    this.reflections = []
    this._build()
  }

  // Build the full graph synchronously EXCEPT the hall-IR convolver (which
  // needs an async fetch — see loadReverb). The graph is live and connectable
  // the instant the constructor returns, so there is no capture race.
  _build() {
    const ctx = this.ctx
    const r = roomAt(0)

    // Master: directBus → masterLowpass → destination. Unlike OrchestraEngine
    // there is no master compressor — one quiet voice plus its reflections
    // will not clip, so the extra stage would only add coloration.
    this.directBus = ctx.createGain()
    this.directBus.gain.value = 1.0
    this.masterLowpass = ctx.createBiquadFilter()
    this.masterLowpass.type = 'lowpass'
    this.masterLowpass.frequency.value = r.dampingHz
    this.masterLowpass.Q.value = 0.7
    this.directBus.connect(this.masterLowpass)
    this.masterLowpass.connect(ctx.destination)

    // Voice entry — fold to mono so the HRTF panner spatialises one signal.
    this.monoGain = ctx.createGain()
    this.monoGain.channelCount = 1
    this.monoGain.channelCountMode = 'explicit'
    this.monoGain.channelInterpretation = 'speakers'

    // Direct path: monoGain → directGain → HRTF panner → directBus
    this.directGain = ctx.createGain()
    this.directGain.gain.value = r.directGain
    this.panner = ctx.createPanner()
    this.panner.panningModel = 'HRTF'
    this.panner.distanceModel = 'inverse'
    this.panner.refDistance = 1
    this.panner.maxDistance = 20
    this.panner.rolloffFactor = 1
    const vp = sphericalToCartesian(0, VOICE_ELEVATION_DEG, VOICE_DISTANCE_M)
    this.panner.positionX.value = vp.x
    this.panner.positionY.value = vp.y
    this.panner.positionZ.value = vp.z
    this.monoGain.connect(this.directGain)
    this.directGain.connect(this.panner)
    this.panner.connect(this.directBus)

    // Reverb bus — a mono pre-HRTF send; wetness is shaped downstream.
    this.reverbBus = ctx.createGain()
    this.reverbBus.gain.value = 1.0
    this.monoGain.connect(this.reverbBus)

    // Early reflections — 6 image-source walls, reusing the Orchestra room
    // geometry (EARLY_REFLECTIONS). Each: delay → wall lowpass → gain → HRTF.
    for (const er of EARLY_REFLECTIONS) {
      const baseDelaySec = er.delayMs / 1000
      const baseGainLin = dbToLinear(er.gainDb)

      const delay = ctx.createDelay(0.05)
      delay.delayTime.value = baseDelaySec * r.reflectionDelayScale
      const wallFilter = ctx.createBiquadFilter()
      wallFilter.type = 'lowpass'
      wallFilter.frequency.value = er.lpHz
      wallFilter.Q.value = 0.7
      const erGain = ctx.createGain()
      erGain.gain.value = baseGainLin * r.reflectionGain
      const erPanner = ctx.createPanner()
      erPanner.panningModel = 'HRTF'
      erPanner.distanceModel = 'inverse'
      erPanner.refDistance = 1
      erPanner.maxDistance = 20
      erPanner.rolloffFactor = 1
      const ep = sphericalToCartesian(er.azimuth, er.elevation, 1.5)
      erPanner.positionX.value = ep.x
      erPanner.positionY.value = ep.y
      erPanner.positionZ.value = ep.z

      this.reverbBus.connect(delay)
      delay.connect(wallFilter)
      wallFilter.connect(erGain)
      erGain.connect(erPanner)
      erPanner.connect(this.directBus)

      this.reflections.push({ delay, wallFilter, erGain, erPanner, baseDelaySec, baseGainLin })
    }
  }

  // Fetch + decode the binaural hall IR and attach the late-reverb convolver.
  // Best-effort: the room still runs (drier) without it.
  async loadReverb() {
    if (this._disposed) return
    let irBuffer
    try {
      const res = await fetch(HALL_IR_URL)
      const arr = await res.arrayBuffer()
      irBuffer = await this.ctx.decodeAudioData(arr)
    } catch (e) {
      console.warn('[admirer-room] hall IR load failed — running without late reverb', e)
      return
    }
    if (this._disposed) return
    this.convolver = this.ctx.createConvolver()
    this.convolver.buffer = irBuffer
    this.hallWetGain = this.ctx.createGain()
    this.hallWetGain.gain.value = roomAt(this._t).reverbWet
    this.reverbBus.connect(this.convolver)
    this.convolver.connect(this.hallWetGain)
    this.hallWetGain.connect(this.directBus)
  }

  // Phone roll → a gentle azimuth swing of the voice within the room.
  setAzimuthOffset(offsetDeg) {
    if (this._disposed || !this.panner) return
    const pos = sphericalToCartesian(offsetDeg, VOICE_ELEVATION_DEG, VOICE_DISTANCE_M)
    const now = this.ctx.currentTime
    this.panner.positionX.setTargetAtTime(pos.x, now, 0.08)
    this.panner.positionY.setTargetAtTime(pos.y, now, 0.08)
    this.panner.positionZ.setTargetAtTime(pos.z, now, 0.08)
  }

  // Play a one-shot footsteps clip routed through this room's HRTF panner.
  // The panner position animates from a "room edge" point behind the
  // listener's right shoulder to the voice's resting seat over the clip's
  // duration, so the listener hears the Admirer walking up before the
  // first word arrives. Schedules a transient BufferSource and disposes
  // it on 'ended'. Cheap, fire-and-forget.
  playFootsteps(buffer, { onEnded } = {}) {
    if (this._disposed || !buffer || !this.ctx || !this.monoGain) { onEnded?.(); return }
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = buffer

    // Dedicated panner for the footsteps so the animated position does
    // not fight with the voice panner's roll-driven azimuth (set in
    // setAzimuthOffset). Routes to the same directBus so the room's
    // master lowpass + reflections process it like everything else.
    const stepGain = ctx.createGain()
    stepGain.channelCount = 1
    stepGain.channelCountMode = 'explicit'
    stepGain.channelInterpretation = 'speakers'
    stepGain.gain.value = 0.55

    const stepPanner = ctx.createPanner()
    stepPanner.panningModel = 'HRTF'
    stepPanner.distanceModel = 'inverse'
    stepPanner.refDistance = 1
    stepPanner.maxDistance = 20
    stepPanner.rolloffFactor = 1

    // Start position: behind-right at ~6m.
    const startSph = sphericalToCartesian(-150, 0, 6)
    stepPanner.positionX.value = startSph.x
    stepPanner.positionY.value = startSph.y
    stepPanner.positionZ.value = startSph.z

    src.connect(stepGain)
    stepGain.connect(stepPanner)
    stepPanner.connect(this.directBus)
    // Also feed the reverb bus so reflections + late reverb shape the steps.
    stepPanner.connect(this.reverbBus)

    // Animate from (-150°, 0°, 6m) to (0°, 5°, 1.6m) over the buffer's
    // duration. setTargetAtTime ramps with a smoothing time constant; we
    // schedule the targets at start and let them glide.
    const now = ctx.currentTime
    const dur = buffer.duration
    const endSph = sphericalToCartesian(0, 5, 1.6)
    const tc = Math.max(0.3, dur * 0.4)
    stepPanner.positionX.setTargetAtTime(endSph.x, now, tc)
    stepPanner.positionY.setTargetAtTime(endSph.y, now, tc)
    stepPanner.positionZ.setTargetAtTime(endSph.z, now, tc)

    src.start(now)

    src.addEventListener('ended', () => {
      try { src.disconnect() } catch { /* ignore */ }
      try { stepGain.disconnect() } catch { /* ignore */ }
      try { stepPanner.disconnect() } catch { /* ignore */ }
      onEnded?.()
    }, { once: true })
  }

  // Play a pre-recorded voice clip (the Admirer's spoken line) through the
  // room's voice path — monoGain → directGain → HRTF panner (whose azimuth
  // tracks phone roll via setAzimuthOffset) + reverb send — so the line is
  // spatialised at the voice's resting seat and pans as the listener tilts.
  // Replaces the old live-agent voice capture (captureAdmirerVoice/connectVoice):
  // Act 1 is now gesture-only with finite authored lines, so the voice is a
  // bank of pre-baked clips, not a live conversation. Returns a handle with
  // stop(); fires onEnded when the clip finishes (or immediately if it can't).
  playVoiceClip(buffer, { onEnded } = {}) {
    if (this._disposed || !buffer || !this.ctx || !this.monoGain) { onEnded?.(); return null }
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = buffer
    try { src.connect(this.monoGain) } catch (e) {
      console.warn('[admirer-room] playVoiceClip connect failed', e)
      onEnded?.()
      return null
    }
    this.voiceClipSource = src
    src.start(ctx.currentTime)
    src.addEventListener('ended', () => {
      try { src.disconnect() } catch { /* ignore */ }
      if (this.voiceClipSource === src) this.voiceClipSource = null
      onEnded?.()
    }, { once: true })
    return {
      stop: () => {
        try { src.stop() } catch { /* ignore */ }
        try { src.disconnect() } catch { /* ignore */ }
      },
    }
  }

  // Lean movement: two looping textures at fixed L/R azimuths. Returns a
  // handle whose setBalance(b∈[-1,1]) constant-power cross-fades them by the
  // phone's roll. Both feed directBus + reverbBus so the room shapes them.
  playTexturePair(leftBuffer, rightBuffer) {
    if (this._disposed || !this.ctx || !leftBuffer || !rightBuffer) return null
    const ctx = this.ctx
    const make = (buffer, azimuthDeg, initGain) => {
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      const gain = ctx.createGain()
      gain.channelCount = 1
      gain.channelCountMode = 'explicit'
      gain.channelInterpretation = 'speakers'
      gain.gain.value = initGain
      const panner = ctx.createPanner()
      panner.panningModel = 'HRTF'
      panner.distanceModel = 'inverse'
      panner.refDistance = 1
      panner.maxDistance = 20
      panner.rolloffFactor = 1
      const p = sphericalToCartesian(azimuthDeg, 0, 1.8)
      panner.positionX.value = p.x
      panner.positionY.value = p.y
      panner.positionZ.value = p.z
      src.connect(gain)
      gain.connect(panner)
      panner.connect(this.directBus)
      panner.connect(this.reverbBus)
      src.start(ctx.currentTime)
      return { src, gain, panner }
    }
    const init = equalPowerGains(0)
    const left = make(leftBuffer, -60, init.left)
    const right = make(rightBuffer, 60, init.right)
    let stopped = false
    return {
      setBalance: (b) => {
        if (this._disposed || stopped) return
        const g = equalPowerGains(b)
        const now = ctx.currentTime
        left.gain.gain.setTargetAtTime(g.left, now, 0.05)
        right.gain.gain.setTargetAtTime(g.right, now, 0.05)
      },
      stop: () => {
        stopped = true
        for (const n of [left, right]) {
          try { n.src.stop() } catch { /* ignore */ }
          try { n.src.disconnect(); n.gain.disconnect(); n.panner.disconnect() } catch { /* ignore */ }
        }
      },
    }
  }

  // Face movement: N looping sources arranged at given azimuths (the archetype
  // ring). spotlight(yawDeg) raises the source nearest the facing direction
  // and dips the rest via constant-power weighting on angular proximity.
  playRingSources(entries) {
    if (this._disposed || !this.ctx || !entries?.length) return null
    const ctx = this.ctx
    const nodes = entries.map(({ buffer, azimuthDeg }) => {
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      const gain = ctx.createGain()
      gain.channelCount = 1
      gain.channelCountMode = 'explicit'
      gain.channelInterpretation = 'speakers'
      gain.gain.value = 0.25
      const panner = ctx.createPanner()
      panner.panningModel = 'HRTF'
      panner.distanceModel = 'inverse'
      panner.refDistance = 1
      panner.maxDistance = 20
      panner.rolloffFactor = 1
      const p = sphericalToCartesian(azimuthDeg, 0, 2.4)
      panner.positionX.value = p.x
      panner.positionY.value = p.y
      panner.positionZ.value = p.z
      src.connect(gain)
      gain.connect(panner)
      panner.connect(this.directBus)
      panner.connect(this.reverbBus)
      src.start(ctx.currentTime)
      return { src, gain, panner, azimuthDeg }
    })
    let stopped = false
    const azimuths = nodes.map((n) => n.azimuthDeg)
    const minAz = Math.min(...azimuths)
    const maxAz = Math.max(...azimuths)
    return {
      spotlight: (yawDeg) => {
        if (this._disposed || stopped) return
        const y = Math.max(minAz, Math.min(maxAz, yawDeg))
        const now = ctx.currentTime
        for (const n of nodes) {
          const prox = Math.max(0, 1 - Math.abs(n.azimuthDeg - y) / 90)
          n.gain.gain.setTargetAtTime(0.18 + 0.62 * prox, now, 0.08)
        }
      },
      stop: () => {
        stopped = true
        for (const n of nodes) {
          try { n.src.stop() } catch { /* ignore */ }
          try { n.src.disconnect(); n.gain.disconnect(); n.panner.disconnect() } catch { /* ignore */ }
        }
      },
    }
  }

  // Rise movement: one looping build whose gain follows the conducting gesture
  // size (setSwell), plus markBeat() — a short percussive transient on the
  // down-stroke. Seated front-center.
  playRiseBed(buffer) {
    if (this._disposed || !this.ctx || !buffer) return null
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const gain = ctx.createGain()
    gain.channelCount = 1
    gain.channelCountMode = 'explicit'
    gain.channelInterpretation = 'speakers'
    gain.gain.value = 0.2
    const panner = ctx.createPanner()
    panner.panningModel = 'HRTF'
    panner.distanceModel = 'inverse'
    panner.refDistance = 1
    panner.maxDistance = 20
    panner.rolloffFactor = 1
    const p = sphericalToCartesian(0, 5, 1.8)
    panner.positionX.value = p.x
    panner.positionY.value = p.y
    panner.positionZ.value = p.z
    src.connect(gain)
    gain.connect(panner)
    panner.connect(this.directBus)
    panner.connect(this.reverbBus)
    src.start(ctx.currentTime)
    let stopped = false
    return {
      setSwell: (g) => {
        if (this._disposed || stopped) return
        gain.gain.setTargetAtTime(0.15 + 0.85 * Math.max(0, Math.min(1, g)), ctx.currentTime, 0.12)
      },
      markBeat: (intensity = 1) => {
        if (this._disposed || stopped) return
        const now = ctx.currentTime
        const noise = ctx.createBufferSource()
        const len = Math.floor(ctx.sampleRate * 0.08)
        const buf = ctx.createBuffer(1, len, ctx.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
        noise.buffer = buf
        const ng = ctx.createGain()
        ng.channelCount = 1
        ng.channelCountMode = 'explicit'
        ng.channelInterpretation = 'speakers'
        ng.gain.value = 0.4 * Math.max(0, Math.min(1, intensity))
        noise.connect(ng)
        ng.connect(panner)
        noise.start(now)
        noise.addEventListener('ended', () => {
          try { noise.disconnect(); ng.disconnect() } catch { /* ignore */ }
        }, { once: true })
      },
      stop: () => {
        stopped = true
        try { src.stop() } catch { /* ignore */ }
        try { src.disconnect(); gain.disconnect(); panner.disconnect() } catch { /* ignore */ }
      },
    }
  }

  // Apply the room preset at expansion t (0 intimate … 1 expanded).
  setExpansion(t) {
    if (this._disposed || !this.directBus) return
    this._t = Math.max(0, Math.min(1, t))
    const r = roomAt(this._t)
    const now = this.ctx.currentTime
    this.directGain.gain.setTargetAtTime(r.directGain, now, 0.1)
    this.masterLowpass.frequency.setTargetAtTime(r.dampingHz, now, 0.1)
    if (this.hallWetGain) {
      this.hallWetGain.gain.setTargetAtTime(r.reverbWet, now, 0.1)
    }
    for (const ref of this.reflections) {
      ref.delay.delayTime.setTargetAtTime(ref.baseDelaySec * r.reflectionDelayScale, now, 0.1)
      ref.erGain.gain.setTargetAtTime(ref.baseGainLin * r.reflectionGain, now, 0.1)
    }
  }

  // Animate the room open from its current t to 1 over durationMs.
  beginExpansion(durationMs = 3500) {
    if (this._disposed) return
    if (this._rafId) cancelAnimationFrame(this._rafId)
    const fromT = this._t
    const start = performance.now()
    const step = (nowMs) => {
      if (this._disposed) return
      const p = Math.min(1, (nowMs - start) / durationMs)
      this.setExpansion(fromT + (1 - fromT) * p)
      if (p < 1) {
        this._rafId = requestAnimationFrame(step)
      } else {
        this._rafId = null
      }
    }
    this._rafId = requestAnimationFrame(step)
  }

  // Tear down: stop the ramp, disconnect every node.
  dispose() {
    this._disposed = true
    if (this._rafId) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }
    try { this.voiceClipSource?.stop() } catch { /* ignore */ }
    const nodes = [
      this.monoGain, this.directGain, this.panner,
      this.reverbBus, this.convolver, this.hallWetGain,
      this.directBus, this.masterLowpass,
    ]
    for (const n of nodes) {
      try { if (n) n.disconnect() } catch { /* ignore */ }
    }
    for (const ref of this.reflections) {
      try {
        ref.delay.disconnect()
        ref.wallFilter.disconnect()
        ref.erGain.disconnect()
        ref.erPanner.disconnect()
      } catch { /* ignore */ }
    }
    this.reflections = []
  }
}
