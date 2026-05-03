# Spatial audio, presence, and the HRTF question

**Generic HRTF alone will not externalize your music — but the fix is not better HRTFs.** The psychoacoustic literature delivers a surprising and consistent verdict: the felt experience of "sound in a room around you" depends more on early reflections and reverberation than on HRTF quality. Begault et al. (2001) found reverberation had the largest positive effect on externalization, while individualized HRTFs showed no significant externalization improvement over generic ones. This means the OrchestraEngine's core problem was never its HRTF — it was the missing room. With 6 well-placed early reflections, a binaural reverb tail, distance filtering, and the correct signal chain order, Web Audio API's built-in generic HRTF can produce genuine externalization. A native app pivot is not justified for this project. The 4-stem browser pipeline inherited from Workstream B can achieve the felt presence PostListener requires — but only if the seven architectural problems are fixed in the right order.

---

## The brain expects a room, not a function

When a listener wearing headphones perceives sound as external — occupying a space around them rather than trapped inside the skull — the brain is confirming that the incoming signal matches its model of how real-world sound behaves. Jens Blauert's foundational *Spatial Hearing* (1983/1997) formalized this: spatial perception relies on long-term memory (stored spectral maps of how ears filter sound) and short-term memory (contextual expectations about the environment). When headphone audio violates these expectations — no crosstalk between ears, no pinna filtering variation, no reflections, no room — the brain defaults to in-head localization (IHL), the perceptual state where sound feels trapped inside the skull.

**The hierarchy of externalization cues is not what most developers assume.** The literature, synthesized across four decades of research, ranks them as follows:

1. **Early reflections + reverberation** — the most robust externalization cue, capable of compensating for HRTF mismatch entirely. Begault (1992) found that adding synthetic reverberation to HRTF-processed speech **nearly doubled externalization rates**. Yuan et al. (2017) demonstrated that 2nd-order early reflections were more helpful for externalization than late reverb alone.

2. **Head tracking / dynamic cues** — Brimijoin, Boyd & Akeroyd (2013) measured a **3× improvement** in externalization rate: world-fixed binaural rendering on headphones achieved 65% externalization versus 20% for head-fixed rendering. This holds regardless of HRTF fidelity.

3. **Correct spectral profile (HRTF)** — necessary for lateralization and elevation but not sufficient alone. Generic HRTFs produce only **20–30% externalization for frontal sources** when used without supporting cues.

4. **Interaural differences (ITD/ILD)** — essential for left-right placement. Lateral sources externalize 2–3× more easily than median-plane sources because interaural differences are larger.

5. **Distance cues (DRR, air absorption)** — the direct-to-reverberant ratio is the primary distance cue. Air absorption adds ~0.06 dB/m rolloff at 8 kHz, subtle but psychoacoustically meaningful.

6. **HRTF personalization** — improves angular accuracy by ~10° and reduces front-back confusion, but Best et al. (2020) confirmed that in reverberant conditions, "artificial HRTFs are sufficient and individual spectral cues are not critical for externalization."

The critical design implication: **invest engineering effort in room simulation, not HRTF personalization**. A well-chosen generic HRTF plus strong early reflections plus binaural reverb will externalize far more effectively than a personalized HRTF in an anechoic rendering.

### Early reflections carry the spatial signature

Early reflections — the first 5–50ms of reflected sound from walls, floor, and ceiling — are not merely "reverb." They are the brain's primary evidence that a sound exists in an external space. Brinkmann et al. found that **6 accurately rendered early reflections plus stochastic late reverberation** produced auralizations perceptually indistinguishable from a fully rendered reference. The key properties: reflections must arrive from **different directions** than the direct sound (this is what breaks IHL), lateral reflections are especially effective, and they must be binaurally rendered — Leclère et al. (2019) showed that dichotic (binaural) reverberation improved externalization while diotic (identical in both ears) reverberation did not help significantly.

For the Orchestra's virtual room (~5×4×3m), first-order reflections from 6 surfaces arrive at 3–15ms delays with -3 to -6 dB attenuation per reflection order. Each reflection should be HRTF-panned from its mirror-image direction. This is computationally tractable for 4 stems.

### Distance perception and the DRR lever

