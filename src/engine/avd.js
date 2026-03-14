// AVD State Manager — Arousal, Valence, Depth

class AVDEngine {
  constructor() {
    this.state = { a: 0.5, v: 0.5, d: 0.5 }
    this.history = [{ ...this.state, t: Date.now() }]
    this.listeners = new Set()
    this.phaseData = {
      spectrum: { pairs: [] },
      depth: { finalLayer: 1, maxLayer: 1, reEngaged: false },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalTaps: 0, tapsDuringBuild: 0, preDropSilence: false, tapsDuringRelease: 0, peakTapRate: 0 },
    }
  }

  clamp(v) {
    return Math.max(0, Math.min(1, v))
  }

  updateValence(delta, confidence = 1.0) {
    this.state.v = this.clamp(this.state.v + delta * confidence)
    this._snapshot()
    this._emit()
  }

  updateDepth(delta, confidence = 1.0) {
    this.state.d = this.clamp(this.state.d + delta * confidence)
    this._snapshot()
    this._emit()
  }

  updateArousal(delta, confidence = 1.0) {
    this.state.a = this.clamp(this.state.a + delta * confidence)
    this._snapshot()
    this._emit()
  }

  setArousal(value) {
    this.state.a = this.clamp(value)
    this._snapshot()
    this._emit()
  }

  setValence(value) {
    this.state.v = this.clamp(value)
    this._snapshot()
    this._emit()
  }

  setDepth(value) {
    this.state.d = this.clamp(value)
    this._snapshot()
    this._emit()
  }

  getAVD() {
    return { ...this.state }
  }

  getHistory() {
    return [...this.history]
  }

  getPhaseData() {
    return JSON.parse(JSON.stringify(this.phaseData))
  }

  setPhaseData(phase, data) {
    this.phaseData[phase] = { ...this.phaseData[phase], ...data }
  }

  getPrompt() {
    const { a, v, d } = this.state
    const parts = []

    if (a < 0.3) parts.push('slow, meditative, calm, spacious')
    else if (a < 0.7) parts.push('moderate groove, steady rhythm, flowing')
    else parts.push('high energy, driving, intense, powerful')

    if (v < 0.3) parts.push('minor key, melancholic, dark, brooding')
    else if (v < 0.7) parts.push('bittersweet, contemplative, modal, ambiguous')
    else parts.push('major key, uplifting, bright, warm')

    if (d < 0.3) parts.push('minimal, sparse, repetitive, hypnotic')
    else if (d < 0.7) parts.push('structured arrangement, moderate layers')
    else parts.push('layered, complex, progressive, rich orchestration')

    const bpm = Math.round(60 + a * 100)
    const keys = v < 0.5
      ? ['Am', 'Dm', 'Em', 'Cm']
      : ['C', 'G', 'D', 'F']
    const key = keys[Math.floor(Math.random() * keys.length)]

    parts.push(`${bpm} BPM, ${key}`)
    return parts.join(', ')
  }

  subscribe(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  _snapshot() {
    this.history.push({ ...this.state, t: Date.now() })
  }

  _emit() {
    this.listeners.forEach(fn => fn(this.getAVD()))
  }

  reset() {
    this.state = { a: 0.5, v: 0.5, d: 0.5 }
    this.history = [{ ...this.state, t: Date.now() }]
    this.phaseData = {
      spectrum: { pairs: [] },
      depth: { finalLayer: 1, maxLayer: 1, reEngaged: false },
      textures: { preferred: [], rejected: [], neutral: [] },
      moment: { totalTaps: 0, tapsDuringBuild: 0, preDropSilence: false, tapsDuringRelease: 0, peakTapRate: 0 },
    }
    this._emit()
  }
}

export const avdEngine = new AVDEngine()
