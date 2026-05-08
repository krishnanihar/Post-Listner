import { describe, it, expect } from 'vitest'
import { registerToVoiceSettings, ADMIRER_VOICE_ID, REGISTERS } from '../voiceRegister'

describe('voiceRegister', () => {
  it('exports the three canonical registers', () => {
    expect(REGISTERS).toEqual(['caretaking', 'present', 'elevated'])
  })

  it('caretaking maps to warm low-stability settings', () => {
    const s = registerToVoiceSettings('caretaking')
    expect(s.stability).toBe(0.4)
    expect(s.similarity_boost).toBe(0.7)
    expect(s.style).toBe(0.6)
    expect(s.voice_id).toBe(ADMIRER_VOICE_ID)
    expect(s.model_id).toBe('eleven_v3')
  })

  it('present maps to mid-stability moderate-style settings', () => {
    const s = registerToVoiceSettings('present')
    expect(s.stability).toBe(0.55)
    expect(s.style).toBe(0.4)
  })

  it('elevated maps to low-stability high-style settings', () => {
    const s = registerToVoiceSettings('elevated')
    expect(s.stability).toBe(0.3)
    expect(s.style).toBe(0.85)
  })

  it('unknown register defaults to present', () => {
    const s = registerToVoiceSettings('unknown')
    expect(s.stability).toBe(0.55)
  })
})
