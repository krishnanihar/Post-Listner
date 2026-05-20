# Five-Minute Admirer + Shared World — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compress the Admirer conversation to ~5 minutes, and give the Admirer phase and the Orchestra phase one continuous spatial + visual world — an intimate "room" that expands into the orchestra.

**Architecture:** Two phases, one world. Phase 1 (Admirer, ~5 min) and Phase 2 (Orchestra, ~5 min) stay distinct *acts*, but share continuous infrastructure. **Build A** — a Web-Audio HRTF "room" with two sizes (intimate ↔ expanded) whose expansion *is* the phase transition. **Build B** — a calm, peripheral visual "reflection surface" (live transcript + accumulating lexicon + glyph) that runs unbroken across both. The five-minute compression is achieved by merging the old sequential *biography* and *locate* stages into one interleaved call-and-response in the agent's system prompt.

**Tech Stack:** React 19 + Vite, `@elevenlabs/react` Conversational AI, Web Audio API (HRTF `PannerNode`, `ConvolverNode`), Framer Motion, Vitest. Agent config source-of-truth: `scripts/create-admirer-agent.js`, pushed via `scripts/update-admirer-agent.js`.

---

## Staging & scope

This plan has three phases. Each produces working, testable software on its own; execute and ship them in order.

- **Phase 1 — The Five-Minute Admirer** (Tasks 1–4). Pure agent-config work. Low risk, ships a 5-minute conversation immediately. Fully specified here.
- **Phase 2 — Build B: The Reflection Surface** (Tasks 5–9). React work — transcript + accumulating lexicon. Fully specified here. (The *glyph* layer of Build B is sequenced into Phase 3, because the glyph forms from phone motion during Phase 1, and reading phone motion in Phase 1 is a Build-A prerequisite.)
- **Phase 3 — Build A: The Shared Room** (Tasks 10–11 specified here; integration outline below). Web Audio. Opens with a **spike** (Task 10) because the route from the `@elevenlabs/react` SDK's audio output into an `AudioContext` is not yet known. Tasks 10–11 (spike + the pure-function room model) are fully specified. The audio-integration tasks that follow depend on the spike's outcome and are scoped — not coded — here; they must be detailed into a short follow-on plan once Task 10 resolves. Writing that integration code now would be guesswork.

**Baseline:** this plan assumes the agent prompt as it stands after the question-design (A1–A5) and arrival-and-naming changes already shipped on `2026-05-20`. Confirm with `git log --oneline` that those landed before starting.

## Research grounding

The five-minute target and the multi-modal layer are grounded in the project's research corpus: `Research/ 5-minute-taste-extraction redesign.md` and `Research/5-minute-phase-enhancements.md` (the pre-orchestra phase was always costed at ~5 min; ~4.6 bits suffice to pick 1 of 24 tracks); `Research/spatial-audio-hrtf-externalization.md` (room simulation, not HRTF quality, is what externalizes sound — Build A's two-size room); `Research/gesture-felt-agency-phone-as-baton.md` (the phone teaches conducting in ~5 min; capture the motion permission in the pre-conducting flow); `Research/stealable-techniques-feeling-seen.md` (the reflection surface is where "being seen" is manufactured — Build B); `docs/research-question-design-2026-05-20.md` (the tier gradient and "interrogation-then-test" diagnosis the interleave fixes).

## File structure

| File | Phase | Created/Modified | Responsibility |
|---|---|---|---|
| `scripts/create-admirer-agent.js` | 1 | Modify | `SYSTEM_PROMPT`: merge biography + locate into one interleaved stage; retime to ~5 min |
| `docs/admirer-agent-dashboard.md` | 1 | Modify | Human-readable mirror of the agent config — kept in sync |
| `src/lib/liveSession.js` | 2 | Create | In-memory store for the current session's transcript + lexicon; subscribable |
| `src/lib/__tests__/liveSession.test.js` | 2 | Create | Vitest tests for the store |
| `src/hooks/useAdmirerAgent.js` | 2 | Modify | Forward `useConversation` messages into `liveSession` |
| `src/phases/Admirer.jsx` | 2 | Modify | Wire `onRecordLexicon` → `liveSession`; render `ReflectionSurface` |
| `src/phases/ReflectionSurface.jsx` | 2 | Create | The calm, peripheral visual surface (transcript + lexicon) |
| `src/App.jsx` | 2 | Modify | Render `ReflectionSurface` spanning admirer + orchestra; reset `liveSession` on entry |
| `docs/admirer-spatial-spike.md` | 3 | Create | Spike findings: how to route SDK audio into Web Audio |
| `src/lib/roomPresets.js` | 3 | Create | Pure acoustic presets (intimate ↔ expanded) + interpolation |
| `src/lib/__tests__/roomPresets.test.js` | 3 | Create | Vitest tests for the room model |
| *Phase 3 integration files* | 3 | TBD post-spike | Likely `src/orchestra/AdmirerRoom.js` + modify `Admirer.jsx`, `Orchestra.jsx` |

