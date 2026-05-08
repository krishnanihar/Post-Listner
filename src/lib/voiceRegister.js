// Map Admirer voice register names to ElevenLabs TTS voice_settings.
// Three registers per Research/voice-intimacy-admirer-design.md:
//   • caretaking — warm, intimate (Entry, Reflection, Mirror)
//   • present    — observational, settled (Spectrum, Depth, Gems, Moment, Autobio)
//   • elevated   — uplifted, moved (Reveal Forer paragraph)

export const ADMIRER_VOICE_ID = 'NtS6nEHDYMQC9QczMQuq' // Admirer — same as Phase 1 voice cues
export const REGISTERS = ['caretaking', 'present', 'elevated']

const SETTINGS = {
  caretaking: { stability: 0.4,  similarity_boost: 0.7, style: 0.6  },
  present:    { stability: 0.55, similarity_boost: 0.7, style: 0.4  },
  elevated:   { stability: 0.3,  similarity_boost: 0.7, style: 0.85 },
}

export function registerToVoiceSettings(register) {
  const cfg = SETTINGS[register] || SETTINGS.present
  return {
    voice_id: ADMIRER_VOICE_ID,
    model_id: 'eleven_v3',
    ...cfg,
  }
}
