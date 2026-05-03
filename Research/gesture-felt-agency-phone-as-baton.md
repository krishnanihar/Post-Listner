# Gesture, causality, and felt agency: making the phone-as-baton feel real

**The difference between a user who feels they are conducting an orchestra and one who feels they are waving a phone near some music comes down to three factors: latency under 20 milliseconds, learnable many-to-many mappings between gesture and sound, and the absence of any competing explanation for why the music changed.** These conditions — drawn from sensorimotor psychology, the NIME (New Interfaces for Musical Expression) community, and 25 years of virtual conducting research — are individually necessary and collectively sufficient for felt agency in a phone-based conducting interface. The research establishes that non-musicians can achieve compelling felt agency through simplified conducting gestures within minutes, but only if the system's mapping architecture treats gesture-sound coupling as the instrument itself rather than as a control layer atop pre-existing music. PostListener's previous "loose" feel almost certainly resulted from one-to-one mappings that were immediately transparent and therefore boring, combined with insufficient cross-coupling between gesture dimensions and audio parameters.

---

## 1. When motion feels like causation, not correlation

The core perceptual question — when does gesture feel like it is *causing* sound rather than merely accompanying it? — has a substantial research base converging on a clear answer. Three theoretical frameworks, each validated through distinct experimental traditions, define the conditions.

### Sensorimotor contingency theory and what it demands

O'Regan and Noë's foundational 2001 paper argues that perception is not the passive construction of internal representations but a **skillful activity of exploring the environment through lawful action-perception relationships**. Their central claim: "seeing is a way of acting... The experience of seeing occurs when the organism masters what we call the governing laws of sensorimotor contingency." Applied to PostListener, this means felt agency over music requires the user to *master* — not merely encounter — predictable relationships between arm motion and sonic change. The transition from "I'm waving my phone and stuff happens" to "I know exactly what will happen when I raise my arm slowly" is the transition from perceptual coupling to perceptual awareness.

Gonzalez-Grandon and Bhatt (Phenomenology and the Cognitive Sciences, 2019) extended this framework to auditory perception, showing that motor system activation occurs consistently during passive music listening — the brain covertly simulates the movements that would produce the sounds. Zatorre, Chen, and Penhune (Nature Reviews Neuroscience, 2007) confirmed co-activation of auditory and motor systems in both listening and performing. The implication is direct: **the richer the sensorimotor contingency space** (the more distinct, predictable action-outcome relationships the system offers), the deeper the perceptual experience of conducting.

### The comparator model and prediction error

The comparator model (Blakemore, Wolpert, and Frith, 2000, 2002) provides the neural mechanism. When the brain issues a motor command, an efference copy generates a predicted sensory state. A comparator checks predicted against actual sensory consequences. **When they match, agency emerges. When they mismatch, agency diminishes.** This is why you cannot tickle yourself — self-generated stimulation is predicted and therefore attenuated. Synofzik, Vosgerau, and Newen (Consciousness and Cognition, 2008) refined this into a two-level model: a pre-reflective *feeling* of agency (based on sensorimotor matching) and a reflective *judgment* of agency (influenced by contextual cues and narrative framing).

For PostListener, this means the audio response must be **predictable enough for the motor system to form accurate forward models**, but not so predictable that sensory attenuation eliminates novelty. The user's brain needs material to predict with, and occasional surprises to attend to.

### Wegner's three conditions of apparent causation

Wegner and Wheatley (1999) identified three conditions under which people attribute events to their own actions: **priority** (the intention precedes the effect), **consistency** (the action is semantically compatible with the effect), and **exclusivity** (no other obvious cause is present). PostListener's previous build likely violated exclusivity — if the music appeared to follow its own pre-composed timeline regardless of user input, felt agency collapsed. The exclusivity condition means the system must never let the music appear to change independently during the conducting phase. Every audible change should be attributable to gesture.

### The latency budget: where causation lives and dies

