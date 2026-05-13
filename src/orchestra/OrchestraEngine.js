import {
  PHASES,
  BRIEFING_DURATION,
  BLOOM_DURATION,
  END_FADE_DURATION,
  STEMS,
  EARLY_REFLECTIONS,
  YAW_SPOTLIGHT,
  GAINS,
  CONDUCTING,
  distanceCutoff,
} from './constants.js'
import { HALL_IR_FILE, AUDIENCE_FILES } from './scripts.js'
import { lerp, clamp, sphericalToCartesian } from '../chamber/utils/math.js'
import { ENABLE_GYRO_ENERGY_COUPLING } from '../conducting/index.js'

const STEM_NAMES = ['VOCALS', 'DRUMS', 'BASS', 'OTHER']

/**
 * Master audio graph for the Orchestra v3 (3-phase, voice-free).
 *
 * Per-stem (mono):
 *   stemEntry → stemGain → eqFilter → distanceLP → conductingFilter
 *     ├→ HRTFPanner(stemAzimuth)                         → directBus
 *     └→ reverbSend gain                                 → reverbBus
 *
 * Shared (mono → stereo):
 *   reverbBus → 6× [delay → wallFilter → gain → HRTFPanner] → directBus
 *   reverbBus → ConvolverNode(binaural hall IR) → wetGain   → directBus
 *
 * Output:
 *   directBus → masterCompressor → masterGain → ctx.destination
 *
 * Bypass (per spatial-audio Priority 6):
 *   binaural (oscL+oscR → ChannelMerger) → binauralGain → ctx.destination
 *
 * v3 changes from v2: no Track B, no voices/duck, no ovation, no fracture
 * curves, binaural locked at constant 10 Hz alpha, no Ascent/Dissolution
 * envelopes — Track A holds at GAINS.TRACK_A throughout once Bloom completes.
 */
