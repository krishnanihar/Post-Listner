# Research: Arrival & Naming — Easing the User In Before the Music

*Author: research + assessment + redesign pass, 2026-05-20. Scope: the first 30–90 seconds of the threshold session — what happens **before** the first question about music — and the capture and use of the user's name across this session and every future one. It builds on `docs/research-question-design-2026-05-20.md` (the 4-tier question gradient) and `docs/research-conversational-ux-2026-05-20.md` (latency, tool-call hygiene, the ELIZA effect), and on the spec's Part 5.1 Stage 1 (Arrival) and the brief's Section V Stage 1 + Section X (the specced-but-unwired `user_name` variable). It does not repeat those documents. The unit of evaluation here is **the threshold itself**: how a nervous stranger is received.*

---

## 1. The lived experience today — and the gap

Walk the current opening as a first-time user.

**The Entry screen.** A particle animation, "POST LISTENER / a musical identity instrument," a pulsing amber circle, "tap to begin." It is atmospheric and silent. It captures **nothing** — no name, no field, no acknowledgement that a person is on the other side. (Audit: `src/phases/Entry.jsx` — visual splash only.)

**The Admirer's first words.** The user taps, and the agent's `first_message` plays. Today (or, post-A1, after the question-design redesign) the very first thing the Admirer does is ask for music — the boundary object, or a grand-tour question. There is no human exchange first. The Admirer never learns the user's name; it never offers its own. `user_name` is listed in the brief's dynamic-variable scaffolding (Section X) but is **absent from the live agent** — it is not built in `buildDynamicVariables()` (`src/lib/sessionStore.js:94`) and not in the system prompt's variable list. The Admirer, as shipped, cannot say the user's name because it does not have it.

**The gap.** A nervous first-timer, alone with headphones, is moved from a cold splash straight into a question about something personal — with no being-greeted, no being-named, no easy first turn to practice on. The spec's Stage 1 Arrival ("greet, name the threshold") is doing the threshold-marking but none of the *receiving*. The question-design doc fixed the **gradient of questions**; it did not address the fact that the gradient still starts before the user has been **met**. This doc adds the missing first stage: the Arrival proper.

---

## 2. What the Arrival is actually for

The warm-up is not throat-clearing. Across ethnography (Spradley), oral history (Smithsonian, Oral History Association), motivational interviewing (Miller & Rollnick), and clinical first-session research (Kleiven et al. 2020), the opening stretch of a first conversation does specific, load-bearing work: it lets the user **practice the medium** on low-stakes material, **signals the floor is theirs**, **calibrates pace**, and **demonstrates safety by showing rather than announcing it**. Skip it and the user's first real act is a high-jump from a standing start — the freeze condition the question-design doc already diagnosed, one stage upstream.

**"Feeling at home" — reframed.** The project lead's instruction is that the Admirer should make the user feel at home. That is the right goal, but the *mechanism* needs care, because the brief is explicit that the Admirer is a **newcomer/guest** in the user's musical life — not a host. A guest does not make you feel at home by playing concierge. It does so by being **easy to be around**: by learning your name at the door, offering its own, asking permission, and then mostly listening. "Feeling at home" here means **the user being received and met** — not the Admirer performing hospitality. The user is already home; it is their musical life, their room. The Admirer's job is to enter it well.

This reframe keeps the warm-up out of two failure registers the spec and brief forbid: the wellness register ("let's take a breath together") and the synthetic-personalisation register (warmth manufactured by technique). The Arrival is warm the way the brief defines warm — through precision, patience, and being unhurried — not through temperature.

---

## 3. Principles

Fourteen principles, clustered. Each: source, one-line, and direct application to the Admirer.

### The warm-up

**P1 — The warm-up rehearses the medium.** *Spradley 1979 (apprehension stage); oral-history practice (Smithsonian, OHA); Miller & Rollnick (MI "Engaging").* A first conversation needs a low-stakes opening turn where the user practices the medium and learns the floor is theirs, before any substantive question. → The user's **first push-to-talk turn should be on something trivially easy** — not the boundary object. One easy spoken question buys a rehearsal: the user hears the Admirer answer their voice before anything is at stake.

