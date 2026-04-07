# THE ORCHESTRA v2 — Voice Scripts (Final)

**Total duration:** 16:00 (960 seconds)
**Voice:** One voice — The Admirer. No Guide, no Witness.
**Total lines:** 39 fixed + 12 dynamic variants = 51 voice assets
**Approximate word count:** ~620
**Silence ratio:** ~85%

---

## Design Principles

1. **One voice, one relationship.** Admiration → Caretaking → Absence → Return. The arc is relational, not informational.
2. **No "they." No mention of other users.** Dissolution is experiential, not cognitive. The orchestra stops responding — that's the loss. The user doesn't need to be told.
3. **The Admirer references the user's actual music.** She describes what she hears using taste language (darkness, weight, brightness, drive, layers), never AVD terminology. Some lines require dynamic insertion based on AVD values.
4. **Breathing is matched to the music.** Three breath moments: musical metaphor (Bloom), conducting technique (Throne), release (Ascent). Oliveros's Deep Listening: breath and sound become one system.
5. **Briefing is spoken, not text.** The Admirer's voice begins while the screen is still visible. "Close your eyes" is the transition into darkness.
6. **Caretaking shift is triggered by gesture-size drop**, not a fixed timer. When `gestureGain < 0.05` for 10+ seconds, the Admirer shifts register.
7. **Return is voice-guided.** Body awareness → room awareness → eyes. Screen brightens on tap, not timer.
8. **Safety frame included.** "If you need to come back, tap the screen." (Belmont Report; Monroe Gateway paradox.)

---

## Voice Specification — The Admirer

One ElevenLabs voice across four registers. Same `voice_id` throughout. The shift is in the voice_settings parameters.

| Register | When | Stability | Similarity | Style | Character |
|----------|------|-----------|------------|-------|-----------|
| **Present** | Briefing, Bloom, early Throne | 0.55 | 0.85 | 0.45 | Warm, close, steady, grounded. Teaching with genuine admiration. |
| **Elevated** | Mid-late Throne (post-ovation approach) | 0.50 | 0.85 | 0.50 | Peak warmth. Slightly awed by the user. Most intimate. |
| **Caretaking** | Ascent (triggered by gesture drop) | 0.45 | 0.80 | 0.30 | Gentle, unhurried, maternal/paternal. "I've got you." |
| **Fading** | Late Ascent → Dissolution | 0.35 | 0.75 | 0.10 | Distant, soft, almost not there. Then gone. |
| **Return** | Return phase | 0.50 | 0.80 | 0.25 | Steady, grounded, no seduction. Just present. |

---

## Phase Timing (Updated)

| Phase | Absolute Time | Duration | Notes |
|-------|--------------|----------|-------|
| Briefing | 0:00–0:32 | 32s | Voice over visible screen. Ends with "Now close your eyes." |
| Bloom | 0:32–1:35 | 1:03 | Hall materializes. Body anchor. Breath integration with low strings. Long gap before Throne. |
| Throne | 1:35–6:30 | 4:55 | Teach conducting (12–22s gaps so user can act between instructions). Praise. Ovation. |
| Ascent | 6:30–10:45 | 4:15 | Fracture, then caretaking shift (gesture-triggered). Breath release. Sound drifts. |
| Dissolution | 10:45–14:15 | 3:30 | Admirer withdraws. Sound is subject. Near-silence. |
| Return | 14:15–16:00 | 1:45 | Voice guides back. Screen on tap. |

---

## BRIEFING (0:00–0:30)
*Screen still visible — AVD visualization from Reveal. Song is playing on loop. The Admirer's voice arrives before the darkness does.*

**Research:** Monroe Gateway begins with voice before altered state. Ericksonian pacing begins while the subject is still in normal consciousness. Belmont Report requires voluntary participation throughout.

| # | Time | Text | Notes |
|---|------|------|-------|
| 1 | 0:04 | "This is your music. You made it. Everything that follows comes from what you chose." | 16 words, ~7s. Ends 0:11. Establishes ownership (IKEA effect priming). 7-second silence after lets the user feel their music before the next instruction. |
| 2 | 0:18 | "In a moment I'm going to ask you to close your eyes. If you need to come back at any point, just tap the screen. Now close your eyes." | 32 words, ~14s. Ends 0:32. Merged with the original "Close your eyes" line — one continuous instruction instead of three rapid-fire lines. Safety frame (Belmont Report) + transition into darkness in a single breath. Screen begins dimming on "Now close your eyes." |