export default class OrchestraEngine {
  constructor(audioCtx) {
    this.ctx = audioCtx
    this.buffers = new Map()

    this.stems = {}

    this.reverbBus = null
    this.reflectionPanners = []
    this.hallConvolver = null
    this.hallWetGain = null
    this.directBus = null

    this.audienceSources = []
    this.audienceGain = null

    this.binauralLeft = null
    this.binauralRight = null
    this.binauralMerger = null
    this.binauralGain = null

    this.activeSources = []

    this.compressor = null
    this.masterGain = null

    this._driftSeeds = Object.fromEntries(STEM_NAMES.map(n => [n, Math.random() * 100]))
    this._lastT = 0
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

    // Direct bus — sum of spatialized sources before final compression
    this.directBus = ctx.createGain()
    this.directBus.gain.value = 1.0
    this.directBus.connect(this.compressor)

    // Reverb bus (mono — pre-HRTF sends from each stem)
    this.reverbBus = ctx.createGain()
    this.reverbBus.gain.value = 1.0

    // Late reverb (binaural hall IR convolver)
    if (hallIRBuffer) {
      this.hallConvolver = ctx.createConvolver()
      this.hallConvolver.buffer = hallIRBuffer
      this.hallWetGain = ctx.createGain()
      this.hallWetGain.gain.value = 0.0

      this.reverbBus.connect(this.hallConvolver)
      this.hallConvolver.connect(this.hallWetGain)
      this.hallWetGain.connect(this.directBus)
    }

    // Early reflections (6 surfaces, image-source method, shared across stems)
    this._buildEarlyReflections()

    // Per-stem mono chains (entry node → caller connects their source here)
    for (const name of STEM_NAMES) {
      const cfg = STEMS[name]
      const stem = {}

      stem.entry = ctx.createGain()
      stem.entry.gain.value = 1.0

      stem.gain = ctx.createGain()
      stem.gain.gain.value = 1.0

      stem.eqFilter = ctx.createBiquadFilter()
      stem.eqFilter.type = 'peaking'
      stem.eqFilter.frequency.value = 1000
      stem.eqFilter.gain.value = 0
      stem.eqFilter.Q.value = 1

      stem.distanceLP = ctx.createBiquadFilter()
      stem.distanceLP.type = 'lowpass'
      stem.distanceLP.frequency.value = distanceCutoff(cfg.distance)
      stem.distanceLP.Q.value = 0.7

      stem.conductingFilter = ctx.createBiquadFilter()
      stem.conductingFilter.type = 'lowpass'
      stem.conductingFilter.frequency.value = 4000
      stem.conductingFilter.Q.value = 1

      stem.panner = ctx.createPanner()
      stem.panner.panningModel = 'HRTF'
      stem.panner.distanceModel = 'inverse'
      stem.panner.refDistance = 1
      stem.panner.maxDistance = 20
      stem.panner.rolloffFactor = 1
      stem.panner.coneInnerAngle = 360
      stem.panner.coneOuterAngle = 360
      const pos = sphericalToCartesian(cfg.azimuth, cfg.elevation, cfg.distance)
      stem.panner.positionX.value = pos.x
      stem.panner.positionY.value = pos.y
      stem.panner.positionZ.value = pos.z

      stem.reverbSend = ctx.createGain()
      stem.reverbSend.gain.value = cfg.reverbSend

      stem.entry.connect(stem.gain)
      stem.gain.connect(stem.eqFilter)
      stem.eqFilter.connect(stem.distanceLP)
      stem.distanceLP.connect(stem.conductingFilter)

      // Branch: direct via HRTF + reverb send (pre-HRTF mono)
      stem.conductingFilter.connect(stem.panner)
      stem.panner.connect(this.directBus)

      stem.conductingFilter.connect(stem.reverbSend)
      stem.reverbSend.connect(this.reverbBus)

      this.stems[name] = stem
    }

    // Audience murmur (constant level once Bloom completes)
    this.audienceGain = ctx.createGain()
    this.audienceGain.gain.value = 0.0
    this.audienceGain.connect(this.directBus)

    // Binaural — locked at constant 10 Hz alpha, BYPASSES the compressor
    this.binauralLeft = ctx.createOscillator()
    this.binauralLeft.type = 'sine'
    this.binauralLeft.frequency.value = GAINS.BINAURAL.CARRIER

    this.binauralRight = ctx.createOscillator()
    this.binauralRight.type = 'sine'
    this.binauralRight.frequency.value = GAINS.BINAURAL.CARRIER + GAINS.BINAURAL.BEAT_HZ

    this.binauralMerger = ctx.createChannelMerger(2)
    this.binauralGain = ctx.createGain()
    this.binauralGain.gain.value = 0.0

    this.binauralLeft.connect(this.binauralMerger, 0, 0)
    this.binauralRight.connect(this.binauralMerger, 0, 1)
    this.binauralMerger.connect(this.binauralGain)
    this.binauralGain.connect(ctx.destination)  // bypass compressor + master

    this.binauralLeft.start()
    this.binauralRight.start()
  }

  _buildEarlyReflections() {
    const ctx = this.ctx
    for (const er of EARLY_REFLECTIONS) {
      const delay = ctx.createDelay(0.05)
      delay.delayTime.value = er.delayMs / 1000

      const wallFilter = ctx.createBiquadFilter()
      wallFilter.type = 'lowpass'
      wallFilter.frequency.value = er.lpHz
      wallFilter.Q.value = 0.7

      const gain = ctx.createGain()
      gain.gain.value = Math.pow(10, er.gainDb / 20)

      const panner = ctx.createPanner()
      panner.panningModel = 'HRTF'
      panner.distanceModel = 'inverse'
      panner.refDistance = 1
      panner.maxDistance = 20
      panner.rolloffFactor = 1
      const pos = sphericalToCartesian(er.azimuth, er.elevation, 1.5)
      panner.positionX.value = pos.x
      panner.positionY.value = pos.y
      panner.positionZ.value = pos.z

      this.reverbBus.connect(delay)
      delay.connect(wallFilter)
      wallFilter.connect(gain)
      gain.connect(panner)
      panner.connect(this.directBus)

      this.reflectionPanners.push({ name: er.name, panner, gain })
    }
  }

