# Generative music differentiation: what works, what doesn't, and what to build

**Current AI music models can produce audibly different outputs for different user profiles — but only if you engineer the prompt pipeline correctly and accept that psychological framing does at least half the work.** ElevenLabs' Music API offers the strongest combination of programmatic control, licensed training data, and stem separation for PostListener's needs, though Suno V5.5 leads on raw musical quality and Udio on audio fidelity. The critical finding across all four research streams is this: differentiation requires variation across **at least three orthogonal musical dimensions** (genre, tempo, instrumentation, production aesthetic) to clear perceptual thresholds. Single-dimension changes — swapping "melancholic" for "wistful," or shifting tempo by 5 BPM — collapse into the model's house style. The good news: the profiling stage of PostListener gives you exactly the data needed to construct multi-dimensional prompts. The better news: research on the Barnum/Forer effect and personalization placebo suggests that the experience design around the music may matter more than the music's technical differentiation.

---

## Section 1: The generation engine landscape as of April 2026

Three platforms dominate commercial AI music generation, each with distinct strengths that map differently onto PostListener's requirements. Behind them sits a surprisingly capable open-source tier that may prove essential for research validation.

### ElevenLabs Music: the API-first choice

ElevenLabs launched its Music API on **March 14, 2026** (model ID: `music_v1`), positioning it as the first music generation API trained entirely on licensed data and cleared for broad commercial use. The timing is fortunate for the funding proposal. Key specifications: **44.1kHz stereo** output, generation lengths from 3 seconds to **5 minutes**, output in MP3 (128–192 kbps) or WAV, with generation completing in roughly 25–30 seconds for instrumental tracks.

The API's architecture is PostListener's strongest asset. Three features matter most. First, **composition plans** — structured multi-section generation where each section can have its own style descriptors, positive and negative global styles, and controlled durations. This maps directly to building a 16-minute spatial audio experience from profiled segments. Second, **Music Finetunes** — upload non-copyrighted reference tracks to create a personalized model variant in 5–10 minutes, effectively encoding a sonic identity. This is the closest existing mechanism to "generate music that sounds like this user's taste." Third, **built-in stem separation** via API (`POST /v1/music/separate-stems`), offering either 2-stem (vocals/instrumentals, 0.5× cost) or 4-stem separation at generation cost parity.

Pricing on the Scale plan runs **$0.33/minute** of generated audio ($330/month for 304 included minutes). The Business tier drops to $0.27/minute. For a thesis prototype generating perhaps 200–400 minutes of audio across testing and final production, monthly costs of $60–130 are realistic on the Pro plan ($99/month, 62 included minutes at $0.39/additional minute). ElevenLabs also operates a **Startup Grants Program** offering 12 months free access — worth pursuing alongside the funding proposal.

The honest weakness: ElevenLabs' musical creativity trails competitors. Community comparisons describe outputs as "technically competent but musically less sophisticated" than Suno, with vocal expressiveness characterized as "robotic and emotionally flat" in early testing. One practitioner reported only **3 of 20 vocal tracks** passing quality standards. Instrumental output — which PostListener primarily needs — is stronger but "not as varied or genre-flexible" as the top two platforms. This gap matters less than it appears: PostListener's differentiation requirements prioritize controllable variation over peak musical quality, and the composition plan architecture provides structural control no competitor matches via API.

### Suno V5.5: the musical quality leader without an API

Suno released V5.5 on **March 25, 2026**, achieving an ELO score of 1,293 and roughly **88% prompt adherence** on genre classification. It outputs at **44.1kHz stereo** with WAV downloads on paid plans, generates complete songs in approximately 40 seconds, and supports up to **12-stem separation** on Pro/Premier tiers. At $10/month (Pro, 2,500 credits, ~500 songs) or $30/month (Premier, 10,000 credits, ~2,000 songs, plus MIDI export and Suno Studio DAW access), it is dramatically cheaper per output than ElevenLabs. A **50% student discount** brings Pro to $5/month.

