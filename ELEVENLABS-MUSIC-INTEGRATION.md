# PostListener — ElevenLabs Music Integration

## READ THIS FIRST

This is an **update** to an existing PostListener codebase. Do not rebuild anything that already exists. Read the existing files before touching them.

The goal is to replace the procedural Web Audio fallback in Phase 5 (Reveal) with a real AI-generated music track from the ElevenLabs Sound Generation API. The track is generated at the end of Phase 4 (Moment) using the AVD vector that has just been finalised.

**Do not modify:** Entry, Spectrum, DepthDial, Textures, TraceCanvas, AVD engine, audio engine (keep procedural as error fallback), App.jsx, Result.jsx, index.css, index.html.

**Read this entire spec before writing any code.**

---

## ENVIRONMENT VARIABLE

The ElevenLabs API key must be stored in `.env.local` (never committed to git). Create or update `.env.local`:

```
VITE_ELEVENLABS_API_KEY=your_key_here
```

Access in code as `import.meta.env.VITE_ELEVENLABS_API_KEY`.

Add `.env.local` to `.gitignore` if not already present.

---

## STEP 1 — Create src/engine/elevenlabs.js

New file. Handles the ElevenLabs Sound Generation API call.

```javascript
// ElevenLabs Sound Generation API wrapper

const API_URL = 'https://api.elevenlabs.io/v1/sound-generation'
const TIMEOUT_MS = 60000 // 60 second ceiling

export async function generateMusic(prompt) {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY

  if (!apiKey) {
    throw new Error('VITE_ELEVENLABS_API_KEY is not set')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: prompt,
        duration_seconds: 60,
        prompt_influence: 0.5,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error')
      throw new Error(`ElevenLabs API error ${response.status}: ${errorText}`)
    }

    // Response is raw audio bytes (mp3)
    const blob = await response.blob()
    const audioUrl = URL.createObjectURL(blob)
    return audioUrl

  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Music generation timed out after 60 seconds')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}
```

---

## STEP 2 — Update src/phases/Moment.jsx

At the end of Phase 4, after arousal is calculated and before calling `onNext`, fire the ElevenLabs generation in the background and pass the **promise** (not the result) to the next phase via `onNext`.

**Changes to Moment.jsx:**

1. Import `generateMusic` from `../engine/elevenlabs`
2. Import `avdEngine` to get the final prompt at the point of generation
3. After `calculateArousal()` finalises and sets AVD, start the ElevenLabs generation immediately
4. Pass the music generation promise to `onNext` so Reveal can await it

The key pattern — in `calculateArousal` after `avd.setArousal(A)` and `avd.setPhaseData(...)`:

```javascript
// Fire generation immediately after AVD is locked
// avd.getPrompt() now has the complete A+V+D vector
const musicPromise = generateMusic(avd.getPrompt())

// Pass promise to Reveal via onNext
setTimeout(() => {
  onNext({
    moment: { totalTaps, tapsDuringBuild, preDropSilence, tapsDuringRelease, peakTapRate },
    musicPromise, // Reveal will await this
  })
}, 1200) // existing implode animation delay
```

The `musicPromise` is passed through `sessionData` in App.jsx automatically — no changes needed to App.jsx since it spreads all data from `onNext` into `sessionData`.

---

## STEP 3 — Update src/phases/Reveal.jsx

This is the main change. Reveal now:
1. Receives `musicPromise` from `sessionData.musicPromise`
2. Extends "finding you..." with evolving text while awaiting the promise
3. On resolve: plays the returned audio URL
4. On reject: shows an error state with a retry button
5. Falls back to procedural audio ONLY on retry if ElevenLabs fails twice (or never — the retry just re-calls ElevenLabs, not procedural)

### Full rewrite of Reveal.jsx:

```jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateMusic } from '../engine/elevenlabs'

const REVEAL_LINES = [
  'this music was composed by an algorithm',
  'it translated your choices into sound',
  'tempo, mood, texture, complexity',
  'no human wrote it',
  'the only human in this composition was you',
]

// Evolving loading messages during generation wait
const LOADING_MESSAGES = [
  { at: 0,  text: 'finding you...' },
  { at: 8,  text: 'translating your choices...' },
  { at: 18, text: 'composing...' },
  { at: 32, text: 'almost there...' },
]

export default function Reveal({ onNext, avd, sessionData, goToPhase }) {
  const [stage, setStage] = useState('computing') 
  // stages: computing | error | playing | reveal | choices
  
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0].text)
  const [visibleLines, setVisibleLines] = useState(0)
  const [avdValues] = useState(() => avd.getAVD())
  const [errorMessage, setErrorMessage] = useState('')
  const [isRetrying, setIsRetrying] = useState(false)

  const audioRef = useRef(null)    // HTMLAudioElement for ElevenLabs track
  const audioUrlRef = useRef(null) // object URL to revoke on unmount
  const loadingTimerRef = useRef(null)
  const computeStartRef = useRef(Date.now())

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(loadingTimerRef.current)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
      }
    }
  }, [])

  // Evolving loading messages based on elapsed time
  useEffect(() => {
    if (stage !== 'computing') return

    loadingTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - computeStartRef.current) / 1000
      // Find the most recent message whose `at` time has passed
      const current = [...LOADING_MESSAGES]
        .reverse()
        .find(m => elapsed >= m.at)
      if (current) setLoadingMessage(current.text)
    }, 500)

    return () => clearInterval(loadingTimerRef.current)
  }, [stage])

  // Await the music promise passed from Moment
  const awaitAndPlay = useCallback(async (promise) => {
    try {
      const audioUrl = await promise
      clearInterval(loadingTimerRef.current)
      audioUrlRef.current = audioUrl

      // Create audio element and play
      const audio = new Audio(audioUrl)
      audio.volume = 0.8
      audioRef.current = audio

      await audio.play()
      setStage('playing')

      // After track ends (or after 65s ceiling), begin reveal
      const beginReveal = () => {
        setStage('reveal')
        REVEAL_LINES.forEach((_, i) => {
          setTimeout(() => setVisibleLines(i + 1), i * 1500)
        })
        setTimeout(() => setStage('choices'), REVEAL_LINES.length * 1500 + 3000)
      }

      audio.addEventListener('ended', beginReveal)
      // Safety ceiling: if track doesn't fire 'ended' after 65s, advance anyway
      setTimeout(beginReveal, 65000)

    } catch (err) {
      clearInterval(loadingTimerRef.current)
      console.error('Music generation failed:', err)
      setErrorMessage(err.message || 'The composition failed to arrive.')
      setStage('error')
      setIsRetrying(false)
    }
  }, [])

  // Initial: await the promise from sessionData
  useEffect(() => {
    const promise = sessionData?.musicPromise
    if (!promise) {
      // No promise (shouldn't happen) — show error
      setErrorMessage('No music generation was initiated.')
      setStage('error')
      return
    }
    awaitAndPlay(promise)
  }, []) // run once on mount

  // Retry: re-call ElevenLabs
  const handleRetry = useCallback(async () => {
    setIsRetrying(true)
    setStage('computing')
    setLoadingMessage(LOADING_MESSAGES[0].text)
    computeStartRef.current = Date.now()

    const prompt = avd.getPrompt()
    const newPromise = generateMusic(prompt)
    awaitAndPlay(newPromise)
  }, [avd, awaitAndPlay])

  const handleReplay = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play()
      setStage('playing')
    }
  }, [])

  const handleShowMe = useCallback(() => {
    if (audioRef.current) audioRef.current.pause()
    onNext({ revealChoice: 'show_me' })
  }, [onNext])

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center select-none px-8"
      style={{ touchAction: 'manipulation' }}
    >
      {/* COMPUTING stage */}
      <AnimatePresence mode="wait">
        {stage === 'computing' && (
          <motion.div
            key="computing"
            className="absolute inset-0 flex flex-col items-center justify-center gap-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.span
              className="font-serif text-center"
              style={{ fontSize: 'clamp(20px, 5vw, 28px)', color: 'var(--text)' }}
              key={loadingMessage}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {loadingMessage}
            </motion.span>

            {/* Subtle amber pulse dot */}
            <motion.div
              className="rounded-full"
              style={{
                width: 6,
                height: 6,
                background: 'var(--accent)',
              }}
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        )}

        {/* ERROR stage */}
        {stage === 'error' && (
          <motion.div
            key="error"
            className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p
              className="font-serif text-center"
              style={{
                fontSize: 'clamp(16px, 4vw, 22px)',
                color: 'var(--text-dim)',
                maxWidth: '320px',
                lineHeight: 1.6,
              }}
            >
              {errorMessage}
            </p>

            <motion.button
              className="font-serif"
              style={{
                fontSize: '16px',
                color: 'var(--accent)',
                background: 'none',
                border: 'none',
                cursor: isRetrying ? 'not-allowed' : 'pointer',
                padding: '12px 24px',
                opacity: isRetrying ? 0.5 : 1,
              }}
              whileTap={{ scale: 0.97 }}
              onClick={isRetrying ? undefined : handleRetry}
            >
              {isRetrying ? 'retrying...' : 'try again'}
            </motion.button>

            <p
              className="font-mono text-center"
              style={{ fontSize: '9px', color: 'var(--text-dim)' }}
            >
              check your connection and api key
            </p>
          </motion.div>
        )}

        {/* PLAYING stage */}
        {stage === 'playing' && (
          <motion.div
            key="playing"
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <p
              className="font-serif"
              style={{ fontSize: 'clamp(20px, 5vw, 28px)', color: 'var(--text)' }}
            >
              this is yours
            </p>

            <motion.div
              className="flex gap-8 justify-center mt-12 font-mono"
              style={{ fontSize: '12px', color: 'var(--accent)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
            >
              <span>A {avdValues.a.toFixed(2)}</span>
              <span>V {avdValues.v.toFixed(2)}</span>
              <span>D {avdValues.d.toFixed(2)}</span>
            </motion.div>
          </motion.div>
        )}

        {/* REVEAL + CHOICES stages */}
        {(stage === 'reveal' || stage === 'choices') && (
          <motion.div
            key="reveal"
            className="text-center max-w-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {REVEAL_LINES.map((line, i) => (
              <motion.p
                key={i}
                className="font-serif mb-4"
                style={{ fontSize: 'clamp(16px, 4vw, 22px)', color: 'var(--text)' }}
                initial={{ opacity: 0, y: 10 }}
                animate={i < visibleLines ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              >
                {line}
              </motion.p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* CHOICES — bottom buttons */}
      {stage === 'choices' && (
        <motion.div
          className="absolute bottom-16 left-0 right-0 flex justify-between px-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <button
            className="font-serif"
            style={{
              fontSize: '16px',
              color: 'var(--accent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '12px',
            }}
            onClick={handleReplay}
          >
            hear it again
          </button>
          <button
            className="font-serif"
            style={{
              fontSize: '16px',
              color: 'var(--text)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '12px',
            }}
            onClick={handleShowMe}
          >
            show me who I am
          </button>
        </motion.div>
      )}
    </div>
  )
}
```