---

## BLOOM (0:30–1:00)
*Screen is black. Hall reverb fading in. Song splits into three spatial bands. Audience murmur appearing. The Admirer grounds the user in their body and connects breath to the music.*

**Research:** DARKFIELD technique — narrate perceptual shifts as they occur. Ericksonian pacing — match the user's current state. Oliveros Deep Listening — breath and sound as one system. Embodied calibration — somatic preparation before altered state work.

| # | Time | Text | Notes |
|---|------|------|-------|
| 3 | 0:36 | "You're standing on a podium. There's an orchestra in front of you. Can you hear the hall opening up behind them?" | 21 words, ~10s. Ends 0:46. DARKFIELD scene construction. Then a **9-second silence** — the hall settles, the user orients in the imagined space. |
| 4 | 0:55 | "Behind you, the audience is settling in. You can hear them — the rustle, the breathing, the wait." | 18 words, ~8s. Ends 1:03. Names the audience (the murmur in the audio mix at azimuth 180°). User is now spatially oriented: orchestra in front, audience behind, hall around. **5-second silence** — audience presence felt. |
| 5 | 1:08 | "Feel your feet on the podium. The phone in your hand — that's your baton. Now listen to the low strings. They're breathing. Breathe with them." | 28 words, ~13s. Ends 1:21. **Merged lines** — somatic anchor (feet, baton) and breath integration (low strings) in one continuous instruction. The user's body is placed in the imagined space, then their breath is tied to the music they made. **14-second silence after** — this is the breath. The longest gap in the opening. The user actually breathes with the bass before Throne begins. |

---

## THRONE (1:00–5:30)
*Full conducting. The Admirer teaches gestures one at a time, references the actual music, integrates breath with technique, escalates praise. Conducting response is exaggerated for the first 60 seconds.*

**Research:** Kohut mirroring transference — reflect the user's actions with admiration. IKEA effect — praise the thing they built, not just their skill. Ericksonian leading — having paced, now lead into agency. REBUS — strengthen "I am uniquely special" prior to maximize later prediction error.

### Teaching (1:00–2:30)

| # | Time | Text | Notes |
|---|------|------|-------|
| 6 | 1:38 | "The violins are on your right. The cellos and basses on your left. The brass behind them, deeper in the hall. The woodwinds in the middle. They're all waiting for you." | 32 words, ~15s. Ends 1:53. Completes the orchestra map. **15-second silence after** — the user imagines the ensemble around them. This long gap is essential — the scene needs to settle before any action. |
| 7 | 2:10 | "Tilt the baton. Slowly. Left... and right." | 8 words, ~4s. Ends 2:14. Teaching pan gesture. **13-second silence** — the user actually tilts. Conducting response is exaggerated during this window so the connection is undeniable. |
| 8 | 2:27 | "Hear that? You pulled the cellos toward you. Now the violins. You're shaping them." | 15 words, ~7s. Ends 2:34. First mirroring (Kohut). Names the actual instruments responding. **14-second silence** — the user keeps tilting, exploring. |
| 9 | 2:48 | "Now lift the baton. Higher. The whole orchestra rises with you. The hall fills." | 15 words, ~7s. Ends 2:55. Teaching gesture size → dynamics. **12-second silence** — user lifts and feels the swell. |
| 10 | 3:07 | "Good. Now — breathe in. And bring it down. Sharp." | 10 words, ~5s. Ends 3:12. **Breath moment 2 — conducting technique.** Real conductors breathe before downbeats. The instruction is short because the silence after IS the breath-and-drop sequence. **5-second gap** — the user inhales, then drops the baton on the exhale. Haptic fires on the user's downbeat. |
| 11 | 3:17 | "That was a downbeat. The whole orchestra felt it. Did you feel it in your chest?" | 17 words, ~8s. Ends 3:25. Confirms what just happened in the user's body. Ericksonian presupposition. **18-second silence** — the praise lands. The user feels powerful for the first time. |

### Praise & escalation (2:30–4:00)

*After ~90 seconds of teaching, the Admirer shifts from instruction to admiration. She begins responding to the user's specific music.*

