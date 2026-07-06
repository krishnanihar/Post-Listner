# Generative Music — integration notes (P1, 2026-07-06)

The generative core from the FABLE redesign plan (area 1 — "move off stems, keep
the living instrument"). Built behind a feature flag, **off by default**, so the
shipped app is byte-identical to the catalog-stem path until the flag is flipped.

## The crux, solved

A generated track is ONE mixed file — it has none of the 4 independent sources
the Orchestra pans / filters / spotlights per gesture. Instead of separating a
mix, `GenerativePlayer` **splits** it: a single looped `BufferSourceNode` runs
through a 4-band Linkwitz-Riley crossover (`src/orchestra/spectralBands.js`) at
120 / 800 / 3500 Hz, producing 4 band outputs that present the *exact same*
`detachAndGetSources()` contract `OrchestraEngine.connectStems` expects:

| Band | Register | Orchestra slot |
|---|---|---|
| bass | sub / bass | BASS (right lateral) |
| drums | low-mid body / rhythm | DRUMS (left lateral) |
| vocals | lead / melody presence | VOCALS (front) |
| other | air / cymbals / space | OTHER (behind) |

Because all 4 bands derive from one source they are **perfectly sample-aligned
by construction** — a stronger guarantee than the 4-stem invariant it replaces.
Every conducting behavior (yaw spotlight, tilt pan, conducting filter, downbeat
spike, dynamics) operates on these bands unchanged, so the Orchestra stays a
living, conductable instrument. The engine swaps its per-slot gain table
(`BAND_GAIN_COMP` vs `STEM_GAIN_COMP`) via `OrchestraEngine.setSourceMode('bands')`.

## The seam, unchanged in shape

The Act1→Act2 handoff is the same choreography, new player:

```
Act 1 (Admirer)                         Act 2 (Orchestra)
  era-commit → startGenerativeTrack()     handoff = revealAudioRef.current
    → generateMusicTrack(prompt)          if handoff.detachAndGetSources:  ← duck-typed
    → GenerativePlayer.load()               engine.setSourceMode(handoff.sourceMode)
    → start() SILENT                        sources = handoff.detachAndGetSources()
  bloom → generated player WINS if ready    engine.connectStems(sources)
          (else catalog fallback)           songDuration = handoff.duration ?? max(buffers)
```

**Fallback is by construction.** The speculative catalog `StemPlayer` still loads
at the Rise beat exactly as before. At bloom, the generated player only wins if
it resolved within `GEN_BLOOM_WAIT_MS` (4s); otherwise the catalog player is the
handoff. The sacred seam never waits on the network.

## Files

- `src/orchestra/spectralBands.js` — the 4-band Linkwitz-Riley splitter (pure graph builder).
- `src/lib/generativePlayer.js` — StemPlayer-shaped player over one generated mix + RMS loudness normalization.
- `src/lib/avdToPlan.js` — `(a,v,d)` + faced archetype + era → `buildPrompt` (the runtime path for
  `music_v2`) + `buildCompositionPlan` (snake_case schema, `music_v1`-only, kept for that path).
- `src/engine/elevenlabs.js` — `generateMusicTrack(prompt|plan)` → posts to `/api/music`. Mock mode preserved.

**API facts (verified live 2026-07-06):** `music_v2` **rejects composition plans** (422 "Invalid type
of composition_plan") — plans are `music_v1`-only, so the runtime uses **v2 + prompt**.
`/music/separate-stems` **404s** — no API stem path exists, confirming the client-side 4-band split is
the only route. A 210 s track generates in ~20 s at ~187 kbps; spike tracks:
`tmp/music-spike/v2-{calm-deep,bright-high,melancholic}.mp3`.
- `api/music.js` — server-side proxy (keeps `ELEVENLABS_API_KEY` off the client; `maxDuration: 60`).
- `src/lib/musicGen.js` — orchestration + the `LIVE_MUSIC_GEN_ENABLED` flag + bloom wait constant.
- `src/orchestra/OrchestraEngine.js` — `setSourceMode()` + `_gainComp`.
- `src/phases/{Admirer,Orchestra}.jsx` — era-commit trigger, winner/loser bloom + cleanup, duck-typed handoff.

## Activation (the spend-gated steps — user's call)

1. **Run the capability spike** (real paid calls, ~$1.65 for 3 tracks):
   ```
   node scripts/spike-music-v2.mjs        # MODEL=music_v1 to fall back
   ```
   Confirms `music_v2` + prompt works on this account, generates 3
   AVD-keyed tracks to `tmp/music-spike/v2-*.mp3`, and re-probes
   `/music/separate-stems`. **(Already run 2026-07-06 — tracks on disk, passed.)**
2. **Listen** to `tmp/music-spike/v2-*.mp3` — musical quality is the go/no-go gate.
3. **Enable the flag** in `.env.local` (and Vercel Production env):
   ```
   VITE_ENABLE_LIVE_MUSIC_GEN=true
   # optional overrides:
   # VITE_MUSIC_MODEL_ID=music_v2
   # VITE_MOCK_MUSIC=true      ← exercises the whole seam with a silent track, no spend
   ```
4. **On-device pass** (required — jsdom/DevTools can't synthesize gesture): run the
   full 8-beat arc with the flag on, confirm the generated track blooms into the
   Orchestra unbroken and conducts (spotlight/tilt/downbeat on the 4 bands). Then
   run a forced-fallback pass (airplane-mode right after the era beat) to prove the
   catalog fallback still hands off cleanly.

## Cost & guardrails

- ~$0.55 per generated 3:30 track. One live call per session, fired at era-commit.
- Generate-ahead (not blocking): ~18–21s generation is covered by the reflect
  beat + bloom + Briefing (12s) + Bloom (24s). Bloom waits at most 4s before
  choosing the catalog fallback.
- The archive keeps the generated audio locally (planned P1.8 — not yet wired);
  the desktop-journal detail view streams from R2 and will show no audio for
  generated sessions until an upload path exists (accepted post-ship gap).

## Not yet built (follow-on from the FABLE plan)

- P1.8 — persist the generated ArrayBuffer into the IndexedDB archive.
- P2 — on-device band-mode tuning (spotlight dB, per-band reverb, width on the AIR band).
- P3–P6 — teach→use articulation, intro build, voice arc, UI cohesion (separate tracks).