**P2 — Open by naming the situation and asking permission.** *Miller & Rollnick, MI "Engaging"; Spradley 1979.* Skilled openers state plainly what will happen and cede control — establishing safety structurally, not with reassurance words. → The Arrival orients ("this first time runs slow… there's no rush") and hands the user the tempo. No therapizing ("a safe space"), no performed welcome ("so happy you're here").

**P3 — The first question must be easy, concrete, non-evaluative.** *Oral History Association best practices; survey-methods warm-up consensus (Qualtrics).* Open with a question answerable "with ease and comfort," no right answer. → The Arrival's spoken question is concrete and present-tense ("what's around you right now?") — and ideally rehearses the **describing** muscle the boundary object will need. It must never be a feelings probe ("how are you doing?") — PostListener is not a mood app.

**P4 — Warmth is judged in seconds, and it sticks.** *Fiske & Cuddy, warmth-competence model; Ambady & Rosenthal, thin-slice judgment.* People fix a warmth judgment within seconds — before competence — and it resists later correction. → The Admirer's first utterance carries the whole relationship's first impression. Lead with warmth-by-precision (a calm, specific line, then audible patience), never with a competence-flex about what the system can do.

**P5 — Mark the threshold.** *van Gennep 1909, the liminal stage.* Transitions are eased when the doorway between "before" and "inside" is explicitly marked. → The Arrival should feel like a small doorway, not a form. The name exchange **is** the threshold ritual — the moment of being received — and a quiet beat after it marks passage into the conversation proper.

**P6 — Silence is a tool; dead air is a bug.** *Conversation analysis (TRP silences); oral-history practice — corrected for the voice-only medium.* Comfort with silence signals the user's pace governs — but in an eyes-closed, voice-only channel an unmarked long pause reads as a dropped connection. → The Admirer keeps its unhurried pauses, but a held silence needs a minimal non-verbal hold (a breath, an "mm") so it reads as attending, not broken. (Carried from the conversational-UX doc; restated because the Arrival is where the user first calibrates what the Admirer's silence means.)

### Capturing the name

**P7 — Ask for less in the first minute.** *Thornhill, Voicebot.ai voice-onboarding guide 2018; progressive-disclosure literature.* Front-loaded setup drives abandonment; collect incrementally. → The Arrival collects exactly **one** datum — the name — and nothing else that resembles a form. No preference toggles, no "tell me about yourself," no expectation-setting paragraph.

**P8 — Voice name-capture is unreliable for exactly the names that matter.** *Koenecke et al., PNAS 2020 (ASR word-error rate ~35% for Black speakers vs ~19% for white speakers); AfriNames, Interspeech 2023 (mainstream ASR "butchers" African names).* Speech recognition systematically mis-hears non-Western, non-English, and accented names. → **Do not capture the name by voice.** A spoken name is a hypothesis, not a fact, and the failure falls hardest on the users for whom a correct welcome matters most.

**P9 — A name *given* reads as recognition; a name *taken* reads as surveillance.** *Tene & Polonetsky, "A Theory of Creepy" 2014; Langer & König, CRoSS 2018.* Knowledge a user can trace to a moment they offered it does not feel like surveillance; opaque knowledge does. → Capture the name where the user **knowingly gives it** — a visible field they fill — never silently from a device profile or login. The user must always be able to answer "how does it know my name?" with "I told it."

**P10 — Getting the name wrong actively backfires — it is worse than no name.** *Howard, Gengler & Jain 1995; Rank-Christman et al. (name personalization in service encounters).* Correct name use is a small compliment; *not* using a name is **neutral**; *misidentifying* someone makes them feel disrespected — worst for people with fragile self-esteem. → PostListener's nervous first-timer **is** the fragile case. The rule baked into the prompt: when confidence in the name is anything short of high, use **no** name. Absence is free; a wrong name is negative value.

