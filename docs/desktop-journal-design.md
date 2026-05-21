# PostListener — Desktop Journal & Collective: Design Doc

*Status: design, agreed via brainstorm 2026-05-21. Branch: `musicking`. This doc is the spec the desktop is built from; build happens in slices (§12).*

---

## 1. What the desktop is

The desktop is the **journal** — PostListener's "past tense" surface (spec Part 3). The phone *makes* entries; the desktop is where the accumulated record **lives** and is browsed across weeks, months, and years. It is the place the longitudinal artifact actually becomes visible.

**Main purpose.** The journal is a *self-addressed documentary* — a place a person goes to see **who was I, and who am I becoming**, through the accumulation of their musical sessions. It is for the self, not an audience.

**Anti-patterns — what it must never become** (research-grounded; see Dear Data, Jonathan Harris's *Cowbird*, Day One's "On This Day", and Spotify Wrapped as the thing to define against):

- No metrics — no counts, no streaks, no progress bars.
- No calendar grid — a month with 2 filled cells reads as 28 failures; the practice is irregular by design.
- No "year in review", no ranked "your top X", no shareable performance cards. The journal is a calm room, not a stage.

---

## 2. Architecture

- **The desktop is home.** The user has an **account** and signs in **on the desktop**.
- **The phone is a baton.** It scans the QR; the QR carries the session ID **plus** the identity of whoever is signed in on that desktop. The phone never authenticates — it inherits identity for the session.
- **A backend** holds accounts + entries. It is also what makes the collective layer (§7) possible.
- **Two desktop modes**, gated on whether the signed-in account has entries:
  - **First-timer** (0 entries) — QR only, plus one line naming the promise.
  - **Returning** — the journal (the book), the collective (the sky), and a QR to begin again.

**Deferred, by decision:** mobile sign-in — i.e. starting a solo phone rite with *no* desktop present. It is purely additive and requires zero rework of anything in this doc. Not in scope now.

