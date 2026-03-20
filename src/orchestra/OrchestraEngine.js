import { STARTS, SECTIONS, FRACTURE, TRACK_B, GAINS, DUCK, CONDUCTING } from './constants.js'
import { HALL_IR_FILE, TRACK_B_FILE, AUDIENCE_FILES, OVATION_FILE } from './scripts.js'
import { lerp, clamp, sphericalToCartesian } from '../chamber/utils/math.js'

/**
 * Master audio graph for the Orchestra experience.
 *
 * Audio architecture:
 *   songSource → dryGain (fades during Bloom)
 *              → 3-band split (LOW/MID/HIGH) → per-section gain → per-section HRTF panner
 *                → duckGain → hallConvolver (wet) + hallDry → compressor → destination
 *
 *   trackB → trackBFilter → trackBGain → trackBPanner → compressor
 *   audience → audienceGain → compressor
 *   ovation → ovationGain → ovationPanner → compressor
 *   binaural (L+R sine → merger) → binauralGain → compressor
 *   voices → voiceGain → compressor
 */
export default class OrchestraEngine {
  constructor(audioCtx) {
    this.ctx = audioCtx
    this.buffers = new Map() // path → AudioBuffer

    // Song source
    this.songSource = null
    this.dryGain = null
    this.splitGain = null

    // 3-band split
    this.sections = {} // { LOW: { filter, gain, panner }, MID: { ... }, HIGH: { ... } }

    // Hall reverb
    this.hallConvolver = null
    this.hallWetGain = null
    this.hallDryGain = null

    // Duck
    this.duckGain = null

    // Track B
    this.trackBSources = []
    this.trackBFilter = null
    this.trackBGain = null
    this.trackBPanner = null
    this.trackBStarted = false
    this.trackBAngle = 0

    // Audience
    this.audienceSources = []
    this.audienceGain = null

    // Ovation
    this.ovationSource = null
    this.ovationGain = null
    this.ovationPanner = null

    // Binaural
    this.binauralLeft = null
    this.binauralRight = null
    this.binauralMerger = null
    this.binauralGain = null

    // Voices
    this.voiceGain = null
    this.activeSources = [] // track all for cleanup

    // Master
    this.compressor = null
    this.masterGain = null

    // Section coupling (computed from FRACTURE curves)
    this.sectionCoupling = { LOW: 1.0, MID: 1.0, HIGH: 1.0 }

    // Conducting filter (shared across sections)
    this.conductingFilter = null

    // Drift seeds for azimuth random walk
    this._driftSeeds = { LOW: Math.random() * 100, MID: Math.random() * 100, HIGH: Math.random() * 100 }
  }

  // ─── Preload ─────────────────────────────────────────────────────────────────

  async preloadAll(paths, onProgress) {
    let loaded = 0
    for (const p of paths) {
      try {
        const res = await fetch(p)
        const arrayBuf = await res.arrayBuffer()
        const audioBuf = await this.ctx.decodeAudioData(arrayBuf)
        this.buffers.set(p, audioBuf)
      } catch (e) {
        console.warn(`OrchestraEngine: failed to load ${p}`, e)
      }
      loaded++
      if (onProgress) onProgress(loaded / paths.length)
    }
  }

  // ─── Init ────────────────────────────────────────────────────────────────────

