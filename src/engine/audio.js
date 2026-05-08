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
    this._textureBuffers = new Map()
    this._textureSource = null
    this._textureGain = null
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
    this.activeNodes.forEach(n => {
      try { n.stop?.() } catch {}
      try { n.disconnect() } catch {}
    })
    this.activeNodes = []
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

  playTapSound() {
    this.init()
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(900, now)
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.06)
    g.gain.setValueAtTime(0.12, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
    osc.connect(g).connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.08)
    this._track(osc)
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

      // Build processing chain: source(s) -> [distortion] -> [filter] -> gain -> pan -> master
      let chainHead = g

      if (config.filter) {
        const filt = this.ctx.createBiquadFilter()
        filt.type = config.filter.type || 'lowpass'
        filt.frequency.value = config.filter.freq || 1000
        filt.Q.value = config.filter.Q || 1
        if (config.filter.lfoFreq) {
          const flfo = this.ctx.createOscillator()
          const flfoG = this.ctx.createGain()
          flfo.frequency.value = config.filter.lfoFreq
          flfoG.gain.value = config.filter.lfoDepth || 500
          flfo.connect(flfoG).connect(filt.frequency)
          flfo.start(now)
          flfo.stop(now + duration)
          this._track(flfo)
        }
        filt.connect(chainHead)
        chainHead = filt
      }

      if (config.distortion) {
        const ws = this.ctx.createWaveShaper()
        const amt = typeof config.distortion === 'number' ? config.distortion : 20
        const curve = new Float32Array(256)
        for (let i = 0; i < 256; i++) {
          const x = (i / 128) - 1
          curve[i] = (Math.PI + amt) * x / (Math.PI + amt * Math.abs(x))
        }
        ws.curve = curve
        ws.connect(chainHead)
        chainHead = ws
      }

      const oscs = []

      if (config.type === 'noise') {
        const bufSize = this.ctx.sampleRate * duration
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
        const d = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1
        const src = this.ctx.createBufferSource()
        src.buffer = buf
        if (!config.filter) {
          const filt = this.ctx.createBiquadFilter()
          filt.type = 'lowpass'
          filt.frequency.value = config.filterFreq || 800
          src.connect(filt).connect(chainHead)
        } else {
          src.connect(chainHead)
        }
        src.start(now)
        src.stop(now + duration)
        this._track(src)
      } else if (config.freqs) {
        config.freqs.forEach((freq, i) => {
          const osc = this.ctx.createOscillator()
          osc.type = config.oscType || 'sine'
          osc.frequency.value = freq
          if (config.detune && i > 0) {
            osc.detune.value = config.detune * (i % 2 === 0 ? 1 : -1)
          }
          osc.connect(chainHead)
          osc.start(now)
          osc.stop(now + duration)
          this._track(osc)
          oscs.push(osc)
        })
      } else if (config.freq) {
        const osc = this.ctx.createOscillator()
        osc.type = config.oscType || 'sine'
        osc.frequency.value = config.freq
        osc.connect(chainHead)
        osc.start(now)
        osc.stop(now + duration)
        this._track(osc)
        oscs.push(osc)

        if (config.detune) {
          const osc2 = this.ctx.createOscillator()
          osc2.type = config.oscType || 'sine'
          osc2.frequency.value = config.freq
          osc2.detune.value = config.detune
          osc2.connect(chainHead)
          osc2.start(now)
          osc2.stop(now + duration)
          this._track(osc2)
          oscs.push(osc2)
        }
      }

      // Vibrato — modulate oscillator frequencies
      if (config.vibrato && oscs.length) {
        const vlfo = this.ctx.createOscillator()
        vlfo.frequency.value = config.vibrato.freq || 5
        oscs.forEach(osc => {
          const vg = this.ctx.createGain()
          vg.gain.value = config.vibrato.depth || 3
          vlfo.connect(vg).connect(osc.frequency)
        })
        vlfo.start(now)
        vlfo.stop(now + duration)
        this._track(vlfo)
      }

      // Tremolo — modulate gain
      if (config.tremolo) {
        const tlfo = this.ctx.createOscillator()
        const tlfoG = this.ctx.createGain()
        tlfo.frequency.value = config.tremolo.freq || 4
        tlfoG.gain.value = config.tremolo.depth || 0.05
        tlfo.connect(tlfoG).connect(g.gain)
        tlfo.start(now)
        tlfo.stop(now + duration)
        this._track(tlfo)
      }

      // Noise layer mixed in
      if (config.noiseMix) {
        const bufSize = this.ctx.sampleRate * duration
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
        const d = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1
        const src = this.ctx.createBufferSource()
        src.buffer = buf
        const nfilt = this.ctx.createBiquadFilter()
        nfilt.type = config.noiseMix.filterType || 'lowpass'
        nfilt.frequency.value = config.noiseMix.filterFreq || 1000
        const ng = this.ctx.createGain()
        const nVol = config.noiseMix.gain || 0.05
        ng.gain.setValueAtTime(0, now)
        ng.gain.linearRampToValueAtTime(nVol, now + 0.3)
        ng.gain.setValueAtTime(nVol, now + duration - 0.3)
        ng.gain.linearRampToValueAtTime(0, now + duration)
        src.connect(nfilt).connect(ng).connect(p)
        src.start(now)
        src.stop(now + duration)
        this._track(src)
      }

      return { gain: g, pan: p }
    }

    const { gain: voiceA, pan: panA } = createVoice(configA, -1)
    const { gain: voiceB, pan: panB } = createVoice(configB, 1)

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
        voiceA.gain.setValueAtTime(voiceA.gain.value, t)
        voiceA.gain.linearRampToValueAtTime(leftGain, t + 0.1)
        voiceB.gain.cancelScheduledValues(t)
        voiceB.gain.setValueAtTime(voiceB.gain.value, t)
        voiceB.gain.linearRampToValueAtTime(rightGain, t + 0.1)
      },
      stop: () => {
        const t = this.ctx.currentTime
        voiceA.gain.cancelScheduledValues(t)
        voiceA.gain.setValueAtTime(voiceA.gain.value, t)
        voiceA.gain.linearRampToValueAtTime(0, t + 0.15)
        voiceB.gain.cancelScheduledValues(t)
        voiceB.gain.setValueAtTime(voiceB.gain.value, t)
        voiceB.gain.linearRampToValueAtTime(0, t + 0.15)
        // Disconnect after fade to ensure no audio leaks
        setTimeout(() => {
          try { panA.disconnect(); panB.disconnect() } catch {}
        }, 200)
      },
      promise: new Promise(resolve => setTimeout(resolve, duration * 1000)),
    }
  }

  // --- Phase 1b: MP3 stereo pair (for Spectrum pre-generated clips) ---
  // Uses equal-power crossfade + crossfade looping for seamless playback.

  playMp3Pair(urlA, urlB, duration = 30) {
    this.init()
    const ctx = this.ctx
    const XFADE = 1.0  // seconds of overlap at loop boundaries
    const PEAK = 0.5   // max gain per voice

    const loadBuffer = async (url) => {
      const resp = await fetch(url)
      const arr = await resp.arrayBuffer()
      return ctx.decodeAudioData(arr)
    }

    // Master gain nodes for each side (balance target)
    const masterA = ctx.createGain()
    const masterB = ctx.createGain()
    const panA = ctx.createStereoPanner()
    const panB = ctx.createStereoPanner()
    panA.pan.value = -0.8
    panB.pan.value = 0.8
    masterA.gain.value = 0
    masterB.gain.value = 0
    masterA.connect(panA).connect(this.masterGain)
    masterB.connect(panB).connect(this.masterGain)

    let stopped = false
    let activeSources = []
    let loopTimers = []

    // Crossfade-looping: schedule overlapping buffer sources so the
    // tail of one fades out while the head of the next fades in.
    const scheduleLoop = (buffer, masterGain) => {
      if (stopped) return
      const clipDur = buffer.duration

      const playOnce = () => {
        if (stopped) return
        const src = ctx.createBufferSource()
        const env = ctx.createGain()
        src.buffer = buffer
        src.connect(env).connect(masterGain)

        const now = ctx.currentTime
        // Fade in over XFADE seconds
        env.gain.setValueAtTime(0, now)
        env.gain.linearRampToValueAtTime(1, now + XFADE)
        // Hold
        env.gain.setValueAtTime(1, now + clipDur - XFADE)
        // Fade out over XFADE seconds
        env.gain.linearRampToValueAtTime(0, now + clipDur)

        src.start(now)
        src.stop(now + clipDur + 0.05)
        activeSources.push(src)

        // Schedule next iteration to start XFADE seconds before this one ends
        const nextIn = (clipDur - XFADE) * 1000
        const timer = setTimeout(playOnce, nextIn)
        loopTimers.push(timer)
      }

      playOnce()
    }

    const applyBalance = (balance) => {
      // Map balance [-1, 1] to t [0, 1]
      const t = (balance + 1) / 2
      // Equal-power crossfade: cos/sin so perceived volume is constant
      const leftGain = PEAK * Math.cos(t * Math.PI / 2)
      const rightGain = PEAK * Math.sin(t * Math.PI / 2)

      const now = ctx.currentTime
      masterA.gain.cancelScheduledValues(now)
      masterA.gain.setValueAtTime(masterA.gain.value, now)
      masterA.gain.linearRampToValueAtTime(leftGain, now + 0.05)
      masterB.gain.cancelScheduledValues(now)
      masterB.gain.setValueAtTime(masterB.gain.value, now)
      masterB.gain.linearRampToValueAtTime(rightGain, now + 0.05)
    }

    let pendingBalance = 0
    const ready = Promise.all([loadBuffer(urlA), loadBuffer(urlB)]).then(([bufA, bufB]) => {
      if (stopped) return
      // Start crossfade-looping both clips
      scheduleLoop(bufA, masterA)
      scheduleLoop(bufB, masterB)
      // Apply the latest balance (may have been set before load finished)
      applyBalance(pendingBalance)
    })

    return {
      ready,
      setBalance: (balance) => {
        pendingBalance = balance
        if (!stopped) applyBalance(balance)
      },
      stop: () => {
        stopped = true
        // Clear all scheduled loop timers
        loopTimers.forEach(t => clearTimeout(t))
        loopTimers = []
        // Fade out master gains
        const now = ctx.currentTime
        masterA.gain.cancelScheduledValues(now)
        masterA.gain.setValueAtTime(masterA.gain.value, now)
        masterA.gain.linearRampToValueAtTime(0, now + 0.15)
        masterB.gain.cancelScheduledValues(now)
        masterB.gain.setValueAtTime(masterB.gain.value, now)
        masterB.gain.linearRampToValueAtTime(0, now + 0.15)
        setTimeout(() => {
          try {
            activeSources.forEach(s => { try { s.stop() } catch {} })
            activeSources = []
            panA.disconnect()
            panB.disconnect()
          } catch {}
        }, 200)
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

  // --- Helpers for richer synthesis ---

  _createReverbSend(wetLevel = 0.25) {
    const wet = this.ctx.createGain()
    wet.gain.value = wetLevel
    const input = this.ctx.createGain()
    input.gain.value = 1
    ;[0.037, 0.053, 0.071, 0.097].forEach(t => {
      const d = this.ctx.createDelay(0.1)
      d.delayTime.value = t
      const fb = this.ctx.createGain()
      fb.gain.value = 0.35
      const f = this.ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 2500
      d.connect(f).connect(fb).connect(d)
      fb.connect(wet)
      input.connect(d)
    })
    wet.connect(this.masterGain)
    return input
  }

  _adsr(gainNode, time, { a = 0.1, d = 0.2, s = 0.7, r = 0.5, peak = 0.1, duration }) {
    gainNode.gain.setValueAtTime(0, time)
    gainNode.gain.linearRampToValueAtTime(peak, time + a)
    gainNode.gain.linearRampToValueAtTime(peak * s, time + a + d)
    gainNode.gain.setValueAtTime(peak * s, time + duration - r)
    gainNode.gain.linearRampToValueAtTime(0, time + duration)
  }

  // --- Phase 3: Texture playback (pre-recorded MP3s) ---

  static TEXTURE_NAMES = ['strings', 'synthesizer', 'distortion', 'keys', 'voice', 'glitch', 'rhythm', 'field']

  async preloadTextures() {
    this.init()
    await Promise.all(
      AudioEngine.TEXTURE_NAMES.map(name => this._loadTextureBuffer(name))
    )
  }

  async _loadTextureBuffer(textureName) {
    if (this._textureBuffers.has(textureName)) {
      return this._textureBuffers.get(textureName)
    }
    const resp = await fetch(`/Texture/${textureName}.mp3`)
    const arr = await resp.arrayBuffer()
    const buffer = await this.ctx.decodeAudioData(arr)
    this._textureBuffers.set(textureName, buffer)
    return buffer
  }

  stopTexture() {
    this._currentTexture = null
    if (!this._textureSource) return
    const now = this.ctx.currentTime
    try {
      this._textureGain.gain.cancelScheduledValues(now)
      this._textureGain.gain.setValueAtTime(this._textureGain.gain.value, now)
      this._textureGain.gain.linearRampToValueAtTime(0, now + 0.05)
      this._textureSource.stop(now + 0.05)
    } catch { /* already stopped */ }
    this._textureSource = null
    this._textureGain = null
    this._currentTexture = null
  }

  playTexture(textureName, duration = 5) {
    this.init()
    this.stopTexture()
    this._currentTexture = textureName
    const ctx = this.ctx
    const FADE_IN = 0.15
    const FADE_OUT = 0.5

    const buffer = this._textureBuffers.get(textureName)
    if (!buffer) {
      return this._loadTextureBuffer(textureName).then(() => {
        // Guard: only play if this texture is still the one requested
        if (this._currentTexture === textureName) {
          this.playTexture(textureName, duration)
        }
      })
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const gain = ctx.createGain()
    const now = ctx.currentTime
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.8, now + FADE_IN)
    gain.gain.setValueAtTime(0.8, now + duration - FADE_OUT)
    gain.gain.linearRampToValueAtTime(0, now + duration)

    source.connect(gain).connect(this.masterGain)
    source.start(now)
    source.stop(now + duration)

    this._textureSource = source
    this._textureGain = gain

    return new Promise(resolve => setTimeout(resolve, duration * 1000))
  }

  // --- Phase 4: Build and Drop ---

  playBuildAndDrop(duration = 10) {
    this.init()
    const now = this.ctx.currentTime
    const root = 110 // A2 — warmer register
    const gains = []

    // Proportional timing anchors (scale with duration)
    const s = duration / 15 // scale factor vs original 15s
    const t = (sec) => now + sec * s // scaled absolute time

    // Simple stereo delay for spaciousness (no feedback loops)
    const delayL = this.ctx.createDelay(0.5)
    delayL.delayTime.value = 0.12
    const delayR = this.ctx.createDelay(0.5)
    delayR.delayTime.value = 0.18
    const delayGain = this.ctx.createGain()
    delayGain.gain.value = 0.12
    const delayFilter = this.ctx.createBiquadFilter()
    delayFilter.type = 'lowpass'
    delayFilter.frequency.value = 1500
    const delayPanL = this.ctx.createStereoPanner()
    delayPanL.pan.value = -0.4
    const delayPanR = this.ctx.createStereoPanner()
    delayPanR.pan.value = 0.4
    delayL.connect(delayFilter).connect(delayPanL).connect(delayGain)
    delayR.connect(delayFilter).connect(delayPanR).connect(delayGain)
    delayGain.connect(this.masterGain)
    const sendToDelay = (node) => {
      node.connect(delayL)
      node.connect(delayR)
    }

    // --- Layer 1: Sub bass (sine, warm foundation) ---
    const sub = this.ctx.createOscillator()
    const subGain = this.ctx.createGain()
    sub.type = 'sine'
    sub.frequency.value = root / 2 // A1
    subGain.gain.setValueAtTime(0, now)
    subGain.gain.linearRampToValueAtTime(0.12, t(1.5))
    subGain.gain.setValueAtTime(0.12, t(8.5))
    subGain.gain.linearRampToValueAtTime(0, t(9.25)) // fade before drop
    subGain.gain.setValueAtTime(0, t(10))
    subGain.gain.linearRampToValueAtTime(0.08, t(11))
    subGain.gain.linearRampToValueAtTime(0, now + duration)
    sub.connect(subGain).connect(this.masterGain)
    sub.start(now)
    sub.stop(now + duration)
    this._track(sub)
    gains.push(subGain)

    // --- Layer 2: Pad chord (filtered, lush) ---
    // A minor 9 voicing: A2, E3, G3, B3, C4
    const padNotes = [root, root * 3/2, root * 27/16, root * 15/8, root * 2]
    const padFilter = this.ctx.createBiquadFilter()
    padFilter.type = 'lowpass'
    padFilter.frequency.setValueAtTime(200, now)
    padFilter.frequency.exponentialRampToValueAtTime(2500, t(8))
    padFilter.frequency.exponentialRampToValueAtTime(400, t(9.25))
    padFilter.frequency.setValueAtTime(400, t(10))
    padFilter.frequency.exponentialRampToValueAtTime(1800, t(13))
    padFilter.frequency.linearRampToValueAtTime(600, now + duration)
    padFilter.Q.value = 0.7
    const padGain = this.ctx.createGain()
    padGain.gain.setValueAtTime(0, now)
    padGain.gain.linearRampToValueAtTime(0.06, t(2))
    padGain.gain.linearRampToValueAtTime(0.09, t(8))
    padGain.gain.linearRampToValueAtTime(0, t(9.25))
    padGain.gain.setValueAtTime(0, t(10))
    padGain.gain.linearRampToValueAtTime(0.07, t(11.5))
    padGain.gain.linearRampToValueAtTime(0, now + duration)
    padFilter.connect(padGain).connect(this.masterGain)
    sendToDelay(padGain)
    gains.push(padGain)

    padNotes.forEach((freq, i) => {
      // Two slightly detuned oscillators per note for richness
      for (let detune of [-4, 4]) {
        const osc = this.ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        osc.detune.value = detune + (i * 0.5) // subtle spread
        osc.connect(padFilter)
        osc.start(now + i * 0.3 * s) // staggered entry
        osc.stop(now + duration)
        this._track(osc)
      }
    })

    // --- Layer 3: Rising shimmer (builds tension musically) ---
    const shimmerNotes = [root * 2, root * 3, root * 4, root * 6]
    shimmerNotes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      // Slow vibrato for shimmer
      const lfo = this.ctx.createOscillator()
      const lfoGain = this.ctx.createGain()
      lfo.frequency.value = 0.3 + i * 0.1
      lfoGain.gain.value = freq * 0.003
      lfo.connect(lfoGain).connect(osc.frequency)
      lfo.start(now)
      lfo.stop(now + duration)
      this._track(lfo)

      const enter = t(2 + i * 1.25)
      g.gain.setValueAtTime(0, enter)
      g.gain.linearRampToValueAtTime(0.025, enter + 1.5 * s)
      g.gain.linearRampToValueAtTime(0.04, t(8))
      g.gain.linearRampToValueAtTime(0, t(9)) // vanish at drop
      g.gain.setValueAtTime(0, t(10.5))
      g.gain.linearRampToValueAtTime(0.015, t(12))
      g.gain.linearRampToValueAtTime(0, now + duration)
      osc.connect(g).connect(this.masterGain)
      sendToDelay(g)
      osc.start(enter)
      osc.stop(now + duration)
      this._track(osc)
    })

    // --- Layer 4: Riser sweep (filtered noise, only in build) ---
    const noiseLen = this.ctx.sampleRate * 9.5 * s
    const noiseBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate)
    const noiseData = noiseBuf.getChannelData(0)
    for (let i = 0; i < noiseLen; i++) noiseData[i] = Math.random() * 2 - 1
    const noiseSrc = this.ctx.createBufferSource()
    noiseSrc.buffer = noiseBuf
    const noiseFilter = this.ctx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.setValueAtTime(200, now)
    noiseFilter.frequency.exponentialRampToValueAtTime(6000, t(8.5))
    noiseFilter.frequency.exponentialRampToValueAtTime(200, t(9.25))
    noiseFilter.Q.value = 1.5
    const noiseGain = this.ctx.createGain()
    noiseGain.gain.setValueAtTime(0, now)
    noiseGain.gain.linearRampToValueAtTime(0.008, t(4))
    noiseGain.gain.linearRampToValueAtTime(0.02, t(8.5))
    noiseGain.gain.linearRampToValueAtTime(0, t(9.25))
    noiseSrc.connect(noiseFilter).connect(noiseGain).connect(this.masterGain)
    noiseSrc.start(now)
    this._track(noiseSrc)

    // --- Drop silence marker: a single deep tone ---
    const dropTone = this.ctx.createOscillator()
    const dropGain = this.ctx.createGain()
    dropTone.type = 'sine'
    dropTone.frequency.value = root / 2
    dropGain.gain.setValueAtTime(0, t(9.9))
    dropGain.gain.linearRampToValueAtTime(0.15, t(10))
    dropGain.gain.exponentialRampToValueAtTime(0.001, t(11))
    dropTone.connect(dropGain).connect(this.masterGain)
    sendToDelay(dropGain)
    dropTone.start(t(9.9))
    dropTone.stop(t(11.5))
    this._track(dropTone)

    // Collect all gain nodes for clean stop
    const allGains = [...gains, noiseGain, dropGain]

    return {
      promise: new Promise(resolve => setTimeout(resolve, duration * 1000)),
      stop: () => {
        const t = this.ctx.currentTime
        allGains.forEach(g => {
          g.gain.cancelScheduledValues(t)
          g.gain.linearRampToValueAtTime(0, t + 0.5)
        })
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

  /**
   * Plays a sustained sine drone at the given frequency until the returned
   * stop function is called. Used for the Phase 0 threshold rite (60 Hz —
   * felt rather than heard, provides a body-anchor without engaging musical
   * schemas per Bernardi 2006 and Research/ 5-minute-taste-extraction redesign.md).
   *
   * @param {number} freq Frequency in Hz (e.g., 60 for the threshold drone).
   * @param {number} gain Linear gain (default 0.04 — sub-audible felt anchor).
   * @returns {() => void} Stop function. Idempotent — safe to call multiple times.
   */
  playDrone(freq = 60, gain = 0.04) {
    if (!this.ctx) return () => {}
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime)
    // Fade in over 800ms to avoid a click.
    g.gain.setValueAtTime(0, this.ctx.currentTime)
    g.gain.linearRampToValueAtTime(gain, this.ctx.currentTime + 0.8)
    osc.connect(g)
    g.connect(this.ctx.destination)
    osc.start()
    let stopped = false
    return () => {
      if (stopped) return
      stopped = true
      try {
        // Fade out over 400ms.
        g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.4)
        osc.stop(this.ctx.currentTime + 0.5)
      } catch { /* osc may already be stopped */ }
      setTimeout(() => {
        try { osc.disconnect() } catch {}
        try { g.disconnect() } catch {}
      }, 600)
    }
  }

  // --- Stop everything ---

  stopAll() {
    this.stopTexture()
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