Published thresholds from music interface research establish a remarkably consistent picture. Wessel and Wright (Computer Music Journal, 2002) set the gold standard at **≤10ms latency with ≤±1ms jitter** for intimate musical control. Jack, Stockman, and McPherson (Music Perception, 2018) found no perceptual difference between 0ms and 10ms, but significant degradation at 20ms — placing the critical threshold between 10ms and 20ms. Crucially, **jitter may be worse than constant latency**: their 10ms ± 3ms jitter condition was rated as poorly as flat 20ms delay.

Mäki-Patola and Hämäläinen (ICMC, 2004) tested gesture-controlled continuous sound instruments specifically — the closest published analogue to PostListener's baton use case. They found **perception thresholds between 20 and 30ms** for continuous control, with the critical insight that continuous mappings tolerate higher latency than discrete/percussive events because gradual audio changes lack the sharp transients that anchor precise temporal judgment.

| Latency range | Perceptual effect | Design implication |
|---|---|---|
| **<10ms** | Indistinguishable from zero | Gold standard; difficult in browser |
| **10–20ms** | Barely noticeable; acceptable | Achievable target for Web Audio API |
| **20–50ms** | Noticeable but still feels causal | Boundary zone; continuous mappings tolerate this |
| **50–100ms** | Clearly delayed; agency weakens | Problematic for discrete events |
| **>150ms** | Causation perception collapses | System feels disconnected |

### Auditory ownership and the extended body

The rubber hand illusion (Botvinick and Cohen, 1998) demonstrates that synchronous multisensory feedback can cause people to feel ownership of an external object. Radziun and Ehrsson (Journal of Experimental Psychology, 2018) showed that body-related sounds modulate this illusion — synchronous auditory cues enhanced it, asynchronous cues weakened it. A 2025 paper in Scientific Reports describes a "rubber voice illusion" where speakers adopt a stranger's voice as self-generated when it is perfectly time-locked to their own speech. These findings confirm that **auditory ownership illusions are possible** given tight temporal coupling, supporting the viability of the phone-as-baton metaphor.

Maravita and Iriki (Trends in Cognitive Sciences, 2004) showed that tool use causes neural receptive fields to expand to include the tool — the tool becomes part of the body schema. A conductor's baton is a natural candidate for this incorporation, but it requires consistent, reliable, low-latency sensory feedback correlated with the tool's use.

### Individual differences and the "dancing with an app" failure mode

Felt agency varies significantly across users. Musical training sharpens sensorimotor synchronization precision and forward model accuracy but also increases sensitivity to imprecise mappings (Jack et al., 2018). Internal locus of control (Rotter, 1966) predicts higher criticality toward imperfect agency situations. The practical implication: **musically trained users will feel agency sooner but judge the system more harshly**, while non-musicians need simpler initial mappings but are more forgiving of latency.