  init() {
    const ctx = this.ctx
    const hallIRBuffer = this.buffers.get(HALL_IR_FILE)

    // Master compressor
    this.compressor = ctx.createDynamicsCompressor()
    this.compressor.threshold.value = -12
    this.compressor.knee.value = 0
    this.compressor.ratio.value = 4
    this.compressor.attack.value = 0.003
    this.compressor.release.value = 0.1

    this.masterGain = ctx.createGain()
    this.masterGain.gain.value = 1.0
    this.compressor.connect(this.masterGain)
    this.masterGain.connect(ctx.destination)

    // Duck gain (sidechain for voice ducking)
    this.duckGain = ctx.createGain()
    this.duckGain.gain.value = 1.0

    // Hall convolver reverb (wet/dry parallel)
    if (hallIRBuffer) {
      this.hallConvolver = ctx.createConvolver()
      this.hallConvolver.buffer = hallIRBuffer
      this.hallWetGain = ctx.createGain()
      this.hallWetGain.gain.value = 0.0
      this.hallDryGain = ctx.createGain()
      this.hallDryGain.gain.value = 1.0

      this.duckGain.connect(this.hallConvolver)
      this.hallConvolver.connect(this.hallWetGain)
      this.hallWetGain.connect(this.compressor)

      this.duckGain.connect(this.hallDryGain)
      this.hallDryGain.connect(this.compressor)
    } else {
      // No IR — direct connection
      this.duckGain.connect(this.compressor)
    }

    // Dry path (stereo, pre-split)
    this.dryGain = ctx.createGain()
    this.dryGain.gain.value = 1.0
    this.dryGain.connect(this.compressor) // dry goes direct

    // Split path gain (crossfade with dry during Bloom)
    this.splitGain = ctx.createGain()
    this.splitGain.gain.value = 0.0

    // 3-band split sections
    for (const [name, cfg] of Object.entries(SECTIONS)) {
      const section = {}

      if (name === 'MID') {
        // Bandpass: highpass 250Hz + lowpass 2500Hz in series
        section.filterHP = ctx.createBiquadFilter()
        section.filterHP.type = 'highpass'
        section.filterHP.frequency.value = cfg.cutoffLow
        section.filterHP.Q.value = 0.7

        section.filterLP = ctx.createBiquadFilter()
        section.filterLP.type = 'lowpass'
        section.filterLP.frequency.value = cfg.cutoffHigh
        section.filterLP.Q.value = 0.7

        section.filterHP.connect(section.filterLP)
        section.filter = section.filterHP // entry point
      } else {
        section.filter = ctx.createBiquadFilter()
        section.filter.type = cfg.type
        section.filter.frequency.value = cfg.cutoff
        section.filter.Q.value = 0.7
      }

      section.gain = ctx.createGain()
      section.gain.gain.value = 1.0

      section.panner = ctx.createPanner()
      section.panner.panningModel = 'HRTF'
      section.panner.distanceModel = 'inverse'
      section.panner.refDistance = 1
      section.panner.maxDistance = 20
      section.panner.rolloffFactor = 1
      section.panner.coneInnerAngle = 360
      section.panner.coneOuterAngle = 360

      // Set initial position
      const pos = sphericalToCartesian(cfg.azimuth || 0, cfg.elevation || 0, cfg.distance || 2)
      section.panner.positionX.value = pos.x
      section.panner.positionY.value = pos.y
      section.panner.positionZ.value = pos.z

      // Connect: splitGain → filter → gain → panner → duckGain
      const lastFilter = name === 'MID' ? section.filterLP : section.filter
      lastFilter.connect(section.gain)
      section.gain.connect(section.panner)
      section.panner.connect(this.conductingFilter)

      this.sections[name] = section
    }

    // Conducting filter (shared, for filter cutoff control)
    // All section panners → conductingFilter → duckGain
    this.conductingFilter = ctx.createBiquadFilter()
    this.conductingFilter.type = 'lowpass'
    this.conductingFilter.frequency.value = 4000
    this.conductingFilter.Q.value = 1
    this.conductingFilter.connect(this.duckGain)

    // Track B nodes (source created on demand)
    this.trackBFilter = ctx.createBiquadFilter()
    this.trackBFilter.type = 'lowpass'
    this.trackBFilter.frequency.value = TRACK_B.INITIAL_LOWPASS

    this.trackBGain = ctx.createGain()
    this.trackBGain.gain.value = 0.0

    this.trackBPanner = ctx.createPanner()
    this.trackBPanner.panningModel = 'HRTF'
    this.trackBPanner.distanceModel = 'inverse'
    this.trackBPanner.refDistance = 1
    this.trackBPanner.maxDistance = 20
    this.trackBPanner.rolloffFactor = 1
    this.trackBPanner.coneInnerAngle = 360
    this.trackBPanner.coneOuterAngle = 360
    const tbPos = sphericalToCartesian(90, 0, 4)
    this.trackBPanner.positionX.value = tbPos.x
    this.trackBPanner.positionY.value = tbPos.y
    this.trackBPanner.positionZ.value = tbPos.z

    this.trackBFilter.connect(this.trackBGain)
    this.trackBGain.connect(this.trackBPanner)
    this.trackBPanner.connect(this.compressor)

    // Audience
    this.audienceGain = ctx.createGain()
    this.audienceGain.gain.value = 0.0
    this.audienceGain.connect(this.compressor)

    // Ovation
    this.ovationGain = ctx.createGain()
    this.ovationGain.gain.value = 0.0
    this.ovationPanner = ctx.createPanner()
    this.ovationPanner.panningModel = 'HRTF'
    this.ovationPanner.distanceModel = 'inverse'
    this.ovationPanner.refDistance = 1
    this.ovationPanner.maxDistance = 20
    this.ovationPanner.rolloffFactor = 1
    const ovPos = sphericalToCartesian(180, 0, 3)
    this.ovationPanner.positionX.value = ovPos.x
    this.ovationPanner.positionY.value = ovPos.y
    this.ovationPanner.positionZ.value = ovPos.z
    this.ovationGain.connect(this.ovationPanner)
    this.ovationPanner.connect(this.compressor)

    // Binaural
    this.binauralLeft = ctx.createOscillator()
    this.binauralLeft.type = 'sine'
    this.binauralLeft.frequency.value = GAINS.BINAURAL.CARRIER

    this.binauralRight = ctx.createOscillator()
    this.binauralRight.type = 'sine'
    this.binauralRight.frequency.value = GAINS.BINAURAL.CARRIER + 10 // alpha

    this.binauralMerger = ctx.createChannelMerger(2)
    this.binauralGain = ctx.createGain()
    this.binauralGain.gain.value = 0.0

    this.binauralLeft.connect(this.binauralMerger, 0, 0)
    this.binauralRight.connect(this.binauralMerger, 0, 1)
    this.binauralMerger.connect(this.binauralGain)
    this.binauralGain.connect(this.compressor)

    this.binauralLeft.start()
    this.binauralRight.start()

    // Voice gain
    this.voiceGain = ctx.createGain()
    this.voiceGain.gain.value = 1.0
    this.voiceGain.connect(this.compressor)
  }

