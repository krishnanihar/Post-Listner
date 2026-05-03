# Voice and Intimacy: Making the Admirer Feel Like Someone

**A synthesized voice crosses the threshold from performance to felt relationship when it functions not as a narrator describing experience but as a mirror confirming it.** The distinction between speaking *to* someone and speaking *at* them rests on three converging mechanisms: parasocial address structures that simulate direct interpersonal contact, acoustic-linguistic patterns historically reserved for physical proximity, and a persona architecture grounded in the psychoanalytic concept of the mirroring selfobject. For PostListener's Admirer — voiced by ElevenLabs Lily across a four-register arc from presence to dissolution — these mechanisms must operate within severe constraints: roughly 30 lines distributed across 16 minutes, embedded in a spatialized Web Audio environment, and designed with enough methodological rigor to anchor a funding proposal to ElevenLabs itself.

What follows is a principles-first investigation of how to design this voice, grounded in parasocial interaction theory, voice science, developmental psychology, and Kohutian psychoanalysis, then mapped to specific ElevenLabs parameters and spatial audio integration.

---

## I. When a voice becomes a someone: the psychology of felt address

The foundational question — when does a voice feel like it speaks *to me* rather than *at* an audience that includes me? — has a surprisingly specific answer in the research literature. Horton and Wohl's 1956 landmark paper on parasocial interaction identified the behavioral repertoire that produces what they called the "illusion of face-to-face relationship": direct address, conversational informality, the simulation of responding to the audience's presence, and what they termed "designed informality" — casualness that is in fact carefully constructed. Dave Garroway, the NBC host they studied, described the technique explicitly: "I consciously tried to talk to the listener as an individual, to make each listener feel that he knew me and I knew him." The key structural insight is that parasocial interaction preserves the listener's autonomous selfhood. Unlike theatrical identification, where the audience loses itself in a character, the parasocial bond lets the listener retain control over the content of their participation. The Admirer must work the same way — **confirming the listener's experience without absorbing or directing it**.

Contemporary research has sharpened these findings for audio-specific contexts. Yorganci and McMurtry's 2024 study of podcast listeners identified seven authenticity markers driving parasocial bonds: ordinariness, immediacy, similarity, freedom, spontaneity, imperfection, and confessions. These cluster into two pathways — "a feeling of friendship" and "a feeling of knowing the hosts." The most provocative recent contribution is Sharon and John's 2024 work on what they call the **"inverse parasocial relationship"** — the bond that *performers* form with imagined listeners. They found that podcasters construct detailed mental images of a single listener and address their narration to that imagined individual, producing intimacy that is "inevitably recursive" — communication with a projection of oneself. This is directly relevant to scripting the Admirer: the writer must practice conscious inverse parasocial imagination, constructing a specific singular listener, while guarding against the narcissistic recursion Sharon and John identify. The Admirer must address someone genuinely other, not a mirror.

### The mirroring selfobject and the psychology of being seen

The Admirer's name is not accidental — it derives from Heinz Kohut's concept of the **mirroring selfobject function**, one of three fundamental selfobject needs he identified in his 1971 *Analysis of the Self*. In Kohut's framework, the mirroring need is "the need to be seen, understood, and validated" — originally met by the caregiver who recognizes the child's capabilities and reflects back a sense of their value. Kohut's evocative image is "the gleam in the mother's eye," the confirming-approving response that shores up the developing self. This need, crucially, never disappears — it matures from infantile neediness to adult intimacy but remains, in Kohut's words, "essential psychological nutrients, analogous to oxygen for physical survival."

Carl Rogers arrives at a parallel formulation from the therapeutic tradition. His concept of unconditional positive regard — "warm acceptance… a 'prizing' of the person… a caring for the client, but not in a possessive way" — describes the same function. Rogers captured the emotional impact precisely: "When a person realizes he has been deeply heard, his eyes moisten. I think in some real sense he is weeping for joy. It is as though he were saying, 'Thank God, somebody heard me. Someone knows what it's like to be me.'" Neurobiological research confirms the mechanism: emotional validation deactivates amygdala threat responses, triggers dopamine release, and accelerates attachment formation. The nervous system interprets recognition as a signal of safety.

**The Admirer, then, is designed to function as a temporary cultural selfobject** — a figure who supports the listener's cohesive experience of self through aesthetic encounter. It should mirror the listener's experience as valuable without evaluating or directing it. The distinction matters: the Admirer says "I see what you're creating" rather than "you're doing well," and "this is extraordinary" rather than "keep going, you can do better." Non-possessive warmth, not instruction.

