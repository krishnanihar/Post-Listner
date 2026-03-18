/**
 * ElevenLabs TTS API stub for MVP.
 * Pre-recorded files cover all voice needs.
 * This can be expanded later for dynamic/personalized voice generation.
 */
export default class ElevenLabsAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async generateSpeech(voiceKey, text) {
    console.warn('ElevenLabs TTS not enabled for MVP. Using pre-recorded files.');
    return null;
  }
}