---

## STEP 4 — Update App.jsx (minor)

The `musicPromise` passed via `onNext` from Moment will be spread into `sessionData` automatically since `nextPhase` already does `setSessionData(prev => ({ ...prev, ...data }))`.

**One issue:** Promises don't survive React state serialisation cleanly — they will, but verify this works. If there are issues, the alternative is to store the promise in a `useRef` in App.jsx and pass it directly to Reveal.

If needed, update App.jsx to store `musicPromise` in a ref:

```jsx
// In App.jsx, add:
const musicPromiseRef = useRef(null)

// Update nextPhase to extract musicPromise before setting state:
const nextPhase = useCallback((data = {}) => {
  const { musicPromise, ...rest } = data
  if (musicPromise) musicPromiseRef.current = musicPromise
  setSessionData(prev => ({ ...prev, ...rest }))
  const idx = PHASES.indexOf(phase)
  if (idx < PHASES.length - 1) setPhase(PHASES[idx + 1])
}, [phase])

// Pass ref value to Reveal:
reveal: <Reveal 
  onNext={nextPhase} 
  avd={avdEngine} 
  sessionData={{ ...sessionData, musicPromise: musicPromiseRef.current }} 
  goToPhase={goToPhase} 
/>,
```

Use this ref approach — it's safer than putting a Promise in React state.

---

## STEP 5 — Update .gitignore

Ensure `.env.local` is in `.gitignore`. The existing `.gitignore` likely doesn't include it since the project was scaffolded without it. Add:

```
.env.local
.env*.local
```

---

## WHAT TO TEST

1. Add a real `VITE_ELEVENLABS_API_KEY` to `.env.local` and run `npm run dev`
2. Go through all 5 phases
3. Confirm: "finding you..." appears immediately after Phase 4
4. Confirm: loading message evolves (finding you → translating → composing → almost there)
5. Confirm: track plays and "this is yours" appears on stage transition
6. Confirm: AVD values appear after 2s on playing screen
7. Confirm: reveal lines appear one by one after track ends
8. Confirm: "hear it again" replays from beginning, "show me who I am" goes to Result
9. Test error state: use an invalid API key, confirm error message and retry button appear
10. Test retry: after error, confirm retry re-fires the API call and resolves correctly

---

## QUESTIONS BEFORE YOU START

None — this spec is complete. Begin with Step 1.