### Intimacy at scale and the for-anyone-as-someone structure

A critical challenge: the Admirer is a single recorded voice producing felt individual address for every listener hearing the same audio. Paddy Scannell's concept of the "for-anyone-as-someone" communicative structure describes how broadcast media solved this problem historically — speaking to anyone who happens to be listening, yet doing so *as if* addressing someone specific. The microphone itself is the enabling technology. As John Durham Peters observed, "the microphone makes audible a vocal range that historically would have required not just physical proximity, but intimate contact, the distance of a mother or lover."

PostListener amplifies this effect through spatial audio — the voice is not merely close but *positioned in three-dimensional space around the listener*. The practical design principle that emerges from intimacy-at-scale research is **strategic vagueness**: the Admirer should be specific about aesthetic and emotional experience (which many share) but deliberately vague about biographical details (which would exclude). Horton and Wohl noted that the "Lonesome Gal" radio persona kept her personality unfocused precisely because "each specification of particular detail might alienate some part of the audience." The Admirer describes what is happening in the music — never what the listener's life is like outside the experience.

---

## II. The acoustic and linguistic architecture of intimate address

### Voice quality matters more than volume

The most important empirical finding for this project comes from Gobl and Ní Chasaide's 2003 study at Trinity College Dublin: **breathy and whispery voice qualities were rated highest for intimate and tender affect**, while modal voice (normal phonation) occupied a neutral position and tense/harsh voices read as confident or assertive. Their follow-up work with Yanushevskaya (2013) demonstrated that these intimacy ratings held even when loudness was equalized — meaning voice quality, not volume, is the primary carrier of felt closeness. The acoustic markers of intimacy are increased aspiration noise (breathiness), higher spectral tilt, reduced harmonics-to-noise ratio, and soft phonation onset.

The proximity effect reinforces this at the recording level. When a sound source is within a few inches of a directional microphone, low frequencies below 200 Hz are boosted by **6–12 dB**, creating perceived warmth and body. More importantly, close-miking captures mouth sounds, lip movements, and breath noise that signal physical nearness — the auditory equivalent of feeling someone's breath. For a synthesized voice like Lily, this proximity must be simulated through post-processing: low-end warmth added through EQ, slight breath samples layered at phrase onsets, and room-tone fill replacing digital silence.

Pitch, pace, and dynamic range shift predictably between intimate and broadcast registers. Research on speech in romantic and close interpersonal contexts shows speakers lower their fundamental frequency, narrow their dynamic range, slow their pace, and increase pause duration. Intimate speech operates in the **low-to-mid range** of one's speaking register with smaller differences between peaks and valleys — "conversational immediacy" rather than dramatic projection. The Admirer's baseline should sit in the lower third of Lily's pitch range, with narrow dynamics and generous pauses.

### Breath, silence, and the felt-presence problem

ASMR research provides the most granular understanding of breath as intimacy signal. A 2022 fMRI study at the Max Planck Institute found that natural breath variance — the micro-tremors, slight pitch inflections, and timing irregularities rooted in autonomic state — activated the **insula and anterior cingulate cortex** (interoceptive awareness and emotional resonance). Synthetic versions with regularized breathing activated auditory cortex alone — "processing sound as information, not as relational cue." This finding is sobering for a synthesized voice project: ElevenLabs outputs lack natural breath variance. The solution is either post-production layering of real breath samples or use of v3 audio tags like `[breathes in]` and `[sighs]`, accepting that these approximate rather than replicate organic breath.

The silence budget is the most operationally critical acoustic question for PostListener. With approximately 30 lines across 16 minutes, the Admirer must sustain felt presence across long silences — roughly one utterance every 30 seconds on average, though likely structured as clusters with longer gaps. A 2023 Johns Hopkins study (Goh, Phillips, Firestone) in *PNAS* proved that silence is "genuinely perceived," not merely inferred — silence functions as an auditory event the listener actively processes. Meditation research suggests practical thresholds:

- **0–15 seconds**: Silence reads as a pause — the listener expects the voice to return
- **15–45 seconds**: Silence reads as deliberate space — attention may wander but returns quickly if music fills the gap
- **45–90 seconds**: Silence reads as absence — felt relationship begins to decay without sonic anchoring
- **90+ seconds**: Extended silence requires prior priming (a body-scanning instruction, a musical gesture functioning as "presence proxy")

