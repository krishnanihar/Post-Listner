# Suno Extend Lyrics — 3-Round Continuation per Archetype

## How to use

For each of your 24 liked clips, you'll do **3 sequential Extend rounds** in Suno:

1. Open the clip → **Remix** menu → **Extend**
2. **Set the extend timestamp to 3/4 of the clip's duration** (drag the seek slider — don't use "Select All", which lands on the silent tail)
3. **Style field**: leave the auto-filled style alone (or click "Reuse Prompt"). Don't modify it.
4. **Lyrics field**: paste the **Round-N block** for that clip's archetype (below)
5. Click **Create song**
6. When it finishes, repeat with the new clip as the source for Round 2, then Round 3
7. After Round 3, click the **⋯ menu → Get Whole Song** to stitch into a single ~5-min file

The structure markers (e.g. `[Continue: ...]`, `[Outro: ...]`, `[End]`) tell Suno *what* to do without introducing vocals. **Do not** use `[Verse]` / `[Chorus]` markers in extends — those can prompt vocals even with `instrumental only` in style.

3/4 cut math per round:
- Round 1: extend at 0.75 × original duration
- Round 2: extend at 0.75 × Round-1 duration
- Round 3: extend at 0.75 × Round-2 duration

Each round adds ~60s. Final length per track ≈ 3:00–3:30 after 3 rounds (the 3/4 cut trims silence each time, so growth is sub-linear). To push past 5 min, you may need a 4th round or use a higher cut (e.g. 0.85) once you've heard where music actually ends.

---

## LATE-NIGHT-ARCHITECT
*(lo-fi piano, neo-classical, felt piano, lone violin, A minor, 70 BPM)*

Applies to: `lo-fi-piano-2010s`, `synth-melancholy-1980s`, `neo-classical-2020s`, `ecm-jazz-piano-1970s`

### Round 1
```
[Continue: same felt piano motif, slight harmonic shift]
[Develop: lone violin takes the lead phrase, sparse left hand]
[Sustain: layered piano voicings, gentle build, no drop]
```

### Round 2
```
[Continue: piano and violin intertwined, denser texture]
[Bridge: subtle key flex toward relative major, field-recording texture beneath]
[Pre-outro: instruments thin to piano and lone violin]
```

### Round 3
```
[Continue: solo felt piano returns, motif fragmented]
[Outro: gradual decay, final phrase trails off into silence]
[End]
```

---

## HEARTH-KEEPER
*(warm folk, americana, fingerpicked guitar, felt cello, G major, 90 BPM)*

Applies to: `folk-2010s`, `slow-rnb-1970s`, `acoustic-soft-2000s`, `americana-1960s`

### Round 1
```
[Continue: same fingerpicking pattern, cello sustains beneath]
[Develop: brushed drums settle into pocket, guitar variation]
[Sustain: cello takes the lead phrase, warm and tender]
```

### Round 2
```
[Continue: full ensemble, gentle swell]
[Bridge: gentle modulation upward, cello solo, drums brushed quieter]
[Pre-outro: drums recede, guitar and cello in dialogue]
```

### Round 3
```
[Continue: solo fingerpicked guitar returns]
[Outro: cello holds the final long note, room mics breathe, fade]
[End]
```

---

## VELVET-MYSTIC
*(chamber strings, dream-pop, bowed strings, shimmer reverb piano, D major, 80 BPM)*

Applies to: `chamber-strings-2020s`, `dream-pop-1990s`, `orchestral-revisited`, `ambient-choral-2010s`

### Round 1
```
[Continue: bowed strings sustain, piano shimmer in cathedral reverb]
[Develop: choral pad swells, harmonic resolution]
[Sustain: full string section ascending, restrained]
```

### Round 2
```
[Continue: cathedral reverb wash, layered strings]
[Bridge: modulation upward, sparse piano answers]
[Pre-outro: choral pad fades, strings remain reverent]
```

### Round 3
```
[Continue: solo bowed strings, pp restrained]
[Outro: long sustained note, dissolves into hall ambience]
[End]
```

---

## QUIET-INSURGENT
*(post-rock, minor-key indie, tremolo electric guitar, restrained drums, E minor, 90 BPM)*

Applies to: `post-rock-2000s`, `minor-indie-1990s`, `restrained-punk-2010s`, `post-punk-1980s`

### Round 1
```
[Continue: tremolo guitar holds, drums build subtly]
[Develop: bass enters, withheld tension increases]
[Sustain: full band foreboding, no drop, no triumphant peak]
```

### Round 2
```
[Continue: layered tremolo, denser tape-warm texture]
[Bridge: half-step modulation, guitar feedback bleeds in]
[Pre-outro: drums recede, tremolo guitar alone]
```

### Round 3
```
[Continue: solo tremolo guitar, foreboding]
[Outro: feedback decay, no resolution, fade to noise]
[End]
```

---

## SLOW-GLOW
*(downtempo soul, trip-hop, warm Rhodes, tape-saturated drums, D Dorian, 85 BPM)*

Applies to: `downtempo-soul-2020s`, `chillwave-2010s`, `trip-hop-1990s`, `soft-funk-1970s`

### Round 1
```
[Continue: warm Rhodes vamp, groove locked in]
[Develop: tape-warm bass swells, drums patient]
[Sustain: vibraphone enters, layered with Rhodes]
```

### Round 2
```
[Continue: full groove, filter sweep across mix]
[Bridge: drums break to half-time, Rhodes solo]
[Pre-outro: bass and Rhodes only, tape hiss]
```

### Round 3
```
[Continue: solo Rhodes, soft and unhurried]
[Outro: final chord sustained, tape saturation breathes, fade]
[End]
```

---

## SKY-SEEKER
*(cinematic ambient, post-classical, expansive strings, sustained brass, C major, 100 BPM)*

Applies to: `cinematic-ambient-2010s`, `post-classical-2020s`, `triumphant-rock-1990s`, `electronic-orchestral-2000s`

### Round 1
```
[Continue: expansive strings sustain, brass swells beneath]
[Develop: harmonic development, hall ambience widens]
[Sustain: full orchestral peak, awe-inducing, no trailer cliché]
```

### Round 2
```
[Continue: hall ambience, second crescendo builds]
[Bridge: triumphant modulation, brass takes the melody]
[Pre-outro: strings descend, brass holds the final chord]
```

### Round 3
```
[Continue: solo strings sustain, pp]
[Outro: final chord rings out in hall reverb, decays]
[End]
```

---

## After all 3 extends — Get Whole Song

On the final (Round 3) clip:
- Click the **⋯ (More options)** button on that clip
- Select **Get Whole Song**
- Suno stitches the original + 3 extensions into a single ~5-min audio file
- Download that as your final asset

If you find Round 3 still too short, do a 4th round using the Round 3 outro block again, or duplicate the Round 2 block before the Round 3 outro to add a "second wind."
