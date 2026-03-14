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

  // --- Phase 3: Texture synthesis ---

  playTexture(textureName, duration = 5) {
    this.init()
    const now = this.ctx.currentTime

    const textures = {
      strings: () => {
        // Warm ensemble strings — detuned saws through lowpass with LFO sweep + reverb
        const reverb = this._createReverbSend(0.3)
        const filter = this.ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 1200
        filter.Q.value = 1
        const filterLfo = this.ctx.createOscillator()
        const filterLfoG = this.ctx.createGain()
        filterLfo.frequency.value = 0.3
        filterLfoG.gain.value = 300
        filterLfo.connect(filterLfoG).connect(filter.frequency)
        filterLfo.start(now)
        filterLfo.stop(now + duration)
        this._track(filterLfo)
        const outGain = this.ctx.createGain()
        this._adsr(outGain, now, { a: 0.8, d: 0.3, s: 0.85, r: 1.0, peak: 0.1, duration })
        filter.connect(outGain)
        outGain.connect(this.masterGain)
        outGain.connect(reverb)
        // 3 detuned saws per note for ensemble chorus
        ;[220, 329.63].forEach(freq => {
          ;[-7, 0, 7].forEach(detune => {
            const osc = this.ctx.createOscillator()
            osc.type = 'sawtooth'
            osc.frequency.value = freq
            osc.detune.value = detune
            osc.connect(filter)
            osc.start(now)
            osc.stop(now + duration)
            this._track(osc)
          })
        })
      },

      synthesizer: () => {
        // Evolving electronic pad — detuned saws + sub, slow filter sweep, breathing LFO
        const reverb = this._createReverbSend(0.2)
        const filter = this.ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(300, now)
        filter.frequency.exponentialRampToValueAtTime(2500, now + duration * 0.45)
        filter.frequency.exponentialRampToValueAtTime(600, now + duration)
        filter.Q.value = 3
        const outGain = this.ctx.createGain()
        this._adsr(outGain, now, { a: 0.6, d: 0.3, s: 0.8, r: 0.8, peak: 0.1, duration })
        filter.connect(outGain)
        outGain.connect(this.masterGain)
        outGain.connect(reverb)
        // Detuned saw pair
        ;[-5, 5].forEach(detune => {
          const osc = this.ctx.createOscillator()
          osc.type = 'sawtooth'
          osc.frequency.value = 130.81
          osc.detune.value = detune
          osc.connect(filter)
          osc.start(now)
          osc.stop(now + duration)
          this._track(osc)
        })
        // Sub sine one octave below
        const sub = this.ctx.createOscillator()
        sub.type = 'sine'
        sub.frequency.value = 65.41
        const subG = this.ctx.createGain()
        this._adsr(subG, now, { a: 0.8, d: 0.2, s: 0.9, r: 0.8, peak: 0.06, duration })
        sub.connect(subG).connect(this.masterGain)
        sub.start(now)
        sub.stop(now + duration)
        this._track(sub)
        // Breathing LFO on detune
        const lfo = this.ctx.createOscillator()
        const lfoG = this.ctx.createGain()
        lfo.frequency.value = 0.15
        lfoG.gain.value = 8
        lfo.connect(lfoG).connect(filter.detune)
        lfo.start(now)
        lfo.stop(now + duration)
        this._track(lfo)
      },

      distortion: () => {
        // Controlled grit — power chord through smooth tanh waveshaper, pre/post filtering, amplitude pulse
        const reverb = this._createReverbSend(0.15)
        // Pre-distortion filter
        const preFilter = this.ctx.createBiquadFilter()
        preFilter.type = 'lowpass'
        preFilter.frequency.value = 2000
        // Waveshaper with smooth tanh curve
        const ws = this.ctx.createWaveShaper()
        const curve = new Float32Array(1024)
        for (let i = 0; i < 1024; i++) {
          const x = (i / 512) - 1
          curve[i] = Math.tanh(x * 2.5)
        }
        ws.curve = curve
        ws.oversample = '2x'
        // Post-distortion filter
        const postFilter = this.ctx.createBiquadFilter()
        postFilter.type = 'lowpass'
        postFilter.frequency.value = 3000
        postFilter.Q.value = 0.7
        // Amplitude pulse LFO
        const ampLfo = this.ctx.createOscillator()
        const ampLfoG = this.ctx.createGain()
        ampLfo.frequency.value = 2
        ampLfoG.gain.value = 0.03
        const outGain = this.ctx.createGain()
        this._adsr(outGain, now, { a: 0.15, d: 0.2, s: 0.85, r: 0.4, peak: 0.1, duration })
        ampLfo.connect(ampLfoG).connect(outGain.gain)
        ampLfo.start(now)
        ampLfo.stop(now + duration)
        this._track(ampLfo)
        preFilter.connect(ws).connect(postFilter).connect(outGain)
        outGain.connect(this.masterGain)
        outGain.connect(reverb)
        // Root + fifth (power chord)
        ;[110, 165].forEach(freq => {
          const osc = this.ctx.createOscillator()
          osc.type = 'sawtooth'
          osc.frequency.value = freq
          osc.connect(preFilter)
          osc.start(now)
          osc.stop(now + duration)
          this._track(osc)
        })
        // Filtered noise layer for air
        const bufSize = this.ctx.sampleRate * duration
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
        const noiseSrc = this.ctx.createBufferSource()
        noiseSrc.buffer = buf
        const noiseFilt = this.ctx.createBiquadFilter()
        noiseFilt.type = 'bandpass'
        noiseFilt.frequency.value = 500
        noiseFilt.Q.value = 1
        const noiseG = this.ctx.createGain()
        this._adsr(noiseG, now, { a: 0.3, d: 0.2, s: 0.8, r: 0.4, peak: 0.025, duration })
        noiseSrc.connect(noiseFilt).connect(noiseG).connect(this.masterGain)
        noiseSrc.start(now)
        this._track(noiseSrc)
      },

      keys: () => {
        // Intimate piano — staggered chord with overtone harmonics, exponential decay, hall reverb
        const reverb = this._createReverbSend(0.35)
        const hipass = this.ctx.createBiquadFilter()
        hipass.type = 'highpass'
        hipass.frequency.value = 80
        hipass.connect(this.masterGain)
        hipass.connect(reverb)
        ;[261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
          const start = now + i * 0.5
          // Fundamental + octave harmonic + 12th harmonic
          ;[
            { mult: 1, gain: 0.12 },
            { mult: 2, gain: 0.04 },
            { mult: 3, gain: 0.02 },
          ].forEach(h => {
            const osc = this.ctx.createOscillator()
            const g = this.ctx.createGain()
            osc.type = 'sine'
            osc.frequency.value = freq * h.mult
            g.gain.setValueAtTime(0, start)
            g.gain.linearRampToValueAtTime(h.gain, start + 0.005)
            g.gain.exponentialRampToValueAtTime(0.001, start + 2.2)
            osc.connect(g).connect(hipass)
            osc.start(start)
            osc.stop(start + 2.5)
            this._track(osc)
          })
        })
      },

      voice: () => {
        // Ethereal choir — sine voices with formant filters, vibrato, staggered entry, heavy reverb
        const reverb = this._createReverbSend(0.4)
        ;[220, 277.18, 330, 440].forEach((freq, i) => {
          const onset = now + i * 0.3
          const voiceDur = duration - i * 0.3
          const osc = this.ctx.createOscillator()
          osc.type = 'sine'
          osc.frequency.value = freq
          // Vibrato
          const vLfo = this.ctx.createOscillator()
          const vLfoG = this.ctx.createGain()
          vLfo.frequency.value = 4.5 + i * 0.5
          vLfoG.gain.value = freq * 0.008
          vLfo.connect(vLfoG).connect(osc.frequency)
          vLfo.start(onset)
          vLfo.stop(onset + voiceDur)
          this._track(vLfo)
          // Formant filters (vowel "ah")
          const f1 = this.ctx.createBiquadFilter()
          f1.type = 'bandpass'
          f1.frequency.value = 800
          f1.Q.value = 5
          const f2 = this.ctx.createBiquadFilter()
          f2.type = 'bandpass'
          f2.frequency.value = 1200
          f2.Q.value = 5
          const formantMix = this.ctx.createGain()
          formantMix.gain.value = 1
          osc.connect(f1).connect(formantMix)
          osc.connect(f2).connect(formantMix)
          const g = this.ctx.createGain()
          this._adsr(g, onset, { a: 1.2, d: 0.3, s: 0.85, r: 1.2, peak: 0.08, duration: voiceDur })
          formantMix.connect(g)
          g.connect(this.masterGain)
          g.connect(reverb)
          osc.start(onset)
          osc.stop(onset + voiceDur)
          this._track(osc)
        })
      },

      glitch: () => {
        // Fragmented digital — pitched bursts with pitch-bend, varied durations, noise fills, reverb tail
        const reverb = this._createReverbSend(0.2)
        for (let i = 0; i < 10; i++) {
          const start = now + i * (duration / 10)
          const burstDur = 0.05 + Math.random() * 0.2
          const freq = 200 + Math.random() * 1800
          const osc = this.ctx.createOscillator()
          const g = this.ctx.createGain()
          osc.type = i % 3 === 0 ? 'square' : 'sawtooth'
          osc.frequency.setValueAtTime(freq, start)
          osc.frequency.exponentialRampToValueAtTime(freq * (0.5 + Math.random()), start + burstDur)
          g.gain.setValueAtTime(0, start)
          g.gain.linearRampToValueAtTime(0.07, start + 0.005)
          g.gain.exponentialRampToValueAtTime(0.001, start + burstDur)
          const filt = this.ctx.createBiquadFilter()
          filt.type = 'bandpass'
          filt.frequency.value = freq
          filt.Q.value = 2
          osc.connect(filt).connect(g)
          g.connect(this.masterGain)
          g.connect(reverb)
          osc.start(start)
          osc.stop(start + burstDur + 0.05)
          this._track(osc)
        }
        // Filtered noise texture between bursts
        const nBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate)
        const nData = nBuf.getChannelData(0)
        for (let i = 0; i < nData.length; i++) nData[i] = Math.random() * 2 - 1
        const nSrc = this.ctx.createBufferSource()
        nSrc.buffer = nBuf
        const nFilt = this.ctx.createBiquadFilter()
        nFilt.type = 'highpass'
        nFilt.frequency.value = 4000
        const nG = this.ctx.createGain()
        this._adsr(nG, now, { a: 0.2, d: 0.1, s: 0.6, r: 0.3, peak: 0.015, duration })
        nSrc.connect(nFilt).connect(nG).connect(this.masterGain)
        nSrc.start(now)
        this._track(nSrc)
      },

      rhythm: () => {
        // Drum pattern — alternating kicks (sine pitch sweep) and hi-hats (noise), room reverb
        const reverb = this._createReverbSend(0.2)
        const beatCount = 12
        for (let i = 0; i < beatCount; i++) {
          const start = now + i * (duration / beatCount)
          const isKick = i % 2 === 0
          if (isKick) {
            // Kick: sine pitch sweep 200 → 60Hz
            const osc = this.ctx.createOscillator()
            const g = this.ctx.createGain()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(200, start)
            osc.frequency.exponentialRampToValueAtTime(60, start + 0.12)
            g.gain.setValueAtTime(0.15, start)
            g.gain.exponentialRampToValueAtTime(0.001, start + 0.3)
            osc.connect(g).connect(this.masterGain)
            osc.connect(g).connect(reverb)
            osc.start(start)
            osc.stop(start + 0.35)
            this._track(osc)
          } else {
            // Hi-hat: short highpass noise
            const bufSize = this.ctx.sampleRate * 0.08
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
            const data = buf.getChannelData(0)
            for (let j = 0; j < bufSize; j++) data[j] = Math.random() * 2 - 1
            const src = this.ctx.createBufferSource()
            src.buffer = buf
            const filt = this.ctx.createBiquadFilter()
            filt.type = 'highpass'
            filt.frequency.value = 6000
            const g = this.ctx.createGain()
            g.gain.setValueAtTime(0.1, start)
            g.gain.exponentialRampToValueAtTime(0.001, start + 0.06)
            src.connect(filt).connect(g).connect(this.masterGain)
            src.connect(filt).connect(g).connect(reverb)
            src.start(start)
            this._track(src)
          }
        }
      },

      field: () => {
        // Ambient environment — layered bandpass noise, sine chirps, drone with vibrato, heavy reverb
        const reverb = this._createReverbSend(0.35)
        // Two bandpass noise layers
        ;[400, 2000].forEach(freq => {
          const bufSize = this.ctx.sampleRate * duration
          const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
          const data = buf.getChannelData(0)
          for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5
          const src = this.ctx.createBufferSource()
          src.buffer = buf
          const filt = this.ctx.createBiquadFilter()
          filt.type = 'bandpass'
          filt.frequency.value = freq
          filt.Q.value = 0.8
          const g = this.ctx.createGain()
          this._adsr(g, now, { a: 1.0, d: 0.3, s: 0.8, r: 1.0, peak: 0.04, duration })
          src.connect(filt).connect(g).connect(this.masterGain)
          src.connect(filt).connect(g).connect(reverb)
          src.start(now)
          this._track(src)
        })
        // Gentle drone with vibrato
        const drone = this.ctx.createOscillator()
        drone.type = 'sine'
        drone.frequency.value = 80
        const droneLfo = this.ctx.createOscillator()
        const droneLfoG = this.ctx.createGain()
        droneLfo.frequency.value = 0.2
        droneLfoG.gain.value = 2
        droneLfo.connect(droneLfoG).connect(drone.frequency)
        droneLfo.start(now)
        droneLfo.stop(now + duration)
        this._track(droneLfo)
        const droneG = this.ctx.createGain()
        this._adsr(droneG, now, { a: 1.2, d: 0.2, s: 0.9, r: 1.0, peak: 0.05, duration })
        drone.connect(droneG).connect(this.masterGain)
        drone.connect(droneG).connect(reverb)
        drone.start(now)
        drone.stop(now + duration)
        this._track(drone)
        // Birdsong-like chirps — random sine pitch sweeps
        for (let i = 0; i < 5; i++) {
          const chirpStart = now + 1 + Math.random() * (duration - 3)
          const chirpDur = 0.15 + Math.random() * 0.3
          const startFreq = 1500 + Math.random() * 2000
          const endFreq = startFreq * (0.6 + Math.random() * 0.8)
          const osc = this.ctx.createOscillator()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(startFreq, chirpStart)
          osc.frequency.exponentialRampToValueAtTime(endFreq, chirpStart + chirpDur)
          const g = this.ctx.createGain()
          g.gain.setValueAtTime(0, chirpStart)
          g.gain.linearRampToValueAtTime(0.03, chirpStart + 0.01)
          g.gain.exponentialRampToValueAtTime(0.001, chirpStart + chirpDur)
          osc.connect(g).connect(this.masterGain)
          osc.connect(g).connect(reverb)
          osc.start(chirpStart)
          osc.stop(chirpStart + chirpDur + 0.05)
          this._track(osc)
        }
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
    const root = 110 // A2 — warmer register
    const gains = []

    // Convolution-style reverb via feedback delay network
    const reverbGain = this.ctx.createGain()
    reverbGain.gain.value = 0.3
    const delays = [0.037, 0.053, 0.071, 0.097].map(t => {
      const d = this.ctx.createDelay(0.1)
      d.delayTime.value = t
      const g = this.ctx.createGain()
      g.gain.value = 0.4
      const f = this.ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 3000
      d.connect(f).connect(g).connect(d) // feedback loop
      g.connect(reverbGain)
      return d
    })
    reverbGain.connect(this.masterGain)
    const sendToReverb = (node) => {
      delays.forEach(d => node.connect(d))
    }

    // --- Layer 1: Sub bass (sine, warm foundation) ---
    const sub = this.ctx.createOscillator()
    const subGain = this.ctx.createGain()
    sub.type = 'sine'
    sub.frequency.value = root / 2 // A1
    subGain.gain.setValueAtTime(0, now)
    subGain.gain.linearRampToValueAtTime(0.12, now + 3)
    subGain.gain.setValueAtTime(0.12, now + 17)
    subGain.gain.linearRampToValueAtTime(0, now + 18.5) // fade before drop
    subGain.gain.setValueAtTime(0, now + 20)
    subGain.gain.linearRampToValueAtTime(0.08, now + 22)
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
    padFilter.frequency.exponentialRampToValueAtTime(2500, now + 16)
    padFilter.frequency.exponentialRampToValueAtTime(400, now + 18.5)
    padFilter.frequency.setValueAtTime(400, now + 20)
    padFilter.frequency.exponentialRampToValueAtTime(1800, now + 26)
    padFilter.frequency.linearRampToValueAtTime(600, now + duration)
    padFilter.Q.value = 0.7
    const padGain = this.ctx.createGain()
    padGain.gain.setValueAtTime(0, now)
    padGain.gain.linearRampToValueAtTime(0.06, now + 4)
    padGain.gain.linearRampToValueAtTime(0.09, now + 16)
    padGain.gain.linearRampToValueAtTime(0, now + 18.5)
    padGain.gain.setValueAtTime(0, now + 20)
    padGain.gain.linearRampToValueAtTime(0.07, now + 23)
    padGain.gain.linearRampToValueAtTime(0, now + duration)
    padFilter.connect(padGain).connect(this.masterGain)
    sendToReverb(padGain)
    gains.push(padGain)

    padNotes.forEach((freq, i) => {
      // Two slightly detuned oscillators per note for richness
      for (let detune of [-4, 4]) {
        const osc = this.ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq
        osc.detune.value = detune + (i * 0.5) // subtle spread
        osc.connect(padFilter)
        osc.start(now + i * 0.3) // staggered entry
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

      const enter = now + 4 + i * 2.5
      g.gain.setValueAtTime(0, enter)
      g.gain.linearRampToValueAtTime(0.025, enter + 3)
      g.gain.linearRampToValueAtTime(0.04, now + 16)
      g.gain.linearRampToValueAtTime(0, now + 18) // vanish at drop
      g.gain.setValueAtTime(0, now + 21)
      g.gain.linearRampToValueAtTime(0.015, now + 24)
      g.gain.linearRampToValueAtTime(0, now + duration)
      osc.connect(g).connect(this.masterGain)
      sendToReverb(g)
      osc.start(enter)
      osc.stop(now + duration)
      this._track(osc)
    })

    // --- Layer 4: Soft melodic pulses (pitched, not noise) ---
    const pulseNotes = [root, root * 5/4, root * 3/2, root * 2, root * 5/2]
    const beats = []
    let beatTime = 0.5
    let interval = 1.2
    while (beatTime < 17.5) {
      beats.push(beatTime)
      beatTime += interval
      interval *= 0.94 // gentle acceleration
    }
    // Post-drop: steady, slower pulse
    for (let t = 21; t < duration - 3; t += 0.8) {
      beats.push(t)
    }

    beats.forEach((t, idx) => {
      const noteFreq = pulseNotes[idx % pulseNotes.length]
      const osc = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      const f = this.ctx.createBiquadFilter()
      osc.type = 'triangle'
      osc.frequency.value = noteFreq * (t < 18 ? 1 : 0.5) // octave down post-drop
      f.type = 'bandpass'
      f.frequency.value = noteFreq * 2
      f.Q.value = 2
      const s = now + t
      const vol = t < 18 ? 0.03 + (t / 18) * 0.05 : 0.04
      g.gain.setValueAtTime(0, s)
      g.gain.linearRampToValueAtTime(vol, s + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.4)
      osc.connect(f).connect(g).connect(this.masterGain)
      sendToReverb(g)
      osc.start(s)
      osc.stop(s + 0.5)
      this._track(osc)
    })

    // --- Layer 5: Riser sweep (filtered noise, only in build) ---
    const noiseLen = this.ctx.sampleRate * 19
    const noiseBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate)
    const noiseData = noiseBuf.getChannelData(0)
    for (let i = 0; i < noiseLen; i++) noiseData[i] = Math.random() * 2 - 1
    const noiseSrc = this.ctx.createBufferSource()
    noiseSrc.buffer = noiseBuf
    const noiseFilter = this.ctx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.setValueAtTime(200, now)
    noiseFilter.frequency.exponentialRampToValueAtTime(6000, now + 17)
    noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 18.5)
    noiseFilter.Q.value = 3
    const noiseGain = this.ctx.createGain()
    noiseGain.gain.setValueAtTime(0, now)
    noiseGain.gain.linearRampToValueAtTime(0.015, now + 8)
    noiseGain.gain.linearRampToValueAtTime(0.04, now + 17)
    noiseGain.gain.linearRampToValueAtTime(0, now + 18.5)
    noiseSrc.connect(noiseFilter).connect(noiseGain).connect(this.masterGain)
    noiseSrc.start(now)
    this._track(noiseSrc)

    // --- Drop silence marker: a single deep tone at 20s ---
    const dropTone = this.ctx.createOscillator()
    const dropGain = this.ctx.createGain()
    dropTone.type = 'sine'
    dropTone.frequency.value = root / 2
    dropGain.gain.setValueAtTime(0, now + 19.8)
    dropGain.gain.linearRampToValueAtTime(0.15, now + 20)
    dropGain.gain.exponentialRampToValueAtTime(0.001, now + 22)
    dropTone.connect(dropGain).connect(this.masterGain)
    sendToReverb(dropGain)
    dropTone.start(now + 19.8)
    dropTone.stop(now + 23)
    this._track(dropTone)

    return {
      promise: new Promise(resolve => setTimeout(resolve, duration * 1000)),
      stop: () => {
        const t = this.ctx.currentTime
        gains.forEach(g => {
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
