# 5-Minute Phase — Enhancement Plan

A tiered recommendation list for enhancing the 5-minute taste-extraction phase
(Phases 0–5). Synthesised from the internal research files and 2025–2026
literature.

**Sources consulted**: [5-minute-taste-extraction redesign.md](./%205-minute-taste-extraction%20redesign.md),
[taste-extraction-postlistener-orchestra.md](./taste-extraction-postlistener-orchestra.md),
[stealable-techniques-feeling-seen.md](./stealable-techniques-feeling-seen.md),
[voice-intimacy-admirer-design.md](./voice-intimacy-admirer-design.md),
[Designing Ego-Feeding-Then-Dissolving Experiences.md](./Designing%20Ego-Feeding-Then-Dissolving%20Experiences.md),
plus 2025–2026 web literature on placebo AI, pairwise audio elicitation,
reminiscence bump, GEMS-9, and Suno V5.5 (citations at end).

---

## What's already built (status check)

| Phase | Built | Notes |
|---|---|---|
| 0 Threshold | Name capture, hand-on-chest text, 6s breath × 2, threshold statement | No audio drone, no held-tap commitment |
| 1 Spectrum (Pairwise) | 9 word-pairs + waveforms (port from v2), tap-to-commit, log-RT confidence weighting | Audio pending; no operational-transparency comments |
| 2 Emotion (GEMS) | 3 excerpts × 6 tiles, 6s tile fade (full-width), mid-set Forer probe | Audio pending |
| 3 Carry | 3 Rathbone prompts + iTunes Search autocomplete + year metadata | No era contextualisation feedback |
| 4 Moment | Tap-rhythm BPM + Hurley liking probe, visible tap zone, radial pulse | No equivoque framing |
| 5 Mirror | Archetype + variation + 5 Forer lines + latency line + time-of-day line + name-personalised close + pair residue | No reflection screen, no causal attribution, no song memory callback |
| Scoring | 6×4 archetype/variation grid, ε-greedy variation pick, log-RT confidence weighting | Adaptive pair selection not implemented |

---

## The single biggest gap

**A reflection screen between Phase 4 and Phase 5.**

The [stealable-techniques](./stealable-techniques-feeling-seen.md) file calls
this *"PostListener's single most important design element — it is where the
'being seen' feeling is manufactured."* Replika, ChatGPT, Midjourney, and
Stanford's Riff chatbot all do it. We currently go straight from tapping →
archetype reveal with no visible bridge — user choices vanish into a black box.

What it should do: render *each user input* alongside its interpreted meaning.

> *Your tap tempo of 87 BPM suggested a contemplative pace.*
> *Your choice of WARMTH over SHADOW in 6 of 9 pairs pointed toward acoustic timbres.*
> *Your three songs averaged 1998 — your formative years.*

Then dissolve into the Mirror.

---

## Tier 1 — Pre-audio quick wins

| # | Item | Effort | Impact |
|---|---|---|---|
| 1 | **Reflection screen** between Phase 4 and Phase 5 | ~30 min | Highest |
| 2 | **Memory callback** — Mirror references one Phase 3 song specifically | ~15 min | Highest |
| 3 | **"Because you…" causal attribution** band before Forer | ~20 min | High |
| 4 | **Operational transparency comment** mid-Phase 1 | ~25 min | High |
| 5 | **Phase 3 era contextualisation** (bump period detection) | ~30 min | High |

### 1. Reflection screen (NEW PHASE 4.5)
Per [stealable-techniques §Reflection](./stealable-techniques-feeling-seen.md).
Insert a 12–16s phase between Moment and Mirror. For each captured signal:
- Pair commits → directional summary ("you chose warmth, density, presence")
- Tile selection → emotional vocabulary ("nostalgia, defiance, peace")
- Three songs → era summary + one named song
- Tap tempo + liking → tempo-class + receptiveness
Format: line-by-line ink-on-cream score-paper aesthetic. Soft fade-in, then
fade-out into Mirror's stage-1 reveal.

