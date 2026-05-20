// AdmirerRoom — a small Web-Audio HRTF "room" for the Admirer's voice during
// the conversation phase. It mirrors the per-source signal chain of
// OrchestraEngine (mono → HRTF panner + pre-HRTF reverb send → 6 image-source
// early reflections + binaural hall-IR convolver → master lowpass → output),
// but for one source instead of four. setExpansion(t) interpolates the room
// between the INTIMATE (t=0) and EXPANDED (t=1) presets in roomPresets.js, so
// the closed conversation room can audibly open into the orchestra.
//
// Voice capture: the ElevenLabs SDK exposes no output node (see
// docs/admirer-spatial-spike.md). It appends a hidden <audio> element whose
// srcObject is a MediaStream to document.body; captureAdmirerVoice() taps it.

import { EARLY_REFLECTIONS } from './constants.js'
import { sphericalToCartesian } from '../chamber/utils/math.js'
import { roomAt } from '../lib/roomPresets.js'

const HALL_IR_URL = '/chamber/hall-ir.wav'
const VOICE_ELEVATION_DEG = 5
const VOICE_DISTANCE_M = 1.6

// Largest azimuth swing the phone's roll can give the voice. Small on
// purpose — the voice has a place; the phone turns you within the room,
// it is not a video-game pan.
export const MAX_AZIMUTH_OFFSET_DEG = 20
const ROLL_DEADZONE_DEG = 4

function dbToLinear(db) {
  return Math.pow(10, db / 20)
}

// Map device roll (gamma, degrees, nominally -90..90) to a gentle azimuth
// offset for the voice. A small deadzone keeps a still hand from nudging it.
// Pure — unit-tested.
export function rollToAzimuthOffset(gamma) {
  if (gamma == null || Number.isNaN(gamma)) return 0
  const clamped = Math.max(-90, Math.min(90, gamma))
  const mag = Math.abs(clamped)
  if (mag < ROLL_DEADZONE_DEG) return 0
  const sign = clamped < 0 ? -1 : 1
  const past = (mag - ROLL_DEADZONE_DEG) / (90 - ROLL_DEADZONE_DEG)
  return sign * past * MAX_AZIMUTH_OFFSET_DEG
}

// Find the hidden <audio> element the ElevenLabs SDK appends to document.body
// and tap its MediaStream. Throws if it is not present yet — the caller
// retries briefly after the session connects. Muting the element kills its
// direct-to-speaker path; it does not affect the MediaStream the source node
// reads, so the room becomes the only thing rendering the voice.
export function captureAdmirerVoice(ctx) {
  const el = [...document.querySelectorAll('audio')]
    .find(a => a.srcObject instanceof MediaStream && a.src === '')
  if (!el || !el.srcObject) {
    throw new Error('[admirer-room] SDK audio element not found')
  }
  el.muted = true
  return ctx.createMediaStreamSource(el.srcObject)
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

  // Connect a captured voice source node into the room's mono entry.
  // Idempotent: a prior source (if any) is detached first.
  connectVoice(sourceNode) {
    if (this._disposed || !sourceNode || !this.monoGain) return
    if (this.voiceSource) {
      try { this.voiceSource.disconnect(this.monoGain) } catch { /* ignore */ }
    }
    this.voiceSource = sourceNode
    try {
      sourceNode.connect(this.monoGain)
    } catch (e) {
      console.warn('[admirer-room] connectVoice failed', e)
    }
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
    const nodes = [
      this.voiceSource, this.monoGain, this.directGain, this.panner,
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