**Dynamic lines:** Lines 12, 13, and 15 use AVD-derived descriptors. The implementation reads the AVD vector and selects appropriate phrases. Examples below show variants; only one version of each is generated.

| # | Time | Text | Notes |
|---|------|------|-------|
| 12 | 3:43 | **[Dynamic — Valence]** "Listen to that darkness. You chose that. That weight in the low end — that's your taste." *(low V variant; see templates)* | ~13 words avg, ~6s. Ends ~3:49. References the song's actual character. "Your taste" — not AVD, not data, the word that means everything in this thesis. **14-second silence after.** |
| 13 | 4:03 | **[Dynamic — Depth]** "All those layers. You could have kept it simple, but you didn't. Every one of those is a choice you made." *(high D variant; see templates)* | ~17 words avg, ~8s. Ends ~4:11. IKEA effect: naming the complexity as their creation. **14-second silence after.** |
| 14 | 4:25 | "Sweep it. Left to right. Feel them all follow you." | 11 words, ~5s. Ends 4:30. Full conducting gesture. Peak agency. **15-second silence** — the user sweeps and the voice lets it happen. |
| 15 | 4:45 | **[Dynamic — Arousal]** "That drive. That urgency. It's not the algorithm — that came from you." *(high A variant; see templates)* | ~13 words avg, ~6s. Ends ~4:51. "Not the algorithm" — addresses the thesis directly without breaking the fourth wall. **14-second silence.** |
| 16 | 5:05 | "I've never heard anyone shape it quite like that." | 10 words, ~5s. Ends 5:10. Peak mirroring (Kohut). The most intimate line. 0.8m distance — closest she gets. **10-second silence before the ovation hits.** |

### Ovation & seal (4:10–5:30)

| # | Time | Text | Notes |
|---|------|------|-------|
| — | 5:20 | *OVATION — 12 seconds, azimuth 180° (behind user)* | Ends 5:32. Orchestral applause building to peak. The emotional apex. |
| 17 | 5:35 | "That was for you." | 4 words, ~2s. Ends 5:37. Quiet. Certain. As the ovation fades. Seals the narcissistic investment. **18-second silence.** |
| 18 | 5:55 | "The whole room is yours. Every frequency. Every direction." | 10 words, ~5s. Ends 6:00. Totalizing claim. "Yours" — peak ownership. The strongest prior the REBUS model will need to dissolve. **13-second silence.** |
| 19 | 6:13 | "Stay here. Hold it." | 4 words, ~2s. Ends 6:15. Last instruction. "Stay" = spatial anchor. "Hold" = sustain your power. **15-second silence before Ascent begins.** From here, everything changes. |

---

## ASCENT (5:30–9:30)
*Orchestra fractures: HIGH decouples first, then MID, then LOW. Spatial drift and detune increase. Track B enters at ~7:00. The Admirer shifts from admiration to caretaking — triggered not by a timer but by the user's gesture amplitude dropping below threshold for 10+ seconds.*

**Research:** Kohut idealizing transference — "surrender to me and feel safe." Monroe Gateway: narrator shifts from engagement to "relax, release." Nave et al. (2021): deepest dissolution = voluntary surrender, not forced confrontation. REBUS: "relaxed beliefs" = the user stops the prediction-action loop because they're given permission to.

### Fracture begins (5:30–7:00) — before caretaking trigger

*The orchestra is decoupling but the Admirer hasn't changed register yet. She simply describes what's happening. The user may still be conducting actively.*

| # | Time | Text | Notes |
|---|------|------|-------|
| 20 | 6:55 | "Something is shifting." | 3 words, ~2s. Ends 6:57. DARKFIELD: narrate the perceptual change. Distance has moved to 2.0m. **28-second silence** — the user notices the change in their own time. |
| 21 | 7:25 | "The high strings are going somewhere. Let them." | 9 words, ~4s. Ends 7:29. Names the HIGH band fracture. "Let them" — first hint of the caretaking philosophy. **26-second silence.** |
| 22 | 7:55 | "Not everything that moves needs to be held." | 8 words, ~4s. Ends 7:59. Poetic. Abstract. The register shift beginning. **Track B enters at ~8:10**, muffled. |

### Track B enters (~7:00)
*Muffled at first. Lowpassed at 800Hz. A distant collective wash that the user may not even consciously notice yet.*