### 2. Memory callback in Mirror
Replika pattern, [stealable-techniques §Replika](./stealable-techniques-feeling-seen.md).
We already store `songs[]` and `songYears[]`. Pick the song with the strongest
archetype match (era + emotion fit) and surface as a Mirror line:
> *When you said {song} from {year}, I knew.*
Place between latency line and "I have something for you."

### 3. "Because you…" causal attribution
Pandora "Why This Song" + Netflix "because you watched" pattern.
[stealable-techniques §Pandora, §Netflix](./stealable-techniques-feeling-seen.md).
Insert between divider and Forer paragraphs:
> *because you chose warmth · because you tapped slow · because you carried 1998*

### 4. Operational transparency in Phase 1
[Memo §Phase 1](./%205-minute-taste-extraction%20redesign.md) specifies a
single Admirer line between pairs 3–6. Currently absent. Compute a directional
tally (warm/dense/sung axes) and surface one comment after pair 4:
> *you're choosing the warmer ones — interesting*

### 5. Phase 3 era contextualisation
Krumhansl & Zupnick 2013 + 2025 lifespan study (1891 participants, 84 countries)
confirm the bump is robust. When user's three years span their teens, surface:
> *three songs from your bump period — that means something*
Cascading bump if years cluster ~25 years before user's age. Free uncanny signal.

---

## Tier 2 — Pre-audio richer additions

| # | Item | Effort | Impact |
|---|---|---|---|
| 6 | Implicit-signal expansion (hover-then-cancel as conflict marker) | ~30 min | Medium |
| 7 | Daylist-style microgenre on variation tags | ~45 min | Medium |
| 8 | Temporal uniqueness frame in Reveal | ~10 min | Medium |
| 9 | Audience-sized holes in Mirror typography | ~60 min | Medium |
| 10 | Phase 0 hand-on-chest as held-tap (6s sustained press) | ~30 min | Medium |

### 6. Implicit-signal expansion
[Orchestra memo §2](./taste-extraction-postlistener-orchestra.md) (Stillman 2018,
2020): long dwell ≠ preference strength — it's *conflict*. Currently we weight
log-RT in scoring. Add hover-without-commit as a separate "considered but
rejected" signal. Useful for variation tie-breaking.

### 7. Daylist-style microgenre
Currently variations are clean (`2010s · Lo-fi piano`). Daylist's research-
validated move ([stealable-techniques §Daylist](./stealable-techniques-feeling-seen.md))
is *playful insider-y specificity*:
- `2010s · lo-fi piano for cab rides home`
- `1980s · synth-melancholy for the kitchen at midnight`
- `1970s · ECM jazz piano for unfinished conversations`
The label becomes the shareable artifact.

### 8. Temporal uniqueness frame in Reveal
> *Composed at 11:47 PM on April 27, 2026. For Krishna. Has never existed before.*
Mubert / generative-AI move per techniques file. Concrete and free.

### 9. Audience-sized holes in Mirror
DARKFIELD's 750k-participant principle. One Forer paragraph deliberately
incomplete — `"There is a song you've never told anyone about. ___"` — forces
self-projection. Apply per archetype.

### 10. Phase 0 hand-on-chest as held-tap
Currently text instruction only. Convert breath ring to a held-tap target (6s
sustained press) — actual motor commitment, not just guidance. Sleep No More's
mask analogue per [redesign memo §Phase 0](./%205-minute-taste-extraction%20redesign.md).

---

## Tier 3 — Bigger structural / research-extended

| # | Item | Effort | Notes |
|---|---|---|---|
| 11 | Active-learning Phase 1 (adaptive pair selection) | ~4 hr | Salem 2025, Nguyen 2024 |
| 12 | Suno V5.5–style passive layer alongside the active rite | ~4 hr | Industry validation 2026 |
| 13 | EMMA database for Phase 2 audio (when audio arrives) | depends | 2025 dataset, GEMS-9 rated |
| 14 | The 2×2 actually × told thesis pilot | research design | The orchestra memo's open empirical contribution |