V5.5 introduced three features directly relevant to PostListener. **Custom Models** allow uploading 6+ original tracks to train a style-specific model (2–5 minute training, up to 3 models per user). **Voices** enables recording or uploading 15 seconds to 4 minutes of singing to create a reusable vocal persona with approximately 70% voice resemblance. **My Taste** passively learns from creation and listening habits to bias future generation. Together, these represent the most explicit personalization toolkit in the market.

The critical limitation: **Suno has no official public API**. Third-party providers (SunoAPI.org, Apiframe) offer unofficial access at ~$0.11–0.14 per song, but these may violate Suno's terms of service, creating risk for a funded thesis project and especially for an ElevenLabs proposal that references the competitor. Suno's training data also remains legally contested — Warner Music Group settled in November 2025, but **Sony litigation continues**. Commercial use rights attach only to songs made while subscribed, and Suno retains rights on free-tier outputs.

### Udio: best audio but functionally inaccessible

Udio generates at **48kHz** — the highest fidelity of any major platform — with consistently praised instrumental quality, especially in electronic genres. Its **inpainting** feature (regenerating specific sections without affecting the rest) and precise genre adherence make it technically superior for differentiation research. In blind tests, only **3 of 10 listeners** identified Udio tracks as AI-generated, compared to 7 of 10 for Suno.

However, Udio has been functionally unusable for export since **October 2025**, when downloads were disabled during a licensing transition following copyright lawsuit settlements with UMG and WMG. A new "walled garden" platform is expected mid-2026 but may restrict all content to on-platform use. There is no usable API. **For the thesis timeline, Udio is not a viable production tool** but remains relevant as a comparison benchmark.

### The open-source tier: MusicGen, Stable Audio, and ACE-Step

**Meta's MusicGen** (AudioCraft suite) remains the reference open-source model: a 1.5B-parameter autoregressive transformer generating 32kHz audio with text conditioning, melody conditioning via chromagram (MusicGen-Melody), and chord/drum conditioning (JASCO variant). It is fully parameter-accessible, supports deterministic seeds for reproducible research, and can be fine-tuned via LoRA. The critical limitation is its **CC-BY-NC 4.0 license** on model weights — non-commercial only — and 32kHz output quality.

**Stable Audio 2.5** (Stability AI) uses latent diffusion with a Diffusion Transformer, generating up to **3 minutes at 44.1kHz stereo**. It offers the most research-friendly control surface: deterministic seeds (`torch.Generator("cuda").manual_seed(N)`), explicit negative prompts, adjustable CFG guidance scale, and inference step control. Available via API on Replicate and fal.ai at approximately $0.20 per execution. The open-source variant (Stable Audio Open 1.0) generates up to 47 seconds.

**ACE-Step v1.5** (January 2026) is a dark horse: an open-source foundation model combining diffusion generation with a deep compression autoencoder and lightweight linear transformer. It generates **4-minute tracks in ~20 seconds**, supports LoRA fine-tuning, tag and description conditioning, and claims quality "beyond most commercial music models." Its Apache-compatible license makes it the most permissive option for commercial use. Community validation remains limited given its recency.

**Google's Lyria RealTime** deserves special mention despite being experimental: it offers continuous streaming 48kHz stereo with under 2-second latency, independent sliders for multiple text descriptors, tempo, key, instrument group silencing, note density, spectral brightness, and sampling temperature. It accepts MIDI controller input. If PostListener's conducting experience required real-time music modification rather than pre-generated stems, Lyria RealTime would be the clear choice — but its experimental status and unclear commercial licensing make it unsuitable as a primary engine for a funded project.

### Comparative summary for PostListener