  // ─── Connect Stems ────────────────────────────────────────────────────────────

  /**
   * Wire 4 source nodes (already running, sample-aligned) into the spatial graph.
   * @param {{vocals: AudioNode, drums: AudioNode, bass: AudioNode, other: AudioNode}} sourceNodes
   */
  connectStems(sourceNodes) {
    if (!sourceNodes || !this.stems.VOCALS) return
    const map = {
      VOCALS: sourceNodes.vocals,
      DRUMS:  sourceNodes.drums,
      BASS:   sourceNodes.bass,
      OTHER:  sourceNodes.other,
    }
    for (const name of STEM_NAMES) {
      const node = map[name]
      if (!node) {
        console.warn(`OrchestraEngine.connectStems: missing source for ${name}`)
        continue
      }
      try {
        node.connect(this.stems[name].entry)
      } catch (e) {
        console.warn(`OrchestraEngine.connectStems: failed to connect ${name}`, e)
      }
    }
  }

  // ─── Tick (frame update) ─────────────────────────────────────────────────────

  /**
   * t — relative time since briefing start (seconds)
   * songDuration — full duration of the user's track (seconds)
   */
  tick(t, songDuration) {
    const now = this.ctx.currentTime
    this._lastT = t

    // Bloom envelope: hall reverb + audience murmur fade in across the
    // BLOOM_DURATION window starting at PHASES.BLOOM_START.
    if (t >= PHASES.BLOOM_START && t < PHASES.THRONE_START) {
      const p = clamp((t - PHASES.BLOOM_START) / BLOOM_DURATION, 0, 1)
      if (this.hallWetGain) {
        this.hallWetGain.gain.setTargetAtTime(
          lerp(GAINS.HALL_WET.BLOOM_START, GAINS.HALL_WET.BLOOM_END, p),
          now, 0.1,
        )
      }
      this.audienceGain.gain.setTargetAtTime(lerp(0, GAINS.AUDIENCE, p), now, 0.1)
    } else if (t >= PHASES.THRONE_START) {
      // Snap to post-Bloom values in case Bloom window was missed (tab backgrounded)
      if (this.hallWetGain && this.hallWetGain.gain.value < GAINS.HALL_WET.BLOOM_END - 0.01) {
        this.hallWetGain.gain.setTargetAtTime(GAINS.HALL_WET.BLOOM_END, now, 0.05)
      }
      if (this.audienceGain.gain.value < GAINS.AUDIENCE - 0.005) {
        this.audienceGain.gain.setTargetAtTime(GAINS.AUDIENCE, now, 0.05)
      }
    }

    // Track A gain — held constant once Bloom completes.
    const trackAGain = this._getTrackAGain(t, songDuration)
    for (const name of STEM_NAMES) {
      this.stems[name].gain.gain.setTargetAtTime(trackAGain, now, 0.3)
    }

    // Binaural gain — fade in once Briefing ends, hold through Throne, fade
    // out across the END_FADE_DURATION tail.
    if (t >= BRIEFING_DURATION && t < songDuration - END_FADE_DURATION) {
      this.binauralGain.gain.setTargetAtTime(GAINS.BINAURAL.MAX, now, 0.3)
    } else if (t >= songDuration - END_FADE_DURATION) {
      const fadeP = clamp((t - (songDuration - END_FADE_DURATION)) / END_FADE_DURATION, 0, 1)
      this.binauralGain.gain.setTargetAtTime(GAINS.BINAURAL.MAX * (1 - fadeP), now, 0.2)
    }
  }

  // ─── Conducting ──────────────────────────────────────────────────────────────