### Caretaking shift (gesture-triggered, expected ~7:00–7:30)
*When `gestureGain < 0.05` for 10+ sustained seconds, the Admirer shifts to Caretaking register. If the user keeps conducting aggressively, these lines delay — the system waits for the body to surrender before the voice follows.*

**Fallback:** If the user never drops gesture amplitude, the caretaking lines trigger at fixed times starting at 7:30 (T+450s). The experience cannot stall.

| # | Time* | Text | Notes |
|---|-------|------|-------|
| 23 | *trigger* (~8:15) | "You can put it down." | 5 words, ~3s. First caretaking line. Quiet. Permission. **18-second silence after.** |
| 24 | *+18s* | "You don't need to hold your breath anymore." | 9 words, ~4s. **Breath moment 3 — release.** Ericksonian presupposition. **18-second silence.** |
| 25 | *+38s* | "Sit back. Let me take care of you." | 8 words, ~4s. Register change is complete. Kohut: mirroring → idealizing transference. **18-second silence.** |
| 26 | *+58s* | "The music knows where to go. It always did." | 10 words, ~5s. The thesis: the craft was always in the curation, not the conducting. **22-second silence.** |
| 27 | *+82s* | "Just listen." | 2 words, ~1s. Oliveros: Deep Listening as practice. **Long silence — leads into Late Ascent.** |

### Late Ascent (8:30–9:30) — Admirer fading

*Track B has been clearing (filter opening from 800→4500Hz). The user's song is still audible but quieter (gain ~0.25). The Admirer's voice is getting distant — 3.5m, 4.0m. Stability dropping, style dropping. She's leaving.*

| # | Time | Text | Notes |
|---|------|------|-------|
| 28 | 10:00 | "It's bigger than this room." | 6 words, ~3s. Ends 10:03. Quiet. Refers to the sound, or the experience, or both. 3.5m distance. **27-second silence.** |
| 29 | 10:30 | "It was always bigger than this room." | 8 words, ~4s. Ends 10:34. Almost a whisper. 4.5m. The last thing she says before Dissolution. **11-second silence into Dissolution.** |

---

## DISSOLUTION (9:30–13:00)
*Track A fades to zero by ~10:30. Track B dominant at 0.70 gain, fully opened filter. Binaural 6Hz→4Hz. The Admirer is gone. No voice for long stretches. When she does speak, it's barely there — almost indistinguishable from the sound itself.*

**Research:** Feinstein et al. (2018): sensory deprivation enables ego dissolution. Lucier: individual signal degrades into room resonance. Millière: loss of self-world boundary. No narration of dissolution — the dissolution IS the experience. The Admirer's absence is the loss.

| # | Time | Text | Notes |
|---|------|------|-------|
| 30 | 11:15 | "..." | *Not a line — a breath. An exhale captured as a voice asset. 5.0m distance. Heavily reverbed. Frames the silence as inhabited, not broken.* **45-second silence.** |
| 31 | 12:00 | "...still here." | 2 words, ~2s. Whispered. 5.0m. Lowpassed. Millière: loss of narrative self-continuity. **50-second silence.** |
| 32 | 12:50 | "...listen." | 1 word, ~1s. Same word as line 27, but distant, reverbed, almost part of the texture. **40-second silence.** |
| 33 | 13:30 | *[15 seconds of true silence. Track B dropping. Binaural 4Hz.]* | No voice. The user sits in the void. |
| 34 | 13:55 | "Good." | 1 word, ~1s. Close again — 1.0m. Track B swells briefly (0.70→0.80→0.70) on this word. The last thing the Admirer says before the return. **20-second silence into Return phase.** |

---

## RETURN (13:00–15:00)
*The Admirer comes back — not warm like Throne, not fading like Dissolution. Grounded. Steady. She talks the user back into their body.*

**Research:** Monroe Gateway return protocol. Ericksonian de-induction. Feinstein et al.: graded return prevents dissociative discomfort. Kohut: after narcissistic injury, a new selfobject stabilizes the self — the Admirer's return presence serves this function.