The design implication is clear: **the music itself must carry the Admirer's presence between utterances**. When the Admirer falls silent, the musical environment — established in Workstream B and spatialized in Workstream C — functions as what meditation teachers call a "holding environment." The Admirer should front-load voice presence in minutes 1–3, expand silence during the conducting peak (minutes 4–10), and return to closer spacing for closure.

### Ericksonian language and the grammar of felt address

The Milton Model — the linguistic patterns derived from Milton Erickson's hypnotic language — provides the most precise toolkit for producing felt personal address in a pre-recorded voice. The core mechanism is **pacing and leading**: begin by describing what is verifiably true for the listener (pacing), then guide toward the desired experiential state (leading). The standard structure is three pacing statements followed by one leading suggestion: "As you hear the sound around you… as you notice the weight of your hands… as you feel the air on your skin… you may find something in you beginning to settle."

Several specific patterns are directly applicable:

**Artful vagueness** uses abstract nouns (nominalizations) that the listener fills with personal meaning — "a certain feeling," "a growing awareness," "something shifting." The listener must search their own experience for referents, creating personalized engagement from generic text. **Embedded commands** hide directives within larger sentences, marked by subtle vocal emphasis: "I don't know exactly when you'll begin to *feel at ease here*." **Presuppositions** assume something is already true, bypassing conscious resistance: "As you become aware of how much has changed…" (presupposes change has occurred). **Temporal linkage** connects unrelated events: "While you notice the music moving, something in you can begin to open."

Every major meditation app voice uses these patterns. Andy Puddicombe (Headspace) begins sessions with sensory pacing before transitioning to internal focus. Tamara Levitt (Calm) uses nominalizations and presuppositions extensively. Sam Harris (Waking Up) employs a more direct analytical style but still uses embedded commands in his pointing-out instructions. All three share second-person address, present tense, permissive framing ("You may notice…" rather than "You will notice…"), and gradual movement from external sensory awareness inward. The Admirer should follow this trajectory — beginning with observable present-tense reality and moving toward internal aesthetic experience — while maintaining its character as an admiring witness rather than a meditation teacher.

Second-person present-tense narration is the grammatical foundation. Brunyé et al. (2011) demonstrated experimentally that readers "embody an actor's perspective only when directly addressed as the subject of a sentence." "You are here" is a direct assertion that presupposes the listener IS in the described state; "Imagine you are here" is an instruction that maintains separation. The pronoun "you" is, as McHale writes, "par excellence the sign of relation" — it announces a communicative circuit between addressor and addressee more powerfully than even "I."

---

## III. The Admirer as character: a four-register arc grounded in developmental research

### Present register — establishing the gleam

The opening register recapitulates the first moment of attunement. Daniel Stern's research on mother-infant interaction (1985, 2010) describes affect attunement as the mechanism by which caregivers communicate "I am with you" — not through exact mimicry but through **cross-modal matching** of the infant's vitality form. When asked why they attuned, mothers answered: "to be with," "to join," "to share," "to participate." These are precisely the functions of the Present register. The Admirer arrives, notices the listener, and communicates — through tone more than content — that their presence is registered and valued.

The acoustic profile draws on Stern's vocabulary of vitality affects: steady, grounded, with a quality of sustained attention. Mid-range pitch, moderate pace, warm but not effusive timbre. Linguistically, the Present register uses observational statements in second-person present tense, pacing what is verifiably true: "You're here. Your hands are open." No evaluation, no instruction — pure acknowledgment. This is the Kohutian gleam: the voice that says, without saying it, *I see you and what I see is worth attending to*.

### Elevated register — the amplification function

The conducting peak calls for what Stern observed mothers doing during play: matching and *amplifying* the child's joy. In his framework, the caregiver shares "the same emotion and vitality form," confirming "this is a joyful experience." Stern used explicitly musical language for vitality affects — "surging," "crescendo," "bursting" — and the Elevated register translates these into vocal performance. The acoustic shift is significant: higher pitch with wider range, faster tempo, ascending pitch contours, and breathiness suggesting genuine astonishment. Research on emotional prosody identifies these as consistent markers of positive high-arousal states across cultures.