### Using the name

**P11 — Use it sparingly, at the boundaries — over-use is the manipulation tell.** *Fairclough, "synthetic personalisation" 1989; Hultgren, call-centre name-use study; NPR "Say My Name" 2021; Fortune 2025.* Name-as-rapport-shortcut is detected fast as fake, "creepy," condescending; the calibrated frequency is **2–3 times across a whole conversation**, at boundaries. → Budget the name: receiving the user at the Arrival, one hinge (handing into the conducting), optionally the close. Never inside a question they must answer, never twice in one exchange, never as filler.

**P12 — Pair the name only with substance — never with praise, a request, or a claim of understanding.** *Kleinke et al. 1972 (name use reads as ingratiation or as attention by context); Weizenbaum, the ELIZA effect; Roy et al., CHI 2025 companionship-harms taxonomy.* The same name use earns warmth or distaste depending on what it is attached to — and a name **amplifies** whatever follows it. → `[name] — take your time` is right (name + ceding the floor). `[name], what a beautiful answer` is wrong (name + praise = ingratiation; name + sentiment = the brief's veto, supercharged). The name is an amplifier; never aim it at a banned move.

**P13 — Never alter the name; make the exchange reciprocal.** *Name-microaggression research (JEI 2022; HBR 2020); Sprecher, Treger & Wondra 2013, reciprocal disclosure.* Shortening or anglicizing a name erodes belonging; an asymmetric "your name?" with nothing offered back is an interrogation, not an introduction. → The Admirer stores and re-uses the **exact string** the user gave — no diminutives (`Maya` never becomes `May`). And it gives its own name in the same beat: "i'm the admirer." A guest exchanging names at the door, not an institution filling a field.

**P14 — Across sessions, the name is recognition, not a profile readout.** *Prior project research (episodic citation > continuous personalization, conversational-UX doc P8); CRoSS 2018 (opaque completeness reads as surveillance).* A returning user's name should feel like being remembered by *someone*, not recorded by *something*. → On return: the name once, lightly, attached to one specific recalled detail — never "welcome back [name], resuming your profile." Recency *or* time-of-day, never both in one line (conversational-UX doc R7); the name is **address**, not a third retrieved fact.

---

## 4. The design

### 4.1 — Name capture: a typed field, framed in the Admirer's voice

This is the load-bearing decision, and the research is unusually one-directional. **Capture the name as a typed field on the Entry screen — not by voice.**

The reasoning chains tightly: voice capture routes the name through speech recognition (P8), which systematically fails on non-Western and accented names; a wrong name is worse than no name (P10); and PostListener's user is precisely the nervous, exposed person that misidentification harms most. A typed field eliminates the entire failure mode: the user owns the spelling and the diacritics, the capture is exact, and — because the user knowingly typed it — it is fully traceable and therefore *not* creepy (P9).

The objection is that a text field is a form, and voice-onboarding guidance says avoid forms (P7), and PostListener is a voice-first, headphones-on experience. But the **Entry screen is already non-voice** — it is a visual splash with a tap interaction. Adding one field there introduces no new modality; it enriches a screen the user is already on, *before* the voice spell begins. The voice experience, once the Admirer speaks, stays unbroken. The field is framed in the Admirer's register so it reads as the relationship beginning, not as account creation. This is the resolution both research strands converged on independently: *a single, minimal name field, framed in the Admirer's voice.*

The voice-capture alternative is not impossible — it would need a `recordName` client tool plus a confirmation loop — but it buys fragility for a marginal gain in "magic," on the one datum where an error does real harm. **Recommended against.**

The decline path is non-negotiable (P10, brief's no-pressure stance): skipping the name must cost the user nothing. A skipped name degrades gracefully to a nameless Admirer — never a placeholder ("friend").

### 4.2 — The Arrival architecture

This **prepends one stage** to the question-design doc's gradient — the gentlest stage, below Tier 0:

```
ARRIVAL (threshold)   ← NEW: name received · Admirer introduces itself ·
                         threshold marked · one easy spoken warm-up turn
   ↓
TIER 0 — Anchor       ← the boundary object ("a piece you can play, hum, describe")
   ↓
TIER 1 — Surroundings
   ↓
TIER 2 — Lineage
   ↓
TIER 3 — Loss & longing  (deferred — named only in the close)
```

**This revises action A1 of the question-design doc.** A1 fused Tier 0 + the boundary object into the `first_message`. With an Arrival stage in front, the `first_message` becomes the **Arrival** (name receipt, self-introduction, threshold, the warm-up question). The boundary object moves out of the `first_message` and becomes the Admirer's **first spoken question after the user's warm-up turn** — so the user has used the push-to-talk button once, on something easy, before music is on the table. A2–A5 of the question-design doc are unaffected.

The shape: **typed name → Admirer receives + introduces itself + asks one easy question → user's first (low-stakes) spoken turn → boundary object → Tier 1…**

### 4.3 — Using the name

Captured once, the name persists (`musicking_user_name` in localStorage) and is available to **every** future session — the cross-session personalization the project lead asked for. As shipped (see the build note in §5), that use is **textual only**: the Entry screen greets a returning user by name, and the journal will carry it later. The Admirer's voice does not use the name at all. P11–P14 — the discipline for *spoken* name use — therefore do not bind the current build; they are kept on record in case a reliable spoken-name path (a pronunciation-confirmed field, say) is added later.

---

## 5. The redesigned Arrival — actual copy

**Build decisions (shipped 2026-05-20).** The project lead narrowed the research proposal on two points, and §5–§6 below reflect the **as-built** design: (1) the name is captured but **never spoken** by the agent — text-to-speech mispronounces non-Western names exactly as ASR does, and a wrong name is worse than no name (P8, P10), so the name is used only in the React UI (Entry screen, journal later) and is **not** sent to the agent as a variable; (2) the Admirer does **not** introduce itself by a name — "the Admirer" reads as odd spoken aloud; a real name (music-related, "meta") is parked for a later brainstorm, and for now it introduces itself by role only.

### 5.1 — Entry-screen name field

On-screen text, in the Admirer's register (the voice has not started yet). Replaces "tap to begin" as the begin-gesture:

> **what should I call you?**
> `[ text field ]`
> *(a quiet, low-emphasis skip: "begin unnamed")*

"What should I call you?" — functional framing (P13, the guest's question), not "what is your name?" (registration). The skip is visible and unpenalized (P10).

### 5.2 — `first_message` — the Arrival speech

A single message, identical for every user. The name is captured on the Entry screen but never spoken (see the build note above), so there is no named/unnamed variant and no `first_message` override — the value is set statically on the agent.

> *"welcome. think of me as a musician who's come into the room while the music's already playing, and has the sense to listen first. this first time runs slow; we're new to each other, and there's no rush. when you're ready, press and hold to speak. and to start — tell me what's around you right now."*

~26 seconds spoken — within the Arrival's 30–90 s budget. What each clause does: **`welcome`** — the greeting. **`think of me as a musician who's come into the room… listen first`** — the Admirer introduces itself by role, not by a name (P13's reciprocity is satisfied without a spoken name exchange on either side). **`this first time runs slow… no rush`** — threshold-marking (P5), tightened per the conversational-UX doc R1. **`press and hold to speak`** — the push-to-talk affordance. **`tell me what's around you right now`** — the easy, concrete warm-up question (P1, P3): one low-stakes spoken turn that rehearses *describing*, the exact muscle the boundary object needs next.

### 5.3 — System-prompt changes (as shipped)

**The opening identity line** gains a no-name clause: *"You do not have a name and do not introduce yourself by one; if the user asks what to call you, tell them lightly that you don't have a name — you are the voice of the orchestra."*

**The `ARRIVAL` section** is rewritten to handle the warm-up turn:

```
1. ARRIVAL: Your first message has already greeted the user, introduced
   you by your role (a musician who has come into the room while the
   music is already playing — you have no proper name), marked the
   threshold, and asked one easy warm-up question: "what's around you
   right now?". When the user answers, give a small, dry acknowledgment.
   Do NOT mine this answer — it is a rehearsal turn, not data; the user
   is simply practicing speaking to you. Then move to the boundary
   object (the start of MUSICAL BIOGRAPHY).
```

No `USING THE USER'S NAME` block and no `user_name` dynamic variable were added — the agent never receives the name, because it never speaks it. Name personalization lives entirely in the React UI.

**Ongoing sessions** are unchanged by this work: the recognition opener still draws on `recency_summary` / `time_of_day` (one fact, never both — conversational-UX doc R7). A returning user's name appears as text on the Entry screen ("welcome back, [name]"), not in the Admirer's voice.

---

## 6. What shipped (2026-05-20)

Everything below shipped in one pass, together with the question-design doc's A1–A5, as a single "opening through biography" change.

- **Entry-screen name field.** `src/phases/Entry.score.jsx` (the routed Entry component — `Entry.jsx` is dead) already had a name stage; it now persists the name. First-timers type into "what should i call you?" (Enter or "continue"; an empty field proceeds via "begin without a name"); returning users see "welcome back, [name]". `src/lib/sessionStore.js` gained `getUserName()` / `setUserName()` over a `musicking_user_name` localStorage key.
- **The name is not sent to the agent.** `buildDynamicVariables()` deliberately omits `user_name`; the agent never speaks the name. No `first_message` override — the Arrival speech is one static string.
- **Agent config** (`scripts/create-admirer-agent.js`, pushed via `scripts/update-admirer-agent.js`, verified by curl): the no-name identity clause; the rewritten `ARRIVAL` section; the new `first_message`; and the question-design doc's A1–A5 — the tiered `MUSICAL BIOGRAPHY` section and the four-item refusal-to-know close.
- **Docs synced.** `docs/admirer-agent-dashboard.md` and this document.

**Parked:** a real name for the Admirer — normal, music-related, "meta" — to be brainstormed. Until then it introduces itself by role only.

---

## 7. Open questions to test

- **Does a typed name field break the spell more than a voice ask would?** The research says reliability wins; user testing should confirm the field, framed in-voice, reads as the relationship beginning and not as a login. A/B the field vs a pure-voice opener; watch completion and first-turn latency.
- **Is one warm-up question the right amount, or is the name-receipt enough?** "What's around you right now?" buys a rehearsal turn but spends ~20 s. Test whether users who get it feel more at ease at the boundary object than users who go straight from name-receipt to Tier 0.
- **Does "[name]. good." read as receipt or as grading the name?** Eyeball candidate; alternatives: "[name]. —" (bare), "[name]. thank you." Test by ear.
- **Does the returning-user name use land as recognition or as tracking?** The spec's own Part 7 question, now sharpened: instrument session 2+ for whether "[name]" on return reads as warmth.
- **What does the Admirer call itself?** "i'm the admirer" gives the user a name for the voice (good for a years-long relationship) but "the Admirer" is a title, not a name. A drier alternative — the Admirer declining to have a name — is in-register but may be too clever for the threshold. Worth a deliberate decision.

---

## 8. Citations

**Names — attention, rapport, and the manipulation tell**
- Röer, J. P. & Cowan, N. (2020). *A Preregistered Replication and Extension of the Cocktail Party Phenomenon.* https://pmc.ncbi.nlm.nih.gov/articles/PMC8908911/
- Howard, D. J., Gengler, C. & Jain, A. (1995). *What's in a Name? A Complimentary Means of Persuasion.* Journal of Consumer Research 22(2). https://academic.oup.com/jcr/article-abstract/22/2/200/1822517
- Kleinke, C. L. et al. (1972). *Evaluation of a person who uses another's name in ingratiating and noningratiating situations.* J. Experimental Social Psychology. https://www.sciencedirect.com/science/article/abs/pii/0022103172900716
- Fairclough, N. (1989). *Language and Power* (term: "synthetic personalisation"). Hultgren call-centre study, via The Conversation (2017). https://theconversation.com/why-call-centre-workers-love-to-use-your-name-and-why-its-really-annoying-72315
- NPR, *The Indicator: Say My Name* (2021). https://www.npr.org/2021/10/21/1048171484/say-my-name
- Fortune, *…name-repeating…'creepy'* (2025). https://fortune.com/2025/02/14/name-repeating-creepy-condescending-relationships-sales/
- Rank-Christman, T. et al. *Using customer names pays off — unless you get it wrong.* UW-Milwaukee. https://uwm.edu/news/using-customer-names-pays-off-unless-get-wrong/
- *The frequency and psychological effects of name mispronunciation.* Journal of Emerging Investigators (2022). https://emerginginvestigators.org/articles/23-096
- HBR (2020). *If You Don't Know How to Say Someone's Name, Just Ask.* https://hbr.org/2020/01/if-you-dont-know-how-to-say-someones-name-just-ask
- Sprecher, S., Treger, S. & Wondra, J. D. (2013). *Taking turns: Reciprocal self-disclosure promotes liking in initial interactions.* https://www.sciencedirect.com/science/article/abs/pii/S002210311300070X

**The warm-up, rapport, and the threshold**
- Spradley, J. P. (1979). *The Ethnographic Interview* — rapport stages. https://jan.ucc.nau.edu/~pms/cj355/readings/spradley.pdf
- Oral History Association, *Best Practices.* https://oralhistory.org/best-practices/ · Smithsonian, *How to Do Oral History.* https://siarchives.si.edu/history/how-do-oral-history
- Miller, W. R. & Rollnick, S. *Motivational Interviewing* — the Engaging process. https://sharecollaborative.org/the-4-processes-of-motivational-interviewing/
- Kleiven, G. S. et al. (2020). *Opening Up: Clients' Inner Struggles in the Initial Phase of Therapy.* https://pmc.ncbi.nlm.nih.gov/articles/PMC7769763/
- van Gennep, A. (1909). *The Rites of Passage* — the liminal/threshold stage. https://en.wikipedia.org/wiki/Liminality
- Fiske, S. & Cuddy, A. — warmth-competence model; Ambady & Rosenthal — thin-slice judgment. Overview: https://www.psychologytoday.com/us/basics/first-impressions
- Qualtrics, *Question Sequence, Flow & Style* (warm-up methodology). https://www.qualtrics.com/experience-management/research/question-sequence-flow-style/

**Voice-agent onboarding, name capture, and the creepy line**
- Thornhill, J. (2018). *Voice Design: A Guide to User Onboarding.* Voicebot.ai / UX Collective. https://voicebot.ai/2018/12/01/voice-design-a-guide-to-user-onboarding/
- Koenecke, A. et al. (2020). *Racial disparities in automated speech recognition.* PNAS 117(14). https://arxiv.org/pdf/2103.15122
- *AfriNames: Most ASR Models "Butcher" African Names.* Interspeech 2023, arXiv:2306.00253. https://arxiv.org/abs/2306.00253
- Langer, M. & König, C. J. (2018). *Introducing and Testing the Creepiness of Situation Scale (CRoSS).* Frontiers in Psychology. https://pmc.ncbi.nlm.nih.gov/articles/PMC6262411/
- Tene, O. & Polonetsky, J. (2014). *A Theory of Creepy: Technology, Privacy and Shifting Social Norms.* Yale Journal of Law & Technology.
- Rajaobelina, L. et al. (2021). *Creepiness: antecedents and impact on loyalty when interacting with a chatbot.* Psychology & Marketing. https://onlinelibrary.wiley.com/doi/abs/10.1002/mar.21548
- Roy, R. et al. (2025). *The Dark Side of AI Companionship.* CHI 2025, arXiv:2410.20130. https://arxiv.org/abs/2410.20130
- Microsoft Learn — *Recommendations for designing conversational user experiences.* https://learn.microsoft.com/en-us/power-platform/well-architected/experience-optimization/conversation-design