**Testing approach.** Pure-function modules (`liveSession`, `roomPresets`) get Vitest TDD. Agent-prompt changes are verified by a server-side `curl` assertion plus a timed manual smoke walk — they are not unit-testable. React / Web-Audio UI is verified by a manual checklist with explicit expected see/hear outcomes; this matches how the project already verifies UI (see the Playwright snap scripts referenced in `CLAUDE.md`).

---

## Phase 1 — The Five-Minute Admirer

### Task 1: Merge biography + locate into one interleaved conversation

**Files:**
- Modify: `scripts/create-admirer-agent.js` (the `SYSTEM_PROMPT` template literal)

- [ ] **Step 1: Read the current SYSTEM_PROMPT**

Run: `sed -n '48,160p' scripts/create-admirer-agent.js`
Confirm the `is_first_session = true` block currently contains numbered sections `1. ARRIVAL`, `2. MUSICAL BIOGRAPHY`, `3. LOCATE`, `4. TRANSITION`.

- [ ] **Step 2: Retime the first-session header**

Change the line `**If is_first_session = true (~25 minutes total):**` to:

```
**If is_first_session = true (~5 minutes total):**
```

- [ ] **Step 3: Retime ARRIVAL**

Change `1. ARRIVAL: Your first message has already` to `1. ARRIVAL (~40 sec): Your first message has already` (only the section heading — leave the rest of the ARRIVAL paragraph unchanged).

- [ ] **Step 4: Replace sections 2, 3, and 4 with the merged conversation + transition**

Delete the entire `2. MUSICAL BIOGRAPHY ...` section, the entire `3. LOCATE ...` section, and the entire `4. TRANSITION ...` section. Replace all three with exactly this text:

```
2. THE CONVERSATION (~3 minutes — the heart of the session; keep it moving).
   This one stretch does what the old separate "biography" and "locate" stages
   did — you ask a little and you play a little, and the two interleave.

   Open with the boundary object: "is there a piece you can play me, or hum, or
   just describe? something that's been near you lately. it doesn't have to mean
   anything yet." When the user shares it, call commitArtifact with a short
   label, give one small observation (not interpretation), and answer it with a
   short fragment via playFragment — the orchestra's first reply to them.

   Then move through about THREE short exchanges, interleaved. Each exchange is:
   one question -> the user answers -> a short fragment (playFragment) that nods
   at what they said. The questions shape your sense of them; the fragments
   refine it. Never run questions and fragments as separate blocks — weave them.

   Ask about three questions across the whole conversation, present-tense and
   concrete first, in this order of preference:
   - "Who was the loudest music in the house, growing up?"
   - "What's playing in the rooms you're in now — yours, or other people's?"
   - "What music is around you now that surprises you?"
   - "Is there an instrument or a sound you'd know anywhere?"
   Only if the user has clearly warmed and is answering fully may you spend ONE
   exchange on lineage: "Whose music did you grow up inside — was there someone
   it came from?" Never ask about music the user has lost, places they can't go
   back to, or music they've walked away from — those are deferred entirely to
   the closing refusal-to-know.

   If the user marks anything as closed or restricted ("I don't talk about that
   music"), call markRestricted with the repertoire name.

   playFragment fragmentIds: warm-acoustic-now, warm-folk-recent,
   shadow-piano-late, shadow-synth-old, lifted-cinematic, lifted-postclassical,
   patient-glow, tense-postrock.

   PACING — this is the five-minute shape, and it matters: aim for about three
   exchanges and roughly three minutes here. A few real exchanges is enough —
   you are NOT running an interview. Extend only if the user is visibly engaged
   and giving rich, unguarded answers; never add a question to fill time. If you
   are unsure whether to ask one more, you are done — move on.

   When you have a feel for the direction, name it back in the user's own words
   ("somewhere warm, slower than the second thing, with the strings staying"),
   then call startGeneration with descriptors:
   { tempo: "slow"|"medium"|"fast",
     mood: "warm"|"shadowed"|"lifted"|"tense"|"patient"|"expansive",
     era: <year>,
     instrumentation: "acoustic"|"synth"|"orchestral"|"ensemble"|"electronic" }.

3. TRANSITION (~45 sec): Say one short line like "it's coming. you'll hear it
   start. when it does, just move the way you're listening." Then call
   commitEntry with a short summary (under 80 chars) of the session. Then STOP
   speaking.
```

