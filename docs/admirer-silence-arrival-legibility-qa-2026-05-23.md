# Manual phone QA — Admirer silence / arrival / legibility (2026-05-23)

Walkthrough checklist for the four behavior changes shipped in commits
`c847a8f` (keep-alive), `29ddd17 + 165d4b1` (agent config), `5619cc5`
(footsteps), `a66a8e2` (first_message), `10afe6d + 4268eb8` (transcript).

**Dev server:** https://192.168.1.13:5173/ (substitute your actual Wi-Fi
IP if different). Use a real phone with headphones — Web Audio HRTF only
externalises in stereo headphones.

**Manual prerequisite:** Confirm the ElevenLabs Agent dashboard reflects
the new settings before running QA:
- Turn timeout: **30 s**
- Turn eagerness: **Patient**
- Tools list includes **Skip turn** (system tool — `node scripts/update-admirer-agent.js`
  has been run and confirmed; the update script now patches `built_in_tools.skip_turn`
  via the API so no dashboard step is needed. Verified: GET on the live agent returns
  `system:skip_turn` in the tools list alongside the 6 client tools.)

---

## A. First-time user — silence test

1. Open phone DevTools console (or use a private/incognito window — easier on iOS) and run:
   ```js
   localStorage.clear()
   ```
   Hard-refresh.

2. Walk Entry: tap "begin", accept device-motion permission if prompted, wait through the ~8s video, type a name (or skip), continue.

3. Land in Admirer phase. Listen for:
   - [ ] **Footsteps** approaching from behind-right toward the front-centre within the first ~1–3 s before the voice arrives.
   - [ ] **First message** begins: *"welcome. think of me as a musician who's come into the room while the music's already playing… this first time runs slow… press and hold to speak. and to start — tell me what's around you right now."*

4. After the Admirer asks "what's around you right now?", **DO NOT press hold-to-speak**.

5. **Watch a clock. Wait 60 seconds.** During this time the Admirer should remain silent.
   - [ ] No second question
   - [ ] No "I'm going to play you a few pieces"
   - [ ] No fragments
   - [ ] Just silence

6. After 60s, press and hold and answer normally. Confirm conversation resumes.

---

## B. Transcript readability test (during the same session)

1. While the Admirer is speaking, glance at the bottom of the screen.
   - [ ] Up to 3 recent agent lines visible
   - [ ] Newest line is **legible** (italic serif, ~15px, ~85% opacity)
   - [ ] Two older lines fade above it

2. Deliberately look at the floor while the Admirer asks a question, then look back.
   - [ ] You can read the line you missed

---

## C. Returning-user — first_message test

1. Finish the first-time rite to settle naturally (fragments → orchestra → settle) so a real entry lands in localStorage.

   OR cheat-add a fake entry from DevTools console:
   ```js
   const entries = [{ ts: Date.now() - 24*3600*1000, summary: 'manual test entry' }]
   localStorage.setItem('musicking_entries', JSON.stringify(entries))
   ```

2. Hard-refresh. Walk through Entry (now shows "welcome back, {name}" with a continue button).

3. Land in Admirer phase. Listen for the first message:
   - [ ] Does **NOT** contain "welcome." or "this first time runs slow"
   - [ ] Short recognition line — e.g. *"yesterday, and again."* or *"a few days. back."*
   - [ ] Includes push-to-talk reminder + a short opener question

---

## D. Returning-user — silence test

Same as Test A step 5. Stay silent for 60s after the returning-user opening.
- [ ] Agent does not advance during silence

---

## E. ElevenLabs dashboard cross-check

Open https://elevenlabs.io/app/conversational-ai/conversations and find your most recent conversation.
- [ ] `user_activity` events appear every ~10s during silent periods (the keep-alive ping is firing)
- [ ] No agent response timestamps during the silent periods (the agent waited)

---

## What to do if anything fails

If any checkbox above does NOT pass:

1. Note the specific step and what you saw instead.
2. Capture the relevant console output (DevTools) — copy errors verbatim.
3. Add the deviation as a new section at the bottom of this file:

   ```markdown
   ## Deviations observed

   ### Test [A/B/C/D/E] step [N]
   Expected: …
   Actual: …
   Console output:
   ```
   (paste here)
   ```
   ```

Open a follow-up task — do not patch inside Task 6.

---

## Sign-off

Once every checkbox above passes, the plan is shipped. Final state:

- 326 tests passing
- Build clean
- Lint 148 (3 new env-config-gap errors from `scripts/generate-footsteps.js` accepted as matching the existing convention)
- Commits on `musicking`: `c847a8f`, `29ddd17`, `165d4b1`, `5619cc5`, `a66a8e2`, `10afe6d`, `4268eb8`
