import { VOICES, getDynamicVoices } from './scripts.js'
import { STARTS } from './constants.js'

/**
 * Schedules all voice playback at absolute timestamps.
 * v2: One voice (The Admirer), no categories, no whispers.
 * All scheduling uses AudioBufferSourceNode.start(when) for sample-accurate timing.
 */
export default class VoiceScheduler {
  constructor(engine) {
    this.engine = engine
    this.scheduledSources = []
  }

  /**
   * Schedule all voices at once.
   * @param {number} experienceStartCtxTime - AudioContext.currentTime when experience begins
   * @param {{ a: number, v: number, d: number }} avd - AVD values for dynamic line selection
   */
  scheduleAll(experienceStartCtxTime, avd) {
    const offset = experienceStartCtxTime
    // Voice timestamps are absolute from button press (include briefing).
    // scheduleAll is called at briefing end, so subtract briefing duration.
    const briefingOffset = STARTS.BLOOM

    // Schedule fixed voices
    for (const voice of VOICES) {
      this._scheduleVoice(voice, offset, briefingOffset)
    }

    // Schedule dynamic voices (AVD-selected)
    if (avd) {
      const dynamicVoices = getDynamicVoices(avd)
      for (const voice of dynamicVoices) {
        this._scheduleVoice(voice, offset, briefingOffset)
      }
    }

    // Schedule ovation (subtract briefing offset since OVATION.TIME is absolute)
    this.engine.scheduleOvation(offset - briefingOffset)
  }

  _scheduleVoice(voice, offset, briefingOffset) {
    // Briefing voices (time < BLOOM) are played directly by BriefingScreen.
    // Scheduling them here would re-fire them immediately because
    // AudioBufferSourceNode.start(past) plays now.
    if (voice.time < briefingOffset) return

    const buffer = this.engine.buffers.get(voice.file)
    if (!buffer) {
      console.warn(`VoiceScheduler: missing buffer for ${voice.file}`)
      return
    }
    const playAt = offset + (voice.time - briefingOffset)
    const source = this.engine.scheduleVoice(buffer, playAt, {
      duck: voice.duck,
      azimuth: voice.azimuth,
      elevation: voice.elevation,
      distance: voice.distance,
      gain: voice.gain || 1.0,
      lowpass: voice.lowpass,
    })
    if (source) this.scheduledSources.push(source)
  }

  stopAll() {
    for (const source of this.scheduledSources) {
      try { source.stop() } catch (e) { /* already stopped */ }
    }
    this.scheduledSources = []
  }
}