| Criterion | ElevenLabs | Suno V5.5 | Stable Audio 2.5 | MusicGen |
|---|---|---|---|---|
| API availability | ✅ Official, documented | ❌ No official API | ✅ Via Replicate/fal.ai | ✅ Open-source |
| Prompt differentiation | Good (composition plans) | Very good (88% adherence) | Very good (seed + CFG) | Good (fine-tunable) |
| Custom model training | ✅ Music Finetunes | ✅ Custom Models | ❌ | ✅ LoRA fine-tuning |
| Stem separation | ✅ Built-in API (2 or 4) | ✅ Up to 12 stems | ❌ | ✅ MusicGen-Stem (3) |
| Max duration | 5 min | 4 min (extendable) | 3 min | ~30 sec (extendable) |
| Output quality | 44.1kHz stereo | 44.1kHz stereo | 44.1kHz stereo | 32kHz |
| Commercial license | ✅ Clean, licensed data | ⚠️ Litigation ongoing | ✅ Licensed data | ❌ CC-BY-NC |
| Monthly cost (thesis scale) | ~$99–330 | ~$5–30 | ~$20–50 | Free (self-hosted GPU) |
| Seed reproducibility | Not documented | ❌ | ✅ Deterministic | ✅ Deterministic |

**Recommendation for the ElevenLabs proposal:** Position ElevenLabs as the primary generation engine for its API architecture, composition plans, and licensing clarity. Use Stable Audio or MusicGen as a research comparison baseline — their seed control allows isolating prompt effects from randomness, which strengthens the differentiation argument. Acknowledge Suno's quality lead honestly but frame ElevenLabs' structured control as better suited to systematic personalization than Suno's "vibes-based" prompting.

---

## Section 2: Prompt engineering that actually produces different music

The vocabulary problem is real and well-documented: many prompt words produce cosmetically different metadata but sonically identical outputs. Solving this requires understanding which musical dimensions models actually respond to, and how to construct prompts that force variation across those dimensions.

### The six levers that move the sound

Community testing across hundreds of tracks (documented in the suno-prompt-engineering-guide GitHub repo, Undetectr's 100+ prompt analysis, and FrankX's 500-track corpus) converges on a ranked hierarchy of prompt effectiveness. **Genre/sub-genre** is the strongest lever — "post-punk shoegaze" produces fundamentally different output from "boom-bap hip-hop." **Named instruments** rank second; adding "Rhodes piano" versus "distorted guitar" shifts the entire timbral character. **Vocal descriptors** (gender, texture, delivery style) rank third. **Tempo/BPM** ranks fourth, with differences of ±20 BPM creating noticeable energy shifts. **Mood/emotion words** rank fifth, shaping harmonic direction. **Production aesthetic** ("lo-fi tape hiss" versus "polished radio-ready") ranks sixth but creates the textural signature that makes outputs feel distinct.

At the bottom of the effectiveness scale: **synonym swaps within the same semantic cluster** ("melancholic" versus "sad" often produce near-identical outputs), abstract qualifiers ("interesting," "good"), and command language ("make the drums louder" fails; "powerful driving drums" succeeds). Models respond to descriptions, not instructions.

The optimal prompt formula across platforms uses **4–7 distinct descriptors spanning different dimensions**: `[Genre + Sub-genre], [Tempo/BPM], [2-3 Named Instruments], [Vocal Style or "instrumental"], [Mood Descriptor], [Production Era/Aesthetic]`. For PostListener, this means the profiling stage must extract preferences along at least these six axes to construct maximally differentiated prompts.

### The pop gravity well and house style collapse

A critical finding from co-occurrence data analysis of Suno's training data reveals **"genre clouds"** — entangled clusters where tags co-occur so frequently that the model treats them as near-synonymous. Pop sits at the gravitational center: nearly every genre in the dataset gravitates toward pop structures (verse-chorus form, clean production, 4/4 time) unless actively excluded. Four major clouds were identified: Rap Cloud (rap↔trap↔bass↔hip-hop), Orchestral Cloud (orchestral↔epic↔cinematic↔dramatic), Indie Cloud (indie↔pop↔acoustic↔dreamy), and Dark Electronic Cloud (dark↔synth↔electro↔synthwave).