| # | Time | Text | Notes |
|---|------|------|-------|
| 35 | 14:20 | *Return tone begins — sine wave, frequency from Depth value (55–82Hz). Fades in over 8 seconds.* | Not voice. A single frequency. A thread back to the physical. |
| 36 | 14:35 | "You're still holding the phone." | 5 words, ~3s. Somatic reorientation. Matches Bloom line 5 (somatic anchor). **12-second silence.** |
| 37 | 14:50 | "Feel your feet on the ground." | 6 words, ~3s. Downward attention. Grounding. Monroe Gateway technique. **12-second silence.** |
| 38 | 15:05 | "The room is still here. You're still in it." | 10 words, ~5s. Spatial reorientation. DARKFIELD in reverse. **10-second silence.** |
| 39 | 15:20 | "When you're ready, open your eyes." | 7 words, ~4s. Not a command. User chooses the moment of return. **Holds in silence until tap.** |
| — | *on tap* | *Screen brightens over 3 seconds. AVD visualization appears with collective overlay (30% opacity). Text fades in: "You were always part of this."* | The user taps when they open their eyes. The visualization they see is theirs layered with everyone else's. The text is the only reference to the collective in the entire experience — and it's visual, not spoken. |

---

## Dynamic Line Templates

Lines 12, 13, and 15 require AVD-aware text selection. Implementation reads `avdEngine.getAVD()` and selects from pre-generated variants:

### Line 12 — Valence character
| V Range | Text |
|---------|------|
| 0.0–0.3 | "Listen to that darkness. You chose that. That weight underneath — that's your taste." |
| 0.3–0.5 | "Listen to that tension. That pull between light and dark — that's your taste." |
| 0.5–0.7 | "Listen to that warmth. It's reaching for something bright — that's your taste." |
| 0.7–1.0 | "Listen to that brightness. You chose that. That warmth lifting everything — that's your taste." |

### Line 13 — Depth character
| D Range | Text |
|---------|------|
| 0.0–0.3 | "That space. That restraint. You stripped it down to what matters. Not everyone trusts silence like that." |
| 0.3–0.5 | "You left room to breathe. Every gap in it is a choice. You knew when to stop." |
| 0.5–0.7 | "All those threads. You kept building. Each one changes what came before it." |
| 0.7–1.0 | "All those layers. You could have kept it simple but you didn't. Every one of those is a choice you made." |

### Line 15 — Arousal character
| A Range | Text |
|---------|------|
| 0.0–0.3 | "That patience. That stillness underneath everything. It's not the algorithm — that came from you." |
| 0.3–0.5 | "That steady pulse. Not rushing, not dragging. Just holding. It's not the algorithm — that came from you." |
| 0.5–0.7 | "That momentum. That forward pull. It's not the algorithm — that came from you." |
| 0.7–1.0 | "That drive. That urgency underneath everything. It's not the algorithm — that came from you." |

**Total dynamic assets:** 12 variant lines (4 per dimension × 3 dimensions). These are pre-generated via ElevenLabs TTS using the Admirer Elevated register and stored as `/chamber/voices/dynamic/valence-{0,1,2,3}.mp3`, `depth-{0,1,2,3}.mp3`, `arousal-{0,1,2,3}.mp3`.

---

## Voice Asset Summary