  applyConducting(params) {
    if (!params) return
    const now = this.ctx.currentTime
    const t = this._lastT
    const { pan, filterNorm, gestureGain, articulation, downbeat, yaw, rotationRate } = params

    // facingDeg = which direction the user is "facing". Research §3.5 says
    // this should come from compass heading (alpha/yaw), not roll. Gate
    // behind ENABLE_GYRO_ENERGY_COUPLING so legacy behavior is recoverable.
    let facingDeg
    if (ENABLE_GYRO_ENERGY_COUPLING && yaw != null) {
      // alpha is 0..360°. Map to -180..180° so spatial math works.
      facingDeg = yaw > 180 ? yaw - 360 : yaw
    } else {
      const panOffset = (pan - 0.5) * 2
      facingDeg = panOffset * 90
    }

    for (const name of STEM_NAMES) {
      const stem = this.stems[name]
      const cfg = STEMS[name]

      // Yaw-quadrant spotlight — angular distance from facing direction to
      // this stem's azimuth. Closest stem (within HALFWIDTH) → +BOOST_DB;
      // opposite (≥180-HALFWIDTH) → -CUT_DB.
      const ang = angularDistanceDeg(facingDeg, cfg.azimuth)
      let spotlightDb = 0
      if (ang <= YAW_SPOTLIGHT.HALFWIDTH_DEG) {
        const proximity = 1 - (ang / YAW_SPOTLIGHT.HALFWIDTH_DEG)
        spotlightDb = YAW_SPOTLIGHT.BOOST_DB * proximity
      } else if (ang >= 180 - YAW_SPOTLIGHT.HALFWIDTH_DEG) {
        const proximity = 1 - ((180 - ang) / YAW_SPOTLIGHT.HALFWIDTH_DEG)
        spotlightDb = -YAW_SPOTLIGHT.CUT_DB * proximity
      }
      const spotlightLin = Math.pow(10, spotlightDb / 20)

      // Gesture size → dynamics
      const dynamicsGain = lerp(
        CONDUCTING.GESTURE_SIZE_GAIN_MIN,
        CONDUCTING.GESTURE_SIZE_GAIN_MAX,
        clamp(gestureGain, 0, 1),
      )

      const trackAGain = this._getTrackAGain(t, this._songDuration || 9999)
      const finalGain = clamp(trackAGain * dynamicsGain * spotlightLin, 0, 1.5)
      stem.gain.gain.setTargetAtTime(finalGain, now, CONDUCTING.INTENSITY_TC)

      // Per-stem conducting filter cutoff. Base cutoff comes from pitch (filterNorm).
      // When gyro coupling is on, fast rotational motion brightens the spectrum —
      // implements the "Energy/Brightness" macro-dimension from research §3.1.
      const gyroMag = (rotationRate && rotationRate.mag) || 0
      const gyroBoost = ENABLE_GYRO_ENERGY_COUPLING
        ? Math.min(2000, gyroMag * 4)   // 500°/s gyro → +2 kHz cutoff lift
        : 0
      const cutoff = 200 + filterNorm * 3800 + gyroBoost
      stem.conductingFilter.frequency.setTargetAtTime(cutoff, now, CONDUCTING.FILTER_FREQ_TC)

      // Reverb send modulation: fast gyro = drier/more present, slow = wetter.
      if (ENABLE_GYRO_ENERGY_COUPLING) {
        const baseReverb = STEMS[name].reverbSend
        const drier = clamp(1 - gyroMag / 600, 0, 1)
        stem.reverbSend.gain.setTargetAtTime(baseReverb * drier, now, CONDUCTING.FILTER_FREQ_TC)
      }

      // Articulation → Q spike
      if (articulation > CONDUCTING.ARTICULATION_THRESHOLD) {
        const targetQ = CONDUCTING.ARTICULATION_Q_BASE +
          articulation * (CONDUCTING.ARTICULATION_Q_MAX - CONDUCTING.ARTICULATION_Q_BASE)
        stem.conductingFilter.Q.setTargetAtTime(targetQ, now, 0.01)
        stem.conductingFilter.Q.setTargetAtTime(
          CONDUCTING.ARTICULATION_Q_BASE,
          now + 0.02,
          CONDUCTING.ARTICULATION_DECAY_TC,
        )
      }

      // Per-stem panner shift from tilt (azimuth offset)
      const finalAz = cfg.azimuth + facingDeg * 0.3
      const pos = sphericalToCartesian(finalAz, cfg.elevation, cfg.distance)
      stem.panner.positionX.setTargetAtTime(pos.x, now, CONDUCTING.PAN_TC)
      stem.panner.positionY.setTargetAtTime(pos.y, now, CONDUCTING.PAN_TC)
      stem.panner.positionZ.setTargetAtTime(pos.z, now, CONDUCTING.PAN_TC)
    }

    if (downbeat && downbeat.fired) {
      this._applyDownbeat(downbeat.intensity)
    }
  }