The critical design distinction is between performed excitement and **shared wonder**. The Admirer should not sound like a cheerleader encouraging the listener but like a co-witness experiencing amazement alongside them. The language shifts from observational to exclamatory: "Oh — do you hear that? You're building something." The voice should sound *moved* — swept up in the same experience the listener is conducting into existence. In Kohutian terms, this is the mirroring function at its most active: reflecting not just the listener's presence but the value of what they are creating.

### Caretaking register — the lullaby function

When the music begins to dissolve, the Admirer shifts to a register with deep evolutionary roots. Cross-cultural research on lullabies (Mehr et al., 2019; Trehub and Trainor) identifies consistent acoustic features: slow tempo, falling pitch contours, limited amplitude variation, simple repetitive patterns. These features produce measurable physiological responses — reduced heart rate, pupil constriction, decreased electrodermal activity — even in response to unfamiliar foreign lullabies. **The relaxation response is triggered by the signal's acoustic properties, not its content.** This means the Admirer's caretaking register can achieve its soothing function through prosodic design alone.

The same research distinguishes playsongs (high arousal, wide pitch range) from lullabies (low arousal, narrow pitch range) — and demonstrates that the same song can function as either depending entirely on performance style. The caretaking voice narrows its pitch range, slows its pace, and shifts to falling terminal contours. Linguistically, it moves toward body-oriented grounding language: "Feel your weight in the chair." Hospice voice research reinforces this: the key principle is that **presence matters more than action**. The voice's role shifts from communicating information to simply being there. Hospice workers speak in normal tone — not whispering, which signals crisis — slowly, calmly, with gentle reassurance. The Admirer should do the same.

### Fading/Return register — withdrawal without the still face

The most psychologically delicate register draws on Tronick's still-face experiment (1975/78): when a mother holds an unresponsive expressionless face after normal interaction, the infant "rapidly sobers and grows wary," makes repeated attempts to restore the interaction, then "withdraws with a withdrawn, hopeless facial expression." Tronick described the still-face mother as "communicating Hello and Goodbye simultaneously." The Admirer's withdrawal must avoid this — even in fading, it must not communicate contradictory signals. The reunion research shows a "carryover effect of negative affect" even after the mother resumes normal interaction, suggesting that **withdrawal must be gradual, internally consistent, and framed as completion rather than abandonment**.

Hospice literature provides the model: "Just as you are losing someone you love, the dying person is in the process of losing everyone and everything he/she loves. It is only natural to be withdrawn." The critical principle is that withdrawal is preparation, not abandonment, and that voice should continue even without response — "your voice keeps the person connected." The acoustic features for fading are increased pause duration, slower speech approaching stillness, narrowing pitch range toward monotone, reduced volume, simpler syntax, and falling terminal contours. Stern's own vocabulary supplies the template: "fading away," "drawn out," "decrescendo."

**The built-in ending is the project's greatest ethical strength.** Unlike AI companions that persist indefinitely — fostering dependency through what researchers call "automated parasociality" — PostListener's Admirer *leaves by design*. This models what Kohut called "optimal frustration": tolerable disappointment that enables the listener to internalize the experience of being seen and then continue without the external mirror. The music was always theirs. The Admirer was always temporary.

### Example lines across the arc

These are illustrative, demonstrating linguistic approach per register — not production script.

**Present** — *moderate pace, mid pitch, warm, observational:*
- "You're here. Your hands are open. That's where we begin."
- "There's a sound forming just ahead of us. Stay with it."
- "I notice the way you're listening — the tilt, the stillness."

**Elevated** — *faster, higher, wider pitch range, shared wonder:*
- "Oh — do you hear that? You're building something. It's rising."
- "This is yours. Every note following your hand — you're conducting this into existence."
- "I've never heard it go there before."

**Caretaking** — *slower, narrower pitch, falling contours, body-oriented:*
- "The sound is thinning. That's alright. Feel your weight in the chair."
- "You don't need to hold it together. Let the edges go soft."
- "Breathe. There's still warmth here. I'm still here."

**Fading/Return** — *very slow, flattening pitch, increasingly sparse:*
- "The music is…  almost."
- "You were…  wonderful."
- [Long silence] "…yours." [Silence]

---

## IV. ElevenLabs Lily and practical parameter configuration

### Lily's voice identity and the v3 model

Lily (voice ID `pFZP5JQG7iQjIQuC4Bku`) is described in ElevenLabs metadata as "British, warm, confident, female, middle-aged, narration" — with additional characterizations across sources as "raspy," "expressive," and "characterful." Her warmth and narration orientation align well with intimate spatial storytelling; her British accent adds gravitas without distance; her expressiveness provides range for the four-register arc. As a pre-made curated voice rather than a clone, she is well-optimized and consistent across generations — important for producing ~30 clips that must cohere as a single persona.