  // ─── Connect Song ────────────────────────────────────────────────────────────

  connectSong(audioElement) {
    this.songSource = this.ctx.createMediaElementSource(audioElement)

    // Dry path (fades to 0 during Bloom)
    this.songSource.connect(this.dryGain)

    // Split path: song → splitGain → each section filter
    this.songSource.connect(this.splitGain)
    for (const section of Object.values(this.sections)) {
      this.splitGain.connect(section.filter)
    }
  }

  // ─── Tick (frame update) ─────────────────────────────────────────────────────

  tick(t, dt) {
    const now = this.ctx.currentTime

    // 1. Bloom crossfade (30s–50s): dry→0, split→1, hall wet→0.55, audience→0.10
    if (t >= STARTS.BLOOM && t < STARTS.THRONE) {
      const p = clamp((t - STARTS.BLOOM) / (STARTS.THRONE - STARTS.BLOOM), 0, 1)
      this.dryGain.gain.setTargetAtTime(1.0 - p, now, 0.1)
      this.splitGain.gain.setTargetAtTime(p, now, 0.1)
      if (this.hallWetGain) {
        this.hallWetGain.gain.setTargetAtTime(lerp(GAINS.HALL_WET.BLOOM_START, GAINS.HALL_WET.BLOOM_END, p), now, 0.1)
      }
      this.audienceGain.gain.setTargetAtTime(lerp(0, GAINS.AUDIENCE.BLOOM, p), now, 0.1)
    } else if (t >= STARTS.THRONE && t < STARTS.BLOOM) {
      // Already past bloom — ensure values set
    }

    // 2. Hall reverb wet (grows slightly during Ascent)
    if (t >= STARTS.ASCENT && t < STARTS.DISSOLUTION && this.hallWetGain) {
      const p = clamp((t - STARTS.ASCENT) / (STARTS.DISSOLUTION - STARTS.ASCENT), 0, 1)
      this.hallWetGain.gain.setTargetAtTime(lerp(GAINS.HALL_WET.THRONE, GAINS.HALL_WET.ASCENT_END, p), now, 0.5)
    }

    // 3. Per-section coupling (FRACTURE curves)
    for (const name of ['HIGH', 'MID', 'LOW']) {
      this.sectionCoupling[name] = this._interpolateCurve(FRACTURE[name], t)
    }

    // 4. Per-section azimuth drift (store for applyConducting to combine)
    this._currentDrift = this._currentDrift || {}
    for (const [name, section] of Object.entries(this.sections)) {
      const coupling = this.sectionCoupling[name]
      const driftAmount = 1.0 - coupling
      const cfg = SECTIONS[name]
      const maxDrift = FRACTURE[`${name}_DRIFT`] || 0
      const drift = Math.sin(t * 0.1 + this._driftSeeds[name]) * maxDrift * driftAmount
      this._currentDrift[name] = drift
      const baseAzimuth = cfg.azimuth || 0
      const pos = sphericalToCartesian(baseAzimuth + drift, cfg.elevation || 0, cfg.distance || 2)
      section.panner.positionX.setTargetAtTime(pos.x, now, 0.1)
      section.panner.positionY.setTargetAtTime(pos.y, now, 0.1)
      section.panner.positionZ.setTargetAtTime(pos.z, now, 0.1)

      // 5. Per-section detune
      const maxDetune = FRACTURE[`${name}_DETUNE`] || 0
      if (maxDetune > 0 && section.filter) {
        const detune = Math.sin(t * 0.07 + this._driftSeeds[name] * 2) * maxDetune * driftAmount
        section.filter.detune.setTargetAtTime(detune, now, 0.1)
      }
    }

    // 6. Track A master gain
    const trackAGain = this._getTrackAGain(t)
    for (const section of Object.values(this.sections)) {
      section.gain.gain.setTargetAtTime(trackAGain, now, 0.3)
    }

    // 7. Track B
    if (t >= TRACK_B.ENTER && !this.trackBStarted) {
      this.startTrackB()
    }
    if (this.trackBStarted) {
      const trackBGain = this._getTrackBGain(t)
      this.trackBGain.gain.setTargetAtTime(trackBGain, now, 0.3)

      // Filter opens over time
      const filterProgress = clamp((t - TRACK_B.ENTER) / (STARTS.DISSOLUTION - TRACK_B.ENTER), 0, 1)
      const filterFreq = lerp(TRACK_B.INITIAL_LOWPASS, TRACK_B.FINAL_LOWPASS, filterProgress)
      this.trackBFilter.frequency.setTargetAtTime(filterFreq, now, 0.5)

      // Orbital position
      this.trackBAngle += TRACK_B.ORBITAL_SPEED * dt
      const elevation = t >= STARTS.DISSOLUTION ? lerp(0, 30, clamp((t - STARTS.DISSOLUTION) / 120, 0, 1)) : 0
      const tbPos = sphericalToCartesian((this.trackBAngle * 180 / Math.PI) % 360, elevation, 4)
      this.trackBPanner.positionX.setTargetAtTime(tbPos.x, now, 0.05)
      this.trackBPanner.positionY.setTargetAtTime(tbPos.y, now, 0.05)
      this.trackBPanner.positionZ.setTargetAtTime(tbPos.z, now, 0.05)
    }

    // 8. Audience gain (fades out by Dissolution)
    if (t >= STARTS.THRONE && t < STARTS.DISSOLUTION) {
      const p = clamp((t - STARTS.THRONE) / (STARTS.DISSOLUTION - STARTS.THRONE), 0, 1)
      // Audience is at BLOOM level during Throne, fades to 0 by Dissolution
      if (t >= STARTS.ASCENT) {
        const fadeP = clamp((t - STARTS.ASCENT) / (STARTS.DISSOLUTION - STARTS.ASCENT), 0, 1)
        this.audienceGain.gain.setTargetAtTime(lerp(GAINS.AUDIENCE.BLOOM, 0, fadeP), now, 0.5)
      }
    } else if (t >= STARTS.DISSOLUTION) {
      this.audienceGain.gain.setTargetAtTime(0, now, 0.5)
    }

    // 9. Binaural beat frequency sweep
    const beatFreq = this._getBinauralBeat(t)
    this.binauralRight.frequency.setTargetAtTime(GAINS.BINAURAL.CARRIER + beatFreq, now, 0.5)

    // Binaural gain
    if (t >= STARTS.BLOOM && t < STARTS.SILENCE) {
      this.binauralGain.gain.setTargetAtTime(GAINS.BINAURAL.MAX, now, 0.3)
    } else if (t >= STARTS.SILENCE) {
      const fadeP = clamp((t - STARTS.SILENCE) / (STARTS.RETURN - STARTS.SILENCE), 0, 1)
      this.binauralGain.gain.setTargetAtTime(GAINS.BINAURAL.MAX * (1 - fadeP), now, 0.3)
    }
  }

