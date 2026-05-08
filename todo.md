# TODO

## Asset dependencies (Phase 2 → Phase 3)

These assets are flagged as out-of-scope for Phase 2 code work but must land before the corresponding phases feel complete. We have an **ElevenLabs API key** (`VITE_ELEVENLABS_API_KEY`) — generate via Music API.

### GEMS phase excerpts (3 files, ~15s each, instrumental)

15-second excerpts that play during the Gems phase. The phase code already references these paths and now falls back to a 4s silent listening window when the file is missing — so the experience degrades gracefully until the assets land.

| Path | Duration | GEMS cluster |
|---|---|---|
| `public/gems/sublimity.mp3` | 15s | Wonder / awe / transcendence |
| `public/gems/tenderness.mp3` | 15s | Longing / nostalgia / intimacy |
| `public/gems/tension.mp3` | 15s | Defiance / unresolved / pulled-back |

### ElevenLabs Music API prompts for the GEMS excerpts

Use `POST https://api.elevenlabs.io/v1/music` with `model_id: "music_v1"`, `force_instrumental: true`, `music_length_ms: 15000`, `output_format: "mp3_44100_128"`. Each prompt follows the **6-lever recipe** from `Research/generative-music-differentiation-engines.md`: `[Genre + Sub-genre], [Tempo/BPM], [2-3 Named Instruments], [instrumental], [Mood Descriptor], [Production Era/Aesthetic]`.

**sublimity.mp3** — wonder / awe / transcendence:
```
neo-classical ambient, 50 BPM, felt piano, sustained string pad, choral wash,
instrumental, breathless wonder, 2020s ECM-style sparse production with deep
reverb tail, no percussion, no vocal melody, builds gently toward an unresolved
suspension at 12s
```
Negative styles: `["aggressive percussion", "synth lead", "electronic beats", "vocals"]`

**tenderness.mp3** — longing / nostalgia / intimacy:
```
chamber folk, 65 BPM, fingerpicked nylon guitar, melodic cello, soft upright
bass, instrumental, tender longing, 1970s warm tape-saturation, intimate
close-mic'd dynamics, single guitar line carries melody, room-tone breath
between phrases
```
Negative styles: `["distortion", "drums", "synthesizer", "electric guitar"]`

**tension.mp3** — defiance / unresolved / pulled-back:
```
post-rock instrumental, 80 BPM, distorted electric guitar with palm-muted
restraint, brushed drums, low pulsing analog synth, instrumental, simmering
defiance withheld, 2000s dry-room production with no compression on transients,
crescendo never resolves, ends on a held minor-second cluster
```
Negative styles: `["bright major key", "uplifting", "vocal", "EDM drop"]`

### Spectrum v2 audio (18 files, 8s each, instrumental)

8-second clips for the 9 polar pairs along production-aesthetic axes. The pair definitions are wired in `src/lib/spectrumPairs.js` — flip the toggle once audio lands.

```
public/spectrum/v2/
  warm.mp3        cold.mp3
  dense.mp3       spare.mp3
  sung.mp3        instrumental.mp3
  analog.mp3      digital.mp3
  major.mp3       modal.mp3
  slow.mp3        mid.mp3
  driving.mp3     floating.mp3
  low.mp3         high.mp3
  reverberant.mp3 dry.mp3
```

**Activation steps once assets land:**
1. Set `ACTIVE_PAIRS = PAIRS_V2` in [src/lib/spectrumPairs.js](src/lib/spectrumPairs.js).
2. Update `src/phases/Spectrum.score.jsx` audio path construction from `/spectrum/${pair.left}.mp3` → `/spectrum/v2/${pair.left}.mp3`.

### ElevenLabs Music API prompts for Spectrum v2

Each pair's two endpoints differ only along **one orthogonal axis** — the listener is meant to feel a clean A/B contrast in the named dimension while everything else stays neutral. Use `music_length_ms: 8000`, `force_instrumental: true`. Pair the prompts in single sessions when possible to keep the model's stylistic reference stable.

**warm / cold** (V axis):
- warm: `acoustic chamber, 70 BPM, felt piano + cello, instrumental, body-warmth, 1970s tape saturation, no synthesizer, no electric instruments`
- cold: `synth ambient, 70 BPM, sine pad + glassy bell, instrumental, cool sterile beauty, 1980s digital reverb, no acoustic instruments`

**dense / spare** (D axis):
- dense: `orchestral chamber, 70 BPM, layered strings + woodwinds + harp + felt piano, instrumental, complex polyphonic texture, full ensemble production`
- spare: `solo piano, 70 BPM, single sustained note line, instrumental, radically minimal, dry-room close-mic, long silences between phrases`

