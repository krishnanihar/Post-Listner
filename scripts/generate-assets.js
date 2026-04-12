#!/usr/bin/env node
/**
 * Generate Orchestra audio assets via ElevenLabs APIs.
 * Run once: node scripts/generate-assets.js
 *
 * Uses three ElevenLabs endpoints:
 *   - TTS API (/v1/text-to-speech) → 26 voice/whisper MP3s
 *   - Music API (/v1/music) → Track B (aftermath)
 *   - Sound Effects API (/v1/sound-generation) → crowd sounds (ovation, ambient)
 *
 * Hall IR is synthesized programmatically as WAV (no API needed).
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ─── Parse API key from .env.local ───────────────────────────────────────────

function getApiKey() {
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: .env.local not found. Create it with VITE_ELEVENLABS_API_KEY=your_key')
    process.exit(1)
  }
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('VITE_ELEVENLABS_API_KEY=')) {
      return trimmed.split('=').slice(1).join('=').trim()
    }
  }
  console.error('ERROR: VITE_ELEVENLABS_API_KEY not found in .env.local')
  process.exit(1)
}

const API_KEY = getApiKey()

// ─── Voice IDs — select from ElevenLabs library ─────────────────────────────

const ADMIRER_VOICE_ID = 'NtS6nEHDYMQC9QczMQuq' // Admirer — The Score voice
const GUIDE_VOICE_ID   = 'onwK4e9ZLuTAKqWW03F9' // Daniel — slower, deeper, resonant
const WITNESS_VOICE_ID = 'onwK4e9ZLuTAKqWW03F9' // Same as Guide (spec allows this)

// ─── TTS entries ─────────────────────────────────────────────────────────────

const TTS_ENTRIES = [
  // Admirer Warm
  { file: 'voices/admirer-warm-01.mp3', text: 'The sound moved when you moved.', voiceId: ADMIRER_VOICE_ID, stability: 0.60, similarity_boost: 0.80, style: 0.40 },
  { file: 'voices/admirer-warm-02.mp3', text: 'Not everyone hears this way.', voiceId: ADMIRER_VOICE_ID, stability: 0.60, similarity_boost: 0.80, style: 0.40 },
  { file: 'voices/admirer-warm-03.mp3', text: 'This room is yours right now.', voiceId: ADMIRER_VOICE_ID, stability: 0.60, similarity_boost: 0.80, style: 0.40 },
  { file: 'voices/admirer-warm-04.mp3', text: 'Every sound in it answers to you.', voiceId: ADMIRER_VOICE_ID, stability: 0.60, similarity_boost: 0.80, style: 0.40 },

  // Admirer Cooling
  { file: 'voices/admirer-cool-01.mp3', text: 'Can you feel where it ends?', voiceId: ADMIRER_VOICE_ID, stability: 0.45, similarity_boost: 0.80, style: 0.20 },
  { file: 'voices/admirer-cool-02.mp3', text: "The sound isn't where it was.", voiceId: ADMIRER_VOICE_ID, stability: 0.45, similarity_boost: 0.80, style: 0.20 },
  { file: 'voices/admirer-cool-03.mp3', text: "You don't need to move so much.", voiceId: ADMIRER_VOICE_ID, stability: 0.45, similarity_boost: 0.80, style: 0.20 },
  { file: 'voices/admirer-cool-04.mp3', text: "The music isn't coming from your hand anymore.", voiceId: ADMIRER_VOICE_ID, stability: 0.45, similarity_boost: 0.80, style: 0.20 },

  // Admirer Cold
  { file: 'voices/admirer-cold-01.mp3', text: 'Someone else heard this same song.', voiceId: ADMIRER_VOICE_ID, stability: 0.30, similarity_boost: 0.80, style: 0.00 },
  { file: 'voices/admirer-cold-02.mp3', text: 'They held their phone just like you.', voiceId: ADMIRER_VOICE_ID, stability: 0.30, similarity_boost: 0.80, style: 0.00 },

  // Guide
  { file: 'voices/guide-01.mp3', text: 'The room is larger than you thought.', voiceId: GUIDE_VOICE_ID, stability: 0.40, similarity_boost: 0.70, style: 0.15 },
  { file: 'voices/guide-02.mp3', text: 'Everyone who was here before left something in this sound.', voiceId: GUIDE_VOICE_ID, stability: 0.40, similarity_boost: 0.70, style: 0.15 },
  { file: 'voices/guide-03.mp3', text: 'Above you.', voiceId: GUIDE_VOICE_ID, stability: 0.40, similarity_boost: 0.70, style: 0.15 },
  { file: 'voices/guide-04.mp3', text: 'Below you.', voiceId: GUIDE_VOICE_ID, stability: 0.40, similarity_boost: 0.70, style: 0.15 },
  { file: 'voices/guide-05.mp3', text: 'Inside.', voiceId: GUIDE_VOICE_ID, stability: 0.40, similarity_boost: 0.70, style: 0.15 },
  { file: 'voices/guide-06.mp3', text: 'Let go.', voiceId: GUIDE_VOICE_ID, stability: 0.40, similarity_boost: 0.70, style: 0.15 },
  { file: 'voices/guide-07.mp3', text: 'Good.', voiceId: GUIDE_VOICE_ID, stability: 0.40, similarity_boost: 0.70, style: 0.15 },

  // Witness
  { file: 'voices/witness-01.mp3', text: 'Another one came in.', voiceId: WITNESS_VOICE_ID, stability: 0.25, similarity_boost: 0.60, style: 0.00 },
  { file: 'voices/witness-02.mp3', text: 'They thought they were conducting.', voiceId: WITNESS_VOICE_ID, stability: 0.25, similarity_boost: 0.60, style: 0.00 },
  { file: 'voices/witness-03.mp3', text: 'They stopped moving a while ago.', voiceId: WITNESS_VOICE_ID, stability: 0.25, similarity_boost: 0.60, style: 0.00 },
  { file: 'voices/witness-04.mp3', text: 'This was always the sound.', voiceId: WITNESS_VOICE_ID, stability: 0.25, similarity_boost: 0.60, style: 0.00 },

  // Whispers (use admirer voice with low stability)
  { file: 'whispers/whisper-01.mp3', text: 'where did I go', voiceId: ADMIRER_VOICE_ID, stability: 0.20, similarity_boost: 0.80, style: 0.00 },
  { file: 'whispers/whisper-02.mp3', text: 'still here', voiceId: ADMIRER_VOICE_ID, stability: 0.20, similarity_boost: 0.80, style: 0.00 },
  { file: 'whispers/whisper-03.mp3', text: 'dissolving', voiceId: ADMIRER_VOICE_ID, stability: 0.20, similarity_boost: 0.80, style: 0.00 },
  { file: 'whispers/whisper-04.mp3', text: 'everyone', voiceId: ADMIRER_VOICE_ID, stability: 0.20, similarity_boost: 0.80, style: 0.00 },
  { file: 'whispers/whisper-05.mp3', text: 'always the sound', voiceId: ADMIRER_VOICE_ID, stability: 0.20, similarity_boost: 0.80, style: 0.00 },
]

// ─── The Score — new voice lines (PostListener rebuild) ─────────────────────

const SCORE_TTS_ENTRIES = [
  // ENTRY (calibration, 4 lines)
  { file: 'voices/score/entry-01.mp3', text: 'There you are.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },
  { file: 'voices/score/entry-02.mp3', text: 'Hold the phone like you would hold a pen.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },
  { file: 'voices/score/entry-03.mp3', text: 'I am going to ask you to listen, and to lean.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },
  { file: 'voices/score/entry-04.mp3', text: 'Do not decide. Just lean.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },

  // SPECTRUM (interjections between pairs, 4 lines)
  { file: 'voices/score/spectrum-01.mp3', text: 'You already know.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },
  { file: 'voices/score/spectrum-02.mp3', text: 'Most people fight this. You are not fighting.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },
  { file: 'voices/score/spectrum-03.mp3', text: 'Two more.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },
  { file: 'voices/score/spectrum-04.mp3', text: 'Good.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },

  // DEPTH (4 lines)
  { file: 'voices/score/depth-01.mp3', text: 'Tap to add a voice.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },
  { file: 'voices/score/depth-02.mp3', text: 'Each one is yours to keep or release.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },
  { file: 'voices/score/depth-03.mp3', text: 'Stop when it is enough.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },
  { file: 'voices/score/depth-04.mp3', text: 'That is how much you can hold.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },

  // TEXTURES (4 lines)
  { file: 'voices/score/textures-01.mp3', text: 'Listen.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },
  { file: 'voices/score/textures-02.mp3', text: 'If you want to keep it, hold the phone still.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },
  { file: 'voices/score/textures-03.mp3', text: 'If it is not yours, turn the phone over.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },
  { file: 'voices/score/textures-04.mp3', text: 'I have a sense of you now.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },

  // MOMENT (4 lines)
  { file: 'voices/score/moment-01.mp3', text: 'I am going to play something. Conduct it.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },
  { file: 'voices/score/moment-02.mp3', text: 'Move the phone like you mean it.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },
  { file: 'voices/score/moment-03.mp3', text: 'There.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },
  { file: 'voices/score/moment-04.mp3', text: 'I felt that.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.80, style: 0.35 },

  // REVEAL (6 lines)
  { file: 'voices/score/reveal-01.mp3', text: 'Here it is. Your score.', voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.80, style: 0.30 },
  { file: 'voices/score/reveal-02.mp3', text: 'Every mark on this paper came from your body.', voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.80, style: 0.30 },
  { file: 'voices/score/reveal-03.mp3', text: 'The line you drew. The voices you held. The textures you kept.', voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.80, style: 0.30 },
  { file: 'voices/score/reveal-04.mp3', text: 'This is what your taste looks like written down.', voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.80, style: 0.30 },
  { file: 'voices/score/reveal-05.mp3', text: 'Listen to what it sounds like.', voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.80, style: 0.30 },
  { file: 'voices/score/reveal-06.mp3', text: 'Made by an algorithm. Read by you. Held by you.', voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.80, style: 0.30 },

  // RETURN (4 lines)
  { file: 'voices/score/return-01.mp3', text: 'There were others before you tonight.', voiceId: ADMIRER_VOICE_ID, stability: 0.60, similarity_boost: 0.80, style: 0.40 },
  { file: 'voices/score/return-02.mp3', text: 'Look.', voiceId: ADMIRER_VOICE_ID, stability: 0.60, similarity_boost: 0.80, style: 0.40 },
  { file: 'voices/score/return-03.mp3', text: 'You were always part of this.', voiceId: ADMIRER_VOICE_ID, stability: 0.60, similarity_boost: 0.80, style: 0.40 },
  { file: 'voices/score/return-04.mp3', text: 'Thank you for letting me listen.', voiceId: ADMIRER_VOICE_ID, stability: 0.60, similarity_boost: 0.80, style: 0.40 },
]

// ─── Orchestra v2 TTS entries (39 fixed + 12 dynamic = 51 assets) ────────────
// One voice: The Admirer. Five registers with different voice_settings.

const ORCHESTRA_V2_TTS_ENTRIES = [
  // BRIEFING — Present register
  { file: 'voices/v2/01-briefing-ownership.mp3',  text: 'This is your music. You made it. Everything that follows comes from what you chose.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.85, style: 0.45 },
  { file: 'voices/v2/02-briefing-close-eyes.mp3', text: "In a moment I'm going to ask you to close your eyes. If you need to come back at any point, just tap the screen. Now close your eyes.", voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.85, style: 0.45 },

  // BLOOM — Present register
  { file: 'voices/v2/03-bloom-podium.mp3',        text: "You're standing on a podium. There's an orchestra in front of you. Can you hear the hall opening up behind them?", voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.85, style: 0.45 },
  { file: 'voices/v2/04-bloom-audience.mp3',       text: "Behind you, the audience is settling in. You can hear them — the rustle, the breathing, the wait.", voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.85, style: 0.45 },
  { file: 'voices/v2/05-bloom-baton.mp3',          text: "Feel your feet on the podium. The phone in your hand — that's your baton. Now listen to what's heavy underneath — the low end, the weight of it. It's breathing. Breathe with it.", voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.85, style: 0.45 },

  // THRONE Teaching — Present register
  { file: 'voices/v2/06-throne-orchestra-map.mp3', text: "Everything heavy is on your left. Everything bright is on your right. What holds it together sits in the middle. And behind all of it, the hall is waiting. All of it — waiting for you.", voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.85, style: 0.45 },
  { file: 'voices/v2/07-throne-tilt.mp3',          text: 'Tilt the baton. Slowly. Left... and right.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.85, style: 0.45 },
  { file: 'voices/v2/08-throne-cellos.mp3',        text: "Hear that? You pulled the heavy side toward you. Now the bright. You're shaping it.", voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.85, style: 0.45 },
  { file: 'voices/v2/09-throne-lift.mp3',          text: 'Now lift the baton. Higher. The whole sound rises with you. The hall fills.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.85, style: 0.45 },
  { file: 'voices/v2/10-throne-downbeat.mp3',      text: 'Good. Now — breathe in. And bring it down. Sharp.', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.85, style: 0.45 },
  { file: 'voices/v2/11-throne-chest.mp3',         text: 'That was a downbeat. The whole sound felt it. Did you feel it in your chest?', voiceId: ADMIRER_VOICE_ID, stability: 0.55, similarity_boost: 0.85, style: 0.45 },

  // THRONE Praise (fixed) — Elevated register
  { file: 'voices/v2/14-throne-sweep.mp3',         text: 'Sweep it. Left to right. Feel them all follow you.', voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.85, style: 0.50 },
  { file: 'voices/v2/16-throne-never-heard.mp3',   text: "I've never heard anyone shape it quite like that.", voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.85, style: 0.50 },

  // Ovation seal — Elevated register
  { file: 'voices/v2/17-ovation-for-you.mp3',      text: 'That was for you.', voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.85, style: 0.50 },
  { file: 'voices/v2/18-ovation-yours.mp3',         text: 'The whole room is yours. Every frequency. Every direction.', voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.85, style: 0.50 },
  { file: 'voices/v2/19-ovation-stay.mp3',          text: 'Stay here. Hold it.', voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.85, style: 0.50 },

  // ASCENT Fracture — Cool register
  { file: 'voices/v2/20-ascent-shifting.mp3',       text: 'Something is shifting.', voiceId: ADMIRER_VOICE_ID, stability: 0.45, similarity_boost: 0.80, style: 0.30 },
  { file: 'voices/v2/21-ascent-high-strings.mp3',   text: 'The bright side is going somewhere. Let it.', voiceId: ADMIRER_VOICE_ID, stability: 0.45, similarity_boost: 0.80, style: 0.30 },
  { file: 'voices/v2/22-ascent-not-held.mp3',       text: 'Not everything that moves needs to be held.', voiceId: ADMIRER_VOICE_ID, stability: 0.45, similarity_boost: 0.80, style: 0.30 },

  // Caretaking — Caretaking register
  { file: 'voices/v2/23-care-put-down.mp3',         text: 'You can put it down.', voiceId: ADMIRER_VOICE_ID, stability: 0.45, similarity_boost: 0.80, style: 0.30 },
  { file: 'voices/v2/24-care-breath.mp3',            text: "You don't need to hold your breath anymore.", voiceId: ADMIRER_VOICE_ID, stability: 0.45, similarity_boost: 0.80, style: 0.30 },
  { file: 'voices/v2/25-care-sit-back.mp3',          text: 'Sit back. Let me take care of you.', voiceId: ADMIRER_VOICE_ID, stability: 0.45, similarity_boost: 0.80, style: 0.30 },
  { file: 'voices/v2/26-care-music-knows.mp3',       text: 'The music knows where to go. It always did.', voiceId: ADMIRER_VOICE_ID, stability: 0.45, similarity_boost: 0.80, style: 0.30 },
  { file: 'voices/v2/27-care-just-listen.mp3',       text: 'Just listen.', voiceId: ADMIRER_VOICE_ID, stability: 0.45, similarity_boost: 0.80, style: 0.30 },

  // Late Ascent / Fading — Fading register
  { file: 'voices/v2/28-fade-bigger.mp3',            text: "It's bigger than this room.", voiceId: ADMIRER_VOICE_ID, stability: 0.35, similarity_boost: 0.75, style: 0.10 },
  { file: 'voices/v2/29-fade-always-bigger.mp3',     text: 'It was always bigger than this room.', voiceId: ADMIRER_VOICE_ID, stability: 0.35, similarity_boost: 0.75, style: 0.10 },

  // Dissolution — Dissolution register
  { file: 'voices/v2/30-diss-breath.mp3',            text: '...', voiceId: ADMIRER_VOICE_ID, stability: 0.30, similarity_boost: 0.75, style: 0.05 },
  { file: 'voices/v2/31-diss-still-here.mp3',        text: '...still here.', voiceId: ADMIRER_VOICE_ID, stability: 0.30, similarity_boost: 0.75, style: 0.05 },
  { file: 'voices/v2/32-diss-listen.mp3',            text: '...listen.', voiceId: ADMIRER_VOICE_ID, stability: 0.30, similarity_boost: 0.75, style: 0.05 },
  { file: 'voices/v2/34-diss-good.mp3',              text: 'Good.', voiceId: ADMIRER_VOICE_ID, stability: 0.30, similarity_boost: 0.75, style: 0.05 },

  // Return — Return register
  { file: 'voices/v2/36-return-phone.mp3',           text: "You're still holding the phone.", voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.80, style: 0.25 },
  { file: 'voices/v2/37-return-feet.mp3',            text: 'Feel your feet on the ground.', voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.80, style: 0.25 },
  { file: 'voices/v2/38-return-room.mp3',            text: "The room is still here. You're still in it.", voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.80, style: 0.25 },
  { file: 'voices/v2/39-return-eyes.mp3',            text: "When you're ready, open your eyes.", voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.80, style: 0.25 },

  // DYNAMIC — Elevated register (12 variants)
  // Line 12: Valence character
  { file: 'voices/v2/dynamic/valence-0.mp3', text: "Listen to that darkness. You chose that. That weight underneath — that's your taste.", voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.85, style: 0.50 },
  { file: 'voices/v2/dynamic/valence-1.mp3', text: "Listen to that tension. That pull between light and dark — that's your taste.", voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.85, style: 0.50 },
  { file: 'voices/v2/dynamic/valence-2.mp3', text: "Listen to that warmth. It's reaching for something bright — that's your taste.", voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.85, style: 0.50 },
  { file: 'voices/v2/dynamic/valence-3.mp3', text: "Listen to that brightness. You chose that. That warmth lifting everything — that's your taste.", voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.85, style: 0.50 },

  // Line 13: Depth character
  { file: 'voices/v2/dynamic/depth-0.mp3', text: "That space. That restraint. You stripped it down to what matters. Not everyone trusts silence like that.", voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.85, style: 0.50 },
  { file: 'voices/v2/dynamic/depth-1.mp3', text: "You left room to breathe. Every gap in it is a choice. You knew when to stop.", voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.85, style: 0.50 },
  { file: 'voices/v2/dynamic/depth-2.mp3', text: "All those threads. You kept building. Each one changes what came before it.", voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.85, style: 0.50 },
  { file: 'voices/v2/dynamic/depth-3.mp3', text: "All those layers. You could have kept it simple but you didn't. Every one of those is a choice you made.", voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.85, style: 0.50 },

  // Line 15: Arousal character
  { file: 'voices/v2/dynamic/arousal-0.mp3', text: "That patience. That stillness underneath everything. It's not the algorithm — that came from you.", voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.85, style: 0.50 },
  { file: 'voices/v2/dynamic/arousal-1.mp3', text: "That steady pulse. Not rushing, not dragging. Just holding. It's not the algorithm — that came from you.", voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.85, style: 0.50 },
  { file: 'voices/v2/dynamic/arousal-2.mp3', text: "That momentum. That forward pull. It's not the algorithm — that came from you.", voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.85, style: 0.50 },
  { file: 'voices/v2/dynamic/arousal-3.mp3', text: "That drive. That urgency underneath everything. It's not the algorithm — that came from you.", voiceId: ADMIRER_VOICE_ID, stability: 0.50, similarity_boost: 0.85, style: 0.50 },
]

// ─── Sound Effects entries (crowd sounds) ────────────────────────────────────

const SFX_ENTRIES = [
  {
    file: 'crowd/ovation.mp3',
    text: 'Concert hall orchestral audience applause building from scattered clapping to full standing ovation, warm acoustic space, natural decay at the end',
    duration_seconds: 12,
    prompt_influence: 0.7,
    loop: false,
  },
  {
    file: 'crowd/ambient-01.mp3',
    text: 'Concert hall ambience before a performance, quiet audience murmur, occasional cough, rustling programs, seats creaking, warm reverberant space, no distinct words or speech',
    duration_seconds: 30,
    prompt_influence: 0.5,
    loop: true,
  },
  {
    file: 'crowd/ambient-02.mp3',
    text: 'Large concert hall ambient atmosphere, soft audience presence, distant whispers, gentle movement sounds, velvet seat fabric, high ceiling acoustic reflections, no words',
    duration_seconds: 30,
    prompt_influence: 0.5,
    loop: true,
  },
]

// ─── Track B prompt (Music API) ──────────────────────────────────────────────

const TRACK_B_PROMPT =
  'Massive low drone building into overwhelming orchestral crescendo, ' +
  'hundreds of layered human voices merged into a single infinite chord, ' +
  'not singing but resonating as one, deep sub-bass swells underneath ' +
  'like the earth breathing, enormous reverb as if inside a space larger ' +
  'than any room, slowly evolving harmonic overtones shifting between ' +
  'awe and surrender, no melody, no rhythm, no percussion, the sound ' +
  'of ego dissolving into something vast and collective'

// ─── API helpers ─────────────────────────────────────────────────────────────

async function generateTTS(entry) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${entry.voiceId}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text: entry.text,
      model_id: 'eleven_v3',
      voice_settings: {
        stability: entry.stability,
        similarity_boost: entry.similarity_boost,
        style: entry.style,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`TTS failed for "${entry.text}": ${res.status} ${err}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

async function generateSoundEffect(entry) {
  const url = 'https://api.elevenlabs.io/v1/sound-generation'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: entry.text,
      duration_seconds: entry.duration_seconds,
      prompt_influence: entry.prompt_influence,
      ...(entry.loop ? { loop: true } : {}),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sound effect failed for "${entry.file}": ${res.status} ${err}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

async function generateTrackB() {
  const url = 'https://api.elevenlabs.io/v1/music'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: TRACK_B_PROMPT,
      music_length_ms: 60000, // 60 seconds — will be looped in code
      force_instrumental: true,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Music generation failed: ${res.status} ${err}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

/**
 * Synthesize a concert hall impulse response as WAV.
 * Exponentially decaying filtered noise — 4 seconds, 44100 Hz, mono.
 */