  _applyDownbeat(intensity) {
    const now = this.ctx.currentTime

    for (const name of STEM_NAMES) {
      const stem = this.stems[name]
      const currentGain = stem.gain.gain.value
      const spike = CONDUCTING.DOWNBEAT_GAIN_SPIKE_MIN +
        intensity * (CONDUCTING.DOWNBEAT_GAIN_SPIKE_MAX - CONDUCTING.DOWNBEAT_GAIN_SPIKE_MIN)
      const spikeGain = Math.min(1.5, currentGain * spike)

      stem.gain.gain.cancelScheduledValues(now)
      stem.gain.gain.setValueAtTime(spikeGain, now)
      stem.gain.gain.setTargetAtTime(currentGain, now + 0.01, CONDUCTING.DOWNBEAT_GAIN_DECAY_TC)

      const targetQ = CONDUCTING.DOWNBEAT_Q_MIN +
        intensity * (CONDUCTING.DOWNBEAT_Q_MAX - CONDUCTING.DOWNBEAT_Q_MIN)
      stem.conductingFilter.Q.cancelScheduledValues(now)
      stem.conductingFilter.Q.setValueAtTime(targetQ, now)
      stem.conductingFilter.Q.setTargetAtTime(
        CONDUCTING.ARTICULATION_Q_BASE,
        now + 0.01,
        CONDUCTING.DOWNBEAT_Q_DECAY_TC,
      )
    }

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

  // ─── Audience ────────────────────────────────────────────────────────────────

  startAudience() {
    const positions = [
      { azimuth: 210, elevation: 5, distance: 4 },
      { azimuth: 150, elevation: 5, distance: 4 },
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
      panner.refDistance = 4
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

  // ─── Fade Out (called near song end by Orchestra.jsx) ───────────────────────

  fadeOut(duration = END_FADE_DURATION) {
    const now = this.ctx.currentTime
    this.masterGain.gain.setTargetAtTime(0, now, duration / 4)
  }

  // ─── Stop All ────────────────────────────────────────────────────────────────

  stopAll() {
    for (const source of this.activeSources) {
      try { source.stop() } catch { /* already stopped */ }
    }
    this.activeSources = []
    this.audienceSources = []
    try { this.binauralLeft.stop() } catch { /* already stopped */ }
    try { this.binauralRight.stop() } catch { /* already stopped */ }
  }

  // Allow Orchestra.jsx to inform the engine of the song duration so
  // applyConducting can compute the Track A envelope tail correctly.
  setSongDuration(seconds) { this._songDuration = seconds }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  _getTrackAGain(t, songDuration) {
    // Briefing — silent
    if (t < PHASES.BLOOM_START) return 0
    // Bloom — fade in
    if (t < PHASES.THRONE_START) {
      const p = (t - PHASES.BLOOM_START) / BLOOM_DURATION
      return lerp(0, GAINS.TRACK_A, p)
    }
    // Throne — held flat
    if (t < songDuration - END_FADE_DURATION) return GAINS.TRACK_A
    // End fade
    const fadeP = clamp((t - (songDuration - END_FADE_DURATION)) / END_FADE_DURATION, 0, 1)
    return lerp(GAINS.TRACK_A, 0, fadeP)
  }
}

// Smallest absolute angular difference between two azimuths in degrees [0, 180].
function angularDistanceDeg(a, b) {
  const diff = Math.abs(((a - b + 540) % 360) - 180)
  return diff
}