  // ─── Conducting ──────────────────────────────────────────────────────────────

  applyConducting(params) {
    if (!params) return
    const now = this.ctx.currentTime
    const { pan, filterNorm, gestureGain, articulation, downbeat } = params

    // Pan: tilt emphasizes different sections (gain + spatial movement)
    // Left tilt (pan < 0.5) → LOW +, HIGH -
    // Right tilt (pan > 0.5) → HIGH +, LOW -
    const panOffset = (pan - 0.5) * 2 // -1 to 1
    const lowBoost = 1.0 + (-panOffset * 0.6) // up to ±4.5dB when tilted
    const highBoost = 1.0 + (panOffset * 0.6)

    // Spatial panner shift from tilt: ±20° azimuth, scaled by avg coupling
    const avgCouplingForPan = (this.sectionCoupling.LOW + this.sectionCoupling.MID + this.sectionCoupling.HIGH) / 3
    const panShift = panOffset * 20 * avgCouplingForPan

    for (const [name, section] of Object.entries(this.sections)) {
      const coupling = this.sectionCoupling[name]
      let sectionGainMod = 1.0

      if (name === 'LOW') sectionGainMod = lerp(1.0, lowBoost, coupling)
      else if (name === 'HIGH') sectionGainMod = lerp(1.0, highBoost, coupling)

      // Gesture size → dynamics
      const dynamicsGain = lerp(
        CONDUCTING.GESTURE_SIZE_GAIN_MIN,
        CONDUCTING.GESTURE_SIZE_GAIN_MAX,
        gestureGain * coupling
      )

      const finalGain = dynamicsGain * sectionGainMod
      section.gain.gain.setTargetAtTime(
        clamp(finalGain * this._getTrackAGain(this._lastT || 0), 0, 1.5),
        now,
        CONDUCTING.INTENSITY_TC
      )

      // Shift section panner azimuth based on tilt (combine with fracture drift)
      const cfg = SECTIONS[name]
      const drift = this._currentDrift?.[name] || 0
      const finalAz = (cfg.azimuth || 0) + drift + panShift * coupling
      const pos = sphericalToCartesian(finalAz, cfg.elevation || 0, cfg.distance || 2)
      section.panner.positionX.setTargetAtTime(pos.x, now, CONDUCTING.PAN_TC)
      section.panner.positionY.setTargetAtTime(pos.y, now, CONDUCTING.PAN_TC)
      section.panner.positionZ.setTargetAtTime(pos.z, now, CONDUCTING.PAN_TC)
    }

    // Filter cutoff (shared)
    if (this.conductingFilter) {
      const avgCoupling = (this.sectionCoupling.LOW + this.sectionCoupling.MID + this.sectionCoupling.HIGH) / 3
      const cutoff = 200 + filterNorm * avgCoupling * 3800
      this.conductingFilter.frequency.setTargetAtTime(cutoff, now, CONDUCTING.FILTER_FREQ_TC)
    }

    // Articulation → Q spike
    if (articulation > CONDUCTING.ARTICULATION_THRESHOLD) {
      const avgCoupling = (this.sectionCoupling.LOW + this.sectionCoupling.MID + this.sectionCoupling.HIGH) / 3
      if (avgCoupling > 0.05 && this.conductingFilter) {
        const targetQ = CONDUCTING.ARTICULATION_Q_BASE +
          articulation * (CONDUCTING.ARTICULATION_Q_MAX - CONDUCTING.ARTICULATION_Q_BASE)
        this.conductingFilter.Q.setTargetAtTime(targetQ, now, 0.01)
        this.conductingFilter.Q.setTargetAtTime(CONDUCTING.ARTICULATION_Q_BASE, now + 0.02, CONDUCTING.ARTICULATION_DECAY_TC)
      }
    }

    // Downbeat accent
    if (downbeat && downbeat.fired) {
      this._applyDownbeat(downbeat.intensity)
    }
  }