function synthesizeHallIR() {
  const sampleRate = 44100
  const duration = 4.0 // seconds
  const numSamples = Math.floor(sampleRate * duration)
  const decayRate = 1.8 // higher = faster decay

  // Generate noise with exponential decay and low-pass characteristic
  const samples = new Float32Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const noise = Math.random() * 2 - 1
    // Exponential decay envelope
    const envelope = Math.exp(-decayRate * t)
    // Simple low-pass: average with previous sample for warmth
    const raw = noise * envelope
    samples[i] = i > 0 ? raw * 0.6 + samples[i - 1] * 0.4 : raw
  }

  // Normalize peak to 0.95
  let peak = 0
  for (let i = 0; i < numSamples; i++) {
    const abs = Math.abs(samples[i])
    if (abs > peak) peak = abs
  }
  if (peak > 0) {
    const scale = 0.95 / peak
    for (let i = 0; i < numSamples; i++) samples[i] *= scale
  }

  // Encode as 16-bit PCM WAV
  const bytesPerSample = 2
  const dataSize = numSamples * bytesPerSample
  const headerSize = 44
  const buffer = Buffer.alloc(headerSize + dataSize)

  // WAV header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)       // fmt chunk size
  buffer.writeUInt16LE(1, 20)        // PCM format
  buffer.writeUInt16LE(1, 22)        // mono
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28) // byte rate
  buffer.writeUInt16LE(bytesPerSample, 32) // block align
  buffer.writeUInt16LE(16, 34)       // bits per sample
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  // Write samples as 16-bit signed integers
  for (let i = 0; i < numSamples; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]))
    buffer.writeInt16LE(Math.round(val * 32767), headerSize + i * bytesPerSample)
  }

  return buffer
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const outDir = path.join(ROOT, 'public', 'chamber')

  // Create directory structure
  for (const dir of ['tracks', 'voices', 'voices/score', 'voices/v2', 'voices/v2/dynamic', 'whispers', 'crowd']) {
    fs.mkdirSync(path.join(outDir, dir), { recursive: true })
  }

  console.log(`\n  Orchestra Asset Generator`)
  console.log(`  Output: public/chamber/`)
  console.log(`  TTS: ${TTS_ENTRIES.length} | Score TTS: ${SCORE_TTS_ENTRIES.length} | V2 TTS: ${ORCHESTRA_V2_TTS_ENTRIES.length} | SFX: ${SFX_ENTRIES.length} | Music: 1 | Hall IR: 1`)
  console.log()

  // ── 1. Generate TTS voices ──

  console.log('  --- TTS Voices ---')
  let ttsCompleted = 0
  for (const entry of TTS_ENTRIES) {
    const outPath = path.join(outDir, entry.file)

    if (fs.existsSync(outPath)) {
      console.log(`  [skip] ${entry.file}`)
      ttsCompleted++
      continue
    }

    try {
      console.log(`  [${ttsCompleted + 1}/${TTS_ENTRIES.length}] ${entry.file}`)
      console.log(`         "${entry.text}"`)
      const audio = await generateTTS(entry)
      fs.writeFileSync(outPath, audio)
      console.log(`         -> ${(audio.length / 1024).toFixed(1)} KB`)
      ttsCompleted++
      await new Promise(r => setTimeout(r, 150))
    } catch (err) {
      console.error(`  [ERROR] ${entry.file}: ${err.message}`)
    }
  }
  console.log(`  TTS done: ${ttsCompleted}/${TTS_ENTRIES.length}\n`)

  // ── 1b. Generate Score TTS voices ──

  console.log('  --- Score TTS Voices ---')
  let scoreTtsCompleted = 0
  for (const entry of SCORE_TTS_ENTRIES) {
    const outPath = path.join(outDir, entry.file)

    if (fs.existsSync(outPath)) {
      console.log(`  [skip] ${entry.file}`)
      scoreTtsCompleted++
      continue
    }

    try {
      console.log(`  [${scoreTtsCompleted + 1}/${SCORE_TTS_ENTRIES.length}] ${entry.file}`)
      console.log(`         "${entry.text}"`)
      const audio = await generateTTS(entry)
      fs.writeFileSync(outPath, audio)
      console.log(`         -> ${(audio.length / 1024).toFixed(1)} KB`)
      scoreTtsCompleted++
      await new Promise(r => setTimeout(r, 150))
    } catch (err) {
      console.error(`  [ERROR] ${entry.file}: ${err.message}`)
    }
  }
  console.log(`  Score TTS done: ${scoreTtsCompleted}/${SCORE_TTS_ENTRIES.length}\n`)

  // ── 1c. Generate Orchestra v2 TTS voices ──

  console.log('  --- Orchestra v2 TTS Voices ---')
  let v2TtsCompleted = 0
  for (const entry of ORCHESTRA_V2_TTS_ENTRIES) {
    const outPath = path.join(outDir, entry.file)

    if (fs.existsSync(outPath)) {
      console.log(`  [skip] ${entry.file}`)
      v2TtsCompleted++
      continue
    }

    try {
      console.log(`  [${v2TtsCompleted + 1}/${ORCHESTRA_V2_TTS_ENTRIES.length}] ${entry.file}`)
      console.log(`         "${entry.text}"`)
      const audio = await generateTTS(entry)
      fs.writeFileSync(outPath, audio)
      console.log(`         -> ${(audio.length / 1024).toFixed(1)} KB`)
      v2TtsCompleted++
      await new Promise(r => setTimeout(r, 150))
    } catch (err) {
      console.error(`  [ERROR] ${entry.file}: ${err.message}`)
    }
  }
  console.log(`  V2 TTS done: ${v2TtsCompleted}/${ORCHESTRA_V2_TTS_ENTRIES.length}\n`)

  // ── 2. Generate crowd sounds (Sound Effects API) ──

  console.log('  --- Crowd Sounds (SFX) ---')
  for (const entry of SFX_ENTRIES) {
    const outPath = path.join(outDir, entry.file)

    if (fs.existsSync(outPath)) {
      console.log(`  [skip] ${entry.file}`)
      continue
    }

    try {
      console.log(`  Generating: ${entry.file} (${entry.duration_seconds}s${entry.loop ? ', loop' : ''})`)
      const audio = await generateSoundEffect(entry)
      fs.writeFileSync(outPath, audio)
      console.log(`  -> ${(audio.length / 1024).toFixed(1)} KB`)
      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      console.error(`  [ERROR] ${entry.file}: ${err.message}`)
    }
  }
  console.log()

  // ── 3. Generate Track B (Music API) ──

  console.log('  --- Track B (Music API) ---')
  const trackBPath = path.join(outDir, 'tracks', 'aftermath.mp3')
  if (fs.existsSync(trackBPath)) {
    console.log(`  [skip] tracks/aftermath.mp3`)
  } else {
    try {
      console.log(`  Generating Track B (60s, may take 30-90s)...`)
      const audio = await generateTrackB()
      fs.writeFileSync(trackBPath, audio)
      console.log(`  -> tracks/aftermath.mp3 — ${(audio.length / 1024).toFixed(1)} KB`)
    } catch (err) {
      console.error(`  [ERROR] Track B: ${err.message}`)
    }
  }
  console.log()

  // ── 4. Synthesize Hall IR ──

  console.log('  --- Hall IR (synthesized) ---')
  const hallIRPath = path.join(outDir, 'hall-ir.wav')
  if (fs.existsSync(hallIRPath)) {
    console.log(`  [skip] hall-ir.wav`)
  } else {
    const wav = synthesizeHallIR()
    fs.writeFileSync(hallIRPath, wav)
    console.log(`  -> hall-ir.wav — ${(wav.length / 1024).toFixed(1)} KB (4s, 44.1kHz, 16-bit)`)
  }

  console.log(`\n  All done.\n`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