**sung / instrumental** (production aesthetic):
- sung: `chamber pop, 70 BPM, soft humming melody + felt piano + acoustic bass, breathy lead vocal melody, intimate vocal-forward production`
- instrumental: `chamber instrumental, 70 BPM, felt piano + acoustic bass + soft cello, instrumental, no vocals, melodic instrumental focus`

**analog / digital** (production aesthetic):
- analog: `lo-fi indie, 70 BPM, tube-saturated electric guitar + upright bass, instrumental, 1960s tape warmth, hum + tape hiss audible, no digital reverb`
- digital: `clean electronic, 70 BPM, FM synth lead + sub bass, instrumental, pristine digital production, surgical reverb tails, no analog warmth`

**major / modal** (V axis):
- major: `acoustic folk, 70 BPM, fingerpicked guitar in C major, instrumental, bright open chords, uplifting harmonic motion`
- modal: `chamber ambient, 70 BPM, felt piano in dorian mode, instrumental, neither happy nor sad, suspended ambiguous quality`

**slow / mid** (A axis — note: spec uses "slow/mid" for arousal contrast, not "slow/fast"):
- slow: `ambient drone, 50 BPM, sustained string pad + felt piano, instrumental, contemplative meditative pace, no rhythmic pulse`
- mid: `walking groove, 90 BPM, felt piano + brushed snare + upright bass, instrumental, steady walking pulse, deliberate forward motion`

**driving / floating** (A axis × rhythmic aesthetic):
- driving: `kraut rock, 130 BPM, motorik drums + repeating bass arpeggio, instrumental, locked-in propulsive forward motion, urgent energy`
- floating: `ambient post-rock, 50 BPM, reversed guitar swells + sustained strings, instrumental, weightless suspended quality, no clear pulse`

**low / high** (register / D contrast):
- low: `chamber, 70 BPM, double bass + bass clarinet + low felt piano, instrumental, deep register focus, dark sustained low frequencies`
- high: `chamber, 70 BPM, glockenspiel + violin harmonics + flute, instrumental, bright high register focus, sparkling upper frequencies`

**reverberant / dry** (production aesthetic):
- reverberant: `chamber, 70 BPM, felt piano + cello, instrumental, cathedral-sized hall reverb, long decaying tail, distant intimate playing`
- dry: `chamber, 70 BPM, felt piano + cello, instrumental, dead-room close-mic'd, no reverb, intimate fingertip detail audible`

---

## Phase 2 follow-ups

- ✅ ~~Gems untracked timer cleanup~~ — fixed in Phase 2 polish commit. All scheduled timers go through `scheduleTimer` → tracked in `timersRef`, cleared on unmount and StrictMode re-mount.
- ✅ ~~Gems silent-listening fallback~~ — fixed in Phase 2 polish commit. Audio failure shrinks the listening window from 15s → 4s.
- **Autobio unmount abort gap** — `useEffect` cleanup clears the debounce but doesn't abort an in-flight fetch. Add `abortRef.current?.abort()` to the cleanup.
- **Phase label collision** — Moment, Autobio, and Reflection all show "v." Roman numerals. Renumber: Moment "v.", Autobio "vi.", Reflection "vii." (and Reveal "viii.").
- **`getCompositionPlan` reads `textures.preferred`** which is always `[]` after Phase 2. Either wire `gems.excerpts` (via `dominantGemsTag`) into the composition plan, or remove the textures path.
- **`itunesSearch` rate limit** (~20 req/min/IP) could matter at scale. Consider a server-side proxy or short-TTL cache in Phase 3.
- **`itunesSearch` abort test gap** — no test covers a pre-aborted signal. Add one.
- **`PAIRS_V2` slow/mid asymmetry** — copy reads strangely; consider `slow/uptempo` or `slow/fast` for clearer polarity.

---

## Phase 3 territory (next)

- ElevenLabs Admirer voice across all phases (warm intro, prompt narration). Voice: ElevenLabs Lily, four-register arc per `Research/voice-intimacy-admirer-design.md`. Use `eleven_v3` model, `voice_settings: { stability: 0.4, similarity_boost: 0.7, style: 0.6 }` for Caretaking register, `style: 0.85` for Elevated register.
- ElevenLabs Music API integration for the per-session generated track via `composition_plan` derived from `(archetype, variation, autobio.eraSummary.median, dominantGemsTag, hedonic)`.
- Generate the GEMS + Spectrum v2 assets above (one-time batch run; cache to `public/`).
- Hedonic field consumption (`Moment.hedonic`) in archetype scoring — bias toward Quiet Insurgent / Slow Glow when `hedonic === false` even with high arousal.
- Threshold rite for Phase 0 (Entry): name capture, hand-on-chest held tap (6s sustained press), two guided 6s exhales with breath ring at 5.5–6 bpm (per `Research/wait-as-ritual-ai-music-generation.md` resonance-frequency breathing).
- Server route `/api/admirer` (TTS) and `/api/compose` (Music) so the API key stays server-side.
