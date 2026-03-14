// Audio Engine — Web Audio synthesis for all PostListener phases

const SCALES = {
  minor:  [0, 2, 3, 5, 7, 8, 10],       // natural minor
  dorian: [0, 2, 3, 5, 7, 9, 10],        // dorian mode
  major:  [0, 2, 4, 5, 7, 9, 11],        // major scale
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

function getScale(valence) {
  if (valence < 0.3) return SCALES.minor
  if (valence < 0.7) return SCALES.dorian
  return SCALES.major
}

function getRoot(valence) {
  const roots = valence < 0.5 ? [57, 62, 64, 60] : [60, 67, 62, 65] // Am, Dm, Em, Cm : C, G, D, F
  return roots[Math.floor(Math.random() * roots.length)]
}

function scaleNote(root, scale, degree) {
  const octave = Math.floor(degree / scale.length)
  const idx = ((degree % scale.length) + scale.length) % scale.length
  return root + octave * 12 + scale[idx]
}

class AudioEngine {
  constructor() {
    this.ctx = null
    this.masterGain = null
    this.activeNodes = []
  }

  init() {
    if (this.ctx) return
    this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0.7
    this.masterGain.connect(this.ctx.destination)
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  _track(node) {
    this.activeNodes.push(node)
    return node
  }

  _cleanActive() {
    this.activeNodes = this.activeNodes.filter(n => {
      try { return n.context?.state !== 'closed' } catch { return false }
    })
  }

  // --- Building blocks ---

  playTone(freq, type = 'sine', duration = 1, pan = 0, gain = 0.3) {
    this.init()
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    const p = this.ctx.createStereoPanner()

    osc.type = type
    osc.frequency.value = freq
    p.pan.value = pan
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(gain, now + 0.05)
    g.gain.setValueAtTime(gain, now + duration - 0.1)
    g.gain.linearRampToValueAtTime(0, now + duration)

    osc.connect(g).connect(p).connect(this.masterGain)
    osc.start(now)
    osc.stop(now + duration)
    this._track(osc)

    return new Promise(resolve => setTimeout(resolve, duration * 1000))
  }

  playChord(freqs, type = 'sine', duration = 1, pan = 0, gain = 0.15) {
    this.init()
    const now = this.ctx.currentTime
    const g = this.ctx.createGain()
    const p = this.ctx.createStereoPanner()
    p.pan.value = pan
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(gain, now + 0.08)
    g.gain.setValueAtTime(gain, now + duration - 0.15)
    g.gain.linearRampToValueAtTime(0, now + duration)
    g.connect(p).connect(this.masterGain)

    freqs.forEach(freq => {
      const osc = this.ctx.createOscillator()
      osc.type = type
      osc.frequency.value = freq
      osc.connect(g)
      osc.start(now)
      osc.stop(now + duration)
      this._track(osc)
    })

    return new Promise(resolve => setTimeout(resolve, duration * 1000))
  }

  playNoise(filterFreq = 1000, duration = 1, gain = 0.1) {
    this.init()
    const now = this.ctx.currentTime
    const bufferSize = this.ctx.sampleRate * duration
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = filterFreq
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(gain, now + 0.05)
    g.gain.setValueAtTime(gain, now + duration - 0.1)
    g.gain.linearRampToValueAtTime(0, now + duration)

    source.connect(filter).connect(g).connect(this.masterGain)
    source.start(now)
    this._track(source)

    return new Promise(resolve => setTimeout(resolve, duration * 1000))
  }

  // --- Phase 1: Stereo pair ---

  playPair(configA, configB, duration = 4) {
    this.init()
    const now = this.ctx.currentTime

    const createVoice = (config, pan) => {
      const g = this.ctx.createGain()
      const p = this.ctx.createStereoPanner()
      p.pan.value = pan
      g.gain.value = 0
      g.connect(p).connect(this.masterGain)

      if (config.type === 'noise') {
        const bufSize = this.ctx.sampleRate * duration
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
        const d = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1
        const src = this.ctx.createBufferSource()
        src.buffer = buf
        const filt = this.ctx.createBiquadFilter()
        filt.type = 'lowpass'
        filt.frequency.value = config.filterFreq || 800
        src.connect(filt).connect(g)
        src.start(now)
        src.stop(now + duration)
        this._track(src)
      } else if (config.freqs) {
        config.freqs.forEach(freq => {
          const osc = this.ctx.createOscillator()
          osc.type = config.oscType || 'sine'
          osc.frequency.value = freq
          osc.connect(g)
          osc.start(now)
          osc.stop(now + duration)
          this._track(osc)
        })
      } else {
        const osc = this.ctx.createOscillator()
        osc.type = config.oscType || 'sine'
        osc.frequency.value = config.freq || 220
        osc.connect(g)
        osc.start(now)
        osc.stop(now + duration)
        this._track(osc)
      }

      return g
    }

    const voiceA = createVoice(configA, -0.8)
    const voiceB = createVoice(configB, 0.8)

    // Fade in both
    voiceA.gain.setValueAtTime(0, now)
    voiceA.gain.linearRampToValueAtTime(0.2, now + 0.3)
    voiceB.gain.setValueAtTime(0, now)
    voiceB.gain.linearRampToValueAtTime(0.2, now + 0.3)

    // Fade out at end
    voiceA.gain.setValueAtTime(0.2, now + duration - 0.3)
    voiceA.gain.linearRampToValueAtTime(0, now + duration)
    voiceB.gain.setValueAtTime(0.2, now + duration - 0.3)
    voiceB.gain.linearRampToValueAtTime(0, now + duration)

    return {
      setBalance: (balance) => {
        // balance: -1 = all left, 0 = center, 1 = all right
        const t = this.ctx.currentTime
        const leftGain = 0.2 * (1 - Math.max(0, balance))
        const rightGain = 0.2 * (1 + Math.min(0, balance))
        voiceA.gain.cancelScheduledValues(t)
        voiceA.gain.linearRampToValueAtTime(leftGain, t + 0.1)
        voiceB.gain.cancelScheduledValues(t)
        voiceB.gain.linearRampToValueAtTime(rightGain, t + 0.1)
      },
      stop: () => {
        const t = this.ctx.currentTime
        voiceA.gain.cancelScheduledValues(t)
        voiceA.gain.linearRampToValueAtTime(0, t + 0.3)
        voiceB.gain.cancelScheduledValues(t)
        voiceB.gain.linearRampToValueAtTime(0, t + 0.3)
      },
      promise: new Promise(resolve => setTimeout(resolve, duration * 1000)),
    }
  }

  // --- Phase 2: Layered build ---

  playLayeredBuild(maxLayers = 8) {
    this.init()
    const now = this.ctx.currentTime
    const layers = []
    const root = 55 // A1

    const layerConfigs = [
      { freq: root, type: 'sine', label: 'root' },
      { freq: root * 1.5, type: 'sine', label: 'harmony' },
      { freq: root * 2, type: 'sine', label: 'octave' },
      { freq: root * 2.5, type: 'triangle', label: 'texture' },
      { freq: root * 0.5, type: 'sine', label: 'sub' },
      { freq: root * 3, type: 'sine', label: 'drift' },
      { freq: root * 4, type: 'sine', label: 'overtone' },
      { freq: root * 5, type: 'triangle', label: 'everything' },
    ]

    layerConfigs.forEach((config, i) => {
      const osc = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      osc.type = config.type
      osc.frequency.value = config.freq
      // Add subtle vibrato
      const lfo = this.ctx.createOscillator()
      const lfoGain = this.ctx.createGain()
      lfo.frequency.value = 0.5 + i * 0.3
      lfoGain.gain.value = config.freq * 0.005
      lfo.connect(lfoGain).connect(osc.frequency)
      lfo.start(now)

      g.gain.value = 0
      osc.connect(g).connect(this.masterGain)
      osc.start(now)
      this._track(osc)
      this._track(lfo)
      layers.push({ osc, gain: g, lfo, active: false })
    })

    return {
      setActiveCount: (count) => {
        const t = this.ctx.currentTime
        layers.forEach((layer, i) => {
          const target = i < count ? 0.12 : 0
          layer.gain.gain.cancelScheduledValues(t)
          layer.gain.gain.linearRampToValueAtTime(target, t + 0.3)
          layer.active = i < count
        })
      },
      stop: () => {
        const t = this.ctx.currentTime
        layers.forEach(layer => {
          layer.gain.gain.cancelScheduledValues(t)
          layer.gain.gain.linearRampToValueAtTime(0, t + 0.5)
        })
        setTimeout(() => {
          layers.forEach(l => {
            try { l.osc.stop(); l.lfo.stop() } catch {}
          })
        }, 600)
      },
      getActiveLayers: () => layers.filter(l => l.active).length,
    }
  }

  // --- Phase 3: Texture synthesis ---

  playTexture(textureName, duration = 4) {
    this.init()
    const now = this.ctx.currentTime
    const nodes = []

    const makeOsc = (freq, type, gain) => {
      const osc = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      osc.type = type
      osc.frequency.value = freq
      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime(gain, now + 0.2)
      g.gain.setValueAtTime(gain, now + duration - 0.5)
      g.gain.linearRampToValueAtTime(0, now + duration)
      osc.connect(g).connect(this.masterGain)
      osc.start(now)
      osc.stop(now + duration)
      this._track(osc)
      nodes.push(osc)
    }

    const textures = {
      strings: () => {
        // Warm legato synth strings
        [220, 277.18, 329.63].forEach(f => makeOsc(f, 'sine', 0.1))
        makeOsc(220, 'triangle', 0.05)
      },
      synthesizer: () => {
        // Lush evolving pad
        const osc = this.ctx.createOscillator()
        const g = this.ctx.createGain()
        const filter = this.ctx.createBiquadFilter()
        osc.type = 'sawtooth'
        osc.frequency.value = 130.81
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(200, now)
        filter.frequency.linearRampToValueAtTime(2000, now + duration * 0.5)
        filter.frequency.linearRampToValueAtTime(400, now + duration)
        filter.Q.value = 5
        g.gain.setValueAtTime(0, now)
        g.gain.linearRampToValueAtTime(0.12, now + 0.5)
        g.gain.setValueAtTime(0.12, now + duration - 0.5)
        g.gain.linearRampToValueAtTime(0, now + duration)
        osc.connect(filter).connect(g).connect(this.masterGain)
        osc.start(now)
        osc.stop(now + duration)
        this._track(osc)
        // Add detuned copy
        makeOsc(131.5, 'sawtooth', 0.06)
      },
      distortion: () => {
        // Aggressive overdriven saw
        const osc = this.ctx.createOscillator()
        const waveshaper = this.ctx.createWaveShaper()
        const g = this.ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.value = 110
        const curve = new Float32Array(256)
        for (let i = 0; i < 256; i++) {
          const x = (i / 128) - 1
          curve[i] = (Math.PI + 20) * x / (Math.PI + 20 * Math.abs(x))
        }
        waveshaper.curve = curve
        g.gain.setValueAtTime(0, now)
        g.gain.linearRampToValueAtTime(0.1, now + 0.05)
        g.gain.setValueAtTime(0.1, now + duration - 0.2)
        g.gain.linearRampToValueAtTime(0, now + duration)
        osc.connect(waveshaper).connect(g).connect(this.masterGain)
        osc.start(now)
        osc.stop(now + duration)
        this._track(osc)
      },
      keys: () => {
        // Clean intimate piano tones
        const notes = [261.63, 329.63, 392.00]
        notes.forEach((freq, i) => {
          const osc = this.ctx.createOscillator()
          const g = this.ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq
          const start = now + i * 0.8
          g.gain.setValueAtTime(0, start)
          g.gain.linearRampToValueAtTime(0.15, start + 0.01)
          g.gain.exponentialRampToValueAtTime(0.01, start + 1.5)
          osc.connect(g).connect(this.masterGain)
          osc.start(start)
          osc.stop(start + 1.5)
          this._track(osc)
        })
      },
      voice: () => {
        // Ethereal layered choir
        [220, 330, 440, 554.37].forEach((f, i) => {
          const osc = this.ctx.createOscillator()
          const g = this.ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = f
          // Vibrato
          const lfo = this.ctx.createOscillator()
          const lfoG = this.ctx.createGain()
          lfo.frequency.value = 4 + i
          lfoG.gain.value = f * 0.01
          lfo.connect(lfoG).connect(osc.frequency)
          lfo.start(now)
          g.gain.setValueAtTime(0, now)
          g.gain.linearRampToValueAtTime(0.08, now + 0.5)
          g.gain.setValueAtTime(0.08, now + duration - 0.5)
          g.gain.linearRampToValueAtTime(0, now + duration)
          osc.connect(g).connect(this.masterGain)
          osc.start(now)
          osc.stop(now + duration)
          this._track(osc)
          this._track(lfo)
        })
      },
      glitch: () => {
        // Fragmented digital noise
        for (let i = 0; i < 8; i++) {
          const osc = this.ctx.createOscillator()
          const g = this.ctx.createGain()
          osc.type = 'square'
          osc.frequency.value = 100 + Math.random() * 2000
          const start = now + i * (duration / 8)
          const dur = duration / 16
          g.gain.setValueAtTime(0, start)
          g.gain.linearRampToValueAtTime(0.08, start + 0.01)
          g.gain.linearRampToValueAtTime(0, start + dur)
          osc.connect(g).connect(this.masterGain)
          osc.start(start)
          osc.stop(start + dur)
          this._track(osc)
        }
      },
      rhythm: () => {
        // Acoustic percussion hits (noise bursts)
        for (let i = 0; i < 8; i++) {
          const bufSize = this.ctx.sampleRate * 0.15
          const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
          const data = buf.getChannelData(0)
          for (let j = 0; j < bufSize; j++) data[j] = Math.random() * 2 - 1
          const src = this.ctx.createBufferSource()
          src.buffer = buf
          const filter = this.ctx.createBiquadFilter()
          filter.type = i % 2 === 0 ? 'lowpass' : 'highpass'
          filter.frequency.value = i % 2 === 0 ? 200 : 3000
          const g = this.ctx.createGain()
          const start = now + i * (duration / 8)
          g.gain.setValueAtTime(0.15, start)
          g.gain.exponentialRampToValueAtTime(0.001, start + 0.15)
          src.connect(filter).connect(g).connect(this.masterGain)
          src.start(start)
          this._track(src)
        }
      },
      field: () => {
        // Ambient environmental sounds
        const bufSize = this.ctx.sampleRate * duration
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.5
        }
        const src = this.ctx.createBufferSource()
        src.buffer = buf
        const filter = this.ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 600
        filter.Q.value = 0.5
        const g = this.ctx.createGain()
        g.gain.setValueAtTime(0, now)
        g.gain.linearRampToValueAtTime(0.08, now + 1)
        g.gain.setValueAtTime(0.08, now + duration - 1)
        g.gain.linearRampToValueAtTime(0, now + duration)
        src.connect(filter).connect(g).connect(this.masterGain)
        src.start(now)
        this._track(src)
        // Layer a low drone
        makeOsc(80, 'sine', 0.06)
      },
    }

    if (textures[textureName]) {
      textures[textureName]()
    }

    return new Promise(resolve => setTimeout(resolve, duration * 1000))
  }

  // --- Phase 4: Build and Drop ---

  playBuildAndDrop(duration = 30) {
    this.init()
    const now = this.ctx.currentTime
    const root = 55 // A1
    const oscs = []

    // Base drone
    const drone = this.ctx.createOscillator()
    const droneGain = this.ctx.createGain()
    drone.type = 'sawtooth'
    drone.frequency.value = root
    const droneFilter = this.ctx.createBiquadFilter()
    droneFilter.type = 'lowpass'
    droneFilter.frequency.setValueAtTime(100, now)
    droneFilter.frequency.linearRampToValueAtTime(3000, now + 18) // build
    droneFilter.frequency.setValueAtTime(3000, now + 18)
    droneFilter.frequency.linearRampToValueAtTime(80, now + 20) // drop
    droneFilter.frequency.linearRampToValueAtTime(1500, now + duration) // release
    droneGain.gain.setValueAtTime(0, now)
    droneGain.gain.linearRampToValueAtTime(0.15, now + 2)
    droneGain.gain.setValueAtTime(0.15, now + 17)
    droneGain.gain.linearRampToValueAtTime(0.02, now + 20) // drop
    droneGain.gain.linearRampToValueAtTime(0.1, now + 25)
    droneGain.gain.linearRampToValueAtTime(0, now + duration)
    drone.connect(droneFilter).connect(droneGain).connect(this.masterGain)
    drone.start(now)
    drone.stop(now + duration)
    this._track(drone)

    // Rising tension oscillators (build phase 0-18s)
    for (let i = 0; i < 6; i++) {
      const osc = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      osc.type = i < 3 ? 'sine' : 'triangle'
      osc.frequency.value = root * (i + 2)
      osc.frequency.linearRampToValueAtTime(root * (i + 2) * 1.02, now + 18) // slight detune
      g.gain.setValueAtTime(0, now + i * 2)
      g.gain.linearRampToValueAtTime(0.04 + i * 0.01, now + 16)
      g.gain.linearRampToValueAtTime(0, now + 19) // cut at drop
      g.gain.linearRampToValueAtTime(0.02, now + 22) // gentle return
      g.gain.linearRampToValueAtTime(0, now + duration)
      osc.connect(g).connect(this.masterGain)
      osc.start(now)
      osc.stop(now + duration)
      this._track(osc)
      oscs.push(osc)
    }

    // Rhythmic noise hits during build (accelerating)
    const beats = []
    let beatTime = 0
    let interval = 0.8
    while (beatTime < 18) {
      beats.push(beatTime)
      beatTime += interval
      interval *= 0.96 // accelerating
    }
    // Post-drop steady beats
    for (let t = 21; t < duration - 2; t += 0.6) {
      beats.push(t)
    }

    beats.forEach(t => {
      const bufSize = this.ctx.sampleRate * 0.08
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
      const src = this.ctx.createBufferSource()
      src.buffer = buf
      const filt = this.ctx.createBiquadFilter()
      filt.type = 'highpass'
      filt.frequency.value = 2000
      const g = this.ctx.createGain()
      const s = now + t
      const vol = t < 18 ? 0.05 + (t / 18) * 0.1 : 0.08
      g.gain.setValueAtTime(vol, s)
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.08)
      src.connect(filt).connect(g).connect(this.masterGain)
      src.start(s)
      this._track(src)
    })

    return {
      promise: new Promise(resolve => setTimeout(resolve, duration * 1000)),
      stop: () => {
        const t = this.ctx.currentTime
        droneGain.gain.cancelScheduledValues(t)
        droneGain.gain.linearRampToValueAtTime(0, t + 0.5)
      },
    }
  }

  // --- Phase 5: Procedural track ---

  generateProceduralTrack(avd, duration = 60) {
    this.init()
    const now = this.ctx.currentTime
    const { a, v, d } = avd

    const bpm = 60 + a * 100
    const beatDur = 60 / bpm
    const scale = getScale(v)
    const root = getRoot(v)
    const layerCount = Math.ceil(d * 8)
    const filterCutoff = 200 + v * 4000

    // Master filter for brightness
    const masterFilter = this.ctx.createBiquadFilter()
    masterFilter.type = 'lowpass'
    masterFilter.frequency.value = filterCutoff
    masterFilter.Q.value = 1
    masterFilter.connect(this.masterGain)

    const trackGain = this.ctx.createGain()
    trackGain.gain.setValueAtTime(0, now)
    trackGain.gain.linearRampToValueAtTime(0.6, now + 4)
    trackGain.gain.setValueAtTime(0.6, now + duration - 5)
    trackGain.gain.linearRampToValueAtTime(0, now + duration)
    trackGain.connect(masterFilter)

    // Determine structure phases
    const intro = 15, build = 30, full = 45, wind = 55

    // --- Layer 1: Bass root ---
    const scheduleBass = () => {
      for (let t = 0; t < duration; t += beatDur * 4) {
        const absT = now + t
        const activeInPhase = t < intro || (t >= intro && t < wind)
        if (!activeInPhase && t >= wind) continue
        const freq = midiToFreq(root - 12)
        const osc = this.ctx.createOscillator()
        const g = this.ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        const vol = t < intro ? 0.12 * (t / intro) : t > wind ? 0.12 * ((duration - t) / (duration - wind)) : 0.12
        g.gain.setValueAtTime(vol, absT)
        g.gain.exponentialRampToValueAtTime(0.01, absT + beatDur * 3.5)
        osc.connect(g).connect(trackGain)
        osc.start(absT)
        osc.stop(absT + beatDur * 4)
        this._track(osc)
      }
    }

    // --- Layer 2+: Melodic sequence ---
    const scheduleMelody = (layerIdx) => {
      const notesPerBeat = 0.5 + a * 1.5
      const noteInterval = beatDur / notesPerBeat
      const startTime = intro * (layerIdx / layerCount)
      const octaveOffset = (layerIdx - 1) * 12

      for (let t = startTime; t < duration - 5; t += noteInterval) {
        const absT = now + t
        const degree = Math.floor(Math.random() * 7)
        const midi = scaleNote(root + octaveOffset, scale, degree)
        if (midi > 96 || midi < 36) continue // keep in reasonable range
        const freq = midiToFreq(midi)

        const osc = this.ctx.createOscillator()
        const g = this.ctx.createGain()
        osc.type = layerIdx % 3 === 0 ? 'triangle' : layerIdx % 3 === 1 ? 'sine' : 'sawtooth'
        osc.frequency.value = freq

        // Volume envelope based on song structure
        let vol = 0.06 / layerCount
        if (t < intro) vol *= t / intro
        else if (t > wind) vol *= (duration - t) / (duration - wind)
        else if (t >= intro && t < build) vol *= 0.7 + 0.3 * ((t - intro) / (build - intro))

        // Only include this layer if within layer count for current structure phase
        const activeLayerForPhase = t < intro ? Math.ceil((t / intro) * layerCount) :
          t > wind ? Math.ceil(((duration - t) / (duration - wind)) * layerCount) : layerCount
        if (layerIdx > activeLayerForPhase) continue

        g.gain.setValueAtTime(0, absT)
        g.gain.linearRampToValueAtTime(vol, absT + 0.02)
        g.gain.exponentialRampToValueAtTime(0.001, absT + noteInterval * 0.9)
        osc.connect(g).connect(trackGain)
        osc.start(absT)
        osc.stop(absT + noteInterval)
        this._track(osc)
      }
    }

    // --- Percussion (if arousal > 0.5) ---
    const schedulePercussion = () => {
      if (a <= 0.3) return
      for (let t = intro * 0.5; t < duration - 5; t += beatDur) {
        const absT = now + t
        const bufSize = this.ctx.sampleRate * 0.06
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
        const src = this.ctx.createBufferSource()
        src.buffer = buf
        const filt = this.ctx.createBiquadFilter()
        filt.type = t % (beatDur * 2) < beatDur * 0.5 ? 'lowpass' : 'highpass'
        filt.frequency.value = filt.type === 'lowpass' ? 300 : 4000
        const g = this.ctx.createGain()
        let vol = 0.06 * a
        if (t < intro) vol *= t / intro
        if (t > wind) vol *= (duration - t) / (duration - wind)
        g.gain.setValueAtTime(vol, absT)
        g.gain.exponentialRampToValueAtTime(0.001, absT + 0.06)
        src.connect(filt).connect(g).connect(trackGain)
        src.start(absT)
        this._track(src)
      }
    }

    // Schedule all layers
    scheduleBass()
    for (let i = 1; i <= layerCount; i++) {
      scheduleMelody(i)
    }
    schedulePercussion()

    return {
      promise: new Promise(resolve => setTimeout(resolve, duration * 1000)),
      stop: () => {
        const t = this.ctx.currentTime
        trackGain.gain.cancelScheduledValues(t)
        trackGain.gain.linearRampToValueAtTime(0, t + 1)
      },
    }
  }

  // --- Stop everything ---

  stopAll() {
    if (!this.ctx) return Promise.resolve()
    const t = this.ctx.currentTime
    this.masterGain.gain.cancelScheduledValues(t)
    this.masterGain.gain.linearRampToValueAtTime(0, t + 0.5)

    return new Promise(resolve => {
      setTimeout(() => {
        this.masterGain.gain.value = 0.7
        this._cleanActive()
        resolve()
      }, 600)
    })
  }
}

export const audioEngine = new AudioEngine()