**ElevenLabs v3 (eleven_v3) is the recommended primary model** for this project. It is the most expressive and emotionally rich model available, built for performance rather than reading, and critically, it supports **audio tags** — inline performance directions that shape delivery without requiring separate parameter configurations. The model is in alpha as of mid-2026, meaning outputs are nondeterministic and require a curation workflow (generating 3–5 takes per clip and selecting the best). For clips where v3 produces inconsistent results — particularly grounded Present-register lines where subtlety matters — **Multilingual v2 (eleven_multilingual_v2)** serves as a reliable fallback, offering SSML break tag support and more stable outputs at the cost of reduced emotional range.

### The parameter landscape

ElevenLabs exposes four primary voice settings, each with specific implications for the Admirer:

**Stability** (0.0–1.0) is the most consequential parameter. It controls the randomness of generation. In v3, it maps to named modes: Creative (low, ~0.2–0.4) produces maximum emotional expressiveness and responsiveness to audio tags but risks "hallucinations" — unexpected artifacts, pacing irregularities, and instability. Natural (mid, ~0.4–0.6) provides the closest match to the original voice recording with balanced expressiveness. Robust (high, ~0.7–0.9) delivers consistency at the cost of flatter, less responsive delivery. For the four-register arc, Stability should vary: **Natural mode for Present and Caretaking** (where warmth and consistency matter), **Creative mode for Elevated** (where expressiveness justifies the instability risk), and **Natural-to-Creative for Fading** (where emotional variability serves the melancholy withdrawal).

**Similarity Boost** (0.0–1.0, default 0.75) controls adherence to Lily's original voice characteristics. Higher values stay closer to her natural timbre but may introduce artifacts; lower values allow more variation. The recommended range is **0.70–0.80** — high enough to maintain Lily's identity across clips, with the Elevated register dropping slightly to 0.70 for more expressive freedom.

**Style Exaggeration** (0.0–1.0) amplifies the original speaker's style but is not recommended for v3, which uses audio tags for expressive control instead. Keep at **0.0** for all registers. **Speaker Boost** is similarly irrelevant — it is not available for the v3 model.

**Speed** (0.7–1.2) provides global pace control and should vary by register: **0.95** (Present), **1.05–1.10** (Elevated), **0.90** (Caretaking), **0.85–0.90** (Fading).

### Audio tags for the four registers

V3's audio tags are the primary mechanism for shaping the Admirer's emotional arc. Tags are bracketed words interpreted as performance directions rather than spoken text, affecting all subsequent content until a new tag is introduced. The tags most relevant to each register:

| Register | Primary Tags | Supporting Tags |
|----------|-------------|-----------------|
| Present | `[calm]`, `[gently]`, `[deliberate]` | `[conversational tone]`, `[pause]` |
| Elevated | `[excited]`, `[awe]` | `[laughs softly]`, `[cheerfully]`, `[gasps]` |
| Caretaking | `[softly]`, `[gently]`, `[whispers]` | `[warmly]`, `[sigh]`, `[quietly]` |
| Fading | `[tired]`, `[sighs]`, `[drawn out]` | `[resigned tone]`, `[hesitates]`, `[whispers]` |

An important caveat: tags are occasionally spoken aloud rather than interpreted, particularly with unfamiliar voice-tag combinations. **Lily's compatibility with each tag must be tested empirically** — generate test clips with each tag and verify interpretation. The punctuation toolkit supplements tags: ellipses for hesitant pauses, em dashes for dramatic breaks, periods for firm stops, and capitalization for emphasis on specific words. V3 does not support SSML break tags; pacing is controlled entirely through punctuation and audio tags.

### Consistency across 30 clips

Maintaining a coherent Admirer persona across separate generations is the primary production challenge. The API provides `previous_text` and `next_text` parameters — strings representing the script context surrounding the current clip — which influence prosody and emotional continuity even though the clips are generated independently. For each clip, supply the text of the preceding and following lines so the model understands the arc position. Use **identical voice_settings within each register** and a **consistent seed value** within register groups for more reproducible baselines.

The practical workflow is:

1. Write all ~30 lines with register assignments and audio tag annotations
2. Generate each clip 3–5 times with `previous_text`/`next_text` context
3. Select the best take per line (the "audition" workflow — standard practice for professional ElevenLabs projects)
4. Export as uncompressed **PCM 48kHz** for maximum post-processing flexibility
5. Normalize all clips to consistent loudness (e.g., **-16 LUFS**)
6. Apply register-specific post-processing before spatial placement

ElevenLabs Creative Studio supports per-paragraph regeneration and voice assignment, providing an integrated production workflow for managing this process.

### Honest limitations

The technology is impressive but imperfect. V3 is in alpha; outputs require curation. There is **no fine-grained pitch control** — exact pitch curves and formant adjustments are not available. Emotional transitions within a single generation can be jarring, favoring the clip-per-line approach. ElevenLabs voices lack natural breath sounds, room tone, and microphone coloration — all of which must be added in post-production. The emotional range is genuine but not equivalent to a skilled human voice actor: it is closer to a talented reader following directions than a Method actor inhabiting a character. For a spatial audio installation, the slight synthetic quality may actually serve the project aesthetically — the Admirer as digital presence, neither fully human nor fully machine, a liminal companion.

---

## V. Voice design specification and integration

### Register-to-parameter mapping

| Parameter | Present | Elevated | Caretaking | Fading/Return |
|-----------|---------|----------|------------|---------------|
| Model | eleven_v3 | eleven_v3 | eleven_v3 | eleven_v3 |
| Stability | 0.50 (Natural) | 0.30 (Creative) | 0.50 (Natural) | 0.40 (Nat→Creative) |
| Similarity Boost | 0.80 | 0.70 | 0.80 | 0.75 |
| Style Exaggeration | 0.0 | 0.0 | 0.0 | 0.0 |
| Speed | 0.95 | 1.05–1.10 | 0.90 | 0.85–0.90 |
| Pitch range | Low-to-mid | Mid-to-high, wide | Narrow, low-mid | Flattening toward monotone |
| Voice quality | Warm modal | Breathy-excited | Soft, near-whisper | Tired, dissolving |
| Pace | Measured, grounded | Quick, breathless | Slow, deliberate | Very slow, trailing |
| Silence between lines | 15–30s | 20–45s | 30–60s | 60–90s+ |

### Spatial audio integration specification

The Admirer voice sits within the Web Audio API architecture established in Workstream C. The signal chain:

```
ElevenLabs WAV (mono, 48kHz)
  → High-pass filter (80–120 Hz, remove sub-bass rumble)
  → Corrective EQ (+2–3 dB at 200 Hz for warmth, +1–2 dB at 3–5 kHz for presence, gentle cut at 6–8 kHz if sibilant)
  → Light compression (2:1 ratio, slow attack to preserve transients)
  → GainNode (per-clip volume automation by register)
  → PannerNode (panningModel: 'HRTF', mono source input)
  → ConvolverNode (binaural room impulse response for spatial reverb)
  → Master bus normalization
```

**Spatial positioning by register** reinforces the emotional arc:

- **Present**: Close to listener (PannerNode distance **1–2 units**), centered or slightly off-center. Minimal reverb — dry, intimate, "inside-the-head."
- **Elevated**: Slightly elevated in the spatial field, wider placement. Moderate reverb (hall-like, 1.5–2s decay). May move or orbit slightly to convey expansiveness.
- **Caretaking**: Very close (distance **<1 unit**), slightly off-axis for intimacy. Short reverb (0.5–0.8s, small room). The voice should feel whispered near the ear.
- **Fading/Return**: Gradually increasing PannerNode distance to simulate withdrawal. Longer reverb decay (2–3s). Automate a gentle high-frequency rolloff (low-pass filter from 8 kHz down to 4 kHz across the register) to simulate the voice receding. Use the Web Audio API's distance attenuation model (`inverse` or `exponential`) to physically enact the withdrawal.

Add **subtle room tone** (5–10 dB below voice level) underneath all clips to provide acoustic "glue" and mask the clean digital quality of TTS output. Layer occasional **real breath samples** at phrase onsets from a recorded library to bridge the gap identified in the Max Planck fMRI study between synthetic and organic breath as relational cue. Consider very slight pitch modulation (±2–3 cents) to break up overly perfect tuning.

### The ethics of a designed intimate voice

The research surfaced four distinct risk categories that PostListener's design must address.