**This is PostListener's primary technical risk.** Two user profiles that differ only in nuanced mood preferences may produce indistinguishable outputs because both collapse into the same genre cloud's center. The mitigation strategies are well-documented:

Negative prompting is described as "the single most underused technique in AI music generation." Adding explicit exclusions — `"NO: heavy compression, radio production, over-mastered sound"` — dramatically reduces default behaviors. ElevenLabs' composition plans support negative global styles natively. Udio has a formal negative prompt field. Stable Audio supports the `negative_prompt` parameter in its diffusion architecture. Suno accepts informal exclusions (`[Exclude: Pop]` or "no trap") but processes them less reliably.

Sub-genre specificity defeats gravity wells: "melodic doom metal" escapes the generic "metal" cloud. Era descriptors encode enormous stylistic information efficiently: "70s Cambodian rock" constrains production aesthetic, instrumentation, and harmonic language simultaneously. **For PostListener's prompt pipeline, the profiling stage should identify the user's preferred sub-genre and era, not just broad genre categories.**

### Structured versus natural language prompts

Each platform responds to different prompt architectures. Suno works best with **comma-separated tag lists** (8–15 tags, 20–50 words); its internal preprocessor rewrites natural language into tags anyway. Udio thrives on **maximalist natural language** mixed with production terminology; its community-developed "50% rule" recommends restating the target concept in multiple aligned ways to increase probability. ElevenLabs uniquely supports **composition plans** — structured objects specifying positive/negative global styles plus per-section descriptors, durations, and instrumentation. Stable Audio uses a **pipe-delimited format**: `"Format: Band | Subgenre: X | Instruments: Y | Moods: Z | BPM: N"`.

For PostListener, ElevenLabs' composition plan approach is the strongest architecture because it allows programmatic construction of prompts from profile data. A user profile can be mechanically translated into a JSON-like composition plan where each section reflects a different facet of their preferences — opening with their dominant genre, transitioning through their secondary preferences, and closing with their deepest emotional resonance. No other platform's API supports this level of structural control.

### The critical finding on rhythm versus melody

A 2023 paper investigating DreamBooth and Textual Inversion for personalizing text-to-music diffusion models found that **current personalization approaches learn rhythmic music constructs more easily than melody**. This has a direct design implication: PostListener should weight rhythmic and tempo preferences more heavily in the differentiation pipeline, because these are the dimensions where AI models most reliably translate profile differences into audible output differences.

---

## Section 3: From generated audio to spatial conducting experience

The PostListener "Orchestra" conducting phase requires spatializing individual musical elements around the listener's head. This means either generating stems directly or separating a mixed output into stems, then rendering each stem at a controllable 3D position. The technology is mature enough for a June 2026 thesis, but the pipeline choice matters significantly.

### HTDemucs remains the practical standard

Meta's HTDemucs (Demucs v4) achieves a **mean SDR of 8.38 dB** on the MUSDB18-7s benchmark for 4-stem separation (vocals, drums, bass, other). The fine-tuned variant (`htdemucs_ft`) historically scored 9.20 dB on larger benchmarks. Both are MIT-licensed and fully open-source, though the original Meta repository is **no longer maintained** — creator Alexandre Défossez forked it to his personal GitHub after leaving Meta. A 6-stem variant (`htdemucs_6s`) adds guitar and piano but with significantly degraded quality on the "other" stem (SDR drops to 5.92 dB mean). For PostListener's purposes, 4-stem separation is the practical ceiling.

Processing time is manageable: a 4-minute track requires approximately **1–3 minutes on GPU** (NVIDIA, 4GB+ VRAM) or 5–15 minutes on CPU. The easiest programmatic integration is via the `python-audio-separator` package (`pip install audio-separator[gpu]`), which wraps HTDemucs and other models in a single-function API. An ONNX conversion from Google Summer of Code 2025 enables platform-independent deployment with less than 0.1 dB quality difference.