  _applyDownbeat(intensity) {
    const now = this.ctx.currentTime

    // Gain spike on each section
    for (const section of Object.values(this.sections)) {
      const currentGain = section.gain.gain.value
      const spike = CONDUCTING.DOWNBEAT_GAIN_SPIKE_MIN +
        intensity * (CONDUCTING.DOWNBEAT_GAIN_SPIKE_MAX - CONDUCTING.DOWNBEAT_GAIN_SPIKE_MIN)
      const spikeGain = Math.min(1.5, currentGain * spike)

      section.gain.gain.cancelScheduledValues(now)
      section.gain.gain.setValueAtTime(spikeGain, now)
      section.gain.gain.setTargetAtTime(currentGain, now + 0.01, CONDUCTING.DOWNBEAT_GAIN_DECAY_TC)
    }

    // Q spike on conducting filter
    if (this.conductingFilter) {
      const targetQ = CONDUCTING.DOWNBEAT_Q_MIN +
        intensity * (CONDUCTING.DOWNBEAT_Q_MAX - CONDUCTING.DOWNBEAT_Q_MIN)
      this.conductingFilter.Q.cancelScheduledValues(now)
      this.conductingFilter.Q.setValueAtTime(targetQ, now)
      this.conductingFilter.Q.setTargetAtTime(CONDUCTING.ARTICULATION_Q_BASE, now + 0.01, CONDUCTING.DOWNBEAT_Q_DECAY_TC)
    }

    // Percussive noise transient
    this._playDownbeatTransient(intensity)
  }