### 11. Active-learning Phase 1
Salem et al. 2025 + 2025 systematic review of audio preference learning confirm
pairwise + adaptive selection is more sample-efficient than fixed order.
Currently 9 fixed pairs. Adaptive: compute next pair based on which axis still
has highest variance in user evidence. Could cut to 6 pairs at same signal.

### 12. Passive layer alongside active rite
Suno V5.5's "My Taste" (March 2026) is *passive* — learns from behaviour over
time. Our 5-min phase is *active*. Adding ambient signal capture during Phases
1–4 (skip rate, tile-add latency, song-typing speed, hover paths) builds a
passive layer the Mirror can reference:
> *I noticed how you typed that third song — slowly, like you were testing whether to give it to me.*
Uncanny payoff with no extra UI.

### 13. EMMA database for Phase 2
2025 dataset: 817 music excerpts × 7 genres pre-rated on GEMS-9. Removes the
"we need to source GEMS-aligned excerpts" problem when the audio layer lands.

### 14. 2×2 actually × told pilot (thesis-defence move)
[Orchestra memo §3](./taste-extraction-postlistener-orchestra.md):
> *I could not locate a published 2×2 'actually personalized × told personalized'
> study in AI-generated music — this is an open empirical gap and a defensible
> novel contribution for the thesis.*