**Separation quality on AI-generated music is measurably worse than on commercial recordings.** AI-generated outputs from Suno and Udio are typically compressed MP3 (128–192 kbps) with high-frequency content often cutting off above 15 kHz. Separating already-compromised audio compounds artifacts. Expect **1–2 dB lower SDR** than benchmark figures. The practical impact: separated stems will have audible bleed between instruments, particularly between bass and "other," and between vocals and harmonically dense instrumental sections. For spatial audio purposes, this bleed creates a "halo" effect around spatially placed elements — noticeable but not necessarily objectionable, and potentially even desirable for a dissolution-themed experience.

### Direct stem generation exists but isn't ready

**MusicGen-Stem** (Meta/IRCAM, ICASSP 2025) is the first model to generate music as parallel stems rather than a mixed output. It produces **3 stems** (bass, drums, other) from text prompts, matching MusicGen's quality on standard metrics while enabling stem-level editing and iterative composition. The limitation is severe for PostListener: instrumental only (no vocals), 30-second segments, mono per stem, and 32kHz output quality. It is a proof-of-concept, not a production tool.

Suno and Udio both added stem download features, but community reports confirm these use **post-generation separation internally** (likely Demucs-based), not true multi-track generation. The quality is "usable but falls short of expectations," with artifacts in drum stems and inter-stem bleed. ElevenLabs offers stem separation via API at generation cost, likely using a similar internal approach.

### Language-conditioned separation as a wild card

**AudioSep** (IEEE/ACM TASLP 2024) introduces "separate anything you describe" — open-domain source separation using natural language queries like "extract the bass guitar" or "isolate the piano." It achieves SDRi of **7.74 dB across 527 AudioSet classes** and 10.51 dB on the MUSIC dataset. For PostListener, this could enable more musically meaningful separation than the fixed 4-stem model — for instance, isolating "the melodic elements" versus "the rhythmic foundation" versus "the atmospheric textures" regardless of instrumentation. This is research-stage technology but feasible for a thesis prototype.

### The recommended spatial audio pipeline

For a June 2026 deadline, the practical pipeline is:

Generate full mix via ElevenLabs API → separate into 4 stems using HTDemucs (`python-audio-separator`) → pre-load stems as separate audio buffers → spatialize in real-time using **Web Audio API's PannerNode with HRTF model** or **Google's Resonance Audio SDK** for richer room acoustics.

Web Audio API is built into all modern browsers, requires zero dependencies, and handles real-time HRTF-based binaural rendering with negligible latency. Each stem connects to its own PannerNode with controllable `positionX/Y/Z` coordinates. The conducting interaction updates these coordinates in real-time. Resonance Audio (Apache 2.0, `npm install resonance-audio`) adds room modeling, ambisonic encoding, source spread control, and near-field effects — worth the additional complexity if the dissolution phase benefits from evolving room acoustics.

**Total pipeline latency for a new user:** music generation (25–30 seconds via ElevenLabs) + stem separation (1–3 minutes on GPU) = approximately **2–4 minutes from profile completion to spatial playback readiness.** This fits within a 5-minute profiling experience — begin generation during the final profiling questions, run separation during a brief transitional moment, and the spatial experience is ready when the user enters the conducting phase.

---

## Section 4: How different is different enough?

The most important findings in this workstream come from perception research, not audio engineering. The evidence reveals a dual-pathway model where technical differentiation and psychological framing interact — and framing may be the stronger force.

### Perceptual thresholds for musical difference

Just-noticeable-difference thresholds for musical attributes set a floor for meaningful differentiation. Tempo differences below **2–6%** (roughly ±3–8 BPM at 120 BPM) are imperceptible. Pitch differences below approximately **10 cents** (0.6% of frequency above 1000 Hz) go unnoticed. Timbral differences are harder to quantify, but research shows listeners are actually **more sensitive to synthetic timbral variations** than natural ones — a finding that cuts both ways for AI music.