  _playDownbeatTransient(intensity) {
    const now = this.ctx.currentTime
    const duration = CONDUCTING.DOWNBEAT_TRANSIENT_DURATION
    const gain = CONDUCTING.DOWNBEAT_TRANSIENT_GAIN * intensity

    const sampleCount = Math.ceil(this.ctx.sampleRate * duration)
    const buffer = this.ctx.createBuffer(1, sampleCount, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const source = this.ctx.createBufferSource()
    source.buffer = buffer

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1500 + intensity * 2000
    filter.Q.value = 2

    const gainNode = this.ctx.createGain()
    gainNode.gain.setValueAtTime(gain, now)
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration)

    source.connect(filter).connect(gainNode).connect(this.compressor)
    source.start(now)
    source.stop(now + duration + 0.01)
  }

  // ─── Track B ─────────────────────────────────────────────────────────────────

  startTrackB() {
    const buffer = this.buffers.get(TRACK_B_FILE)
    if (!buffer || this.trackBStarted) return
    this.trackBStarted = true

    this._playTrackBLoop(buffer)
  }

  _playTrackBLoop(buffer) {
    const overlap = 2 // seconds of crossfade overlap
    const now = this.ctx.currentTime

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.trackBFilter)
    source.start(now)
    this.trackBSources.push(source)
    this.activeSources.push(source)

    // Schedule next loop before this one ends
    const scheduleNext = () => {
      if (!this.trackBStarted) return
      const nextSource = this.ctx.createBufferSource()
      nextSource.buffer = buffer
      nextSource.connect(this.trackBFilter)
      const startAt = this.ctx.currentTime + buffer.duration - overlap
      nextSource.start(startAt)
      this.trackBSources.push(nextSource)
      this.activeSources.push(nextSource)

      // Schedule the one after that
      setTimeout(scheduleNext, (buffer.duration - overlap - 1) * 1000)
    }