- [ ] **Step 5: Align the ongoing-session branch**

In the `**If is_first_session = false ...**` block, change its header to `**If is_first_session = false (~4 minutes):**`, and replace its `2. LOCATE: Two exchanges instead of three...` paragraph with:

```
2. THE CONVERSATION (~2 min): Shorter than the first session — the prior comes
   from history (see {{prior_lexicon}} and {{prior_entries_summary}}). One or
   two interleaved question+fragment exchanges is enough. Echo the user's prior
   lexicon when it is relevant. Call playFragment then startGeneration as above.
```

Leave that block's `1. ARRIVAL` and `3. TRANSITION` items unchanged (renumber its transition item to `3` if it is currently `3`; it already is).

- [ ] **Step 6: Verify the file still parses**

Run: `node --check scripts/create-admirer-agent.js`
Expected: no output (exit 0). If it errors, an unbalanced backtick or quote was introduced — fix it.

- [ ] **Step 7: Commit**

```bash
git add scripts/create-admirer-agent.js
git commit -m "feat(musicking): merge Admirer biography+locate into one ~5-min interleaved stage

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2: Push to the live agent and verify

**Files:** none modified (runs scripts).

- [ ] **Step 1: Push the updated prompt**

Run: `node scripts/update-admirer-agent.js`
Expected: prints `Agent updated.` followed by `system prompt: <N> chars synced from create script`.

- [ ] **Step 2: Verify the live agent server-side**

Run:

```bash
KEY=$(grep '^ELEVENLABS_API_KEY=' .env.local | cut -d= -f2- | tr -d '"'); \
AID=$(grep '^VITE_ELEVENLABS_AGENT_ID=' .env.local | cut -d= -f2- | tr -d '"'); \
curl -s -H "xi-api-key: $KEY" "https://api.elevenlabs.io/v1/convai/agents/$AID" | python3 -c '
import sys,json
p=json.load(sys.stdin)["conversation_config"]["agent"]["prompt"]["prompt"]
checks=[
 ("merged conversation stage present", "THE CONVERSATION" in p),
 ("five-minute total set", "(~5 minutes total)" in p),
 ("old biography heading gone", "MUSICAL BIOGRAPHY" not in p),
 ("old locate heading gone", "3. LOCATE" not in p and "LOCATE (~3-4 min" not in p),
 ("pacing rule present", "you are NOT running an interview" in p),
]
for name,ok in checks: print(("PASS  " if ok else "FAIL  ")+name)
'
```

Expected: all five lines print `PASS`. If any `FAIL`, the push did not take or Task 1 missed an edit — fix and re-run Task 2.

### Task 3: Sync the dashboard doc

**Files:**
- Modify: `docs/admirer-agent-dashboard.md`

- [ ] **Step 1: Apply the same three edits to the doc's pasted system prompt**

In `docs/admirer-agent-dashboard.md`, the system prompt is reproduced verbatim inside a fenced code block. Apply the identical changes from Task 1 to it: the `(~5 minutes total)` retime, the `ARRIVAL (~40 sec)` heading, the merged `2. THE CONVERSATION` + `3. TRANSITION` replacing the old sections 2–4, and the ongoing-branch edit.

- [ ] **Step 2: Verify the doc and the create script agree**

Run: `grep -c "THE CONVERSATION" docs/admirer-agent-dashboard.md scripts/create-admirer-agent.js`
Expected: both files report `1` or more (the heading is present in both).

- [ ] **Step 3: Commit**

```bash
git add docs/admirer-agent-dashboard.md
git commit -m "docs(musicking): sync dashboard mirror with the 5-min interleaved prompt

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4: Smoke-test the five-minute shape

**Files:** none.

- [ ] **Step 1: Run the app**