Conditions:
- (i) full-ritual full-personalisation (own profile rendered)
- (ii) full-ritual told-personalised but actually-shuffled (other participant's profile)
- (iii) full-ritual perturbed (own profile + AVD noise ±0.15, below the 0.2 audibility threshold)

Outcome: felt-for-me (P1) > (P2), p<.05 on n≈30/condition.

---

## Tier 4 — Voice + audio (the next phase)

| # | Item | API | Notes |
|---|---|---|---|
| 15 | **Admirer voice across phases** | ElevenLabs TTS `eleven_v3` | Three registers per [voice-intimacy](./voice-intimacy-admirer-design.md) |
| 16 | **Phase 1 audio clips** (9 pairs × 2 = 18 clips × 8s) | ElevenLabs Music `prompt` | Production-aesthetic axes |
| 17 | **Phase 2 GEMS excerpts** (3 × 15s) | EMMA database OR Music API | Pre-rated GEMS-9 stimuli |
| 18 | **Phase 0 60Hz drone** | Static asset (or Music API low-pass synth) | Bernardi 2006 |
| 19 | **Phase 5 sub-audible track fade-up** | Music API `composition_plan` | Begin matched track fade during Forer |
| 20 | **Generated track via Music API** | ElevenLabs Music `composition_plan` | Variation tag → 16-min composition plan |

### ElevenLabs API integration spec

#### Music API (`POST /v1/music`)
- **Endpoint**: `https://api.elevenlabs.io/v1/music`
- **Auth**: `xi-api-key` header
- **Request body**:
  - `prompt` (string) **OR** `composition_plan` (structured) — mutually exclusive
  - `music_length_ms` (3000–600000) — only with `prompt`
  - `model_id` ("music_v1" — currently the only option)
  - `force_instrumental` (bool) — `prompt`-only
  - `seed` (int) — reproducibility
- **Output query param**: `output_format=mp3_44100_128` (or `wav`, `pcm_48000`, `opus_48000_192`)
- **Response**: binary audio stream (`application/octet-stream`)
- **Composition plan shape** (for the 16-min orchestra arc):
  ```ts
  {
    positive_global_styles: string[],   // ["ambient", "neo-classical", "felt piano"]
    negative_global_styles: string[],   // ["aggressive percussion"]
    sections: [{
      section_name: string,             // "intro", "build", "climax"
      positive_local_styles: string[],
      negative_local_styles: string[],
      duration_ms: number,              // 3000–120000 per section
      lines: string[],                  // optional lyrics (≤200 chars/line)
    }]
  }
  ```
- **Plan endpoint** (`POST /v1/music/plan`): generate a composition plan from a
  prompt. **Free** — does not cost credits. Useful for a two-step pipeline:
  (1) generate plan from variation/Forer signal, (2) audit plan, (3) compose.

#### TTS API (`POST /v1/text-to-speech/{voice_id}`)
- **Endpoint**: `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
- **Auth**: `xi-api-key` header
- **Models (2026)**:
  - `eleven_v3` — most expressive; intimate/emotional; 5k char limit; **recommended for Admirer voice**
  - `eleven_multilingual_v2` — high-fidelity emotional; 10k char limit
  - `eleven_flash_v2_5` — ~75ms latency; 50% cheaper; conversational
- **Body**:
  - `text` (string, required)
  - `model_id` (default `eleven_multilingual_v2`; we want `eleven_v3`)
  - `voice_settings`: `{ stability, similarity_boost, style, speed, use_speaker_boost }`
  - `previous_text` / `next_text` for cross-line continuity
  - `seed` for deterministic output
- **Output**: `mp3_44100_128` default; `pcm_48000` for low-latency streaming
- **Streaming**: WebSocket available; REST streaming TTFB ~478ms; WebSocket ~711ms
- **Voice ID for Admirer**: pick from voice library; recommend a warm female
  voice tuned with `stability: 0.4, similarity_boost: 0.7, style: 0.6` for the
  Caretaking register and `style: 0.85` for the Elevated register.

#### Pricing (subscription credits)
- TTS: ~$0.06/1k chars (Flash) to ~$0.12/1k chars (v3 / Multilingual)
- Music: billed per generation (exact rate depends on plan tier)
- Composition-plan generation: **free**

#### Architecture sketch for the build
1. **Server route**: `src/app/api/admirer/route.ts` — POST `{ text, register }`
   → calls `POST /v1/text-to-speech/{voiceId}` with register-mapped
   voice_settings → returns audio stream.
2. **Server route**: `src/app/api/compose/route.ts` — POST `{ archetypeId,
   variationId, durationMs, name }` → builds composition_plan from variation
   metadata + Forer-derived sections → calls `POST /v1/music` → returns audio
   URL.
3. **Client cache**: pre-generate Phase 1 (18 clips), Phase 2 (3 excerpts),
   Phase 0 drone at build/seed time — store in `public/audio/`. Only the Phase
   5 final track is generated per-session.
4. **Admirer voice**: streamed at runtime per phase trigger; cached by `text`
   hash for deterministic replay.
5. **Env**: `ELEVENLABS_API_KEY` in `.env.local`, never sent to client.

---

## Sequencing recommendation

**Order:** Tier 1 (≈2hrs) → Tier 4 (audio) → Tier 2 → Tier 3.

The reflection screen (#1) multiplies the felt-personalisation payoff of every
phase that follows, including the audio + voice work in Tier 4. Memory callback
(#2) is dependent on Phase 3 being complete (already true) and pays off the
biggest investment the user makes in the rite.

The 2×2 pilot (#14) is the strategic move that turns PostListener from a
prototype into a thesis contribution.

---

## Cited 2025–2026 literature

- Kosch, Welsch, Chuang & Schmidt (2023). *The Placebo Effect of AI in HCI*. ACM ToCHI 29:56.
- Kloft et al. (2024). *The Placebo Effect is Robust to Negative Descriptions of AI*. CHI '24.
- Salem et al. (2025). *Pairwise and Attribute-Aware Decision Tree-Based Preference Elicitation*. arXiv:2510.27342.
- *Preference-Based Learning in Audio Applications: A Systematic Analysis* (2010–2025). arXiv:2511.13936.
- Just Ask for Music — multimodal personalised music recommendation. RecSys 2025.
- Suno V5.5 release (March 2026). Voices · My Taste · Custom Models.
- Memory bumps across the lifespan in personally meaningful music (2025). N=1891, 84 countries. *Memory*.
- Music-evoked autobiographical memories in healthy aging (2025). *Musicae Scientiae*.
- Popular music and movies as autobiographical memory cues (2025). *Memory & Cognition*.
- Jacobsen, Strauss, Vigl, Zangerle & Zentner (2025). *Assessing aesthetic music-evoked emotions in a minute or less: GEMS-45 vs GEMS-9*. *Musicae Scientiae*.
- *EMMA Database* (2025) — 817 excerpts × 7 genres rated on GEMS-9.