The "dancing with an app" failure mode — where the user shifts from feeling like they control the sound to feeling like they perform gestures for the app — occurs when temporal coupling loosens past ~100ms, when the mapping becomes ambiguous (the user cannot tell which gesture caused which change), when the music changes independently (violating Wegner's exclusivity), or when prediction errors accumulate without the user's forward model being able to recalibrate. Norman's Gulf of Evaluation applies: the user must be able to perceive the consequences of their specific actions clearly.

---

## 2. What the NIME community learned about making gesture feel musical

The New Interfaces for Musical Expression community has spent two decades distinguishing instruments from toys. Their findings converge on a set of principles that directly address PostListener's design challenge.

### Leman's body-as-mediator and Godøy's motor mimesis

Marc Leman's *Embodied Music Cognition and Mediation Technology* (MIT Press, 2007) makes the ontological claim that **the body is a biologically designed mediator** between physical sound energy and musical meaning. This mediation operates through corporeal articulation — the body doesn't accompany music but actively constitutes its meaning. Leman distinguishes progressive levels of engagement: synchronization (moving in time), attuning (matching melodic and dynamic contour), and empathy (felt emotional resonance). For PostListener, the phone must become a transparent extension of the body — an artificial mediator that enables corporeal articulation rather than obstructing it.

Rolf Inge Godøy's motor-mimetic theory (Leonardo, 2003; Music Theory Online, 2018) complements this by showing that people covertly simulate the body motion they believe produced a sound. In experiments, subjects traced pitch contours with hand movements with remarkable agreement, and "air instrument" performances by both experts and novices demonstrated deep innate motor knowledge of sound production. Critically, Godøy found that sound and gesture are perceived as intrinsically coherent units of **0.5–5 seconds duration** — these "chunks" are the natural timescale for gesture-sound coupling, not individual events.

### The foundational design criteria from Wessel and Wright

Wessel and Wright's 2002 paper remains the NIME community's most-cited design philosophy. Their criteria for intimate musical control specify **low latency (≤10ms), continuous control as default, proportional correspondence between gesture size and acoustic result, and no requirement to look at a screen**. Their most actionable contribution is the **"dipping" metaphor**: the computer constantly generates musical material, but it remains silent by default. The performer controls the volume of each process. "An advantage of this metaphor is that each musical event can be precisely timed, regardless of the latency or jitter of the gestural interface." This almost exactly describes PostListener's architecture — four stems always running, the conductor's gestures controlling their relative prominence, spatial position, and timbral quality.

Their aspiration — **"low entry fee with no ceiling on virtuosity"** — is the field's most-quoted design goal. They note explicitly that "many simple-to-use computer interfaces proposed for musical control seem — after even a brief period of use — to have a toy-like character. By this we mean that one quickly 'outgrows' the interface." PostListener's 16-minute window demands a mapping that reveals depth progressively rather than exhausting itself in the first minute.

### Why one-to-one mapping kills agency — Hunt, Wanderley, and Paradis

The pivotal empirical finding comes from Hunt, Wanderley, and Paradis (Journal of New Music Research, 2003): **many-to-many mappings produce more sustained engagement and more musical results than one-to-one mappings, even for novices.** In their experiments, subjects using one-to-one mappings (one slider = one sound parameter) figured out the instrument within seconds and lost interest within two minutes. Subjects using complex multiparametric interfaces found them more engaging and were able to "think gesturally" rather than analytically. The paper's central thesis: "the mapping between input parameters and sound parameters can define the very essence of an instrument."

This directly explains PostListener's previous "loose" feel. The earlier build used continuous one-to-one mappings (tilt → pan, gesture size → volume, downbeat → accent). Each mapping was individually transparent but collectively disconnected — the user understood each relationship immediately, exhausted its expressive range quickly, and never achieved the gestural fluency that comes from many-to-many coupling. The fix is not tighter one-to-one coupling but **structured many-to-many coupling** where each gesture dimension affects multiple correlated audio parameters simultaneously.

### Magnusson's instruments-as-scripts and the ergodynamic depth problem

Thor Magnusson (*Sonic Writing*, 2019) argues that digital instruments are "containers of theory" — their mapping rules constitute scripts that predetermine what the player can express. The mapping rules ARE the instrument, not merely its control interface. His concept of **ergodynamic depth** — the capacity for discovery, surplus behavior, and material excess beyond the designed theory — distinguishes instruments from toys. Digital instruments often lack this depth because their behaviors are fully specified in code. For PostListener, this means the mapping design must include non-linear response curves and subtle cross-couplings that reward exploration without being explicitly taught — the system should afford discoveries that the designer didn't fully predict.

### Why accelerometer instruments feel gimmicky, and what the rare successes share

The NIME community has identified consistent reasons why phone/accelerometer instruments feel like toys: lack of haptic feedback (no physical resistance grounds the gesture), flat learning curves (quickly mastered, quickly boring), and prioritization of novelty over depth. Morreale and McPherson (2017) found that **47% of digital instruments presented at NIME 2010–2014 were not ready for ongoing use**. The rare successes share five characteristics: many-to-many mappings, combined continuous and discrete control, physical metaphors grounded in existing cultural practice, low latency, and effort-sensitivity — the system responds to intentional exertion rather than casual waving.

Atau Tanaka's decades of work with sensor-based instruments (NIME 2010; Oxford Handbook of Computer Music, 2011) adds a crucial dimension: **felt effort matters more than detected motion**. His EMG-based instruments capture muscular tension directly, producing stronger felt agency than pure accelerometer data. Since PostListener cannot sense EMG, the mapping must be designed so that intentional, effortful gestures produce qualitatively different (and better) musical results than casual motion — essentially faking effort-sensitivity through acceleration magnitude thresholds and gesture sharpness detection.

---

## 3. The mapping architecture: from six axes to four stems

The practical heart of the problem: given three axes of phone orientation (roll, pitch, yaw) and three axes of acceleration, what should these map to in PostListener's 4-stem spatial audio architecture?

### Cross-modal correspondences that can be relied upon

The literature on cross-modal mapping is uncommonly robust. Eitan and Granot (Music Perception, 2006) established that **pitch rise maps to upward spatial movement, loudness increase maps to increased speed and muscular energy, and tempo increase maps to increased speed** — with loudness dominating when parameters conflict. Küssner et al. (Frontiers in Psychology, 2014) confirmed that pitch maps reliably to vertical hand height, loudness maps broadly to "effort," and tempo maps to hand speed. Crucially, Dolscheid et al. (2014) found pitch-height associations in prelinguistic 4-month-old infants, and Lewkowicz and Turkewitz (1980) found loudness-brightness correspondence in 3-week-olds — suggesting these mappings are **pre-linguistic and likely innate**.

For PostListener, the following correspondences are defensible:

| Gesture dimension | Most natural audio mapping | Evidence strength |
|---|---|---|
| Phone roll (tilt left/right) | Spatial azimuth pan | Very strong — direct spatial congruence |
| Acceleration magnitude | Loudness / dynamic intensity | Very strong — innate loudness↔energy |
| Phone pitch (tilt forward/back) | Spectral brightness (filter cutoff) | Strong — pitch↔height correspondence |
| Rotation rate (gyroscope) | Spectral brightness / timbre | Moderate — speed↔brightness |
| Yaw (compass heading) | Stem emphasis / directional focus | Moderate — spatial metaphor |

### The sweet spot between too few and too many parameters

No single paper publishes a "magic number" for mapping density, but practitioner consensus from the NIME community converges on **2–3 perceptual macro-dimensions**, each controlling 2–3 correlated audio parameters simultaneously. One parameter per gesture axis feels like a remote control. Five or more independent parameters feel chaotic. Arfib et al. (Organised Sound, 2002) proposed mapping to perceptual dimensions (brightness, roughness, spatial width) rather than raw synthesis parameters — this reduces cognitive load while maintaining density. Rovan, Wanderley, Dubnov, and Depalle (1997) demonstrated that coupling originally independent outputs into a 2D timbre space produced more compelling performance than independent one-to-one control.

PostListener's previous architecture had exactly this problem in reverse — three independent one-to-one mappings with no cross-coupling, each immediately transparent, collectively boring.

### System-driven tempo with gesture accents: the right design choice

Should the music follow the user's gesture tempo or should the user modulate an already-running piece? The research and the precedent systems strongly support **system-driven tempo with quantized gesture accents**. Personal Orchestra (Borchers et al., 2004) used user-driven tempo but required sophisticated time-stretching and found that novices often struggled. Real-time time-stretching of 4 pre-generated audio stems in a browser is technically feasible but adds computational cost and artifacts. More importantly, tempo-following demands significant cognitive overhead from novices — they must understand they are controlling tempo, establish a beat, and maintain it. For a 16-minute experience with untrained users, **modulating dynamics, spatialization, and timbre of a steadily-playing piece produces felt causation faster than attempting tempo control**.

The recommended hybrid: music runs at a fixed tempo; the user's detected downbeats trigger accent effects (momentary gain boost, filter transient, spatial pulse) synchronized to the nearest beat in the musical grid. If the user's beat period approximately matches the song tempo (±15%), a subtle quantized phase-lock aligns accents to actual beats, reinforcing felt synchrony without requiring tempo tracking.

### The 1€ filter and the smoothing-latency tradeoff

The One Euro Filter (Casiez, Roussel, and Vogel, CHI 2012), cited over 1,000 times, is the gold standard for this application. It is an adaptive low-pass filter with speed-dependent cutoff: at low speeds (phone held still), it cuts jitter aggressively; at high speeds (active conducting), it opens up to minimize lag. Only two parameters require tuning: **min_cutoff** (start at 1.0 Hz for orientation data) and **beta** (start at 0.007). The tuning procedure: set beta to zero, reduce min_cutoff until jitter at rest is acceptable, then increase beta until lag during fast movement is acceptable.

Dead zones prevent noise from reaching the audio engine. Recommended starting values: ±2–3° around neutral for orientation, **1.5 m/s² above gravity noise floor for acceleration**, and 5–10°/s for rotation rate. These thresholds distinguish intentional conducting from hand tremor.

### The wrist-elbow-shoulder hierarchy and what the phone actually captures

Real conducting uses a hierarchical body structure: shoulder for large dynamic gestures (<1–2 Hz), elbow for standard beat patterns (1–4 Hz), wrist for fine articulation (up to 5–8 Hz). The phone held in hand primarily captures wrist and forearm motion. Elbow-driven beats contribute to acceleration peaks. Shoulder gestures register mainly through acceleration magnitude, not spatial position. **Absolute arm height is invisible to phone sensors** — only acceleration and orientation are available.

Nakra's Conductor's Jacket (MIT, 2000) placed sensors on every major joint and measured muscle tension, respiration, and heart rate at 3 kHz per channel. She found that **muscle tension carries crucial expressive information** unavailable to accelerometers. The phone captures a fraction of conducting's expressive vocabulary — but the fraction it captures (beat timing, dynamic intensity, spatial orientation, articulation sharpness) happens to be the fraction that non-musicians can meaningfully control.

---

## 4. Real conducting, virtual conducting, and what 25 years of precedent reveals

The most important validation for PostListener's concept comes from a lineage of virtual conducting systems spanning from 1997 to the present. Every successful system converges on the same core design: simplified gesture vocabulary, forgiving beat detection, and real orchestral audio.

### What conductors actually do with gesture

Conducting textbooks (Green and Malko, Max Rudolf, Billingham) teach a signaling system built on three elements: **ictus** (the moment of beat, located at the change of direction), **rebound** (movement after the ictus, carrying expressive information about the next beat's character), and **preparation** (the rebound of the previous beat, essentially a "breath" before the next ictus). All icti occur on the same horizontal plane. Gesture size controls dynamics — universally taught and culturally reinforced. Gesture weight and sharpness control articulation: curved, smooth icti for legato; pointed, sharp icti for staccato. The right hand keeps time while the left hand shapes expression — a bimanual independence that requires years of training and is impossible with a single phone.

Rudolf Laban's movement framework provides a principled mapping between effort qualities and musical expression: **Weight (strong/light) maps to dynamics, Time (sudden/sustained) maps to articulation, Space (direct/indirect) maps to focus, and Flow (bound/free) maps to phrasing**. Bernstein and Cafarelli demonstrated 90% accuracy in interpreting Laban movement combinations — confirming physiological underpinnings. For PostListener, Laban's effort factors translate directly to measurable phone sensor dimensions: acceleration force magnitude → Weight, rate of acceleration change → Time, gyroscope smoothness → Flow.

### Non-musicians can conduct — but only the basics

The empirical data is clear and consistent. In Lee, Wolf, and Borchers's CHI 2005 study comparing trained conductors with non-conductors, **non-conductors led beats by only ~50ms** (versus 150ms for conductors) and varied beat placement **50% more**. Some conducted to musical rhythm rather than the underlying beat — a fundamentally different conceptual model. But the critical finding from Personal Orchestra's deployment at the House of Music Vienna is that **97% of random visitors could perform basic conducting gestures** recognized by the system, **93% discovered they could control tempo**, and **77% discovered dynamic control** — all within an average session of 5.9 minutes.

The minimum viable conducting vocabulary that "feels like conducting" for non-musicians consists of just four elements: vertical oscillation (tempo), gesture amplitude (volume), gesture character sharp versus smooth (articulation), and cessation of motion (stop). This matches exactly what every successful public-facing system has implemented. Anything beyond this — beat patterns, bimanual independence, preparatory gestures, precise cueing — requires training that PostListener's 16-minute window cannot provide.

### Lessons from WorldBeat, Personal Orchestra, and Virtual Maestro

Three systems provide the most relevant precedent:

**Personal Orchestra** (House of Music Vienna, 2002–present) used an infrared baton with simple downbeat detection: downward turning points = beats. Its most important lesson is quantitative: in a study of 30 random users aged 9–67, the discoverability of different parameters showed a **sharp dropoff** — 93% for tempo, 77% for volume, but only **37% for instrument emphasis**. This directly informs PostListener: expect users to discover 2–3 core mappings through exploration, but any additional parameters require explicit instruction or will go unnoticed. Personal Orchestra's error handling — the orchestra stopping and a player complaining when conducting was too erratic — became a major attraction, demonstrating that **diegetic error feedback** enhances rather than breaks the experience.

**UBS Virtual Maestro** (Nakra et al., NIME 2009) is the closest hardware analogue to PostListener, using a **Nintendo Wii Remote** (accelerometer-based, no IR tracking) at venues including Boston Symphony Hall, Walt Disney Concert Hall, and Avery Fisher Hall. Beat detection used filtered acceleration integrated to velocity, with peak detection on velocity magnitude — deliberately orientation-independent to accommodate any gesture style. The system performed **adaptive calibration**, continuously estimating gesture magnitude range to compensate for differences in user height, arm length, and natural gesture scale. A key design choice: processing delay was intentionally smoothed rather than minimized, because tight coupling to noisy sensor data produced jarring results. Thousands of users validated the approach.

**iSymphony** (Lee et al., CHI 2006) introduced the most conceptually important innovation: **adaptive gesture recognition** that automatically distinguished three user profiles — standard four-beat pattern, simplified up-down pattern, and random/free gestures. The system adapted to the user rather than requiring the user to learn specific technique. This is the approach PostListener should adopt: wide acceptance windows that respond meaningfully to both trained and untrained conducting styles.

### Teaching versus discovery: what immersive theater suggests

Should PostListener teach gestures before the experience or let users discover them? The evidence supports **scaffolded discovery with minimal explicit instruction**. Personal Orchestra found that "people did not read the signage." Punchdrunk's Felix Barrett describes designing for audiences "driven by a base, gut feeling and making instinctive decisions" — explicit tutorials break immersion. But UBS Virtual Maestro's approach of showing a brief "How to Conduct" animation before the piece proved effective for orientation without breaking flow.

The optimal sequence: one sentence or short animation establishing the phone-as-baton concept → immediate responsiveness to any motion from the first moment (creating the initial causal "aha") → environmental reinforcement where audio changes make gesture-sound mappings self-evident → progressive revelation of additional control dimensions. The research shows 2–3 parameters can be learned implicitly in ~5 minutes; any additional parameters require either explicit instruction or will remain undiscovered.

---

## 5. Recommended specification, latency budget, and honest limitations

### Gesture-to-audio mapping specification

The mapping architecture uses a **three-layer design** grounded in Hunt, Wanderley, and Paradis's intermediate parameter approach and Arfib et al.'s perceptual-space mapping.

**Layer 1 — Gesture feature extraction.** Apply the 1€ filter (min_cutoff = 1.0 Hz, beta = 0.007) to all orientation streams. Apply a separate 1€ filter (min_cutoff = 0.5 Hz, beta = 0.005) to acceleration data. Detect downbeats via peak detection on gravity-corrected Y-axis acceleration with a **4 m/s² threshold** and 300ms minimum inter-onset interval. Enforce dead zones of ±3° for orientation and 1.5 m/s² for acceleration. Achieve 60 Hz sensor polling via DeviceMotionEvent.

**Layer 2 — Three perceptual macro-dimensions plus one discrete trigger.** Each macro-dimension bundles 2–3 correlated audio parameters so that gesture changes feel coherent rather than fragmented:

- **"Energy/Brightness"** ← phone pitch (beta) combined with rotation rate magnitude. Controls: BiquadFilter cutoff frequency (200 Hz–8 kHz range), reverb send level (inverse — tilting forward produces drier, more present sound), and a subtle gain coupling (±2 dB). This creates a single perceptual axis from "dark and distant" to "bright and present."

- **"Spatial Presence"** ← phone roll (gamma). Controls: HRTF PannerNode azimuth for all stems (within ±60° range), plus stem balance weighting (tilting left increases gain on left-panned stems by up to 3 dB, decreases right-panned). This leverages the strongest innate cross-modal correspondence — spatial direction.

- **"Intensity"** ← smoothed acceleration magnitude (RMS over 100ms window). Controls: master gain across all stems (±6 dB range), plus subtle filter resonance boost at higher intensities. Bigger gestures produce louder, more resonant sound — the most deeply innate cross-modal mapping.

- **"Beat Accent"** (discrete) ← downbeat detection. Triggers: momentary gain spike (**+3–6 dB, 80–120ms exponential decay**), high-frequency filter transient (brief brightening), and a spatial "pulse" (brief reduction in PannerNode distance values, making the sound feel closer for an instant). The accent is quantized to the nearest beat in the musical grid if the user's inter-beat interval falls within ±15% of the song tempo.

**Layer 3 — Stem differentiation via yaw.** Map yaw (alpha / compass heading) to a directional "spotlight" that emphasizes the stem the user is facing. Divide 360° into four quadrants (e.g., vocals = front, drums = right, bass = rear, other = left) with 30° crossfade zones. The facing stem receives +3–4 dB; the opposite stem receives −2 dB. This creates the feeling of directing specific sections of the orchestra through physical orientation.

### Latency budget

| Mapping type | Target latency | Maximum acceptable | Notes |
|---|---|---|---|
| Continuous orientation → filter/pan | **<20ms** | 35ms | Set Web Audio API buffer to 256 samples (~5.8ms at 44.1 kHz); sensor at 60 Hz adds ~16.7ms |
| Continuous acceleration → gain | **<20ms** | 35ms | Same signal chain as orientation |
| Discrete downbeat → accent | **<15ms** | 25ms | Peak detection adds ~5ms processing; schedule accent via AudioContext.currentTime for sample-accurate timing |
| Yaw → stem emphasis | **<50ms** | 100ms | Slow-changing; higher latency tolerable because crossfade is gradual |
| Jitter (all mappings) | **<±2ms** | ±5ms | Jitter is perceptually worse than consistent latency (Jack et al., 2018) |

The Web Audio API's `AudioContext.currentTime` scheduling enables sample-accurate audio parameter changes. The bottleneck is DeviceMotionEvent polling rate (~60 Hz = 16.7ms interval). Total expected end-to-end latency: **~20–25ms** for continuous mappings, which falls within the acceptable range for continuous gesture control per Mäki-Patola (2004).

### Ranked mappings by felt-agency impact versus implementation difficulty

| Rank | Mapping | Felt-agency impact | Implementation difficulty | Priority |
|---|---|---|---|---|
| 1 | Acceleration magnitude → gain (Intensity) | **Very high** — innate, immediate, visceral | Low — direct GainNode control | Must-have |
| 2 | Roll → spatial pan (Spatial Presence) | **Very high** — strongest innate cross-modal mapping | Low — direct PannerNode azimuth | Must-have |
| 3 | Downbeat → accent (Beat Accent) | **High** — discrete, unmistakable confirmation of agency | Medium — requires peak detection algorithm | Must-have |
| 4 | Pitch → filter cutoff (Energy/Brightness) | **High** — intuitive once discovered | Low — BiquadFilterNode frequency | Should-have |
| 5 | Pitch → reverb send (cross-coupling with Energy) | **Medium** — enriches the brightness axis | Low — additional GainNode on reverb bus | Should-have |
| 6 | Rotation rate → spectral brightness | **Medium** — adds gestural nuance | Low — modulates same filter as pitch | Nice-to-have |
| 7 | Yaw → stem emphasis (directional spotlight) | **Medium** — powerful but may not be discovered | Medium — compass heading requires calibration; magnetic interference issues | Nice-to-have |
| 8 | Acceleration → filter resonance (cross-coupling with Intensity) | **Low-medium** — subtle enrichment | Low — Q parameter on existing filter | Nice-to-have |

### What the phone-as-baton cannot do

Honest assessment of the irreducible limitations:

**No bimanual independence.** Real conducting separates timekeeping (right hand) and expression (left hand). With one phone, all signaling must share the same physical channel. The system cannot distinguish "I am keeping time" from "I am shaping a phrase." Compensation: use the perceptual macro-dimension architecture so that different motion dimensions (orientation versus acceleration versus gyroscope) implicitly separate timekeeping from expression without requiring the user to think about it.

**No absolute position.** Accelerometers suffer from integration drift — absolute arm height diverges "almost instantly" (Solin, 2017). The system has no access to whether the arm is high, low, or at chest level. Compensation: rely on orientation (tilt angles are absolute and drift-free) and acceleration magnitude (relative, not positional) rather than attempting position tracking.

**No muscle tension or effort sensing.** Nakra's Conductor's Jacket demonstrated that EMG carries crucial expressive information. The phone senses motion but not the effort behind it — a relaxed arm swing and a tense, controlled gesture may produce identical sensor readings. Compensation: use acceleration magnitude and jerkiness (derivative of acceleration) as proxies for effort intensity.

**No facial expression or gaze.** Cueing specific sections, communicating emotional intent through eye contact, and the conductor's "X-factor" are inaccessible. Compensation: yaw-based stem emphasis provides a crude substitute for directional cueing.

**60 Hz sensor ceiling.** Browser DeviceMotion events typically arrive at 60–67 Hz, compared to 100 Hz for Wii Remote (which Nakra noted was already insufficient for high-frequency gesture components) and 3 kHz for the Conductor's Jacket. This is adequate for beat detection and gross dynamics but **insufficient for fine articulation analysis** — subtle staccato versus legato wrist distinctions will be lost.

**Phone weight and fatigue.** A phone weighs 150–200g compared to a baton's 30–60g. Personal Orchestra found that electronic baton weight caused phantom double-beat detection from momentum effects. Expect similar artifacts and plan for user fatigue during the 16-minute experience — consider building natural rest moments into the musical structure.

**iOS permission friction.** Safari requires explicit `DeviceMotionEvent.requestPermission()` on user interaction. This is a hard onboarding constraint — the permission request must be integrated into the pre-conducting flow (likely during the 5-minute profiling phase).

### The convergent lesson from 25 years of virtual conducting

Despite every limitation listed above, the evidence from WorldBeat, Personal Orchestra, You're the Conductor (1 million visitors during its 2004–2007 tour), UBS Virtual Maestro, and iSymphony converges on a single finding: **any responsive connection between gesture and orchestral sound feels magical to someone who has never conducted.** Borchers concluded that Personal Orchestra "opens up an experience to people that had been completely unreachable for them before." The phone's limitations matter less than the experiential truth that felt causation requires only tight temporal coupling, learnable mappings, and the narrative frame of "you are the conductor." PostListener's 5-minute profiling phase — establishing personal recognition and narrative context — already provides the Wegnerian consistency and exclusivity conditions that make the conducting metaphor believable. The mapping specification above provides the sensorimotor contingencies that make it felt.

The research base for this specification draws on peer-reviewed work from NIME proceedings, Computer Music Journal, Journal of New Music Research, Music Perception, Behavioural and Brain Sciences, Trends in Cognitive Sciences, Phenomenology and the Cognitive Sciences, Frontiers in Psychology, and multiple CHI proceedings — all citable in the ElevenLabs funding proposal. The key names — Haggard, O'Regan, Leman, Godøy, Wessel, Wright, Hunt, Wanderley, Magnusson, Jordà, Tanaka, Nakra, Borchers, Eitan, and Casiez — represent the established authorities across sensorimotor psychology, embodied music cognition, and digital instrument design. The mapping architecture is not novel in its individual components but in their integration: structured many-to-many coupling across perceptual macro-dimensions, applied to a 4-stem spatial audio architecture, within the specific constraints of phone-based browser interaction. That integration is defensible because every component rests on validated research.