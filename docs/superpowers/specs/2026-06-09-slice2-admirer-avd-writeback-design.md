# Slice 2 — Admirer → AVD Writeback (Design Spec)

**Date:** 2026-06-09 · **Author:** Knih (M.Des, NID) + Claude · **Status:** Approved design, pre-plan.
**Program context:** Second slice of the `new-research` spec integration (see `docs/superpowers/plans/2026-06-09-spec-integration-avd-spine.md` and memory `project_spec_integration`). Slice 1 built the continuous signed AVD vector `(a,v,d) ∈ [−1,+1]³`, bound it to the three-plane shader, and shipped `avdStore.commitTurn`/`selectScene` (built, untested-in-production until now). **Slice 2 makes the Admirer conversation write that vector.**

---

## 1. Goal

Migrate the Admirer from an autonomous question-asker to the spec's **authored-seed + LLM-re-voice** model (Option B), and turn every answer into AVD movement, so the three-plane visuals respond to the conversation in real time. Stays **entirely on the ElevenLabs Conversational AI (Agents) platform** — no raw TTS/STT.

Thesis stake: the questions' semantic + poetic core must be authored by Knih; the agent's LLM is a tailor (re-voicing) and a reader (texture classification), never a writer of questions.

## 2. The conversation loop

```
client selects next seed  (by session #, year-tier, least-resolved AVD axis)
  → nextQuestion tool returns the authored seed text + a callback hint
  → agent re-voices it (pronouns / callback / transition only) and speaks it
  → user answers by voice (existing SDK mic / push-to-talk path)
  → agent calls recordAnswer({ seedId, texture, intensity, rationale })
  → client: target = blend(textureAVD, seedIntent); commitTurn(target, {confidence, gain})
  → AVD vector moves → three-plane shader responds (Slice 1, already wired)
```

The autonomous agent is reduced to two jobs it does reliably — **speak what it's handed** and **classify what it hears** — both via the existing client-tool mechanism (`playFragment`, `startGeneration` already work this way).

## 3. ElevenLabs interaction — two client tools

### `nextQuestion` (client-owned content + ordering)
- **Blocking** client tool (`expects_response: true`, like `playFragment`).
- Agent system prompt: *"You never invent questions. Each turn call `nextQuestion`; it returns an authored line. Speak that line adapted only for pronouns, a callback, or a transition — never change its meaning. Then listen."*
- Host callback `onNextQuestion()` runs `selectNextSeed(...)`, marks the seed asked, returns `{ text, callbackHint, seedId, kind }`.
- For **selection seeds** (tap-to-choose), the returned payload includes `options`; the client renders tap buttons (reuse the `FragmentControls` pattern). The tap is handled entirely **client-side** — the host computes `observed = option.avd` and runs the blend → `commitTurn` directly, bypassing the agent's `recordAnswer` (no texture classification needed). The agent is told a selection seed is awaiting a tap and should stay silent until it resolves.

### `recordAnswer` (agent-owned classification)
- Non-blocking client tool the agent calls after each spoken answer.
- Args: `{ seedId, texture: 'calm'|'sharp'|'melancholic'|'exalted', intensity: number /*0..1*/, rationale: string }` — exactly the spec's structured texture judgment, produced by the agent's own LLM (no separate classifier).
- Host callback `onRecordAnswer(args)`: compute the AVD target and call `commitTurn`.

### Reliability spike (first build task)
Confirm the agent reliably asks the `nextQuestion`-returned line, in order, without improvising, on the live agent's model (`gemini-2.5-flash-lite`). If it drifts: firm up the prompt, or move classification to a server call (`recordAnswer` fallback). The architecture is unchanged either way.

## 4. The seed deck (`questionSeeds.js`)

Seeds are **data** (freely editable; tests use fixtures, not the real wording). Each seed:

```js
{
  id: 'locate-arousal',
  kind: 'biography' | 'locate' | 'selection' | 'closing',
  text: 'Do you want something that moves you, or something that stays still with you?',
  probes: 'A' | 'V' | 'D' | null,     // which axis the answer should resolve
  intent: { a: 0, v: 0, d: 0 },        // small directional bias of the question itself
  gain: 0.8,                            // step multiplier (locate 0.8, arrival/biography 0.3)
  sessionScope: 'first' | 'always',     // 'first' = session 1 only (biography)
  tier: 1 | 3,                          // 3 = unlocks only at year-tier 3
  options?: [{ label: 'amber', avd: { a: -0.3, v: 0.6, d: 0 } }, ...] // selection seeds only
}
```

**Biography (sessionScope: 'first', gain 0.3) — spec verbatim, settled:**
1. "What is a piece of music that has stayed with you?"
2. "When did you last listen to it on purpose?"
3. "What were you doing when it first found you?"

**Locate (sessionScope: 'always', gain 0.8) — DRAFT, Knih to revise:**
| id | text | probes |
|---|---|---|
| `locate-arrival` | "What's around you, right now?" | null (gain 0.3 — observe) |
| `locate-arousal` | "Do you want something that moves you, or something that stays still with you?" | A |
| `locate-valence` | "Is today asking you to lift, or to be held?" | V |
| `locate-depth` | "Should this keep you company, or take you somewhere you haven't been?" | D |
| `locate-color` (selection) | "If this evening were a color — amber, slate, rose, or ink?" | — (options carry AVD) |
| `locate-quiet` | "Where does your mind go when the room gets quiet?" | V/D |

