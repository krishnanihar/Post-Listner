# PostListener — Spectrum Phase Audio Generation Prompts
## ElevenLabs Sound Effects API

### Generation parameters for all clips:
- **Duration:** 4 seconds
- **Format:** MP3
- **Storage:** `/public/spectrum/{name}.mp3`
- **Prompt influence:** 0.5 (balanced between prompt and model creativity)

### Design principles:
Each clip is one pole of a valence continuum. Left-side clips anchor low valence 
(dark, tense, minor, heavy). Right-side clips anchor high valence (bright, warm, 
major, light). The contrast between each pair must be immediately perceptible — 
the emotional direction should be felt within the first half second.

All clips must have clean fade-in and fade-out (no abrupt transients) to support 
seamless crossfading during the slide gesture.

Valence coordinate is the primary axis. Arousal and Depth are held roughly constant 
within each pair so the contrast is purely valence-driven.

---

## PAIR 1: shadow / warmth
**Valence range:** V=0.10 (shadow) → V=0.85 (warmth)
**Arousal:** ~0.30 both sides (slow, non-driving)
**Depth:** ~0.50 both sides (moderate)

**shadow.mp3** `V=0.10, A=0.30, D=0.50`
> Deep, dark orchestral drone in a minor key. Low cello or bass sustain. 
> Slow and heavy. No melody. A sense of weight pressing downward. 
> Reverberant and distant. Fades in gently, holds, fades out. 
> Emotionally: grief, shadow, the feeling before sleep.

**warmth.mp3** `V=0.85, A=0.30, D=0.50`
> Warm, bright acoustic guitar chord in a major key. Gentle fingerpicking. 
> Resonant and full. No rhythm, just sustained harmonic warmth. 
> Like sunlight through a window. Fades in gently, holds, fades out. 
> Emotionally: comfort, safety, tenderness.

---

## PAIR 2: pulse / shimmer
**Valence range:** V=0.20 (pulse) → V=0.80 (shimmer)
**Arousal:** ~0.55 both sides (moderate energy)
**Depth:** ~0.35 both sides (surface, not cerebral)

**pulse.mp3** `V=0.20, A=0.55, D=0.35`
> Low, dark electronic pulse. Sub-bass throb with a slow rhythmic beat. 
> Tense and ominous. Like a heartbeat in a dark room. 
> Minimal, repetitive, threatening. Slight distortion at the low end. 
> Emotionally: unease, anticipation, threat.

**shimmer.mp3** `V=0.80, A=0.55, D=0.35`
> High, bright bell-like shimmer. Crystalline overtones decaying slowly. 
> Light and airy. Like light refracting through glass or water. 
> Delicate and sparkling. Multiple harmonics layered softly. 
> Emotionally: delight, wonder, clarity.

---

## PAIR 3: weight / air
**Valence range:** V=0.15 (weight) → V=0.70 (air)
**Arousal:** ~0.20 both sides (very low energy)
**Depth:** ~0.60 both sides (present but not overwhelming)

**weight.mp3** `V=0.15, A=0.20, D=0.60`
> Extremely low sub-bass rumble. The physical sensation of pressure. 
> No melody, no rhythm. Just a sustained low frequency presence. 
> Like standing near a large engine or deep underground. 
> Heavy, suffocating, inescapable. 
> Emotionally: burden, gravity, inertia.

**air.mp3** `V=0.70, A=0.20, D=0.60`
> Very high, delicate airy tones. Like wind chimes heard from far away 
> or breath across a flute opening. Sparse and spacious. 
> Mostly silence with occasional soft high tones floating through. 
> Light, free, weightless. 
> Emotionally: freedom, lightness, expansiveness.

---

## PAIR 4: ache / bloom
**Valence range:** V=0.10 (ache) → V=0.90 (bloom)
**Arousal:** ~0.25 both sides (slow, reflective)
**Depth:** ~0.75 both sides (emotionally deep — this is the most emotionally loaded pair)

**ache.mp3** `V=0.10, A=0.25, D=0.75`
> Slow, melancholic solo cello. A single sustained phrase in a minor key. 
> Emotionally raw and unresolved. No accompaniment. 
> The sound of longing or loss. Slight wavering in pitch, human imperfection. 
> Deeply affecting, quietly devastating. 
> Emotionally: grief, longing, nostalgia, the ache of absence.

**bloom.mp3** `V=0.90, A=0.25, D=0.75`
> Slow, uplifting orchestral swell. Strings and gentle brass building softly 
> to a warm major resolution. Like a sunrise or a held breath releasing. 
> Full and resonant without being loud. Deeply hopeful. 
> Emotionally: joy, arrival, release, the feeling of something opening.

---

## PAIR 5: machine / earth
**Valence range:** V=0.20 (machine) → V=0.65 (earth)
**Arousal:** ~0.50 both sides (moderate)
**Depth:** ~0.40 both sides (present, tactile)

**machine.mp3** `V=0.20, A=0.50, D=0.40`
> Industrial metallic sound. Rhythmic mechanical clanging or stamping. 
> Cold, precise, inhuman. Like a factory floor or a printing press. 
> Harsh overtones, metallic resonance. No warmth. 
> Emotionally: alienation, precision, coldness, industry.