Run: `npm run dev`
Open the printed localhost URL, hard-refresh.

- [ ] **Step 2: Walk one full first session with a stopwatch**

Start the stopwatch when the Admirer's first message begins. Walk Entry → Admirer; answer naturally and fairly briefly (as a real first-time user would).

- [ ] **Step 3: Confirm the expected shape**

Expected observations:
- The Admirer opens with the boundary object after the warm-up turn — not a separate "I want to play you a few short things" locate block.
- Fragments play **interleaved** with questions, not in a block at the end.
- The conversation reaches `startGeneration` then `commitEntry` at roughly **4:30–6:00** on the stopwatch (target ~5:00). If it consistently runs past ~7:00, the agent is over-asking — tighten the PACING paragraph wording and re-run Tasks 1–2.
- The handoff to the Orchestra still works (the matched track plays).

Record the measured time in the commit message of the next phase or in `todo.md` for reference.

---

## Phase 2 — Build B: The Reflection Surface

A calm, peripheral visual layer — the Admirer's current line and the words the user has given — rendered unbroken across the admirer and orchestra phases. It must be *ignorable*: a user who never looks at it loses nothing.

### Task 5: Create the live-session store

**Files:**
- Create: `src/lib/liveSession.js`
- Test: `src/lib/__tests__/liveSession.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/liveSession.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import {
  resetLiveSession, addTranscriptLine, addLexiconWord,
  getLiveSession, subscribeLiveSession,
} from '../liveSession.js'

describe('liveSession', () => {
  beforeEach(() => resetLiveSession())

  it('appends transcript lines with role and trimmed text', () => {
    addTranscriptLine('agent', '  hello  ')
    expect(getLiveSession().transcript).toEqual([{ role: 'agent', text: 'hello' }])
  })

  it('ignores empty transcript text', () => {
    addTranscriptLine('user', '   ')
    expect(getLiveSession().transcript).toEqual([])
  })

  it('accumulates lexicon words and de-duplicates them', () => {
    addLexiconWord('qawwali')
    addLexiconWord('qawwali')
    addLexiconWord('my mom’s tape')
    expect(getLiveSession().lexicon).toEqual(['qawwali', 'my mom’s tape'])
  })

  it('ignores empty lexicon words', () => {
    addLexiconWord('  ')
    expect(getLiveSession().lexicon).toEqual([])
  })

  it('resetLiveSession clears both lists', () => {
    addTranscriptLine('agent', 'x')
    addLexiconWord('y')
    resetLiveSession()
    expect(getLiveSession()).toEqual({ transcript: [], lexicon: [] })
  })

  it('returns a new snapshot reference after each mutation', () => {
    const before = getLiveSession()
    addLexiconWord('z')
    expect(getLiveSession()).not.toBe(before)
  })

  it('notifies subscribers on change and stops after unsubscribe', () => {
    let calls = 0
    const unsub = subscribeLiveSession(() => { calls += 1 })
    addLexiconWord('a')
    expect(calls).toBe(1)
    unsub()
    addLexiconWord('b')
    expect(calls).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- liveSession`
Expected: FAIL — `Cannot find module '../liveSession.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/liveSession.js`:

```js
// In-memory store for the CURRENT session's reflection surface — the
// transcript lines and the lexicon words the user has given. NOT persisted
// (sessionStore.js handles cross-session state). A tiny subscribable store
// so React can read it via useSyncExternalStore.

let state = { transcript: [], lexicon: [] }
const listeners = new Set()

function emit() {
  for (const listener of listeners) listener()
}

export function resetLiveSession() {
  state = { transcript: [], lexicon: [] }
  emit()
}

export function addTranscriptLine(role, text) {
  const t = (text || '').trim()
  if (!t) return
  state = { transcript: [...state.transcript, { role, text: t }], lexicon: state.lexicon }
  emit()
}

export function addLexiconWord(word) {
  const w = (word || '').trim()
  if (!w || state.lexicon.includes(w)) return
  state = { transcript: state.transcript, lexicon: [...state.lexicon, w] }
  emit()
}

export function getLiveSession() {
  return state
}

export function subscribeLiveSession(listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- liveSession`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/liveSession.js src/lib/__tests__/liveSession.test.js
git commit -m "feat(musicking): in-memory live-session store for the reflection surface

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 6: Forward conversation messages into the store

**Files:**
- Modify: `src/hooks/useAdmirerAgent.js`

