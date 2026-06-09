# Slice 3 — AVD → Song Routing (Design Spec)

**Date:** 2026-06-09 · **Author:** Knih + Claude · **Status:** Approved design, pre-plan.
**Program context:** Third slice of the `new-research` spec integration (memory `project_spec_integration`; roadmap in `docs/superpowers/plans/2026-06-09-spec-integration-avd-spine.md`). Slices 1–2 built the signed AVD vector and made the Admirer write it. **Slice 3 makes the matched song follow that vector** instead of the agent's free-text descriptors.

## 1. Decision & scope

"AVD → scene routing" has two possible meanings. We are doing **Option 1 (song routing)** now and deferring **Option 2 (visual back-plane scene deck)** until its 12–16 compositions exist as assets.

**In scope:** at song commit, choose the archetype by nearest AVD centroid; `era` still selects the variation; robust fallback to the legacy descriptor pick when the vector never moved.

**Deferred (Option 2):** swapping the back-plane visual between a deck of scene AVIFs by AVD — blocked on asset production (only one back-plane composition exists today). Build it deck-of-one-ready later.

**Unchanged:** the `startGeneration` tool still exists and is still the agent's "commit the song now" signal; only *how the bundle is chosen* changes. Audio continuity / StemPlayer handoff to Orchestra is untouched.

## 2. The change

Today (`src/lib/admirerTools.js`): `startGeneration(descriptors)` → `mapDescriptorsToStems(descriptors, {restricted})` → `{archetypeId, variationId, stems, masterUrl}`. The archetype comes from `descriptors.mood` (a free-text label the agent invents).

After Slice 3: the archetype comes from the **committed AVD vector**, matched against each archetype's existing `scoringWeights: {a,v,d}` centroid (the 6 archetypes already carry these). `era` (still from descriptors) picks the variation. The vector is the curatorial state the whole conversation built — it should be what chooses the music.

```
startGeneration(descriptors)   // agent's commit trigger
  → if getTurnCount() > 0:  mapAvdToStems(getAvd(), { restricted, era: descriptors.era })
    else:                   mapDescriptorsToStems(descriptors, { restricted })   // fallback
  → onStartGeneration(bundle) → StemPlayer loads silently (unchanged)
```

## 3. New pure module — `src/lib/avdToStems.js`

Mirrors `descriptorsToStems.js`'s shape so `onStartGeneration` is a drop-in (same bundle).

- **`ARCHETYPE_CENTROIDS`** — derived from `ARCHETYPES[*].scoringWeights`, mapped `[0,1] → [−1,1]` (`x*2−1`) into `{ id, anchor: [a,v,d] }` so they live in the signed spine's space.
- **`selectArchetypeByAvd(vector, { restricted })`** — filters out restricted archetype ids, then nearest-centroid via Slice 1's `selectScene(vector, eligibleCentroids, null)` (plain nearest; `null` current = no hysteresis at a one-shot commit). Returns an archetype id; falls back to `ARCHETYPES[0].id` if everything is restricted.
- **`mapAvdToStems(vector, { restricted, era })`** — `selectArchetypeByAvd` → archetype, then `pickVariationByEra(archetype, era)` → variation, then resolve `getStems`/`getMasterUrl`. Returns `{ archetypeId, variationId, stems, masterUrl }` — identical shape to `mapDescriptorsToStems`.

To DRY the variation logic, **export `pickVariationByEra` from `descriptorsToStems.js`** (currently a private helper) and import it in `avdToStems.js`.

## 4. Wiring — `src/lib/admirerTools.js`

`startGeneration` reads the live AVD vector + turn count and chooses the path:

```js
startGeneration: (descriptors = {}) => {
  const restricted = getRestricted()
  const bundle = getTurnCount() > 0
    ? mapAvdToStems(getAvd(), { restricted, era: descriptors.era })
    : mapDescriptorsToStems(descriptors, { restricted })
  cb.onStartGeneration?.(bundle)
  return { ok: true, archetypeId: bundle.archetypeId, variationId: bundle.variationId }
},
```

New imports in `admirerTools.js`: `getAvd`, `getTurnCount` from `avdStore.js`; `mapAvdToStems` from `avdToStems.js`. `mapDescriptorsToStems` stays imported (fallback path).

## 5. Design decisions (locked)

- **AVD → archetype (mood); era → variation (decade).** Orthogonal axes; the agent still passes `era`. Only the `mood → archetype` half of `descriptorsToStems` is retired; the module stays for the fallback path + its era logic.
- **Turn-count fallback.** `getTurnCount() === 0` means no answer ever committed (the vector is still neutral — possibly because the Slice 2 `recordAnswer` path was flaky). In that case use the legacy descriptor pick so song variety never regresses. Any committed turn → AVD drives it.
- **No hysteresis at commit.** Selection is a one-shot at `startGeneration`, so `selectScene` is called with `currentId = null` (plain nearest). Continuous re-routing (and hysteresis) is a later concern if song ever re-selects mid-session.

## 6. Testing

`avdToStems.js` is pure → Vitest unit tests against the **real `ARCHETYPES`** (stable data): centroid derivation (signed mapping), nearest-centroid picks for characteristic vectors (e.g. high A/V/D → sky-seeker; high-A/low-V → quiet-insurgent; near-neutral → the nearest-to-origin archetype), restricted exclusion, full-bundle shape, and `era → variation`. A focused `admirerTools` test asserts `startGeneration` uses the AVD path when `getTurnCount() > 0` and the descriptor path when it's 0. Gate: `npm test`, `npm run build`, no new lint errors.

## 7. Out of scope / follow-ons

- Option 2 (visual scene deck) — asset-blocked; later.
- Real generation (ElevenLabs Music) — still "Phase D"; we map into the 24 existing Suno tracks.
- Continuous mid-session re-routing with hysteresis — only if a future design wants the song to drift during the conversation.