    setTimeout(scheduleNext, (buffer.duration - overlap - 1) * 1000)
  }

  // ─── Audience ────────────────────────────────────────────────────────────────

  startAudience() {
    // Place audience sources behind/around the listener for surround immersion
    const positions = [
      { azimuth: 210, elevation: 5, distance: 4 },  // left-rear
      { azimuth: 150, elevation: 5, distance: 4 },  // right-rear
    ]

    AUDIENCE_FILES.forEach((path, i) => {
      const buffer = this.buffers.get(path)
      if (!buffer) return
      const source = this.ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true

      const panner = this.ctx.createPanner()
      panner.panningModel = 'HRTF'
      panner.distanceModel = 'inverse'
      panner.refDistance = 1
      panner.maxDistance = 20
      panner.rolloffFactor = 1
      panner.coneInnerAngle = 360
      panner.coneOuterAngle = 360
      const p = positions[i % positions.length]
      const pos = sphericalToCartesian(p.azimuth, p.elevation, p.distance)
      panner.positionX.value = pos.x
      panner.positionY.value = pos.y
      panner.positionZ.value = pos.z

      source.connect(panner)
      panner.connect(this.audienceGain)
      source.start()
      this.audienceSources.push(source)
      this.activeSources.push(source)
    })
  }

  // ─── Ovation ─────────────────────────────────────────────────────────────────

  scheduleOvation(ctxStartTime) {
    const buffer = this.buffers.get(OVATION_FILE)
    if (!buffer) return

    const playAt = ctxStartTime + GAINS.OVATION.TIME
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.ovationGain)

    // Gain envelope: 0 → peak over 2s, hold, decay over 4s
    const dur = GAINS.OVATION.DURATION
    this.ovationGain.gain.setValueAtTime(0, playAt)
    this.ovationGain.gain.linearRampToValueAtTime(GAINS.OVATION.PEAK, playAt + 2)
    this.ovationGain.gain.setValueAtTime(GAINS.OVATION.PEAK, playAt + dur - 4)
    this.ovationGain.gain.exponentialRampToValueAtTime(0.001, playAt + dur)

    source.start(playAt)
    this.activeSources.push(source)
  }

  // ─── Voice Scheduling ───────────────────────────────────────────────────────

  scheduleVoice(buffer, startTime, options = {}) {
    if (!buffer) return

    const source = this.ctx.createBufferSource()
    source.buffer = buffer

    const gainNode = this.ctx.createGain()
    gainNode.gain.value = options.gain || 1.0

    if (options.lowpass) {
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = options.lowpass
      source.connect(filter).connect(gainNode)
    } else {
      source.connect(gainNode)
    }

    if (options.azimuth != null || options.elevation != null) {
      const panner = this.ctx.createPanner()
      panner.panningModel = 'HRTF'
      panner.distanceModel = 'inverse'
      panner.refDistance = 1
      panner.maxDistance = 20
      panner.rolloffFactor = 1
      const pos = sphericalToCartesian(options.azimuth || 0, options.elevation || 0, options.distance || 3)
      panner.positionX.value = pos.x
      panner.positionY.value = pos.y
      panner.positionZ.value = pos.z
      gainNode.connect(panner)
      panner.connect(this.voiceGain)
    } else {
      gainNode.connect(this.voiceGain)
    }

    // Sidechain duck if requested
    if (options.duck && this.duckGain) {
      this.duckGain.gain.setTargetAtTime(DUCK.GAIN, startTime, DUCK.ATTACK_TC)
      // Release after buffer duration
      const releaseTime = startTime + buffer.duration
      this.duckGain.gain.setTargetAtTime(1.0, releaseTime, DUCK.RELEASE_TC)
    }

    source.start(startTime)
    this.activeSources.push(source)
    return source
  }

  // ─── Fade Out ────────────────────────────────────────────────────────────────

  fadeOut(duration = 5) {
    const now = this.ctx.currentTime
    this.masterGain.gain.setTargetAtTime(0, now, duration / 4)
  }

  // ─── Return Tone ─────────────────────────────────────────────────────────────

  playReturnTone(depthValue) {
    let freq = 65
    if (depthValue >= 0.6) freq = 55
    else if (depthValue >= 0.3) freq = 82

    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq

    const gain = this.ctx.createGain()
    gain.gain.value = 0

    osc.connect(gain)
    gain.connect(this.compressor)

    osc.start()
    gain.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + 5)

    this.activeSources.push(osc)
    this._returnToneGain = gain
  }

  // ─── Stop All ────────────────────────────────────────────────────────────────

  stopAll() {
    this.trackBStarted = false

    for (const source of this.activeSources) {
      try { source.stop() } catch (e) { /* already stopped */ }
    }
    this.activeSources = []
    this.trackBSources = []
    this.audienceSources = []

    try { this.binauralLeft.stop() } catch (e) {}
    try { this.binauralRight.stop() } catch (e) {}
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  _interpolateCurve(curve, t) {
    if (!curve || curve.length === 0) return 1.0
    if (t <= curve[0][0]) return curve[0][1]
    if (t >= curve[curve.length - 1][0]) return curve[curve.length - 1][1]

    for (let i = 0; i < curve.length - 1; i++) {
      const [t0, v0] = curve[i]
      const [t1, v1] = curve[i + 1]
      if (t >= t0 && t <= t1) {
        const p = (t - t0) / (t1 - t0)
        return lerp(v0, v1, p)
      }
    }
    return curve[curve.length - 1][1]
  }

  _getTrackAGain(t) {
    this._lastT = t
    if (t < STARTS.THRONE) return GAINS.TRACK_A.REVEAL
    if (t < STARTS.ASCENT) return GAINS.TRACK_A.THRONE
    if (t < STARTS.DISSOLUTION) {
      const p = (t - STARTS.ASCENT) / (STARTS.DISSOLUTION - STARTS.ASCENT)
      return lerp(GAINS.TRACK_A.THRONE, GAINS.TRACK_A.ASCENT_END, p)
    }
    if (t < 450) { // gone by 7:30
      const p = (t - STARTS.DISSOLUTION) / (450 - STARTS.DISSOLUTION)
      return lerp(GAINS.TRACK_A.ASCENT_END, GAINS.TRACK_A.DISSOLUTION_END, p)
    }
    return 0
  }

  _getTrackBGain(t) {
    if (t < TRACK_B.ENTER) return 0
    if (t < 320) { // crossover at ~5:20
      const p = (t - TRACK_B.ENTER) / (320 - TRACK_B.ENTER)
      return lerp(GAINS.TRACK_B.ENTER, GAINS.TRACK_B.CROSSOVER, p)
    }
    if (t < STARTS.DISSOLUTION) {
      const p = (t - 320) / (STARTS.DISSOLUTION - 320)
      return lerp(GAINS.TRACK_B.CROSSOVER, GAINS.TRACK_B.DISSOLUTION, p)
    }
    if (t < STARTS.SILENCE) {
      // Check for "Good" swell near 530s
      if (t >= 528 && t <= 535) {
        const swellP = t < 530 ? (t - 528) / 2 : (535 - t) / 5
        return lerp(GAINS.TRACK_B.DISSOLUTION, GAINS.TRACK_B.PEAK, clamp(swellP, 0, 1))
      }
      return GAINS.TRACK_B.DISSOLUTION
    }
    // Silence phase: fade out
    const p = (t - STARTS.SILENCE) / (STARTS.RETURN - STARTS.SILENCE)
    return lerp(GAINS.TRACK_B.DISSOLUTION, GAINS.TRACK_B.SILENCE, clamp(p, 0, 1))
  }

  _getBinauralBeat(t) {
    if (t < STARTS.BLOOM) return 10
    if (t < STARTS.ASCENT) return 10
    if (t < STARTS.DISSOLUTION) {
      const p = (t - STARTS.ASCENT) / (STARTS.DISSOLUTION - STARTS.ASCENT)
      return lerp(10, 6, p)
    }
    if (t < STARTS.SILENCE) {
      const p = (t - STARTS.DISSOLUTION) / (STARTS.SILENCE - STARTS.DISSOLUTION)
      return lerp(6, 4, p)
    }
    const p = (t - STARTS.SILENCE) / (STARTS.RETURN - STARTS.SILENCE)
    return lerp(4, 2, clamp(p, 0, 1))
  }
}
