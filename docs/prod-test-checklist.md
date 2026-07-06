# PostListener — Prod Test Checklist (2026-07-06 redesign batch)

Test on a **real phone with headphones** (the gesture arc + spatial audio can't be
judged on desktop). Walk the whole arc twice: once with generative music **on**,
once forced to the **catalog fallback**.

---

## 0. Pre-flight (do first)

- [ ] **Vercel env:** set `VITE_ENABLE_LIVE_MUSIC_GEN=true` on the **Production**
      environment (this is the switch that turns on generated music). `ELEVENLABS_API_KEY`
      is already set. Optional: `VITE_MUSIC_MODEL_ID=music_v2` (default), `VITE_MOCK_MUSIC=true`
      to dry-run the seam with a silent track (no spend).
- [ ] **Redeploy** after setting the env var (Vercel inlines `VITE_` vars at build time).
- [ ] Confirm the build is the latest commit and the R2 catalog URLs still resolve
      (`VITE_STEMS_BASE_URL` / `VITE_MASTERS_BASE_URL`).

## 1. Entry / intro  *(area 3)*

- [ ] Tap **begin** → you hear the **threshold swell** build under the intro (not
      near-silence), layered over the low drone. It **fades out** cleanly into the
      Admirer's arrival (no abrupt cut, no lingering bed).
- [ ] iOS: both the motion AND orientation permission prompts appear on the begin tap.
- [ ] Name capture works; returning users see "welcome back, <name>".

## 2. The Attunement Room — 8 beats  *(areas 2, 5)*

- [ ] **arrival** — footsteps walk up, then the paced 3-segment welcome plays; advances into leanLift.
- [ ] **leanLift** (roll) — tilt left/right; cursor tracks, **commits on a brink-crossing**, re-poles for
      the 2nd sub-round. Confirm the commit *feel* is unchanged (this beat was refactored to a shared hook).
- [ ] **listen** (pitch) — tilt fwd/back; same brink-commit + re-pole, 2 sub-rounds. Feel unchanged.
- [ ] **rise** (energy + strike) — meter climbs with bigger moves; **strike down** to seal.
      **NEW: a sharp strike cuts a bigger/brighter ring; a soft strike a gentler one** (articulation teaching).
      Copy reads "a sharp strike cuts, a soft one swells…".
- [ ] **face** (yaw) — turn to a world; strike to choose.
- [ ] **era** — search a song; pick a year. **NEW: the gesture→typing switch fades in gently** (no hard jump).
- [ ] **reflect** — the mirror + reading narration plays.
- [ ] No beat ever dead-ends: if you deny motion permission or don't move, each beat safety-nets forward within ~20s.

## 3. Bloom handoff — the sacred seam  *(must be unbroken)*

- [ ] At bloom the amber ring expands and the music **materializes without a gap** — the track you'll conduct
      is already playing, continues unbroken into the Orchestra. **This is the #1 thing to confirm.**

## 4. Orchestra / conducting  *(areas 2, 4)*

- [ ] After "tap to begin" + the 12s briefing, the room blooms in (reverb + audience swell).
- [ ] **NEW — Throne feedback glyph:** a faint amber dot tracks your gesture (tilt L/R moves it, tilt fwd/back
      moves it up/down), **swells with bigger moves**, and **rings out on each downbeat strike**. Confirm it makes
      your motion feel *attached* to the sound.
- [ ] **Conducting responds** on all axes: roll pans the soundstage + spotlights, pitch filters brightness,
      big moves swell dynamics, a strike gives a gain+transient+haptic pulse, sharp gestures add a bright Q-spike.
- [ ] **NEW — spatial width:** the "behind/air" material (pads/cymbals/space) reads **wide**, not a single point.
- [ ] Song plays to the end → 4s fade → closing card → returns home.
- [ ] **Background the app mid-song** for ~10s, return: it does **not** prematurely end/fade (audio-clock fix).

## 5. Settle  *(voice arc)*

- [ ] **NEW:** the closing card now **speaks a warm closing line** ("that's the shape of it, for now…") ~0.7s
      after it appears (it was silent before). Days-of-practice line still shows.

## 6. Generative music — flag ON  *(area 1 — the headline)*

- [ ] The song is **generated for this session** (not one of the 24 catalog tracks) — it should feel keyed to the
      world you faced + the mood you leaned. Generation fires at the **era** beat; by bloom it's ready.
- [ ] It's still a **living instrument** — the 4 conducting behaviors work on it (it's split into 4 spatial bands
      client-side). It must **not** feel like flat playback.
- [ ] Loudness feels consistent with the catalog (RMS-normalized).
- [ ] **Forced-fallback run:** turn on **airplane mode right after the `era` beat** (kills generation) → confirm the
      **catalog track still blooms in unbroken** (the speculative preload is the safety net; the seam never blocks).
- [ ] Do a few sessions back-to-back (return-to-entry loop) → no audio artifacts, no stuck/looping ghost audio,
      no growing memory (the orphan-leak + blob-revoke fixes).

## 7. Regression — flag OFF  *(prove nothing broke)*

- [ ] With `VITE_ENABLE_LIVE_MUSIC_GEN` unset/false, the app runs the **exact prior catalog-stem experience** —
      byte-identical path (already adversarially verified, but confirm on device).

## 8. Cross-cutting

- [ ] **prefers-reduced-motion** on: the Throne glyph softens (no downbeat rings, gentler swell); essential
      conducting motion still works.
- [ ] Headphones vs speaker: spatial externalization is obvious on headphones.
- [ ] **Desktop journal** (QR-paired): a rite still writes an entry. Known gap: a *generated* session shows no
      playable audio in the journal detail view (the raw track is kept locally, not uploaded to R2 — post-ship).

---

### What changed in this batch (so you know what to scrutinize)
Generative music core (`music_v2`+prompt, 4-band split, flag-gated) · Throne feedback glyph · OTHER-slot stereo
width · brink-slider hook dedup (LeanLift/Listen) · EraSearch fade · articulation teaching in Rise · Settle
closing voice · entry threshold SFX · session-record `mode` + local generated-audio persistence.

### Spend note
Flag ON = ~$0.55 of ElevenLabs generation **per session** (one live call at the era beat). Fine for testing;
decide before wide release whether every prod session should generate or only some.