- [ ] **Step 1: Inspect the SDK message payload shape**

In `src/hooks/useAdmirerAgent.js`, the agent runs via `useConversation` from `@elevenlabs/react`. Add a temporary `onMessage` handler to the `useConversation({...})` options that logs the payload:

```js
onMessage: (msg) => { console.log('[admirer] onMessage', JSON.stringify(msg)) },
```

Run `npm run dev`, walk one short Admirer exchange, and read the console. Record the payload shape — in current `@elevenlabs/react` it is an object with a message string and a source field (e.g. `{ message, source }` where `source` is `"user"` or `"ai"`). Note the exact keys.

- [ ] **Step 2: Replace the temporary handler with the real forwarder**

Import the store at the top of `src/hooks/useAdmirerAgent.js`:

```js
import { addTranscriptLine } from '../lib/liveSession.js'
```

Replace the temporary `onMessage` from Step 1 with (adjust the property names to match what Step 1 logged):

```js
onMessage: (msg) => {
  // msg shape confirmed in Step 1: { message, source }
  const role = msg?.source === 'user' ? 'user' : 'agent'
  addTranscriptLine(role, msg?.message)
},
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, walk one Admirer exchange. In the browser devtools console run `JSON.stringify(window.__ls)` only if you added a debug hook; otherwise add a temporary `console.log(getLiveSession())` import-and-call, confirm transcript lines accumulate with correct roles, then remove the temporary log.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAdmirerAgent.js
git commit -m "feat(musicking): forward Admirer conversation messages into liveSession

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 7: Wire the lexicon callback into the store

**Files:**
- Modify: `src/phases/Admirer.jsx`

- [ ] **Step 1: Add the import**

At the top of `src/phases/Admirer.jsx`, add:

```js
import { addLexiconWord } from '../lib/liveSession.js'
```

- [ ] **Step 2: Add the `onRecordLexicon` callback**

`src/lib/admirerTools.js` already calls `cb.onRecordLexicon?.({ term, userPhrasing })`, but `Admirer.jsx` does not currently provide it. Add a callback alongside the existing `onPlayFragment` / `onStartGeneration` / `onCommitEntry`:

```js
const onRecordLexicon = useCallback(({ userPhrasing } = {}) => {
  addLexiconWord(userPhrasing)
}, [])
```

Then add `onRecordLexicon` to the `callbacks` object passed into `useAdmirerAgent({ sessionStage: 'opening', callbacks: { onPlayFragment, onStartGeneration, onCommitEntry, onRecordLexicon } })`.

- [ ] **Step 3: Verify**

Run: `npm run dev`, walk an Admirer exchange in which you name a specific musical term. Confirm (via a temporary `console.log(getLiveSession().lexicon)` you then remove) that the term's verbatim phrasing lands in the lexicon list.

- [ ] **Step 4: Commit**

```bash
git add src/phases/Admirer.jsx
git commit -m "feat(musicking): feed recordLexicon into the live reflection surface

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 8: Build the ReflectionSurface component

**Files:**
- Create: `src/phases/ReflectionSurface.jsx`

- [ ] **Step 1: Write the component**

Create `src/phases/ReflectionSurface.jsx`:

```jsx
import { useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { subscribeLiveSession, getLiveSession } from '../lib/liveSession.js'

// A calm, peripheral surface. Two quiet things: the Admirer's most recent
// line, and the words the user has given, accumulating. It must be
// ignorable — a user who never looks at it loses nothing. Theme-neutral so
// it reads on both the cream Admirer phase and the dark Orchestra phase.
// A glyph layer is added in Phase 3 (it needs phone motion from Build A).
export default function ReflectionSurface() {
  const { transcript, lexicon } = useSyncExternalStore(subscribeLiveSession, getLiveSession)

  const lastAgentLine = [...transcript].reverse().find(l => l.role === 'agent')?.text || ''

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 10,
        padding: '0 24px calc(env(safe-area-inset-bottom, 0px) + 14px)',
        zIndex: 5,
      }}
    >
      {/* accumulating lexicon — the words the user gave */}
      {lexicon.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 10px',
          maxWidth: 420,
        }}>
          {lexicon.map((w, i) => (
            <motion.span
              key={`${w}-${i}`}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 0.4, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{
                fontFamily: 'Iowan Old Style, Palatino, serif',
                fontStyle: 'italic', fontSize: 12, letterSpacing: 0.2,
                color: 'currentColor',
              }}
            >
              {w}
            </motion.span>
          ))}
        </div>
      )}

      {/* the Admirer's current line — faint, slow */}
      <AnimatePresence mode="wait">
        {lastAgentLine && (
          <motion.div
            key={lastAgentLine}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: 'easeOut' }}
            style={{
              fontFamily: 'Iowan Old Style, Palatino, serif',
              fontStyle: 'italic', fontSize: 13, lineHeight: 1.5,
              textAlign: 'center', maxWidth: 420, color: 'currentColor',
            }}
          >
            {lastAgentLine}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

Note: `color: 'currentColor'` means the surface inherits the host phase's text colour (dark ink on cream, light on dark). Opacity is kept low (0.3–0.4) so it stays peripheral.

- [ ] **Step 2: Lint the new file**

Run: `npx eslint src/phases/ReflectionSurface.jsx`
Expected: clean, except possibly the project-wide pre-existing `'motion' is defined but never used` rule artifact (the eslint config lacks `jsx-uses-vars` — see `Entry.jsx`/`Admirer.jsx`, which trip the same). Any *other* error must be fixed.

- [ ] **Step 3: Commit**

```bash
git add src/phases/ReflectionSurface.jsx
git commit -m "feat(musicking): ReflectionSurface — calm transcript + lexicon visual

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 9: Render the surface across both phases

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add imports**

At the top of `src/App.jsx`:

```js
import ReflectionSurface from './phases/ReflectionSurface'
import { resetLiveSession } from './lib/liveSession.js'
```

- [ ] **Step 2: Reset the store at the start of each session**

Add a `useEffect` in the `App` component that clears the live session whenever the flow returns to `entry`:

```js
useEffect(() => {
  if (phase === 'entry') resetLiveSession()
}, [phase])
```

- [ ] **Step 3: Render the surface spanning admirer + orchestra**

In the returned JSX, immediately after the closing `</AnimatePresence>` and before `<Analytics />`, add:

```jsx
{(phase === 'admirer' || phase === 'orchestra') && <ReflectionSurface />}
```

This renders the surface *outside* the phase-swap `AnimatePresence`, so it is not unmounted/remounted when the phase changes — it persists unbroken from the conversation into the conducting.

- [ ] **Step 4: Verify**

Run: `npm run dev`. Walk Entry → Admirer → into Orchestra. Expected:
- During the Admirer phase: the current line and the lexicon words appear, faint, at the bottom; never demanding attention.
- Crossing into the Orchestra phase: the surface stays on screen — it does not flash/reset; the lexicon words are still there.
- Returning to Entry (after Settle): the surface is gone and the store is cleared (next session starts empty).

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: the existing suite plus the new `liveSession` tests all pass.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat(musicking): render ReflectionSurface unbroken across admirer+orchestra

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 — Build A: The Shared Room

The conversation happens in an intimate, closed room; that room then **expands** into the orchestra, and the expansion *is* the phase-1 → phase-2 transition. Tasks 10 and 11 are fully specified. The integration that follows is spike-gated — see the note at the end of this phase.

### Task 10: SPIKE — route the Admirer's audio into Web Audio

**Files:**
- Create: `docs/admirer-spatial-spike.md`

**Why a spike:** routing the Admirer's voice through an HRTF room requires its audio as a node inside an `AudioContext`. The `@elevenlabs/react` SDK plays its own output; how it exposes that output (an output `AudioContext`, an `<audio>` element, a `MediaStream`, an output node, or nothing) is unknown and determines all downstream code.

- [ ] **Step 1: Inspect the SDK**

Run: `ls node_modules/@elevenlabs/react/dist` and read the type declarations:
`cat node_modules/@elevenlabs/react/dist/*.d.ts` (and the underlying `@elevenlabs/client` package it depends on).

Look specifically for: an exposed `AudioContext`, an output node getter, an `outputElement` / `<audio>` reference, a `getOutputStream()` / `MediaStream`, or an `onAudio` callback delivering PCM frames.

- [ ] **Step 2: Decide the capture method and write it up**