The practical implication is stark: **micro-parameter adjustments between user profiles will not create perceived differentiation.** Moving tempo from 118 to 122 BPM, or shifting mood from "melancholic" to "wistful," produces technically different audio files that sound functionally identical. Meaningful differentiation requires variation at the level of genre, instrumentation set, vocal presence/absence, production aesthetic, or structural form. PostListener's profiling must extract preferences coarse enough to drive these macro-level differences.

MIR (Music Information Retrieval) metrics can automate differentiation measurement. A 2018 study by Greenberg et al. validated that **computer-extracted music features from the Essentia library align well with human perceptual ratings**, mapping onto three components: **Arousal, Valence, and Depth**. An automated pipeline using librosa or Essentia to extract tempo, spectral centroid (brightness/warmth), MFCCs (timbral fingerprint), and chroma features (harmonic content) from generated outputs, then computing pairwise distances between profiles, would provide quantitative evidence for the ElevenLabs proposal that different profiles produce measurably different music. This is achievable within the thesis timeline.

### The house style ceiling on differentiation

Every platform produces outputs within a recognizable stylistic envelope. Suno's signature is polished, radio-ready production with "everything mastered, nothing raw." Udio's signature is atmospheric depth with studio-grade instrumental separation. ElevenLabs' signature, inherited from its voice synthesis heritage, is vocal hyperrealism paired with less adventurous musical composition.

A gaming industry critic captured the risk precisely: AI music "regurgitates the same tired tropes, predictable harmonies, and ear-worm melodies, leading to a sonic landscape as homogenous as a beige-painted office cubicle." The **BTR V8 detection system** identifies AI signatures through reduced spectral contrast (generative model smoothing), overly emphasized frequency bands, and absence of micro-irregularities found in human recordings.

**This means per-profile variation within a single platform is constrained by that platform's stylistic ceiling.** Even maximally differentiated prompts on ElevenLabs will share the platform's compression artifacts, spectral smoothing, and compositional tendencies. The mitigation: focus differentiation on the dimensions where the platform has the widest dynamic range (for ElevenLabs, that is structured composition and instrument selection; for Suno, genre and vocal character) and use the conducting/spatialization experience to amplify perceived difference through spatial arrangement.

### The Barnum effect and the personalization placebo

Three bodies of research converge on a finding that fundamentally reframes PostListener's technical requirements.

**The Barnum/Forer effect:** In the 1948 foundational experiment, 39 students received identical personality descriptions and rated their accuracy at **4.26 out of 5 (84%)**. The effect is robust across decades of replication. Musical personalization operates in the same territory: telling someone "this track captures your tendency toward introspection" resonates with most people while feeling specifically tailored.

**The personalization placebo:** Li (2019, *Computers in Human Behavior*) demonstrated that personalized messages outperform generic ones **only when recipients expect them to be personalized**. When positive outcome expectancies are primed, personalized content produces superior engagement. Without such priming, **no measurable difference** between personalized and generic content. People with lower need-for-uniqueness are more susceptible. PostListener's profiling ritual — 5 minutes of questions explicitly building toward "your personal musical identity" — is precisely the expectancy-priming mechanism that activates this effect.

**The AI disclosure penalty:** Berg (2024, 16 preregistered experiments, N=27,491) found consistent evaluation decreases when participants know content is AI-generated. But crucially, Shank et al. (2023, *JASA*) found **no composer identity effect for electronic music** — because electronic music already "sounds AI" to listeners. Genre framing interacts with AI attribution. If PostListener's profiling guides users toward electronic or experimental genres (where AI origin is less penalized), the disclosure effect diminishes.

### Spotify Wrapped as the model for personalization theater

Spotify Wrapped provides the strongest evidence that **framing data as identity creates massive engagement** independent of technical sophistication. **90 million users** engaged with Wrapped in 2020, driving a **21% increase in app downloads** in the first week of December. Wrapped users stream **2× longer** than non-Wrapped users. Users create separate accounts for "guilty pleasure" listening to protect their Wrapped results — treating algorithmic output as identity curation.