**Closing (kind: 'closing', no AVD):** "I won't tell you what this was. That's yours."

Selection options for `locate-color` (DRAFT AVD nudges): amber `{a:-0.3,v:0.6,d:0}`, slate `{a:-0.4,v:-0.4,d:0.4}`, rose `{a:0,v:0.5,d:0.2}`, ink `{a:0.1,v:-0.1,d:0.7}`.

## 5. Texture → AVD math (`textureToAvd.js`, pure)

Texture base vectors (signed, from Admirer spec §3.3):

| texture | a | v | d |
|---|---|---|---|
| calm | −0.5 | +0.6 | 0.0 |
| sharp | +0.6 | −0.5 | −0.2 |
| melancholic | −0.4 | −0.5 | +0.6 |
| exalted | +0.6 | +0.6 | +0.6 |

- `textureToTarget(texture, intensity)` → base × `clamp(intensity,0,1)` per axis (a weak answer moves less).
- `blendTarget(observed, intent, alpha = 0.6)` → `alpha·observed + (1−alpha)·intent` per axis (read-trust α=0.6 from spec §3.2: weight the observed answer over the question's intent).
- For selection seeds the chosen option's `avd` **is** `observed` (skip texture classification).

## 6. AVD step (extend Slice 1 `avdStore.commitTurn`)

`commitTurn` gains an options arg, defaulting to current behavior so Slice 1 tests stay green:

```js
commitTurn(target, { confidence = 1, gain = 1 } = {})
```

Effective step scales the existing η schedule: `step = etaForTurn(turn) × clamp(confidence,0,1) × gain`, applied per axis (depth still ×0.6). This reconciles the two specs: **Slice 1's η-EWMA is the step; the Admirer spec's α-blend sets the target; confidence + seed-gain scale the step** (arrival/biography turns observe more than they steer at gain 0.3; an uncertain classification at low intensity moves less). Implementation: add an internal `ewmaStepScaled(current, target, turnIndex, factor)` in `avdRuntime.js` where `factor = confidence × gain`, or fold the factor into `ewmaStep`. Clamp to [−1,1] as before.

## 7. Seed selection (`seedSelection.js`, pure)

`selectNextSeed({ vector, askedIds, sessionCount, yearTier, deck })`:
1. Eligibility: `sessionScope === 'always'` always eligible; `'first'` only when `sessionCount === 0` (first session); `tier === 3` only when `yearTier >= 3`; exclude `askedIds`; exclude `kind: 'closing'`.
2. On the **first session**, biography seeds come first (in order) before locate seeds.
3. Among eligible locate seeds, pick the one whose `probes` axis has the smallest `|vector[axis]|` (least-resolved axis first); `probes: null` (arrival) is asked first if unasked; ties broken by deck order.
4. Returns the seed, or `null` when the per-session locate budget (~3) is exhausted → the host then proceeds to the listening run / `startGeneration` as today.

`yearTier` from a new `sessionStore.getYearTier()`: `3` when `sessionCount >= 24 && daysSinceFirst >= 180`, else `1` (matches Ship-Blockers §1).

## 8. Host wiring (`Admirer.jsx`, `admirerTools.js`)

- `buildAdmirerTools` gains `nextQuestion` + `recordAnswer`; existing tools unchanged.
- `Admirer.jsx`: `onNextQuestion` (select + track askedIds + return text), `onRecordAnswer` (classify→blend→`commitTurn`). Per-session askedIds + turn budget held in a ref. Reset `avdStore` on Admirer mount (the scene already resets; the phase owns the session, so reset here too — idempotent).
- Selection seeds reuse the `FragmentControls` tap UI for option buttons.
- Agent config: rewrite `SYSTEM_PROMPT` in `scripts/create-admirer-agent.js` to the re-voicer role + the two tools; re-run `scripts/update-admirer-agent.js`; mirror in `docs/admirer-agent-dashboard.md`.

## 9. Scope

**In Slice 2:** authored seed deck; client-driven selection; `nextQuestion`/`recordAnswer` tools; texture→AVD blend; `commitTurn` extension; longitudinal awareness (session-1 biography, no re-greet, year-tier gating of eligibility); the reliability spike.

**Explicitly deferred:**
- **Song/scene selection by AVD** — stays on the existing `startGeneration → descriptorsToStems` path; AVD→scene-deck routing is **Slice 3**.
- **Year-3 scene pools + new Y3 seeds' content** — Slice 2 only honors the `tier` gate; the Y3 visuals are Slice 3/5.
- **Orchestra-as-session-1**, Bilderatlas, IndexedDB archive — Slices 4–5.
- **Server-side Scribe v2 STT** — only as the spike's fallback; default reuses the SDK's transcript path.

## 10. Testing posture

Pure modules (`questionSeeds` helpers, `textureToAvd`, `seedSelection`, the `commitTurn` extension) get Vitest unit tests using **fixture decks** so the real seed wording stays freely editable. The agent/tool glue and the prompt are verified by the spike + manual conversation, consistent with the repo's "shader/agent glue isn't unit-tested" posture. Gate: `npm test` (no regressions), `npm run build`, no new lint errors.