The direct-to-reverberant ratio (DRR) is the brain's strongest distance cue in rooms. As a source moves farther away, direct sound decreases by **6 dB per doubling of distance** while reverberant energy stays roughly constant. Butler et al. (1980) found that high-pass filtered noise was judged closer and low-pass filtered noise was judged more distant. For the Orchestra's stems at 2–5m virtual distances, a gentle lowshelf or lowpass filter (-1 to -3 dB above 4–8 kHz per 2m) combined with DRR adjustment creates convincing depth stratification.

### The visual context question

For PostListener, the absence of a visual environment may actually be an advantage. Research shows that when binaurally rendered acoustics don't match the visual listening environment, externalization suffers (the "room divergence effect"). A 2016 Nature Scientific Reports study found that auditory room cues had higher impact on externalization than visual room cues when the two were incongruent. Eyes-closed or abstract-visual listening eliminates this potential mismatch. If the experience includes any visual component, it should suggest an enclosed space consistent with the audio room simulation — or encourage eyes closed during the dissolution phase.

---

## Web Audio API can reach the externalization threshold

The browser-first constraint is not the limitation it appears to be. Web Audio API's ceiling for spatial audio is higher than commonly understood — the quality gap with native platforms is narrower than most developers assume, and can be narrowed further with the right architecture.

### What the built-in PannerNode HRTF actually does

The PannerNode in HRTF mode performs real-time convolution using **IRCAM Listen Project** averaged HRTFs — not the MIT KEMAR dataset as commonly assumed. The data was averaged across multiple subjects and symmetrized, then compiled into the browser binary. Chromium/Blink, WebKit (Safari), and Firefox all use this same IRCAM-derived dataset. It is **not personalizable** — there is no API to supply custom HRTFs. The quality is adequate for horizontal localization but weak for elevation cues and prone to front-back confusion, which is typical of averaged HRTF datasets.

Paul Adenot (Mozilla, Web Audio spec editor) describes PannerNode HRTF as "very expensive" — it runs 4 FFT-based convolvers (2 per ear × 2 for crossfade during position changes) plus delay lines for ITD simulation. Despite this cost, **4 HRTF PannerNodes should be manageable on mid-range Android** (Snapdragon 6xx/7xx class). This is at the comfort limit but within the performance budget for PostListener's 4-stem architecture.

### Resonance Audio is the strongest library candidate

Google's Resonance Audio Web SDK, despite being effectively unmaintained by Google (transitioned to community-driven development), remains the most feature-complete browser spatial audio library available. It provides:

- **Ambisonic-based rendering** using Omnitone (Google's FOA/HOA decoder with SADIE binaural filters), which decouples source count from rendering cost
- **Room modeling** with configurable dimensions and wall materials, generating frequency-dependent early reflections via an image-source method plus a "Spectral Reverb" late tail
- **Source directivity** and spread control
- **Constant-complexity decode** regardless of source count — critical for mobile performance

The room model is especially valuable because it generates early reflections automatically — exactly the cue the literature identifies as most critical for externalization. The library is installable via NPM (`resonance-audio`) and works with Vite/React.

### Custom HRTF is possible but likely unnecessary

ConvolverNode allows loading arbitrary HRTF impulse responses from databases like CIPIC (45+ subjects, 1250 directions, 200-sample HRIRs at 44.1kHz), ARI, SADIE, or HUTUBS. Position-dependent convolution requires interpolation between measured positions and crossfading between two ConvolverNodes for smooth transitions. The computational cost is manageable for short HRIRs (~200 samples), with a practical limit of **4–8 simultaneous short-impulse ConvolverNodes on mid-range Android**. However, given that HRTF personalization ranks far below room simulation for externalization impact, this effort is not justified for PostListener's June 2026 timeline.

### Head tracking works in the browser — with caveats

The DeviceOrientationEvent API provides phone gyroscope data at ~60Hz on both iOS Safari (requires explicit permission via user gesture since iOS 13) and Android Chrome (works without permission, requires HTTPS). This can drive AudioListener or Resonance Audio scene orientation updates for head-responsive spatial audio:

```javascript
// iOS permission request (must be inside user gesture handler)
if (typeof DeviceOrientationEvent.requestPermission === 'function') {
  DeviceOrientationEvent.requestPermission().then(state => {
    if (state === 'granted') {
      window.addEventListener('deviceorientation', updateOrientation);
    }
  });
}
```

Total motion-to-audio latency is typically **30–100ms on mobile** (sensor interval ~16ms + audio buffer latency + output latency). This is below the ~100ms threshold generally accepted for head-tracked spatial audio. The catch: this tracks phone orientation, not head orientation. Users would need to hold the phone or place it on a surface. For AirPods-style head tracking, native APIs (CMHeadphoneMotionManager) are required — there is no web equivalent. **Phone-based gyroscope head tracking is a partial but meaningful substitute** worth implementing, especially for the conducting phase (Workstream D).

### Correct signal chain order in Web Audio

The signal chain order matters enormously because each stage depends on the output of the previous one. Based on the 3D Tune-In Toolkit architecture (PLOS ONE, 2019), IRCAM's SPAT, and the physical acoustics of real rooms, the correct order is:

```
Per-source (mono):
  Source → Volume → Per-source EQ → Distance filter (lowpass) → HRTF Panner
  ↓ (pre-HRTF mono send to reverb bus)
  
Shared buses:
  Early Reflections: per-reflection Delay → Filter → Gain → HRTF Panner
  Late Reverb: ConvolverNode with binaural (stereo) room IR
  Binaural Beats: Oscillators → ChannelMerger → destination (bypass everything)
  
Output:
  Direct paths + ER paths + Reverb path → Master Gain → destination
```

**Distance filtering must precede HRTF** because in reality distance affects the spectrum before the sound reaches the listener's ears. **Reverb must NOT be applied after HRTF** to the stereo mix — this destroys binaural cues. The correct architecture sends a mono signal pre-HRTF to the reverb bus, where a binaural room impulse response naturally encodes the diffuse spatial character of reverberation.

---

## The native pivot is not justified

Native spatial audio platforms offer measurable improvements over Web Audio, but the quality jump does not justify the development cost for PostListener's specific goals. Here is what each platform actually provides — and why it doesn't change the calculus.

### Apple's spatial audio ecosystem is impressive but limiting

Apple's PHASE framework offers geometry-aware audio, volumetric sources, occlusion modeling, and integration with Personalized Spatial Audio (ear-scanned custom HRTFs stored in iCloud). However, the Cenatus team (professional audio developers) described PHASE as their "biggest challenge," citing profoundly cryptic crashes from misconfigurations and sparse documentation. PHASE provides only a single global reverb preset — no per-source room variation — which is actually *less flexible* than Web Audio's ConvolverNode approach. AVAudioEngine with AVAudio3DMixing is more proportionate but still requires Swift, unfamiliar tooling, and locks the project to iOS/macOS.

The killer feature is **CMHeadphoneMotionManager** for AirPods head tracking — this is genuinely transformative for externalization. But it only works with AirPods Pro, Max, or 3rd gen, limiting the audience to roughly 30–40% of iOS users at best. Everyone else gets the same experience as Web Audio.

### Android's spatial audio story is weak

The Android Spatializer API (Android 13+) is designed for system-level rendering of Dolby/multichannel content, not for placing individual stems in 3D space programmatically. Quality varies by OEM. Mid-range devices may not support it at all. Google Oboe is a low-latency audio I/O wrapper with zero spatialization capabilities. **There is no Android equivalent to PHASE or AVAudioEngine's spatial mixing** — developers must bring their own DSP.

### Cross-platform frameworks don't bridge the gap

React Native Audio API has spatial audio on its roadmap but not yet implemented. Flutter has no spatial audio plugins. Unity with Steam Audio represents the highest quality ceiling available but is dramatically overkill — a solo M.Des. student would spend more time learning Unity than building the experience, and the output would be an app binary, not a shareable URL. Electron and Tauri use the same Web Audio API as the browser and add nothing for spatial audio.

### The decision framework

A native pivot would be justified only if ALL of the following conditions are true:

- Head tracking is demonstrably essential to the thesis argument (not just "nice to have")
- The ElevenLabs proposal can fund **6–10 additional weeks** of development
- The project can accept limiting the full experience to AirPods users on iOS
- The web version is maintained as a fallback (effectively doubling the build)

For PostListener's actual goals — felt presence, 16 minutes, 4 stems, shareable via URL, June 2026 deadline — **Web Audio API with Resonance Audio is the correct choice**. Development time is **1–2 weeks** versus 6–10 weeks for native. The quality gap can be narrowed by maximizing the cues Web Audio *can* deliver (room simulation, early reflections, distance filtering) and mitigated by non-acoustic factors (narrative priming, voice design, visual context).

---

## Fixing the seven problems in order

The previous OrchestraEngine's failures map cleanly onto the perceptual hierarchy: it delivered HRTF in isolation without the supporting cues the brain requires for externalization. Here are the fixes, ordered by impact.

### Priority 1 — Reverb architecture (Problem 1): the foundation

**The problem**: Reverb was in the wrong position in the signal chain — likely applied after HRTF to the stereo mix, which destroys binaural cues, or before HRTF as a mono effect, which incorrectly directionalizes what should be diffuse energy.

**The fix**: Each stem sends a mono signal *before* the HRTF panner to a shared reverb bus. The reverb bus uses a ConvolverNode loaded with a **binaural (stereo) room impulse response** — this naturally encodes the diffuse, enveloping character of reverberation. The reverb output is summed with the HRTF-panned direct paths at the stereo output.

```javascript
// Per-source: mono send to reverb BEFORE HRTF panner
source.connect(distanceFilter);
distanceFilter.connect(panner);        // direct path → HRTF
distanceFilter.connect(reverbSend);    // pre-HRTF mono send to shared bus

// Shared reverb bus with binaural IR
reverbBus.connect(convolver);          // stereo room IR
convolver.connect(masterGain);         // summed with direct paths
```

**Impact: Critical.** Wrong reverb positioning corrupts the entire spatial impression. This must be fixed first because every other improvement depends on a correct reverb architecture.

### Priority 2 — Per-source filtering (Problem 6): a quick win

**The problem**: A single filter stage downstream of all panners coupled all sources to the same modulation and operated on the binaural stereo signal, degrading interaural cues.

**The fix**: Move all filtering to *before* each source's PannerNode. Each stem gets its own BiquadFilterNode chain (EQ, distance filter, expressive filter) in mono, before HRTF encoding. As spatial audio practitioner Jordi Alba confirms: "All effects like EQ, time-based effects, dynamics should happen BEFORE the 3D input. This also means that all these pre-processes are done in mono."

**Impact: Medium-high.** Easy to implement (restructure node connections), essential for independent source control, and prevents degradation of binaural cues.

### Priority 3 — Early reflections (Problem 2): the externalization breakthrough

**The problem**: No early reflections at all — HRTF rendered into an acoustic vacuum.

**The fix**: Implement 6 first-order reflections using the image-source method for the virtual room. Each reflection is a chain of DelayNode (3–15ms based on reflection path length) → BiquadFilterNode (lowpass, simulating wall absorption) → GainNode (-6 to -12 dB) → PannerNode (HRTF, positioned at the mirror-image direction). Lateral reflections (from side walls) should be prioritized because research consistently shows they are most effective for externalization.

**Practical parameters for a ~5×4×3m room, listener near center:**

| Surface | Delay | Gain | Direction |
|---------|-------|------|-----------|
| Left wall | ~7ms | -6 dB | Hard left |
| Right wall | ~7ms | -6 dB | Hard right |
| Front wall | ~10ms | -8 dB | Front |
| Back wall | ~10ms | -8 dB | Behind |
| Floor | ~4ms | -9 dB | Below |
| Ceiling | ~6ms | -9 dB | Above |

**Performance concern**: 6 reflections × 4 stems × HRTF panners = 24 additional HRTF panners, which exceeds the mobile budget. **The solution**: use a simplified approach where reflections are calculated for the room, not per source — route all 4 stems through the same 6 reflection paths. This reduces to 6 additional HRTF panners regardless of stem count, totaling 10 HRTF panners (4 direct + 6 reflections). If still too expensive, fall back to Resonance Audio's built-in room model, which handles early reflections efficiently within its Ambisonic pipeline.

**Impact: High.** This is the single most impactful addition for externalization. Studies show early reflections contribute more to perceived externalization than late reverb alone.

### Priority 4 — Distance filtering (Problem 3): natural depth

**The problem**: All sources had full-bandwidth brightness regardless of virtual distance, sounding artificially close.

**The fix**: One BiquadFilterNode (lowpass) per source, with cutoff frequency mapped to virtual distance. Combined with DRR manipulation (increase reverb send level with distance).

```javascript
function updateDistanceFilter(filterNode, distance) {
  const cutoff = Math.max(2000, 20000 * Math.pow(1 / Math.max(distance, 1), 0.5));
  filterNode.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.02);
}
```

At 2m: ~16 kHz cutoff. At 5m: ~10 kHz. At 10m: ~6 kHz. These are subtle but the brain registers them. The DRR lever (adjusting reverb send gain inversely with distance) is the dominant distance cue and should vary per source.

**Impact: Medium.** Quick to implement, enhances depth perception and naturalness.

### Priority 5 — Supporting cue validation (Problem 5): the meta-fix

This is not a separate implementation — it is the validation that fixes 1–4 have assembled the minimum viable externalization cue set. The literature (Best et al., 2020; Begault et al., 2001) establishes that generic HRTF succeeds when combined with: binaural reverb ✓ (fix 1), early reflections ✓ (fix 3), DRR variation ✓ (fix 4), distance filtering ✓ (fix 4). The only high-impact cue the project cannot provide without hardware is head tracking. This makes the remaining cues more important — they must compensate for the absence of dynamic cues.

### Priority 6 — Binaural beats isolation (Problem 7): simple routing fix

**The problem**: Binaural beats routed through a compressor, which destroys the precise inter-ear frequency difference required for entrainment through gain coupling and ILD distortion.

**The fix**: Binaural beats must completely bypass all processing — two OscillatorNodes at slightly different frequencies, each through a GainNode (very low amplitude, ~0.05), merged via ChannelMergerNode directly to `ctx.destination`.

**Should binaural beats be in the project?** A 2023 systematic review of 14 studies found 5 supporting brainwave entrainment, **8 contradicting it**, and 1 mixed. The empirical basis is weak. **Recommendation**: make binaural beats optional, clearly labeled as experimental, and isolated from the spatial audio pipeline. They should not influence architectural decisions.

**Impact: Low.** Fixing the routing is trivial if beats are kept, but the feature itself has uncertain benefit.

### Priority 7 — Head decoupling (Problem 4): deferred by hardware reality

Without head-tracking hardware, the soundfield is inherently head-locked — sound moves with the head. This is unavoidable and standard for all headphone music listening (including Dolby Atmos Music without AirPods tracking). If DeviceOrientationEvent-based phone gyroscope tracking is added later (Workstream D), the implementation is straightforward:

```javascript
window.addEventListener('deviceorientation', (e) => {
  const yaw = e.alpha * Math.PI / 180;
  ctx.listener.forwardX.value = -Math.sin(yaw);
  ctx.listener.forwardZ.value = -Math.cos(yaw);
});
```

**Impact: High if implemented, but blocked by hardware constraints.** Focus on maximizing static cues to compensate.

---

## The recommended architecture and what compensates for the ceiling

### Complete browser-based signal chain for 4 stems

```
[Vocal stem]  → GainNode → BiquadFilter(EQ) → BiquadFilter(distance LP) 
                  ├→ PannerNode(HRTF, azimuth: 0°, dist: 3m)    → directBus
                  └→ GainNode(reverbSend: 0.35)                  → reverbBus

[Drum stem]   → GainNode → BiquadFilter(EQ) → BiquadFilter(distance LP)
                  ├→ PannerNode(HRTF, azimuth: -60°, dist: 2m)  → directBus
                  └→ GainNode(reverbSend: 0.25)                  → reverbBus

[Bass stem]   → GainNode → BiquadFilter(EQ) → BiquadFilter(distance LP)
                  ├→ PannerNode(HRTF, azimuth: 60°, dist: 2.5m) → directBus
                  └→ GainNode(reverbSend: 0.30)                  → reverbBus

[Other stem]  → GainNode → BiquadFilter(EQ) → BiquadFilter(distance LP)
                  ├→ PannerNode(HRTF, azimuth: 180°, dist: 4m)  → directBus
                  └→ GainNode(reverbSend: 0.40)                  → reverbBus

[Early Reflections]: reverbBus → 6× (DelayNode → BiquadFilter → GainNode → PannerNode(HRTF)) → directBus
[Late Reverb]:       reverbBus → ConvolverNode(binaural room IR) → GainNode(wet level) → directBus
[Binaural Beats]:    OscL(200Hz) + OscR(210Hz) → ChannelMerger → destination (BYPASS ALL)
[Output]:            directBus → masterGain → destination
```

**Placement principles**: No stems at exact 0° median plane (vocals at slight offset if centered causes IHL). Spread stems across azimuth for maximum lateralization. Vary distances for depth layering. Place the "other" stem (most ambient/textural) farthest away with highest reverb send.

### Native-vs-browser decision framework

| Criterion | Web Audio threshold | Native justified if... |
|-----------|-------------------|----------------------|
| Externalization | Achievable with ER + reverb + distance cues | Testing shows <40% of listeners report externalization despite full cue implementation |
| Head tracking | Phone gyroscope provides partial substitute | Thesis argument requires demonstrating dynamic externalization vs. static |
| Timeline | 1–2 weeks to implement | ElevenLabs funds 6+ additional weeks AND delays are acceptable |
| Audience | URL sharing, zero friction | iOS-only distribution is acceptable and AirPods Pro are available for all evaluators |
| HRTF quality | Generic IRCAM dataset via PannerNode | Personalized HRTF is central to the research question (it is not) |

### What compensates for Web Audio's ceiling

The Orchestra is not a naked spatial audio demo — it is a designed experience with narrative, voice, personalization, and temporal arc. Several non-acoustic factors powerfully reinforce spatial presence:

- **Narrative priming**: Telling the listener "you are entering a room" before the spatial audio begins sets expectations that bias perception toward externalization. Plenge's model (cited by Blauert) establishes that short-term memory expectations shape spatial hearing.
- **Personalization context**: Knowing the music was "made for you" (from PostListener profiling) increases engagement and attention. Liberman et al. (2022) found that IHL actually increases felt closeness — the dissolution phase could exploit this by *intentionally* collapsing spatialization at the end.
- **Adaptation period**: Research shows listeners calibrate to virtual environments in **10–20 seconds**. The 16-minute duration is an advantage — the first minute of spatial audio "trains" the brain.
- **Eyes-closed instruction**: Eliminating visual-auditory mismatch removes a potential externalization degradation. Encourage eyes closed during the dissolution phase.
- **Stem arrangement**: Placing stems at strong lateral angles (±60° or wider) exploits the brain's natural tendency to externalize lateral sources 2–3× more easily than frontal ones.

### Honest assessment of the ceiling

Web Audio API with the architecture above will produce convincing externalization for **most listeners in a reverberant rendering**. It will not match the quality of Apple Spatial Audio with personalized HRTFs and AirPods head tracking. The specific limitations:

- **Front-back confusion** will occur for some listeners with the generic HRTF — mitigated by avoiding critical content at 0° or 180°
- **Elevation accuracy** is poor with averaged HRTFs — avoid relying on above/below positioning for musical meaning
- **No true head tracking** without native APIs — the soundfield is head-locked, which reduces externalization by roughly **3× compared to head-tracked rendering** (Brimijoin et al., 2013)
- **Mobile performance headroom is tight** — 4 HRTF PannerNodes + 6 reflection panners + ConvolverNode reverb approaches the budget on mid-range Android. Resonance Audio's Ambisonic approach is the safer path if performance testing reveals problems.

These limitations are real but manageable. The research literature consistently shows that room simulation quality dominates the externalization equation. A well-implemented browser experience with strong early reflections, correct reverb architecture, and thoughtful stem placement will feel more "present" than a technically superior native build with bare HRTF. The Orchestra's 16-minute duration, narrative framing, and personalization context provide compounding advantages that no purely technical benchmark captures. The ElevenLabs proposal should present the browser architecture as the primary deliverable with confidence, noting that a native prototype with head tracking could serve as a research comparison if funding supports it — but not as a prerequisite for the felt experience the project promises.