**earth.mp3** `V=0.65, A=0.50, D=0.40`
> Organic wood percussion. Hand drum or djembe, close-miked. 
> Warm, resonant, imprecise. Like sitting around a fire. 
> Natural and grounding. Slight room ambience. 
> Emotionally: groundedness, community, warmth, the natural world.

---

## PAIR 6: tension / resolve
**Valence range:** V=0.05 (tension) → V=0.85 (resolve)
**Arousal:** ~0.60 both sides (elevated — this pair is the most overtly musical)
**Depth:** ~0.55 both sides

**tension.mp3** `V=0.05, A=0.60, D=0.55`
> Dissonant orchestral cluster chord. Multiple strings and brass sustaining 
> pitches that clash and grind against each other. Unresolved and uncomfortable. 
> The sound of a held breath or a moment before impact. 
> No rhythmic movement. Pure harmonic tension. 
> Emotionally: anxiety, conflict, suspension, unbearable anticipation.

**resolve.mp3** `V=0.85, A=0.60, D=0.55`
> A single, perfectly consonant orchestral chord resolving warmly to a major key. 
> Full strings, gentle brass, clear and ringing. 
> The feeling of tension finally releasing. Deeply satisfying. 
> Like the last chord of a symphony or a long exhale. 
> Emotionally: resolution, peace, completion, relief.

---

## PAIR 7: fog / glass
**Valence range:** V=0.20 (fog) → V=0.75 (glass)
**Arousal:** ~0.15 both sides (very low — this is the quietest pair)
**Depth:** ~=0.65 both sides

**fog.mp3** `V=0.20, A=0.15, D=0.65`
> Thick, murky low-frequency noise. Like a foghorn heard through dense mist 
> or sound travelling through water. Heavily filtered, low-pass. 
> Obscured and indistinct. Nothing is clear. 
> Slow and formless. Slightly oppressive. 
> Emotionally: disorientation, obscurity, isolation, being lost.

**glass.mp3** `V=0.75, A=0.15, D=0.65`
> Crystal clear, pure sine tones with long decay. Like wine glasses being played 
> or a perfectly tuned bell in an empty room. 
> Pristine and transparent. High frequency, clean. 
> No noise, no warmth — pure clarity and precision. 
> Emotionally: clarity, purity, precision, the feeling of seeing clearly.

---

## PAIR 8: gravity / drift
**Valence range:** V=0.30 (gravity) → V=0.60 (drift)
**Arousal:** V=0.65 (gravity) → A=0.15 (drift)
**Note:** This pair deliberately varies Arousal as well as Valence — 
gravity is grounded and driving, drift is floating and directionless. 
This is the most multi-dimensional pair and gives the richest combined signal.

**gravity.mp3** `V=0.30, A=0.65, D=0.30`
> Deep, anchored rhythmic bass. A slow but insistent pulse. 
> Heavy downbeat emphasis. Like a massive pendulum swinging. 
> Dark and grounded. You feel it in your chest. 
> No melody, just weight and rhythm. 
> Emotionally: inevitability, heaviness, being pulled downward, grounded force.

**drift.mp3** `V=0.60, A=0.15, D=0.70`
> Weightless ambient pad. No rhythm, no beat. Slowly evolving harmonics 
> moving in unpredictable directions. Like floating in water or watching clouds. 
> Soft and undirected. No tension, no resolution. 
> Emotionally: freedom, formlessness, gentle wandering, release from direction.

---

## AVD COORDINATE REFERENCE TABLE

| Clip | A | V | D |
|------|-----|-----|-----|
| shadow | 0.30 | 0.10 | 0.50 |
| warmth | 0.30 | 0.85 | 0.50 |
| pulse | 0.55 | 0.20 | 0.35 |
| shimmer | 0.55 | 0.80 | 0.35 |
| weight | 0.20 | 0.15 | 0.60 |
| air | 0.20 | 0.70 | 0.60 |
| ache | 0.25 | 0.10 | 0.75 |
| bloom | 0.25 | 0.90 | 0.75 |
| machine | 0.50 | 0.20 | 0.40 |
| earth | 0.50 | 0.65 | 0.40 |
| tension | 0.60 | 0.05 | 0.55 |
| resolve | 0.60 | 0.85 | 0.55 |
| fog | 0.15 | 0.20 | 0.65 |
| glass | 0.15 | 0.75 | 0.65 |
| gravity | 0.65 | 0.30 | 0.30 |
| drift | 0.15 | 0.60 | 0.70 |

---

## IMPLEMENTATION NOTE

In Spectrum.jsx, the valence update calculation should shift from the current 
fixed ±0.0625 delta per pair toward a coordinate-based approach:

When user commits to a side (left or right), the valence update is:
  delta = (chosenClip.v - 0.5) * confidence * slideCommitmentWeight

Where slideCommitmentWeight is derived from:
- Final slider position at moment of commitment (further = more certain)  
- Number of direction reversals during the gesture (more reversals = ambivalence penalty)
- Time from gesture start to commitment (dwell time as revealed preference)

This replaces the arbitrary -1/+1 binary with a continuous, coordinate-grounded update.
The same logic applies to A and D updates from the pair coordinates, 
giving Spectrum a secondary contribution to all three dimensions, not just V.