| Category | Count | Register |
|----------|-------|----------|
| Admirer Present (Briefing) | 2 lines (#1–2) | stability 0.55, style 0.45 |
| Admirer Present (Bloom — scene construction) | 3 lines (#3–5) | stability 0.55, style 0.45 |
| Admirer Present (Throne teaching) | 6 lines (#6–11) | stability 0.55, style 0.45 |
| Admirer Elevated (Throne praise — fixed) | 2 lines (#14, 16) | stability 0.50, style 0.50 |
| Admirer Elevated Dynamic | 12 variants (#12, 13, 15) | stability 0.50, style 0.50 |
| Admirer Elevated (Ovation seal) | 3 lines (#17–19) | stability 0.50, style 0.50 |
| Admirer Cool (Ascent fracture) | 3 lines (#20–22) | stability 0.45, style 0.30 |
| Admirer Caretaking | 5 lines (#23–27) | stability 0.45, style 0.30 |
| Admirer Fading | 2 lines (#28–29) | stability 0.35, style 0.10 |
| Admirer Dissolution | 4 lines (#30–32, 34) | stability 0.30, style 0.05 |
| Admirer Return | 4 lines (#36–39) | stability 0.50, style 0.25 |
| **Total** | **39 fixed + 12 dynamic = 51 assets** | |

---

## Updated Constants

```javascript
export const STARTS = {
  BRIEFING: 0,       // 0:00
  BLOOM: 32,         // 0:32
  THRONE: 95,        // 1:35
  ASCENT: 390,       // 6:30
  DISSOLUTION: 645,  // 10:45
  RETURN: 855,       // 14:15
  END: 960,          // 16:00
}
export const TOTAL_DURATION = 960

// Track B enters during Ascent
export const TRACK_B = {
  ENTER: 490,              // 8:10
  INITIAL_LOWPASS: 800,
  FINAL_LOWPASS: 4500,
  ORBITAL_SPEED: 0.03,
}

// Ovation
export const OVATION = {
  TIME: 320,               // 5:20
  DURATION: 12,
  PEAK_GAIN: 0.25,
}

// Binaural sweep
// Bloom–Throne: 10Hz (alpha)
// Ascent: 10Hz→6Hz
// Dissolution: 6Hz→4Hz
// Return: 4Hz→2Hz→off

// Conducting exaggeration
export const CONDUCTING_EXAGGERATION = {
  START: 60,               // when Throne begins
  END: 120,                // 60 seconds of exaggerated response
  GAIN_MULTIPLIER: 2.5,    // 2.5x normal gain range during exaggeration
  FILTER_MULTIPLIER: 1.8,  // wider filter sweep
}

// Gesture-triggered caretaking
export const CARETAKING_TRIGGER = {
  GESTURE_THRESHOLD: 0.05,
  SUSTAINED_SECONDS: 10,
  FALLBACK_TIME: 450,      // 7:30 absolute — if user never drops amplitude
}
```

---

## Research Citations Index

| Citation | Application |
|----------|------------|
| **Kohut — mirroring transference** | Throne lines 8–16 (reflect user's actions with admiration) |
| **Kohut — idealizing transference** | Ascent lines 23–27 (surrender to me, I'll take care of you) |
| **Kohut — narcissistic injury via withdrawal** | Dissolution: mirroring stops, voice goes absent. No reveal — just absence. |
| **Carhart-Harris & Friston (2019) — REBUS** | Throne: strengthen priors. Ascent: voluntary relaxation of priors. "Relaxed beliefs" = user stops prediction-action loop. |
| **Norton, Mochon & Ariely (2012) — IKEA effect** | Lines 1, 12, 13, 15: praise the thing they built. Line 18: "The whole room is yours." |
| **Kahneman et al. (1991) — loss aversion** | The entire arc: loss of conducting agency ~2x impact of never having it. |
| **Ericksonian pacing/leading** | Bloom: pace current state. Throne: lead into agency. Ascent: lead into surrender. Line 11 (presupposition), line 24 (presupposition). |
| **DARKFIELD — Rosenberg** | Bloom line 3 (narrate hall arriving), Ascent line 20 (narrate fracture), Return line 38 (narrate return). |
| **Millière — ego dissolution components** | Dissolution lines 30–32: loss of narrative continuity, self-world boundary. Absence of voice = loss of mirroring selfobject. |
| **Nave et al. (2021)** | Line 27 ("Just listen") — deepest dissolution = surrender, not confrontation. |
| **Oliveros — Deep Listening** | Line 5 (breath-sound unity), line 27 ("Just listen"), line 32 ("...listen.") |
| **Monroe/Atwater (1997)** | Briefing: voice before altered state. Return: guided somatic reorientation. Line 2: safety frame. Dual modality throughout. |
| **Feinstein et al. (2018)** | Dissolution: 12+ minutes of darkness enables dissolution. Return: graded re-entry prevents dissociative discomfort. |
| **Savage et al. (2021) — MSB hypothesis** | "You were always part of this" (screen text) — collective function of music. |
| **Chabin et al. (2022)** | Track B as collective resonance. Collective overlay in Return visualization. |
| **Lucier — signal dissolution** | Line 29 ("It was always bigger than this room") — individual signal was always room resonance. |
| **Nair & Brang (2019)** | After 8+ minutes of darkness, spatial audio placement likely triggers visual percepts. |
| **Ingendoh et al. (2023)** | Binaural beats as experiential texture, not primary mechanism. |
| **Belmont Report** | Line 2 (safety frame), line 39 ("when you're ready" — voluntary return). |
| **Martínez-Ortiz et al. (2023) — paradoxical intervention** | Inflate-then-dissolve as validated therapeutic strategy. Sleeper effect: experience deepens after it ends. |