Routing today ([main.jsx](../src/main.jsx#L20)): desktop with no `?s=` → `Desktop` (the auth-gated desktop root). This becomes: desktop → auth check → signed-out → sign-in; signed-in + 0 entries → first-timer; signed-in + entries → the journal. The live-mirror states (`StageCosmos`) still apply *during* a rite.

---

## 3. The journey

**First-timer, signed in, zero entries.** We do *not* show an empty journal. The desktop shows the QR and one honest line: *"Each session leaves one mark. In time, this becomes the trace of you."* → scan → conduct on the phone → **the desktop is the live mirror** during the rite (the existing [StageCosmos](../src/phases/StageCosmos.jsx) cosmos) → session settles → the desktop lands on a journal holding exactly **one entry, rendered large and ceremonial**, with a faint forward line: *"this is where your record begins."*

**Returning, signed in.** The journal (the book) is already there. The QR sits ready to begin again. Occasionally a gentle, dismissible *"a year ago today"* card surfaces one past entry. → scan → conduct → live mirror → settle → back to the book, the new entry settling in as the newest page.

---

## 4. The journal — "the book"

The journal's form is a **hybrid**: a *book to live in* (calm, legible, the everyday) + a *sky to step under* (the collective, §7). The book is a **literal 3D book** — the antique-book model the user supplied (§10).

**Page-turn as navigation.** Browsing the journal = turning pages. The interaction, per the agreed choreography:

> **click "next" → the screen fades/dims + the camera eases back → the page turns → the camera eases in + the fade lifts.**

That fade in the middle does real work: **it is the cover for swapping page content.** While the screen is dimmed, the next entry is rendered onto the page texture; the user only ever sees a page turn and new content arrive.

This solves scaling. The model has 34 physical pages, but the journal must hold hundreds of entries over years. We keep only ~4–6 pages "live" with real content near the current spread and **swap content underneath the fade** — so a finite book holds an infinite journal.

**Deep navigation.** Page-turn is for *nearby* entries. For jumping across a long record, a quiet **chapter index** (by season / year) is available — a marginal rail, never a calendar grid. Entry rendering is **adaptive**: when the record is sparse (1–3 entries) each page is large and generously spaced — the sparseness reads as a spacious beginning, not emptiness; when dense, the rhythm tightens so a year is scannable.

**Empty / first state.** Covered in §3 — never an empty book; route the first-timer into their first session, then open the book on entry #1 alone.

---

## 5. The entry detail view

Opening a single entry (a page brought to full attention) is a calm, full-attention room:

- The **glyph re-animates** — its ink trail re-draws, the gesture *re-performed* rather than shown static.
- The **music replays** — streamed from R2 (the entry stores its song reference). Audio is the strongest memory trigger, so this is central, not a buried control.
- The **summary** sits as an italic-serif caption, given room — a line of memoir.
- Date and time-of-day in the margin, faint. Prev/next to drift to neighboring sessions. No chrome.

This is "re-hear your first entry and hear who you were" (spec 5.6) made literal.

---

## 6. The entry data model

One **entry** = the record of one session. Deliberately lean — a mark, a time, a song, a sentence. No mood labels, no metrics.

| Field | Source |
|---|---|
| `id`, `timestamp` | session settle time — the desktop knows it |
| `glyph` | the desktop already receives the live gesture stream over the relay; it records the full path. Combined with the per-user seed (§8) this is a replayable, re-animatable mark. |
| `song` | archetype + variation ID — so the music re-streams from R2 ([stemsCatalog.js](../src/lib/stemsCatalog.js)). **Relayed from the phone.** |
| `summary` | the Admirer's one-line `commitEntry` sentence. **Relayed from the phone.** |

**The one piece of relay plumbing required.** The glyph the desktop captures for free (it already streams gestures). But `song` and `summary` are not currently relayed — the phone must send those two at session end. This is ~10 lines in [relayProtocol.js](../src/lib/relayProtocol.js) — pure plumbing, **not** the parked mobile experience. It is unavoidable: the desktop cannot record an entry it was never told about.

> **Slice 3 update.** The glyph is *not* accumulated by the desktop from the
> live gesture stream (the original sketch above). Instead the phone records
> the Orchestra conducting path, distils it (`distillGlyph`), and relays the
> finished `{song, summary, glyph}` in one `entry` message at settle; the
> desktop writes the row. This survives 4 minutes of relay loss as a single
> retryable send rather than 14k streamed frames. See the Slice 3 spec §7.

---

## 7. The collective — "the sky"

The collective layer (spec 5.5) restores the feeling that you are not alone in this practice — **without a single social mechanic**. No following, no comments, no feed. Other people are atmosphere, never affordances. You are one quiet light among many.

**Built on Mapbox.** The spec calls the collective "a global map view" with "location coarsened" — so it is geographic, and Mapbox is the right engine.

- **Fully custom style.** Default Mapbox (roads, labels, POIs, borders) would shatter the aesthetic. We build a custom Mapbox Studio style that strips *everything*: landmasses as the faintest ink forms over a void ocean. The result reads as **Earth at night** — dark, with amber lights where people are.
- **Globe projection.** A slowly turning dark globe with warm glyph-lights scattered across it *is* "the sky."
- **Emergent pattern for free.** The spec's "designed though no bird designs it" comes automatically from real geography — lights cluster where people live, like Strava's global heatmap. No need to fake emergence.
- **Privacy by construction.** Location is coarsened to a city/region grid — never exact GPS. There is a hard zoom floor so no single foreign glyph is ever individually resolvable.
- **Finding yourself.** Your own glyphs glow warm and are isolable (the Strava personal-layer pattern); everyone else's are a cooler, faint wash. Three states: *mine* / *the field* / *both*.

**The rise transition.** Journal → collective is **one continuous gesture**, not a tab switch: *"rise to the field."* The book recedes, the cream paper darkens, and the user finds their own warm cluster of lights inside the collective sky. This reuses the project's own `INTIMATE ↔ EXPANDED` interpolation pattern from [roomPresets.js](../src/lib/roomPresets.js) / `AdmirerRoom`. The zoom-out *is* the meaning — you watch yourself become one light among many.

---

## 8. The glyph — the hand

Each session's glyph must be unique, yet a person's own glyphs over time must look like **one person's handwriting**. Two-tier generation:

- **Per-user seed** — derived from the account identity, hashed via the existing [textHash.js](../src/lib/textHash.js) (FNV-1a). Fixes the "hand": ink hue band, stroke-weight envelope, taper character, curvature temperament. Constant across all of one user's entries.
- **Per-session data** — the recorded gesture path. Makes each mark unique.

Because every user's glyphs share a hand, a cluster of one person's marks reads as a constellation with its own character — which is how you find yourself in the collective field (§7).

---

## 9. Visual language

- **Film-grain is the connective tissue** — continuous across every state, so it always feels like one world.
- The two existing themes become **two ends of one transition**: cream-paper = the intimate book; dark-celestial-amber = the expanded collective. This is the `INTIMATE ↔ EXPANDED` interpolation, applied to the whole desktop.
- **Ink and light modeled as physical processes** — bleed, dry, glow, falloff. Not computed-looking; natural.
- **No chart furniture** — no axes, no legends, no numbers. Light does the work: glow = scale, warmth = self, faintness = distance.
- Typography stays in the cream-paper register — italic serif, Roman numerals, restrained. The dark sky uses text very sparingly.

---

## 10. The 3D book model — technical notes

The user supplied an animated antique-book GLB (free model, licensing cleared) and opened it in Blender 5.1.1 with the MCP connected. Inspection findings:

**Structure** — `Sketchfab_model → root → GLTF_SceneRootNode`, holding:
- **34 pages** — pivot empties `paper_39`, `paper.001_40` … `paper.033_72`, each with a flat-plane mesh child (`Object_10`…`Object_76`, 84 verts / 82 polys each, ~2.27 × 3.20 units, single `UVMap`, shared `material_0`).
- **2 covers** — `cover-r_35`→`Object_6`, `cover-l_36`→`Object_8`.
- **1 spine** — `pine_34`→`Object_4`.
- **~2,850 triangles total** — featherweight.

**Animation** — one baked action ("Animation", frames 1–160, 24fps, slotted per-object): a full **open → page-riffle → close** cycle. Every part has location + rotation_quaternion keyed. Each page sits on its own spine hinge — **independently controllable**.

**Materials** — 9 materials, 3 embedded textures (`Image_0` 1024² handwritten-text page, `Image_1` 128² cover, `Image_2` 1024²). `Dots Stroke` is an unused Blender default.

### Blender re-skin work (via MCP)

- **Pages** — drop the handwritten-text texture; normalize each page's UV so a 0–1 texture maps cleanly to the page rectangle (the dynamic-content surface). The live content itself is done in code (below).
- **Cover** — re-skin to the agreed **middle path**: keep the *sense of age and preciousness* — a worn cloth/leather cover, softly debossed, a single small mark — but drop the busy Victorian ornament. Bridges "an artifact you return to across years" with the restrained cream aesthetic.
- **Materials** — replace with the cream-paper / ink palette; soft warm lighting; remove the unused `Dots Stroke`.
- **Keep** the page-hinge rig. **Keep / trim** the baked animation as a reference for natural page-turn easing — and optionally retain frames ~1–80 ("the book opens") as the journal's entry flourish.
- Re-export as GLB.

### Runtime approach (React + R3F)

- A new R3F scene on the journal route. Load the GLB with drei `useGLTF`.
- **Procedural page turns** — drive each page pivot's hinge rotation in code (resting on the right stack → flipped to the left), with our own easing synced to the fade/zoom. We do *not* use the baked clip for turns; it is reference only.
- **Dynamic page content** — each live page gets a material with a `CanvasTexture` / render target onto which the real entry (glyph + date + summary) is drawn; swapped under the fade.
- **The choreography** — click next → overlay fade + camera ease-back → swap page texture → procedural page-turn → camera ease-in + fade lift.
- Note: this reintroduces a WebGL/R3F context on the desktop (the `/conduct-glb` route was deliberately 2D-canvas for perf). That is intentional and acceptable for the hero book; the Mapbox sky is also WebGL. The desktop has two WebGL surfaces and transitions between them.

---

## 11. Backend

New for this project — the codebase currently has no database or auth (only Vercel functions, Cloudflare R2, and the Cloudflare Workers relay).

- **Auth** — desktop sign-in only. Provider/method (email magic-link vs. OAuth) is an open question (§13); favor low friction — a signup wall must never precede a first session.
- **Storage** — accounts + entries. An entry is small (§6): the glyph is a serialized point path, plus IDs and a string. The collective query is "all glyphs near a coarsened location."
- **Fit with the stack** — Vercel (functions) + Cloudflare are already in use; the database choice should stay in that orbit (e.g. a serverless Postgres or Cloudflare D1). Decided at build time, §13.
- The collective layer reads anonymized glyphs across all accounts — the backend's other job.

---

## 12. Build sequence (slices)

Front-loads the visually motivating, low-dependency work; defers the backend-heavy collective.

1. **The book, with mock data.** Blender re-skin of the model; R3F journal route; load the book; procedural page turns; the fade/turn/zoom choreography; dynamic page-content textures. Driven by hardcoded mock entries — **no backend needed.** Deliverable: page through a beautiful book of fake entries.
2. **Accounts + backend.** Desktop sign-in; backend with accounts + entries; first-timer vs. returning routing. The book now reads the signed-in user's real entries.
3. **Close the loop — entry capture. (Built 2026-05-21.)** Relay plumbing (phone sends `song` + `summary` at session end, §6); the desktop records the glyph from the live gesture stream; at settle, writes the entry to the account. A real session now produces a real journal entry.
4. **The entry detail view. (Built 2026-05-21.)** Open one entry → the calm room: music replay from R2, glyph re-animation, caption (§5).
5. **The sky.** Mapbox custom dark style + globe; the "rise to the field" transition; the user's own glyphs placed geographically (coarsened). Mock collective data acceptable here.
6. **The collective.** Real anonymized glyphs from all accounts populate the sky; the self-among-others view (§7).

---

## 13. Deferred / open questions

- **Mobile sign-in** — solo phone rite with no desktop. Purely additive, no rework. Out of scope now.
- **Auth provider** — magic-link vs. OAuth vs. other. Resolve at Slice 2. Constraint: no friction before a first session.
- **Database choice** — serverless Postgres vs. Cloudflare D1 vs. other. Resolve at Slice 2.
- **Glyph replay fidelity** — Slice 4 replays the song + re-animates the glyph. Re-running the user's exact conducting modulations through the engine ("re-conduct from gesture") is a richer later option.
- **"A year ago today" resurfacing** — gentle, dismissible, mutable. Design when the archive is deep enough to need it.