Create `docs/admirer-spatial-spike.md` recording: (a) what the SDK exposes; (b) the chosen capture method — the most likely outcomes, in order of preference, are:
  1. The SDK exposes its output `AudioContext` / output node → connect that node directly into our room graph.
  2. The SDK plays through an `<audio>` element we can reach → `new MediaElementAudioSourceNode(ourCtx, { mediaElement })`.
  3. The SDK exposes a `MediaStream` → `new MediaStreamAudioSourceNode(ourCtx, { mediaStream })`.
  4. None of the above → fallback: keep the Admirer voice in plain stereo for Phase 1, and apply the room only from the Orchestra phase onward; document this as a known limitation.
(c) the exact constructor call for the chosen method, ready to paste into Task 13's integration.

- [ ] **Step 3: Commit**

```bash
git add docs/admirer-spatial-spike.md
git commit -m "spike(musicking): determine how to route Admirer audio into Web Audio

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 11: The room model — pure acoustic presets

**Files:**
- Create: `src/lib/roomPresets.js`
- Test: `src/lib/__tests__/roomPresets.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/roomPresets.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { INTIMATE, EXPANDED, roomAt, easeExpansion, lerp } from '../roomPresets.js'

describe('roomPresets', () => {
  it('lerp interpolates linearly', () => {
    expect(lerp(0, 10, 0)).toBe(0)
    expect(lerp(0, 10, 1)).toBe(10)
    expect(lerp(0, 10, 0.5)).toBe(5)
  })

  it('easeExpansion clamps out-of-range input to [0,1]', () => {
    expect(easeExpansion(-1)).toBe(0)
    expect(easeExpansion(2)).toBe(1)
  })

  it('easeExpansion is a smoothstep (0->0, 1->1, 0.5->0.5)', () => {
    expect(easeExpansion(0)).toBe(0)
    expect(easeExpansion(1)).toBe(1)
    expect(easeExpansion(0.5)).toBeCloseTo(0.5, 5)
  })

  it('roomAt(0) equals the INTIMATE preset', () => {
    expect(roomAt(0)).toEqual(INTIMATE)
  })

  it('roomAt(1) equals the EXPANDED preset', () => {
    expect(roomAt(1)).toEqual(EXPANDED)
  })

  it('roomAt(0.5) sits strictly between the two presets', () => {
    const mid = roomAt(0.5)
    expect(mid.reverbWet).toBeGreaterThan(INTIMATE.reverbWet)
    expect(mid.reverbWet).toBeLessThan(EXPANDED.reverbWet)
    expect(mid.reflectionDelayScale).toBeGreaterThan(INTIMATE.reflectionDelayScale)
    expect(mid.reflectionDelayScale).toBeLessThan(EXPANDED.reflectionDelayScale)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- roomPresets`
Expected: FAIL — `Cannot find module '../roomPresets.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/roomPresets.js`:

```js
// Pure acoustic-parameter presets for the shared "room" that hosts both the
// Admirer conversation (intimate) and the Orchestra (expanded). roomAt(t)
// interpolates between them: t=0 intimate closed room, t=1 orchestra hall.
// The audio engine (Task 13) consumes these numbers; this module has no
// Web Audio dependency and is fully unit-tested.

export const INTIMATE = {
  reverbWet: 0.16,            // convolver send level — dry, close
  reflectionGain: 0.10,       // early-reflection bus gain
  reflectionDelayScale: 0.45, // multiplies base reflection delays — near walls
  directGain: 1.0,            // direct (un-reverbed) voice level
  dampingHz: 5200,            // master lowpass cutoff — slightly damped/close
}

export const EXPANDED = {
  reverbWet: 0.55,
  reflectionGain: 0.30,
  reflectionDelayScale: 1.0,  // full-size ~5x4x3m room
  directGain: 0.85,
  dampingHz: 9000,            // brighter, open
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

// Smoothstep so the room opens organically rather than linearly.
export function easeExpansion(t) {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

export function roomAt(t) {
  const e = easeExpansion(t)
  return {
    reverbWet:            lerp(INTIMATE.reverbWet, EXPANDED.reverbWet, e),
    reflectionGain:       lerp(INTIMATE.reflectionGain, EXPANDED.reflectionGain, e),
    reflectionDelayScale: lerp(INTIMATE.reflectionDelayScale, EXPANDED.reflectionDelayScale, e),
    directGain:           lerp(INTIMATE.directGain, EXPANDED.directGain, e),
    dampingHz:            lerp(INTIMATE.dampingHz, EXPANDED.dampingHz, e),
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- roomPresets`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/roomPresets.js src/lib/__tests__/roomPresets.test.js
git commit -m "feat(musicking): pure room-acoustics model (intimate <-> expanded)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Phase 3 integration — to be detailed into a follow-on plan after Task 10

The remaining Build-A work cannot be written as complete code until the Task 10 spike resolves the audio-capture method. Once Task 10 and Task 11 land, produce a short follow-on plan (`docs/superpowers/plans/2026-05-2X-build-a-room-integration.md`) covering these tasks:

- **Task 13 — `AdmirerRoom` audio module** (`src/orchestra/AdmirerRoom.js`). Takes the captured Admirer voice node (per the Task 10 spike) → mono → `PannerNode` (HRTF) → 6-tap early reflections + `ConvolverNode` (hall IR, already in `public/chamber/hall-ir.wav`) → master lowpass → destination. Exposes `setExpansion(t)` which reads `roomAt(t)` and updates the graph. The signal-chain order is given in `Research/spatial-audio-hrtf-externalization.md` ("Complete browser-based signal chain"); the existing `OrchestraEngine.js` is the reference implementation to mirror, not duplicate.
- **Task 14 — Phone motion in Phase 1**. Request `DeviceMotionEvent`/`DeviceOrientationEvent` permission on the Entry tap (it must be a user gesture), and read orientation during the Admirer phase via the existing `src/conducting/GestureCore.js`. Feed roll → a gentle azimuth offset on the `AdmirerRoom` panner (small range — the voice has a *place*; the phone turns you within the room; keep it musical, never a video-game pan).
- **Task 15 — The glyph layer of the ReflectionSurface**. Add a `<canvas>` ink-trail to `ReflectionSurface.jsx`, drawn from the Phase-1 phone motion (Task 14) and, in the Orchestra phase, from the existing conducting gesture. Reuse the trail technique from `src/conductor-glb/ConductorCelestialField.jsx`. This completes Build B's third element, which was deferred from Phase 2 because it depends on Task 14.
- **Task 16 — The expansion transition**. Mount `AdmirerRoom` at `t=0` (intimate) when the Admirer phase begins. At the phase-1 → phase-2 handoff, animate `t` 0 → 1 over ~3–4 s (a `requestAnimationFrame` loop calling `setExpansion`), so the closed room audibly opens into the orchestra. The `OrchestraEngine` picks up at `t=1`. Verify with the manual checklist: the voice externalises (comes from a place, not inside the head) from the first word; the room audibly widens at the transition; no click or gap at the handoff.

---

## Parked — The Orchestra-phase guidance voice

Not built in this plan. Recorded here so the seam is deliberate:

- The Orchestra phase will get a voice — **later** — whose content is **conducting guidance** ("how to conduct"), not conversation, delivered spatially within the now-expanded room.
- It will be **personalized from Phase 1**. The data it needs already persists: `sessionStore.js` holds the lexicon and restricted repertoires; `commitArtifact` and `startGeneration` descriptors capture the boundary object and the chosen direction. No new capture work is required — the seam is free.
- When it is built, it belongs with the broader voice redesign already parked in `CLAUDE.md` ("Parked for later → Voice redesign"). Do not bake it into this plan's scope.

---

## Self-review

- **Spec coverage.** Phase 1 covers the 5-minute compression (merged interleaved stage, elastic pacing). Phase 2 covers Build B's transcript + lexicon surface. Phase 3 covers Build A's spike + room model, and scopes the integration + the glyph (Build B's third element, dependency-sequenced into Phase 3). The Orchestra guidance voice is explicitly parked. All four scope items the user confirmed are addressed.
- **Placeholders.** None in Tasks 1–11 — every step has exact files, code, or commands. The Phase 3 integration section is deliberately an *outline*, not fake code: its tasks depend on the Task 10 spike, and the plan says so plainly rather than guessing SDK calls.
- **Type consistency.** `liveSession.js` exports (`resetLiveSession`, `addTranscriptLine`, `addLexiconWord`, `getLiveSession`, `subscribeLiveSession`) match their uses in Tasks 6, 7, 8, 9. `roomPresets.js` exports (`INTIMATE`, `EXPANDED`, `roomAt`, `easeExpansion`, `lerp`) match the test and the Task 13 description.
- **Honest testing.** Pure modules are TDD'd; prompt and UI changes are verified by server `curl` checks and explicit manual checklists, matching the codebase's established practice.
