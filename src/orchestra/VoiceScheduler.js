import { VOICES, WHISPERS, OVATION_FILE } from './scripts.js'
import { GAINS } from './constants.js'

/**
 * Schedules all voice and whisper playback at absolute timestamps.
 * All scheduling uses AudioBufferSourceNode.start(when) for sample-accurate timing.
 */
export default class VoiceScheduler {
  constructor(engine) {
    this.engine = engine
    this.scheduledSources = []
  }

  /**
   * Schedule all voices, whispers, and ovation at once.
   * @param {number} experienceStartCtxTime - AudioContext.currentTime when experience begins
   */
  scheduleAll(experienceStartCtxTime) {
    const offset = experienceStartCtxTime

    // Schedule main voices
    for (const voice of VOICES) {
      const buffer = this.engine.buffers.get(voice.file)
      if (!buffer) {
        console.warn(`VoiceScheduler: missing buffer for ${voice.file}`)
        continue
      }
      const playAt = offset + voice.time
      const source = this.engine.scheduleVoice(buffer, playAt, { duck: voice.duck })
      if (source) this.scheduledSources.push(source)
    }

    // Schedule whispers
    for (const whisper of WHISPERS) {
      const buffer = this.engine.buffers.get(whisper.file)
      if (!buffer) {
        console.warn(`VoiceScheduler: missing buffer for ${whisper.file}`)
        continue
      }
      const playAt = offset + whisper.time

      // Whispers with null azimuth get random placement
      const azimuth = whisper.azimuth != null ? whisper.azimuth : Math.random() * 360
      const elevation = whisper.elevation != null ? whisper.elevation : Math.random() * 40

      const source = this.engine.scheduleVoice(buffer, playAt, {
        duck: false,
        azimuth,
        elevation,
        distance: 5,
        lowpass: 2000,
        gain: 0.04,
      })
      if (source) this.scheduledSources.push(source)
    }

    // Schedule ovation
    this.engine.scheduleOvation(offset)
  }

  stopAll() {
    for (const source of this.scheduledSources) {
      try { source.stop() } catch (e) { /* already stopped */ }
    }
    this.scheduledSources = []
  }
}