The mechanism is not musical analysis. It is narrative: your listening data becomes a story about who you are. PostListener's profiling stage performs exactly this function. The research strongly suggests that the profiling experience itself — the questions asked, the visual feedback, the narrative of musical identity being constructed — contributes as much or more to the "this was made for me" feeling as the actual audio differentiation.

### Designing for felt personalization: the dual-pathway model

The evidence supports optimizing along both pathways simultaneously.

**Technical differentiation (necessary but insufficient):** Vary prompts across at least 3 orthogonal dimensions per profile. Weight rhythmic/tempo preferences most heavily (AI models transfer these most reliably). Use MIR metrics to verify inter-profile distance exceeds perceptual thresholds. Employ negative prompts to escape model defaults. Build composition plans that reflect profile-specific structural preferences (not just timbral ones). Generate 5–10 candidates per profile, then auto-select using Essentia's mood/genre classifiers to maximize profile-target alignment.

**Psychological framing (powerful and potentially sufficient alone):** Design the profiling experience to prime personalization expectancy. Make the generation process visible ("we're composing your piece now based on your profile"). Use the conducting interaction as a co-creation moment — users who shape the spatial arrangement feel ownership (IKEA/endowment effect). Name or describe the generated piece in terms that echo the user's profiling responses. Apply the **MAYA principle** (Most Advanced Yet Acceptable): generate music within the user's familiar genre but with enough novelty to feel freshly created, not merely retrieved.

### The experimental design the proposal should promise

A rigorous validation study uses a **2×2 design**: (1) actually personalized versus randomly assigned AI music, crossed with (2) told "made for you" versus no personalization framing. This isolates technical differentiation from psychological framing. Based on existing literature, the prediction is that **framing explains more variance than actual personalization**, but the combination of both produces the strongest effect. This design would generate publishable findings regardless of outcome and demonstrates methodological sophistication for the ElevenLabs proposal.

---

## Conclusion: what to build and what to tell ElevenLabs

The generation pipeline should use **ElevenLabs' composition plan API as the primary engine**, with Music Finetunes creating 3–5 style archetypes derived from user profile clusters. Prompts should vary across genre/sub-genre, tempo, instrument set, production aesthetic, and structural form — never fewer than three dimensions per profile pair. Stems should be separated via HTDemucs (4-stem, `python-audio-separator`) and spatialized through Web Audio API with HRTF panning or Resonance Audio for room modeling. Budget approximately **$100–150/month** for generation during development and testing.

The ElevenLabs proposal should make three arguments. First, PostListener demonstrates a novel use case for their Music API — real-time personalized generation from user profiles — that no competitor can match at the API level. Second, the composition plan architecture enables structured personalization that Suno and Udio's text-only prompting cannot replicate programmatically. Third, ElevenLabs' licensed training data eliminates the copyright risks that make Suno and Udio unsuitable for a publicly exhibited thesis installation.

The honest limitation to acknowledge internally: ElevenLabs' musical quality and genre flexibility currently trail Suno, and a listener comparing raw outputs side-by-side would likely prefer Suno's. The PostListener design resolves this by wrapping the generated audio in a spatial conducting experience and personalization narrative that shifts evaluation criteria from "does this sound as good as Spotify" to "does this feel like mine." The research strongly suggests that shift is achievable — and that **the profiling ritual, the visible generation process, the conducting interaction, and the dissolution arc collectively do more work than the audio quality alone ever could.**

For the June 2026 deadline, the minimum viable pipeline is: profiling → prompt construction (programmatic, from profile data) → ElevenLabs composition plan generation (30 seconds) → HTDemucs stem separation (1–3 minutes) → Web Audio API spatialization (real-time). Total latency under 4 minutes. Total monthly cost under $150. Total new code: a prompt-construction module mapping profiles to composition plans, a separation wrapper, and a spatial audio renderer. The research base is deep enough to cite, the tools are production-ready, and the perceptual evidence suggests the design will work — not because AI music is perfect, but because the experience design makes the imperfections invisible.