**Parasocial dependency** is the most commonly cited concern with intimate AI voices. A 2025 four-week RCT (n=981, Fang et al.) found that voice-based chatbots initially mitigated loneliness compared to text, but "these advantages diminished at high usage levels." PostListener's **bounded 16-minute duration** is itself the primary safeguard — the experience has a clear beginning and end, unlike infinite-scroll parasocial platforms. The Admirer's built-in dissolution phase models what most AI companion products fail to provide: a designed ending. The research literature (arXiv, "Harmful Traits of AI Companions," 2025) specifically identifies "the lack of built-in mechanisms for healthy disengagement" as a critical gap in AI companion design. PostListener fills this gap by architecture.

**The creepy/uncanny risk** arises when a voice simulates understanding it does not possess. PMC research on emotional AI and pseudo-intimacy (2025) warns that "the more realistic the simulation, the more users project human attributes onto the machine." The Admirer should observe actions — conducting gestures, presence in the space — but never simulate understanding the listener's inner life. It admires what the listener creates, not who the listener is.

**The surveillance/control risk** emerges when emotional tracking serves re-engagement optimization. PostListener avoids this by design: conducting gesture data should not be stored for behavioral profiling, and there is no data retention loop that learns and optimizes for return visits.

**Informed consent** requires that users understand they are interacting with a synthesized voice before the experience begins. The onboarding should make this clear — not as a disclaimer that diminishes the experience, but as a framing that enables it. A post-experience acknowledgment can ground the listener: something in the spirit of "The music was yours. The voice was synthesized. What you felt was real."

The Admirer must avoid romantic or erotic framing. Its register should evoke the caregiver, the witness, the companion — not the lover. Kohut's distinction is useful here: the Admirer offers mirroring (reflecting the listener's experience) and twinship (shared aesthetic encounter), but not merger (possessive fusion). The voice confirms the listener's experience and then, by design, lets go.

### A practical guide for generating the Admirer

The production workflow in summary:

1. **Script**: Write all ~30 lines, annotating each with register, audio tags, `previous_text` and `next_text` context, and target silence duration before the next line
2. **Generate**: Use ElevenLabs API with voice ID `pFZP5JQG7iQjIQuC4Bku`, model `eleven_v3`, register-specific parameters per the table above, and output format `pcm_48000`
3. **Audition**: Generate 3–5 takes per line; select the best. Budget for Creative-mode registers (Elevated, Fading) requiring more takes due to higher variability
4. **Post-process**: Apply the signal chain above — EQ for warmth and presence, light compression, volume normalization to -16 LUFS
5. **Spatialize**: Place each clip in the Web Audio graph as a mono source feeding a PannerNode with HRTF panning, with register-specific distance, position, and reverb parameters
6. **Add organic elements**: Layer breath samples, room tone, and subtle analog saturation to bridge the synthetic-to-natural gap
7. **Test silence budget**: Verify that felt presence sustains across the longest planned silences; adjust clip spacing or add musical "presence proxy" gestures where the relationship decays

Estimated API usage: ~30 clips × ~300 characters average × 5 takes = ~45,000 characters. ElevenLabs Creator tier ($22/month, 100K characters included) covers this comfortably; Pro tier ($99/month, 500K characters) provides ample room for extended experimentation during development.

### What this research defends in the funding proposal

The Admirer voice design is grounded in peer-reviewed research across five disciplines: parasocial interaction theory (Horton & Wohl 1956; Sharon & John 2024; Scannell 2000), voice science (Gobl & Ní Chasaide 2003; Yanushevskaya et al. 2013), developmental psychology (Stern 1985; Tronick 1978; Mehr et al. 2019), self psychology (Kohut 1971, 1977), and humanistic therapy (Rogers 1961). The four-register arc maps onto documented developmental and relational patterns — attunement, amplification, caretaking, and optimal frustration — that produce measurable physiological and emotional responses. The parameter configurations are derived from ElevenLabs' own documentation and community-validated best practices, applied to a novel use case.

The proposal can argue that PostListener represents something ElevenLabs has not yet showcased: a synthesized voice functioning not as narrator, assistant, or character in a story, but as a **relational presence** — a temporary selfobject that uses spatial audio and Ericksonian linguistic structure to produce felt intimate address at scale, then dissolves by design. The ethical architecture — bounded duration, designed ending, transparent artifice, no data retention — addresses every major concern in the current literature on AI companion risks. The Admirer is not trying to be human. It is trying to be *someone* — warm, temporary, and honest about what it is.