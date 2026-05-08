# Phase 3 — ElevenLabs Voice + Music + Phase 2 Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire ElevenLabs into the live PostListener experience: an Admirer voice across all phases, a per-session AI-generated track replacing the static MP3, a one-time asset generation pass for the 21 missing GEMS + Spectrum v2 audio files, a proper Threshold rite for Phase 0, and the leftover Phase 2 polish items.

**Architecture:** Three sequenced tracks sharing a server-side proxy. Track A (Tasks 1–5) builds the ElevenLabs proxy + asset gen script — everything downstream depends on it. Track B (Tasks 6–9) wires the Admirer voice into phases and rebuilds Entry as the Threshold rite. Track C (Tasks 10–15) generates the per-session track via Music API composition plan, biases scoring on the captured `hedonic` signal, and ships the Phase 2 polish items. Server proxy uses Vite dev middleware locally + Vercel serverless functions in prod (same handler files in `api/`).

**Tech Stack:** React 19, Vite 7, Tailwind v4, Framer Motion 12, vitest. ElevenLabs APIs: TTS `eleven_v3`, Music API `music_v1`. Server proxy avoids shipping the API key to the client.

---

## Track ordering (read this before starting)

| Track | Tasks | Why this order |
|---|---|---|
| **A — Foundation** | 1–5 | Server proxy + voice/text helpers. Asset gen script lands here so the missing audio files can be generated before Tracks B/C use them. |
| **B — Voice + Threshold** | 6–9 | The `useAdmirer` hook + voice line scripts + Phase 0 rewrite. Depends on Track A's `/api/admirer` route. |
| **C — Composition + polish** | 10–16 | Per-session track generation, hedonic bias, gems→compositionPlan, Phase 2 polish. Composition depends on Track A's `/api/compose` route. |

Tracks B and C are independent of each other once Track A lands — they could be parallelized in a multi-developer setup, but for solo subagent execution take them in order.

---

## Environment setup (do once before Task 1)

The existing `scripts/generate-assets.js` reads `VITE_ELEVENLABS_API_KEY` from `.env.local`. Phase 3 introduces a server-side proxy whose handlers read `process.env.ELEVENLABS_API_KEY` (no VITE_ prefix — variables prefixed with VITE_ get inlined into the client bundle, which we explicitly want to avoid).

Add to `.env.local` (alongside the existing line):
```bash
ELEVENLABS_API_KEY=<same value as VITE_ELEVENLABS_API_KEY>
```

Vite does not automatically load `.env.local` for server middleware — we'll add `dotenv` in Task 3.

---

## File structure

**New files (Track A — Foundation):**

| File | Responsibility |
|---|---|
| `src/lib/voiceRegister.js` | `registerToVoiceSettings(register) → { stability, similarity_boost, style, model_id, voice_id }`. Three registers: `caretaking`, `present`, `elevated`. Pure. |
| `src/lib/textHash.js` | `hashText(text) → string` — deterministic 8-char hash for cache keys. Pure. |
| `src/lib/__tests__/voiceRegister.test.js`, `textHash.test.js` | Unit tests. |
| `api/admirer.js` | Vercel serverless function + Vite-middleware-compatible handler. POST → ElevenLabs TTS. |
| `api/compose.js` | Same shape, for ElevenLabs Music API. |
| `api/_elevenlabs.js` | Shared helpers (env-key resolution, fetch wrappers). |
| `scripts/generate-phase2-assets.js` | Idempotent batch script for the 21 missing audio assets. |
| `vite.config.js` | Add dev-server middleware plugin mounting `api/*.js` handlers. |

**New files (Track B — Voice + Threshold):**

| File | Responsibility |
|---|---|
| `src/lib/admirerScripts.js` | Voice line constants per phase, organized by phase id. Pure data. |
| `src/hooks/useAdmirer.js` | Hook: `useAdmirer()` returns `{ play(text, register), preload(text, register) }`. Fetches `/api/admirer`, caches by text-hash in-memory + via browser audio cache. |
| `src/phases/Entry.score.jsx` | Rewritten as Threshold rite (name capture, breath ring, held-tap, voiced statement). |
| `src/lib/__tests__/admirerScripts.test.js` | Sanity test that scripts contain expected phases. |

**New files (Track C — Composition + polish):**

| File | Responsibility |
|---|---|
| `src/lib/compositionPlan.js` | `buildCompositionPlan({ archetypeId, variationId, eraMedian, dominantGemsTag, hedonic }) → { positive_global_styles, negative_global_styles, sections }`. Pure. Used by `api/compose.js`. |
| `src/lib/__tests__/compositionPlan.test.js` | Unit tests covering each archetype + hedonic bias. |
| `src/lib/hedonicBias.js` | `applyHedonicBias(scores, hedonic) → scores` — boosts low-V archetypes when `hedonic === false`. Pure. |
| `src/lib/__tests__/hedonicBias.test.js` | Unit tests. |

**Modified files:**

| File | Track | Change |
|---|---|---|
| `package.json` | A | Add `dotenv` dependency, add `npm run gen:phase2` script. |
| `src/phases/Spectrum.score.jsx` | B | Wire `useAdmirer` for one mid-phase line. |
| `src/phases/Depth.score.jsx` | B | Wire `useAdmirer` opening line. |
| `src/phases/Gems.score.jsx` | B | Wire `useAdmirer` between excerpts. |
| `src/phases/Moment.score.jsx` | B + C | useAdmirer at intro; in Track C replace `Promise.resolve('/chamber/tracks/track-a.mp3')` with `/api/compose` POST. |
| `src/phases/Autobio.score.jsx` | B | useAdmirer between prompts. |
| `src/phases/Reflection.score.jsx` | B | useAdmirer for the closing line. |
| `src/lib/scoreArchetype.js` | C | Apply `applyHedonicBias` after softmax. |
| `src/engine/avd.js` | C | `getCompositionPlan()` reads gems via `dominantGemsTag` instead of `textures.preferred`. |
| `src/lib/spectrumPairs.js` | C | Relabel `slow/mid` → `slow/fast` + AVD coord update. |
| `src/lib/__tests__/itunesSearch.test.js` | C | Add abort-test case. |
| Multiple phase files | C | Renumber Roman numerals: Moment "v.", Autobio "vi.", Reflection "vii.", Reveal "viii.". |

---

## Track A — Foundation

### Task 1: voiceRegister.js — register-to-settings mapping

**Files:**
- Create: `src/lib/voiceRegister.js`
- Create: `src/lib/__tests__/voiceRegister.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/voiceRegister.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { registerToVoiceSettings, ADMIRER_VOICE_ID, REGISTERS } from '../voiceRegister'

describe('voiceRegister', () => {
  it('exports the three canonical registers', () => {
    expect(REGISTERS).toEqual(['caretaking', 'present', 'elevated'])
  })

  it('caretaking maps to warm low-stability settings', () => {
    const s = registerToVoiceSettings('caretaking')
    expect(s.stability).toBe(0.4)
    expect(s.similarity_boost).toBe(0.7)
    expect(s.style).toBe(0.6)
    expect(s.voice_id).toBe(ADMIRER_VOICE_ID)
    expect(s.model_id).toBe('eleven_v3')
  })

  it('present maps to mid-stability moderate-style settings', () => {
    const s = registerToVoiceSettings('present')
    expect(s.stability).toBe(0.55)
    expect(s.style).toBe(0.4)
  })

  it('elevated maps to low-stability high-style settings', () => {
    const s = registerToVoiceSettings('elevated')
    expect(s.stability).toBe(0.3)
    expect(s.style).toBe(0.85)
  })

  it('unknown register defaults to present', () => {
    const s = registerToVoiceSettings('unknown')
    expect(s.stability).toBe(0.55)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- --run src/lib/__tests__/voiceRegister.test.js`
Expected: FAIL — "Cannot find module '../voiceRegister'"

- [ ] **Step 3: Implement `src/lib/voiceRegister.js`**

Create `src/lib/voiceRegister.js`:
```js
// Map Admirer voice register names to ElevenLabs TTS voice_settings.
// Three registers per Research/voice-intimacy-admirer-design.md:
//   • caretaking — warm, intimate (Entry, Reflection, Mirror)
//   • present    — observational, settled (Spectrum, Depth, Gems, Moment, Autobio)
//   • elevated   — uplifted, moved (Reveal Forer paragraph)

export const ADMIRER_VOICE_ID = 'NtS6nEHDYMQC9QczMQuq' // Admirer — same as Phase 1 voice cues
export const REGISTERS = ['caretaking', 'present', 'elevated']

const SETTINGS = {
  caretaking: { stability: 0.4,  similarity_boost: 0.7, style: 0.6  },
  present:    { stability: 0.55, similarity_boost: 0.7, style: 0.4  },
  elevated:   { stability: 0.3,  similarity_boost: 0.7, style: 0.85 },
}

export function registerToVoiceSettings(register) {
  const cfg = SETTINGS[register] || SETTINGS.present
  return {
    voice_id: ADMIRER_VOICE_ID,
    model_id: 'eleven_v3',
    ...cfg,
  }
}
```

- [ ] **Step 4: Run test to verify passing**

Run: `npm test -- --run src/lib/__tests__/voiceRegister.test.js`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/voiceRegister.js src/lib/__tests__/voiceRegister.test.js
git commit -m "feat(phase3): add Admirer voice register → ElevenLabs settings mapping"
```

---

### Task 2: textHash.js — deterministic cache key

**Files:**
- Create: `src/lib/textHash.js`
- Create: `src/lib/__tests__/textHash.test.js`

Used by `useAdmirer` (Task 6) and the server route (Task 3) to dedupe TTS requests for identical lines.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/textHash.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { hashText } from '../textHash'

describe('hashText', () => {
  it('returns an 8-character hex string', () => {
    const h = hashText('hello world')
    expect(h).toMatch(/^[0-9a-f]{8}$/)
  })

  it('is deterministic — same input yields same hash', () => {
    expect(hashText('foo')).toBe(hashText('foo'))
  })

  it('different inputs yield different hashes', () => {
    expect(hashText('foo')).not.toBe(hashText('bar'))
  })

  it('handles empty string', () => {
    expect(hashText('')).toMatch(/^[0-9a-f]{8}$/)
  })

  it('handles unicode', () => {
    expect(hashText('— em dash 你好')).toMatch(/^[0-9a-f]{8}$/)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- --run src/lib/__tests__/textHash.test.js`
Expected: FAIL — "Cannot find module '../textHash'"

- [ ] **Step 3: Implement `src/lib/textHash.js`**

Create `src/lib/textHash.js`:
```js
// Deterministic 8-char hex hash for cache keys. Implements FNV-1a over the
// UTF-8 byte stream so unicode inputs are handled cleanly. Not cryptographic.

export function hashText(text) {
  const str = String(text ?? '')
  // FNV-1a 32-bit
  let hash = 0x811c9dc5
  // Encode UTF-8 manually so the hash matches across runtimes
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i)
    if (code < 0x80) {
      hash ^= code
      hash = Math.imul(hash, 0x01000193) >>> 0
    } else if (code < 0x800) {
      hash ^= (0xc0 | (code >> 6))
      hash = Math.imul(hash, 0x01000193) >>> 0
      hash ^= (0x80 | (code & 0x3f))
      hash = Math.imul(hash, 0x01000193) >>> 0
    } else {
      hash ^= (0xe0 | (code >> 12))
      hash = Math.imul(hash, 0x01000193) >>> 0
      hash ^= (0x80 | ((code >> 6) & 0x3f))
      hash = Math.imul(hash, 0x01000193) >>> 0
      hash ^= (0x80 | (code & 0x3f))
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
```

- [ ] **Step 4: Run test to verify passing**

Run: `npm test -- --run src/lib/__tests__/textHash.test.js`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/textHash.js src/lib/__tests__/textHash.test.js
git commit -m "feat(phase3): add deterministic text hash for voice cache keys"
```

---

### Task 3: Server proxy — `/api/admirer` route + Vite middleware

**Files:**
- Create: `api/_elevenlabs.js`
- Create: `api/admirer.js`
- Modify: `vite.config.js`
- Modify: `package.json` (add `dotenv` dependency)

This task lands the dual-mode server proxy: a Vercel-compatible serverless function (export default handler) that the Vite dev-server middleware plugin mounts at `/api/admirer` during development.

- [ ] **Step 1: Install `dotenv`**

Run from repo root:
```bash
npm install dotenv
```

Verify it lands in `package.json` `dependencies` (not devDependencies — the Vite config uses it at server start in production builds too).

- [ ] **Step 2: Create the shared ElevenLabs helper**

Create `api/_elevenlabs.js`:
```js
// Shared helpers for the /api/* serverless routes.
// Resolves the ElevenLabs API key from env (works in Vercel and local Vite dev).

export function getApiKey() {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) {
    throw new Error('ELEVENLABS_API_KEY not set. Add it to .env.local (no VITE_ prefix).')
  }
  return key
}

export async function readJsonBody(req) {
  // Vercel parses JSON for us when content-type is application/json; Vite's
  // raw http req is a Node IncomingMessage and needs manual parsing.
  if (req.body && typeof req.body === 'object') return req.body
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf-8')
  return raw ? JSON.parse(raw) : {}
}

export function sendError(res, status, message) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error: message }))
}
```

- [ ] **Step 3: Create the admirer handler**

Create `api/admirer.js`:
```js
import { getApiKey, readJsonBody, sendError } from './_elevenlabs.js'

// Inline copy of the canonical register settings — kept in sync with
// src/lib/voiceRegister.js. The server can't import from src/ in Vercel
// without a build step, so the duplication is intentional.
const ADMIRER_VOICE_ID = 'NtS6nEHDYMQC9QczMQuq'
const REGISTER_SETTINGS = {
  caretaking: { stability: 0.4,  similarity_boost: 0.7, style: 0.6  },
  present:    { stability: 0.55, similarity_boost: 0.7, style: 0.4  },
  elevated:   { stability: 0.3,  similarity_boost: 0.7, style: 0.85 },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'method not allowed')
  }
  let body
  try { body = await readJsonBody(req) } catch (e) {
    return sendError(res, 400, 'invalid JSON body')
  }
  const text = (body.text || '').trim()
  const register = body.register || 'present'
  if (!text) {
    return sendError(res, 400, 'text is required')
  }

  const settings = REGISTER_SETTINGS[register] || REGISTER_SETTINGS.present
  let apiKey
  try { apiKey = getApiKey() } catch (e) {
    return sendError(res, 500, e.message)
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${ADMIRER_VOICE_ID}`
  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_v3',
      voice_settings: settings,
    }),
  })

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '')
    return sendError(res, upstream.status, `ElevenLabs TTS failed: ${errText.slice(0, 200)}`)
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  const buf = Buffer.from(await upstream.arrayBuffer())
  res.end(buf)
}
```

- [ ] **Step 4: Wire dev-server middleware in `vite.config.js`**

Replace the contents of `vite.config.js` with:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import dotenv from 'dotenv'
import path from 'path'

// Load .env.local for server-side API routes. Vite's built-in env loader
// only handles VITE_-prefixed vars at build time and inlines them into the
// client bundle — we explicitly want ELEVENLABS_API_KEY to stay server-side.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

function apiMiddleware() {
  return {
    name: 'api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()
        const route = req.url.split('?')[0].slice('/api/'.length).replace(/\/$/, '')
        if (!route) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${route}.js`)
          const handler = mod.default
          if (typeof handler !== 'function') {
            res.statusCode = 404
            res.end('handler not exported')
            return
          }
          await handler(req, res)
        } catch (e) {
          console.error(`[api/${route}] error:`, e)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: e.message || 'internal error' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiMiddleware()],
})
```

- [ ] **Step 5: Manual smoke test**

Add `ELEVENLABS_API_KEY=<your key>` to `.env.local` (alongside the existing `VITE_ELEVENLABS_API_KEY` line — don't remove the old one; the existing scripts/generate-assets.js still uses it).

Run: `npm run dev`

In a second terminal:
```bash
curl -X POST http://localhost:5173/api/admirer \
  -H "Content-Type: application/json" \
  -d '{"text":"hello there","register":"caretaking"}' \
  -o /tmp/admirer-test.mp3 && file /tmp/admirer-test.mp3
```

Expected: file reports as `MPEG ADTS, layer III` or `Audio file with ID3 version`. The mp3 should be playable.

If the request returns JSON `{"error":"..."}`, fix the issue (most likely `.env.local` missing or wrong key) before proceeding.

- [ ] **Step 6: Commit**

```bash
git add api/ vite.config.js package.json package-lock.json
git commit -m "feat(phase3): add Vite dev middleware + /api/admirer ElevenLabs proxy"
```

---

### Task 4: Server proxy — `/api/compose` route stub

**Files:**
- Create: `api/compose.js`

This task lands the compose route handler structure. The actual composition plan derivation lives in `src/lib/compositionPlan.js` (Task 10). For now the handler accepts a fully-formed composition plan in the request body — the client calls `buildCompositionPlan` and POSTs the result. This keeps the server thin and the derivation logic testable.

- [ ] **Step 1: Create `api/compose.js`**

Create `api/compose.js`:
```js
import { getApiKey, readJsonBody, sendError } from './_elevenlabs.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'method not allowed')
  }
  let body
  try { body = await readJsonBody(req) } catch (e) {
    return sendError(res, 400, 'invalid JSON body')
  }
  const plan = body.composition_plan
  if (!plan || !Array.isArray(plan.sections)) {
    return sendError(res, 400, 'composition_plan with sections[] required')
  }

  let apiKey
  try { apiKey = getApiKey() } catch (e) {
    return sendError(res, 500, e.message)
  }

  const url = 'https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128'
  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      composition_plan: plan,
      model_id: 'music_v1',
    }),
  })

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '')
    return sendError(res, upstream.status, `ElevenLabs Music failed: ${errText.slice(0, 300)}`)
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Cache-Control', 'private, no-store')  // per-session, don't cache
  const buf = Buffer.from(await upstream.arrayBuffer())
  res.end(buf)
}
```

- [ ] **Step 2: Manual smoke test (optional, costs 1 generation)**

The smoke test is optional — calling Music API for a real session costs credits. If you want to verify, run:
```bash
curl -X POST http://localhost:5173/api/compose \
  -H "Content-Type: application/json" \
  -d '{
    "composition_plan": {
      "positive_global_styles": ["ambient", "felt piano", "instrumental"],
      "negative_global_styles": ["drums", "vocals"],
      "sections": [{
        "section_name": "main",
        "positive_local_styles": ["sparse", "warm"],
        "negative_local_styles": ["aggressive"],
        "duration_ms": 30000,
        "lines": []
      }]
    }
  }' -o /tmp/compose-test.mp3
```

Otherwise skip — Task 11 will exercise the route end-to-end.

- [ ] **Step 3: Commit**

```bash
git add api/compose.js
git commit -m "feat(phase3): add /api/compose ElevenLabs Music API proxy"
```

---

### Task 5: Asset generation script (one-time batch)

**Files:**
- Create: `scripts/generate-phase2-assets.js`
- Modify: `package.json` (add `gen:phase2` script)

Idempotent script that produces the 21 missing audio files. Reads the prompts inline (mirrored from `todo.md`), skips any file that already exists, calls Music API, writes to `public/`.

- [ ] **Step 1: Add npm script**

In `package.json` `"scripts"` block, add after `test:watch`:
```json
"gen:phase2": "node scripts/generate-phase2-assets.js"
```

- [ ] **Step 2: Create the script**

Create `scripts/generate-phase2-assets.js`:
```js
#!/usr/bin/env node
/**
 * Generate the Phase 2 audio assets (3 GEMS excerpts + 18 Spectrum v2 clips)
 * via ElevenLabs Music API. Idempotent — skips files that already exist.
 *
 * Usage:
 *   npm run gen:phase2
 *
 * Requires VITE_ELEVENLABS_API_KEY in .env.local.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function getApiKey() {
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: .env.local not found.')
    process.exit(1)
  }
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    // Accept either VITE_-prefixed or non-prefixed
    if (trimmed.startsWith('VITE_ELEVENLABS_API_KEY=') ||
        trimmed.startsWith('ELEVENLABS_API_KEY=')) {
      return trimmed.split('=').slice(1).join('=').trim()
    }
  }
  console.error('ERROR: ELEVENLABS_API_KEY not found in .env.local')
  process.exit(1)
}

const API_KEY = getApiKey()

const ASSETS = [
  // GEMS — 15s instrumental excerpts
  {
    file: 'gems/sublimity.mp3',
    durationMs: 15000,
    prompt: 'neo-classical ambient, 50 BPM, felt piano, sustained string pad, choral wash, instrumental, breathless wonder, 2020s ECM-style sparse production with deep reverb tail, no percussion, no vocal melody, builds gently toward an unresolved suspension at 12s',
  },
  {
    file: 'gems/tenderness.mp3',
    durationMs: 15000,
    prompt: 'chamber folk, 65 BPM, fingerpicked nylon guitar, melodic cello, soft upright bass, instrumental, tender longing, 1970s warm tape-saturation, intimate close-mic\'d dynamics, single guitar line carries melody, room-tone breath between phrases',
  },
  {
    file: 'gems/tension.mp3',
    durationMs: 15000,
    prompt: 'post-rock instrumental, 80 BPM, distorted electric guitar with palm-muted restraint, brushed drums, low pulsing analog synth, instrumental, simmering defiance withheld, 2000s dry-room production with no compression on transients, crescendo never resolves, ends on a held minor-second cluster',
  },

  // Spectrum v2 — 8s instrumental clips
  { file: 'spectrum/v2/warm.mp3',         durationMs: 8000, prompt: 'acoustic chamber, 70 BPM, felt piano + cello, instrumental, body-warmth, 1970s tape saturation, no synthesizer, no electric instruments' },
  { file: 'spectrum/v2/cold.mp3',         durationMs: 8000, prompt: 'synth ambient, 70 BPM, sine pad + glassy bell, instrumental, cool sterile beauty, 1980s digital reverb, no acoustic instruments' },
  { file: 'spectrum/v2/dense.mp3',        durationMs: 8000, prompt: 'orchestral chamber, 70 BPM, layered strings + woodwinds + harp + felt piano, instrumental, complex polyphonic texture, full ensemble production' },
  { file: 'spectrum/v2/spare.mp3',        durationMs: 8000, prompt: 'solo piano, 70 BPM, single sustained note line, instrumental, radically minimal, dry-room close-mic, long silences between phrases' },
  { file: 'spectrum/v2/sung.mp3',         durationMs: 8000, prompt: 'chamber pop, 70 BPM, soft humming melody + felt piano + acoustic bass, breathy lead vocal melody, intimate vocal-forward production' },
  { file: 'spectrum/v2/instrumental.mp3', durationMs: 8000, prompt: 'chamber instrumental, 70 BPM, felt piano + acoustic bass + soft cello, instrumental, no vocals, melodic instrumental focus' },
  { file: 'spectrum/v2/analog.mp3',       durationMs: 8000, prompt: 'lo-fi indie, 70 BPM, tube-saturated electric guitar + upright bass, instrumental, 1960s tape warmth, hum + tape hiss audible, no digital reverb' },
  { file: 'spectrum/v2/digital.mp3',      durationMs: 8000, prompt: 'clean electronic, 70 BPM, FM synth lead + sub bass, instrumental, pristine digital production, surgical reverb tails, no analog warmth' },
  { file: 'spectrum/v2/major.mp3',        durationMs: 8000, prompt: 'acoustic folk, 70 BPM, fingerpicked guitar in C major, instrumental, bright open chords, uplifting harmonic motion' },
  { file: 'spectrum/v2/modal.mp3',        durationMs: 8000, prompt: 'chamber ambient, 70 BPM, felt piano in dorian mode, instrumental, neither happy nor sad, suspended ambiguous quality' },
  { file: 'spectrum/v2/slow.mp3',         durationMs: 8000, prompt: 'ambient drone, 50 BPM, sustained string pad + felt piano, instrumental, contemplative meditative pace, no rhythmic pulse' },
  { file: 'spectrum/v2/fast.mp3',         durationMs: 8000, prompt: 'walking groove, 110 BPM, felt piano + brushed snare + upright bass, instrumental, steady forward pulse, deliberate motion' },
  { file: 'spectrum/v2/driving.mp3',      durationMs: 8000, prompt: 'kraut rock, 130 BPM, motorik drums + repeating bass arpeggio, instrumental, locked-in propulsive forward motion, urgent energy' },
  { file: 'spectrum/v2/floating.mp3',     durationMs: 8000, prompt: 'ambient post-rock, 50 BPM, reversed guitar swells + sustained strings, instrumental, weightless suspended quality, no clear pulse' },
  { file: 'spectrum/v2/low.mp3',          durationMs: 8000, prompt: 'chamber, 70 BPM, double bass + bass clarinet + low felt piano, instrumental, deep register focus, dark sustained low frequencies' },
  { file: 'spectrum/v2/high.mp3',         durationMs: 8000, prompt: 'chamber, 70 BPM, glockenspiel + violin harmonics + flute, instrumental, bright high register focus, sparkling upper frequencies' },
  { file: 'spectrum/v2/reverberant.mp3',  durationMs: 8000, prompt: 'chamber, 70 BPM, felt piano + cello, instrumental, cathedral-sized hall reverb, long decaying tail, distant intimate playing' },
  { file: 'spectrum/v2/dry.mp3',          durationMs: 8000, prompt: 'chamber, 70 BPM, felt piano + cello, instrumental, dead-room close-mic\'d, no reverb, intimate fingertip detail audible' },
]

async function generateMusic(prompt, durationMs) {
  const url = 'https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      music_length_ms: durationMs,
      model_id: 'music_v1',
      force_instrumental: true,
    }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Music API failed: ${res.status} ${err.slice(0, 300)}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

async function main() {
  const publicDir = path.join(ROOT, 'public')
  let generated = 0
  let skipped = 0

  for (const asset of ASSETS) {
    const outPath = path.join(publicDir, asset.file)
    if (fs.existsSync(outPath)) {
      console.log(`SKIP  ${asset.file} (exists)`)
      skipped++
      continue
    }
    process.stdout.write(`GEN   ${asset.file} ... `)
    try {
      const buf = await generateMusic(asset.prompt, asset.durationMs)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, buf)
      console.log(`OK (${buf.length} bytes)`)
      generated++
    } catch (e) {
      console.log(`FAIL: ${e.message}`)
    }
    // Be a polite client — Music API has stricter rate limits than TTS.
    await new Promise(r => setTimeout(r, 1500))
  }

  console.log(`\nDone. Generated ${generated}, skipped ${skipped} of ${ASSETS.length}.`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 3: Run the script (optional but recommended)**

Run: `npm run gen:phase2`

Expected: 21 mp3 files appear in `public/gems/` and `public/spectrum/v2/`. The script takes ~5–10 minutes (each Music API call is ~25–30s + 1.5s polite delay). If you don't want to spend the credits right now, skip this — the rest of the plan still works (audio falls back to silence per Phase 2 fix).

If the script halts partway (rate limit, API error), re-run — it skips files that already exist.

- [ ] **Step 4: Commit (the script, not the generated audio)**

```bash
git add scripts/generate-phase2-assets.js package.json
git commit -m "feat(phase3): add idempotent Phase 2 asset generation script"
```

If you ran the script and want to commit the generated audio:
```bash
git add public/gems/ public/spectrum/v2/
git commit -m "chore(phase3): generate Phase 2 audio assets via Music API"
```

(Treat the audio as build artifacts — committing keeps them under version control alongside the existing `public/spectrum/*.mp3` and `public/chamber/voices/`.)

---

## Track B — Voice + Threshold

### Task 6: useAdmirer hook

**Files:**
- Create: `src/hooks/useAdmirer.js`

Hook that fetches a TTS line via `/api/admirer`, caches the resulting audio Blob URL by text hash, and returns `play(text, register)` + `preload(text, register)` functions.

- [ ] **Step 1: Create the hook**

Create `src/hooks/useAdmirer.js`:
```jsx
import { useCallback, useEffect, useRef } from 'react'
import { hashText } from '../lib/textHash'

// In-memory cache shared across all useAdmirer instances. Once a line is
// fetched, the same Blob URL is reused for the rest of the session.
const cache = new Map() // hash → { url: string, promise: Promise<string> }

async function fetchLine(text, register) {
  const res = await fetch('/api/admirer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, register }),
  })
  if (!res.ok) {
    throw new Error(`admirer fetch failed: ${res.status}`)
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

function ensureCached(text, register) {
  const key = hashText(`${register}:${text}`)
  let entry = cache.get(key)
  if (entry) return entry.promise
  const promise = fetchLine(text, register)
    .then(url => {
      cache.set(key, { url, promise: Promise.resolve(url) })
      return url
    })
    .catch(err => {
      cache.delete(key)
      throw err
    })
  cache.set(key, { url: null, promise })
  return promise
}

export function useAdmirer() {
  const audiosRef = useRef([])

  // Stop any audio elements this hook started, on unmount.
  useEffect(() => {
    return () => {
      for (const a of audiosRef.current) {
        try { a.pause() } catch {}
      }
      audiosRef.current = []
    }
  }, [])

  const preload = useCallback((text, register = 'present') => {
    return ensureCached(text, register).catch(() => { /* swallow — preload is best-effort */ })
  }, [])

  const play = useCallback(async (text, register = 'present') => {
    try {
      const url = await ensureCached(text, register)
      const audio = new Audio(url)
      audio.volume = 0.85
      audiosRef.current.push(audio)
      await audio.play().catch(() => { /* user-gesture required, swallow */ })
      return audio
    } catch {
      // Fail silently — voice is enhancement, not gating.
      return null
    }
  }, [])

  return { play, preload }
}
```

- [ ] **Step 2: Verify it lints**

Run: `npm run lint -- src/hooks/useAdmirer.js`
Expected: no NEW errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAdmirer.js
git commit -m "feat(phase3): add useAdmirer hook with text-hash voice caching"
```

---

### Task 7: admirerScripts.js — voice line constants per phase

**Files:**
- Create: `src/lib/admirerScripts.js`
- Create: `src/lib/__tests__/admirerScripts.test.js`

Centralized voice line scripts so phases reference named keys rather than hardcoded strings. Each entry is `{ text, register }`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/admirerScripts.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { ADMIRER_LINES } from '../admirerScripts'

describe('ADMIRER_LINES', () => {
  it('has entries for every phase that needs voice', () => {
    const phases = ['entry', 'spectrum', 'depth', 'gems', 'moment', 'autobio', 'reflection']
    for (const p of phases) {
      expect(ADMIRER_LINES[p]).toBeTruthy()
      expect(typeof ADMIRER_LINES[p]).toBe('object')
    }
  })

  it('every line has text and register', () => {
    for (const phase of Object.keys(ADMIRER_LINES)) {
      const lines = ADMIRER_LINES[phase]
      for (const key of Object.keys(lines)) {
        const entry = lines[key]
        expect(typeof entry.text).toBe('string')
        expect(entry.text.length).toBeGreaterThan(2)
        expect(['caretaking', 'present', 'elevated']).toContain(entry.register)
      }
    }
  })

  it('entry has the threshold statement', () => {
    expect(ADMIRER_LINES.entry.threshold.text.toLowerCase()).toContain('inbox')
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- --run src/lib/__tests__/admirerScripts.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/admirerScripts.js`:
```js
// Admirer voice lines per phase. Sparse by design — silence is part of the
// rite. Per Research/voice-intimacy-admirer-design.md, the voice should
// confirm rather than narrate.

export const ADMIRER_LINES = {
  entry: {
    breathe:   { text: 'Breathe out with me. Slowly.', register: 'caretaking' },
    threshold: { text: 'For the next sixteen minutes you are not your inbox.', register: 'caretaking' },
  },
  spectrum: {
    intro:    { text: 'Lean toward the word that feels closer.', register: 'present' },
    midpairs: { text: "You're choosing the warmer ones — interesting.", register: 'present' },
  },
  depth: {
    intro: { text: "Stay until the room has the shape you want.", register: 'present' },
  },
  gems: {
    intro: { text: 'Tell me what you heard. Tap any that feel true.', register: 'present' },
    pivot: { text: "You let the sad ones land. Most people skip past them.", register: 'present' },
  },
  moment: {
    intro: { text: "A track will play. Move with it. Don't decide.", register: 'present' },
    after: { text: 'Did that feel good?', register: 'caretaking' },
  },
  autobio: {
    intro: { text: 'Three songs you carry. Take your time.', register: 'caretaking' },
    pivot: { text: 'Take your time. The wrong one would feel wrong.', register: 'caretaking' },
  },
  reflection: {
    open: { text: 'Here is what I heard.', register: 'caretaking' },
  },
}
```

- [ ] **Step 4: Run test to verify passing**

Run: `npm test -- --run src/lib/__tests__/admirerScripts.test.js`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admirerScripts.js src/lib/__tests__/admirerScripts.test.js
git commit -m "feat(phase3): add Admirer voice line scripts per phase"
```

---

### Task 8: Threshold rite — Entry rewrite

**Files:**
- Modify: `src/phases/Entry.score.jsx` (full rewrite)

Phase 0 becomes the Threshold rite: name capture → breath ring → hand-on-chest held tap → voiced threshold statement → "begin".

Structurally this is the largest UI change in Phase 3. The existing Entry has a `headphones → title → voice` flow. We replace it with `headphones → name → breath → tap → threshold → begin`.

- [ ] **Step 1: Read the existing Entry.score.jsx**

Run: `cat src/phases/Entry.score.jsx | wc -l` — expected ~233 lines.

The existing flow uses static voice cues from `public/chamber/voices/score/entry-*.mp3`. We're replacing that with the dynamic Admirer voice + new mechanics.

- [ ] **Step 2: Replace the entire file**

Replace `src/phases/Entry.score.jsx` with:
```jsx
import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { audioEngine } from '../engine/audio'
import { useAdmirer } from '../hooks/useAdmirer'
import { ADMIRER_LINES } from '../lib/admirerScripts'

const HOLD_DURATION_MS = 6000   // hand-on-chest held tap
const EXHALE_DURATION_MS = 6000 // single guided exhale
const EXHALE_COUNT = 2

export default function Entry({ onNext }) {
  const [stage, setStage] = useState('headphones')
  const [name, setName] = useState('')
  const [holdProgress, setHoldProgress] = useState(0)
  const [exhaleIdx, setExhaleIdx] = useState(0)
  const [exhaleActive, setExhaleActive] = useState(false)

  const holdStartRef = useRef(null)
  const holdRafRef = useRef(null)
  const exhaleTimerRef = useRef(null)

  const admirer = useAdmirer()

  const beginAudio = useCallback(() => {
    audioEngine.init()
    audioEngine.resume()
  }, [])

  const handleHeadphonesTap = () => {
    if (stage !== 'headphones') return
    beginAudio()
    setStage('name')
  }

  const handleNameSubmit = () => {
    if (!name.trim()) return
    try {
      localStorage.setItem('postlistener_name', name.trim())
    } catch {}
    setStage('hold')
  }

  // Hand-on-chest held tap: 6s sustained press fills a ring.
  const handleHoldStart = () => {
    if (stage !== 'hold') return
    holdStartRef.current = Date.now()
    const tick = () => {
      const elapsed = Date.now() - (holdStartRef.current || Date.now())
      const p = Math.min(1, elapsed / HOLD_DURATION_MS)
      setHoldProgress(p)
      if (p >= 1) {
        holdStartRef.current = null
        setStage('breath')
        return
      }
      holdRafRef.current = requestAnimationFrame(tick)
    }
    holdRafRef.current = requestAnimationFrame(tick)
  }

  const handleHoldEnd = () => {
    if (holdStartRef.current && holdProgress < 1) {
      // Released too early — reset.
      holdStartRef.current = null
      setHoldProgress(0)
      if (holdRafRef.current) cancelAnimationFrame(holdRafRef.current)
    }
  }

  // Two guided exhales at 6s each (resonance frequency ≈ 5–6 bpm).
  useEffect(() => {
    if (stage !== 'breath') return
    admirer.play(ADMIRER_LINES.entry.breathe.text, ADMIRER_LINES.entry.breathe.register)
    const startExhale = (i) => {
      setExhaleIdx(i)
      setExhaleActive(true)
      exhaleTimerRef.current = setTimeout(() => {
        setExhaleActive(false)
        if (i + 1 < EXHALE_COUNT) {
          exhaleTimerRef.current = setTimeout(() => startExhale(i + 1), 1200)
        } else {
          exhaleTimerRef.current = setTimeout(() => setStage('threshold'), 1500)
        }
      }, EXHALE_DURATION_MS)
    }
    startExhale(0)
    return () => clearTimeout(exhaleTimerRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Threshold statement voiced + button appears.
  useEffect(() => {
    if (stage !== 'threshold') return
    admirer.play(ADMIRER_LINES.entry.threshold.text, ADMIRER_LINES.entry.threshold.register)
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

  const advance = () => {
    if (holdRafRef.current) cancelAnimationFrame(holdRafRef.current)
    clearTimeout(exhaleTimerRef.current)
    onNext({ name: name.trim() })
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Paper variant="cream">
        <AnimatePresence mode="wait">
          {stage === 'headphones' && (
            <motion.div
              key="headphones"
              onClick={handleHeadphonesTap}
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 32, cursor: 'pointer',
              }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke={COLORS.inkCreamSecondary} strokeWidth="1.2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
              <span style={{
                fontFamily: FONTS.serif, fontStyle: 'italic',
                fontSize: 14, color: COLORS.inkCreamSecondary,
              }}>
                wear headphones
              </span>
              <motion.span
                style={{
                  fontFamily: FONTS.serif, fontStyle: 'italic',
                  fontSize: 14, color: COLORS.scoreAmber, marginTop: 24,
                }}
                animate={{ opacity: [0, 0.8, 0.5, 0.8] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              >
                tap to begin
              </motion.span>
            </motion.div>
          )}

          {stage === 'name' && (
            <motion.div
              key="name"
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 28, padding: '0 32px',
              }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div style={{
                fontFamily: FONTS.serif, fontStyle: 'italic',
                fontSize: 18, color: COLORS.inkCream, textAlign: 'center',
              }}>
                what should i call you?
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNameSubmit() }}
                placeholder="your name"
                autoFocus
                style={{
                  width: 220,
                  padding: '12px 16px',
                  border: `1px solid ${COLORS.inkCreamSecondary}`,
                  background: 'transparent',
                  color: COLORS.inkCream,
                  fontFamily: FONTS.serif,
                  fontSize: 16,
                  outline: 'none',
                  borderRadius: 4,
                  textAlign: 'center',
                }}
              />
              <button
                onClick={handleNameSubmit}
                disabled={!name.trim()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: name.trim() ? COLORS.scoreAmber : COLORS.inkCreamSecondary,
                  fontFamily: FONTS.serif, fontStyle: 'italic',
                  fontSize: 14,
                  cursor: name.trim() ? 'pointer' : 'default',
                }}
              >
                continue
              </button>
            </motion.div>
          )}

          {stage === 'hold' && (
            <motion.div
              key="hold"
              onPointerDown={handleHoldStart}
              onPointerUp={handleHoldEnd}
              onPointerCancel={handleHoldEnd}
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 32, touchAction: 'none', cursor: 'pointer',
              }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div style={{
                fontFamily: FONTS.serif, fontStyle: 'italic',
                fontSize: 16, color: COLORS.inkCream, textAlign: 'center',
                padding: '0 40px', lineHeight: 1.6,
              }}>
                place a hand on your chest.<br />press here and hold.
              </div>
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke={COLORS.inkCreamSecondary}
                        strokeWidth="2" strokeOpacity="0.3" />
                <motion.circle
                  cx="60" cy="60" r="50" fill="none" stroke={COLORS.scoreAmber}
                  strokeWidth="2" strokeDasharray={`${holdProgress * 314} 314`}
                  strokeDashoffset="0" transform="rotate(-90 60 60)"
                />
              </svg>
            </motion.div>
          )}

          {stage === 'breath' && (
            <motion.div
              key="breath"
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 24,
              }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <motion.div
                style={{
                  width: 140, height: 140, borderRadius: '50%',
                  border: `2px solid ${COLORS.scoreAmber}`,
                }}
                animate={exhaleActive ? { scale: [1, 0.5] } : { scale: 1 }}
                transition={{ duration: EXHALE_DURATION_MS / 1000, ease: 'easeInOut' }}
              />
              <div style={{
                fontFamily: FONTS.serif, fontStyle: 'italic',
                fontSize: 14, color: COLORS.inkCreamSecondary,
              }}>
                {exhaleActive ? 'exhale' : 'rest'} · {exhaleIdx + 1} of {EXHALE_COUNT}
              </div>
            </motion.div>
          )}

          {stage === 'threshold' && (
            <motion.div
              key="threshold"
              onClick={advance}
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 36, padding: '0 32px', cursor: 'pointer',
              }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 1.2 }}
            >
              <div style={{
                fontFamily: FONTS.serif, fontStyle: 'italic',
                fontSize: 17, color: COLORS.inkCream, textAlign: 'center',
                lineHeight: 1.7, maxWidth: 320,
              }}>
                for the next sixteen minutes<br />you are not your inbox.
              </div>
              <motion.div
                style={{
                  fontFamily: FONTS.serif, fontStyle: 'italic',
                  fontSize: 14, color: COLORS.scoreAmber,
                }}
                animate={{ opacity: [0.4, 0.9, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
              >
                begin
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Paper>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npm run lint -- src/phases/Entry.score.jsx`
Run: `npm test`
Expected: tests still pass (no test changes); lint shows no NEW errors beyond pre-existing patterns.

Run: `npm run build`
Expected: clean.

Then run `npm run dev` and walk through Entry. Verify each stage transitions correctly. The Admirer voice plays at `breath` and `threshold` stages — if the API key isn't set or the route fails, the phase still advances silently (useAdmirer swallows errors).

- [ ] **Step 4: Commit**

```bash
git add src/phases/Entry.score.jsx
git commit -m "feat(phase3): rewrite Entry as Threshold rite (name + breath + held-tap + voiced statement)"
```

---

### Task 9: Wire useAdmirer into existing phases

**Files:**
- Modify: `src/phases/Spectrum.score.jsx`
- Modify: `src/phases/Depth.score.jsx`
- Modify: `src/phases/Gems.score.jsx`
- Modify: `src/phases/Moment.score.jsx`
- Modify: `src/phases/Autobio.score.jsx`
- Modify: `src/phases/Reflection.score.jsx`

Light wiring — one or two voice lines per phase. Don't over-narrate.

- [ ] **Step 1: Spectrum — play intro line on mount**

Edit `src/phases/Spectrum.score.jsx`. After the existing imports, add:
```jsx
import { useAdmirer } from '../hooks/useAdmirer'
import { ADMIRER_LINES } from '../lib/admirerScripts'
```

Inside the component, after the existing `useState` hooks, add:
```jsx
const admirer = useAdmirer()
```

Find the existing `useEffect` that calls `preloadVoices(VOICE_PATHS)` near the top of the component. After that line inside the same effect, add:
```jsx
admirer.play(ADMIRER_LINES.spectrum.intro.text, ADMIRER_LINES.spectrum.intro.register)
```

- [ ] **Step 2: Depth — play intro line on mount**

Edit `src/phases/Depth.score.jsx`. Add the same imports + `useAdmirer()` hook + a single `admirer.play(ADMIRER_LINES.depth.intro.text, ...)` call inside the existing mount useEffect (after the `preloadVoices` call).

- [ ] **Step 3: Gems — play intro line + pivot between excerpts**

Edit `src/phases/Gems.score.jsx`. Add the imports + hook. In the mount `useEffect` that calls `playExcerpt(0)`, add a preceding `admirer.play(ADMIRER_LINES.gems.intro.text, ...)` call.

In `recordSelection`, after pushing to `resultsRef.current`, check if the user selected `melancholic`:
```jsx
if (tiles.includes('melancholic')) {
  admirer.play(ADMIRER_LINES.gems.pivot.text, ADMIRER_LINES.gems.pivot.register)
}
```

(This adds the Forer-y "you let the sad ones land" line as a soft probe.)

- [ ] **Step 4: Moment — play intro before build, leave Hurley copy alone**

Edit `src/phases/Moment.score.jsx`. Add the imports + hook. In the mount `useEffect`, add:
```jsx
admirer.play(ADMIRER_LINES.moment.intro.text, ADMIRER_LINES.moment.intro.register)
```

(The "did that feel good?" Hurley copy is already in the existing UI text — leave it visual rather than voiced for now.)

- [ ] **Step 5: Autobio — play intro line at first prompt**

Edit `src/phases/Autobio.score.jsx`. Add the imports + hook. After the component declaration's existing `useState` block, add a one-shot mount effect:
```jsx
useEffect(() => {
  admirer.play(ADMIRER_LINES.autobio.intro.text, ADMIRER_LINES.autobio.intro.register)
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 6: Reflection — play "here is what i heard" before the lines fade in**

Edit `src/phases/Reflection.score.jsx`. Add the imports + hook. In the existing mount useEffect (where the line timers are set up), after the `for` loop that schedules the line timers, add:
```jsx
admirer.play(ADMIRER_LINES.reflection.open.text, ADMIRER_LINES.reflection.open.register)
```

- [ ] **Step 7: Verify**

Run: `npm test` — expected 80+ tests still pass (no new tests, no regressions).
Run: `npm run build` — expected clean.

Then `npm run dev` and walk through. Voice lines should play in each phase. If `/api/admirer` returns an error, phases continue silently.

- [ ] **Step 8: Commit**

```bash
git add src/phases/Spectrum.score.jsx src/phases/Depth.score.jsx src/phases/Gems.score.jsx \
        src/phases/Moment.score.jsx src/phases/Autobio.score.jsx src/phases/Reflection.score.jsx
git commit -m "feat(phase3): wire Admirer voice into all phases"
```

---

## Track C — Composition + polish

### Task 10: compositionPlan.js — derive Music API plan from session signals

**Files:**
- Create: `src/lib/compositionPlan.js`
- Create: `src/lib/__tests__/compositionPlan.test.js`

Pure function that takes session signals and returns a composition plan. The Reveal track is ~30s for now (single section); Phase 3.x can extend to multi-section arcs.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/compositionPlan.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { buildCompositionPlan } from '../compositionPlan'

const baseInput = {
  archetypeId: 'late-night-architect',
  variationId: 'lo-fi-piano-2010s',
  eraMedian: 2015,
  dominantGemsTag: null,
  hedonic: null,
}

describe('buildCompositionPlan', () => {
  it('returns positive_global_styles, negative_global_styles, sections', () => {
    const plan = buildCompositionPlan(baseInput)
    expect(Array.isArray(plan.positive_global_styles)).toBe(true)
    expect(Array.isArray(plan.negative_global_styles)).toBe(true)
    expect(Array.isArray(plan.sections)).toBe(true)
    expect(plan.sections.length).toBeGreaterThanOrEqual(1)
  })

  it('every section has section_name + duration_ms + style arrays', () => {
    const plan = buildCompositionPlan(baseInput)
    for (const s of plan.sections) {
      expect(typeof s.section_name).toBe('string')
      expect(typeof s.duration_ms).toBe('number')
      expect(s.duration_ms).toBeGreaterThan(2000)
      expect(Array.isArray(s.positive_local_styles)).toBe(true)
      expect(Array.isArray(s.negative_local_styles)).toBe(true)
    }
  })

  it('total duration is between 25s and 60s', () => {
    const plan = buildCompositionPlan(baseInput)
    const total = plan.sections.reduce((s, sec) => s + sec.duration_ms, 0)
    expect(total).toBeGreaterThanOrEqual(25000)
    expect(total).toBeLessThanOrEqual(60000)
  })

  it('archetype-specific styles appear in positive_global_styles', () => {
    const lateNight = buildCompositionPlan({ ...baseInput, archetypeId: 'late-night-architect' })
    const skySeeker = buildCompositionPlan({ ...baseInput, archetypeId: 'sky-seeker' })
    expect(lateNight.positive_global_styles.join(' ').toLowerCase()).toMatch(/lo-fi|piano|introspective|nocturnal|ambient/)
    expect(skySeeker.positive_global_styles.join(' ').toLowerCase()).toMatch(/cinematic|triumphant|expansive|sky/)
  })

  it('era median <1990 emits "vintage" / "analog"', () => {
    const plan = buildCompositionPlan({ ...baseInput, eraMedian: 1985 })
    const text = plan.positive_global_styles.join(' ').toLowerCase()
    expect(text).toMatch(/vintage|analog|tape|warm/)
  })

  it('era median ≥2015 emits "modern" / "neo-classical"', () => {
    const plan = buildCompositionPlan({ ...baseInput, eraMedian: 2022 })
    const text = plan.positive_global_styles.join(' ').toLowerCase()
    expect(text).toMatch(/contemporary|modern|neo-classical|2020s/)
  })

  it('dominantGemsTag injects a matching style hint', () => {
    const plan = buildCompositionPlan({ ...baseInput, dominantGemsTag: 'nostalgic' })
    expect(plan.positive_global_styles.join(' ').toLowerCase()).toMatch(/nostalgic|warm|memory/)
  })

  it('hedonic === false biases toward restraint', () => {
    const plan = buildCompositionPlan({ ...baseInput, hedonic: false })
    const neg = plan.negative_global_styles.join(' ').toLowerCase()
    expect(neg).toMatch(/triumphant|saccharine|bombastic|overproduced/)
  })

  it('always sets force_instrumental implicitly via negative styles', () => {
    const plan = buildCompositionPlan(baseInput)
    expect(plan.negative_global_styles.join(' ').toLowerCase()).toContain('vocal')
  })

  it('returns null when archetypeId is unknown', () => {
    const plan = buildCompositionPlan({ ...baseInput, archetypeId: 'fake' })
    expect(plan).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- --run src/lib/__tests__/compositionPlan.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/compositionPlan.js`:
```js
// Derive an ElevenLabs Music API composition plan from session signals.
// Per Research/generative-music-differentiation-engines.md the prompt needs
// 4–7 distinct descriptors across orthogonal dimensions (genre, tempo,
// instruments, vocal/instrumental, mood, production aesthetic).

import { ARCHETYPES, getArchetype, getVariation } from './archetypes.js'

// Archetype → prompt fragment library. Each archetype's variations would
// ideally tweak these, but Phase 3 keeps it archetype-level for now.
const ARCHETYPE_STYLES = {
  'late-night-architect':
    ['lo-fi piano', 'introspective', 'nocturnal ambient', 'sparse', '70 BPM'],
  'hearth-keeper':
    ['warm folk', 'fingerpicked acoustic guitar', 'intimate', '90 BPM', 'felt cello'],
  'velvet-mystic':
    ['chamber strings', 'dream-pop', 'lush orchestral', '80 BPM', 'reverberant'],
  'quiet-insurgent':
    ['post-rock instrumental', 'minor key', 'restrained tension', '90 BPM', 'driving but withheld'],
  'slow-glow':
    ['downtempo soul', 'lo-fi groove', 'warm low-pass', '85 BPM', 'analog tape saturation'],
  'sky-seeker':
    ['cinematic ambient', 'triumphant', 'expansive', '100 BPM', 'big-sky orchestral'],
}

function eraStyles(eraMedian) {
  if (typeof eraMedian !== 'number' || eraMedian <= 0) return []
  if (eraMedian < 1980) return ['1970s vintage', 'analog tape', 'warm']
  if (eraMedian < 1995) return ['1980s analog', 'tape warmth']
  if (eraMedian < 2010) return ['1990s production', 'mid-fidelity']
  if (eraMedian < 2020) return ['2010s contemporary', 'modern production']
  return ['2020s contemporary', 'neo-classical', 'modern']
}

function gemsStyles(tag) {
  if (!tag) return []
  return {
    nostalgic:   ['nostalgic', 'warm memory'],
    awed:        ['expansive', 'reverent'],
    tender:      ['tender', 'intimate'],
    melancholic: ['melancholy minor', 'pensive'],
    defiant:     ['urgent', 'forward-leaning'],
    peaceful:    ['calm sustained', 'still'],
  }[tag] || []
}

function hedonicNegatives(hedonic) {
  // hedonic === false: user did not enjoy the build-and-drop arousal peak.
  // Bias the generated track away from triumphant / overproduced styles.
  if (hedonic === false) {
    return ['triumphant climax', 'saccharine', 'bombastic', 'overproduced', 'aggressive drop']
  }
  return []
}

const ALWAYS_NEGATIVE = ['vocals', 'singing', 'lyrics']

export function buildCompositionPlan({ archetypeId, variationId, eraMedian, dominantGemsTag, hedonic }) {
  const archetype = getArchetype(archetypeId)
  if (!archetype) return null
  const variation = variationId ? getVariation(archetypeId, variationId) : null

  const positive_global_styles = [
    ...(ARCHETYPE_STYLES[archetypeId] || []),
    ...eraStyles(eraMedian),
    ...gemsStyles(dominantGemsTag),
    'instrumental',
  ]
  const negative_global_styles = [
    ...ALWAYS_NEGATIVE,
    ...hedonicNegatives(hedonic),
  ]

  // Single-section 30s composition for Phase 3.0. Phase 3.x can split into
  // intro/build/climax once the Reveal duration extends.
  const sections = [{
    section_name: 'main',
    positive_local_styles: variation ? [variation.microgenreLabel] : ['expressive'],
    negative_local_styles: [],
    duration_ms: 30000,
    lines: [],
  }]

  return {
    positive_global_styles,
    negative_global_styles,
    sections,
  }
}
```

- [ ] **Step 4: Run test to verify passing**

Run: `npm test -- --run src/lib/__tests__/compositionPlan.test.js`
Expected: 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/compositionPlan.js src/lib/__tests__/compositionPlan.test.js
git commit -m "feat(phase3): add composition plan derivation from session signals"
```

---

### Task 11: Wire compositionPlan into Moment → musicPromise

**Files:**
- Modify: `src/phases/Moment.score.jsx`

Replace the static `Promise.resolve('/chamber/tracks/track-a.mp3')` with a `/api/compose` POST. The result is an object URL that Reveal plays.

- [ ] **Step 1: Read the current Moment.score.jsx Hurley path**

Around `completeAndAdvance` in `src/phases/Moment.score.jsx`, find:
```js
const musicPromise = Promise.resolve('/chamber/tracks/track-a.mp3')
```

- [ ] **Step 2: Replace with compose call**

Add to the imports at the top:
```js
import { buildCompositionPlan } from '../lib/compositionPlan'
import { scoreArchetype } from '../lib/scoreArchetype'
import { dominantGemsTag } from '../lib/gemsTags'
```

Replace the `const musicPromise = Promise.resolve('/chamber/tracks/track-a.mp3')` line with:
```js
const phaseData = avd.getPhaseData()
const avdValues = avd.getAVD()
const scored = scoreArchetype(avdValues, phaseData)
const plan = buildCompositionPlan({
  archetypeId: scored.archetypeId,
  variationId: scored.variationId,
  eraMedian: phaseData.autobio?.eraSummary?.median,
  dominantGemsTag: dominantGemsTag(phaseData.gems?.excerpts),
  hedonic: hedonicRef.current,
})

// POST to the server proxy. On failure, fall back to the static track so
// the experience still completes (degrade gracefully).
const musicPromise = plan
  ? fetch('/api/compose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ composition_plan: plan }),
    })
      .then(async res => {
        if (!res.ok) throw new Error(`compose failed: ${res.status}`)
        const blob = await res.blob()
        return URL.createObjectURL(blob)
      })
      .catch(() => '/chamber/tracks/track-a.mp3')
  : Promise.resolve('/chamber/tracks/track-a.mp3')
```

- [ ] **Step 3: Verify**

Run: `npm test`
Expected: all tests still pass.

Run: `npm run build`
Expected: clean.

For end-to-end test, walk through the full flow in dev. The Music API call takes ~25–30s so the user will be in Autobio + Reflection while Reveal awaits the promise. If the API call fails (rate limit, key missing), the static track plays — same behavior as before.

- [ ] **Step 4: Commit**

```bash
git add src/phases/Moment.score.jsx
git commit -m "feat(phase3): generate per-session Reveal track via /api/compose"
```

---

### Task 12: hedonicBias.js + wire into scoreArchetype

**Files:**
- Create: `src/lib/hedonicBias.js`
- Create: `src/lib/__tests__/hedonicBias.test.js`
- Modify: `src/lib/scoreArchetype.js`

When `hedonic === false`, lean toward the low-V archetypes (Quiet Insurgent, Slow Glow) even if AVD distance pointed elsewhere.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/hedonicBias.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { applyHedonicBias } from '../hedonicBias'

describe('applyHedonicBias', () => {
  const baseScores = {
    'late-night-architect': 0.1,
    'hearth-keeper': 0.1,
    'velvet-mystic': 0.1,
    'quiet-insurgent': 0.1,
    'slow-glow': 0.1,
    'sky-seeker': 0.5,
  }

  it('returns scores unchanged when hedonic is null', () => {
    const out = applyHedonicBias(baseScores, null)
    expect(out).toEqual(baseScores)
  })

  it('returns scores unchanged when hedonic is true', () => {
    const out = applyHedonicBias(baseScores, true)
    expect(out).toEqual(baseScores)
  })

  it('boosts quiet-insurgent and slow-glow when hedonic is false', () => {
    const out = applyHedonicBias(baseScores, false)
    expect(out['quiet-insurgent']).toBeGreaterThan(baseScores['quiet-insurgent'])
    expect(out['slow-glow']).toBeGreaterThan(baseScores['slow-glow'])
  })

  it('reduces sky-seeker when hedonic is false', () => {
    const out = applyHedonicBias(baseScores, false)
    expect(out['sky-seeker']).toBeLessThan(baseScores['sky-seeker'])
  })

  it('renormalizes scores so they sum to 1.0', () => {
    const out = applyHedonicBias(baseScores, false)
    const sum = Object.values(out).reduce((s, v) => s + v, 0)
    expect(sum).toBeCloseTo(1.0, 5)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- --run src/lib/__tests__/hedonicBias.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/hedonicBias.js`**

Create `src/lib/hedonicBias.js`:
```js
// Bias archetype scores when the user reported the Moment build-and-drop
// did NOT feel good (hedonic === false). Lean toward low-valence archetypes
// — the user accepted high arousal but didn't enjoy it; that points to
// tension-tolerant tastes (Quiet Insurgent) or low-arousal patience
// (Slow Glow), not the triumphant Sky-Seeker.

const HEDONIC_FALSE_MULTIPLIERS = {
  'quiet-insurgent': 1.6,
  'slow-glow':       1.4,
  'sky-seeker':      0.5,
  'hearth-keeper':   0.85,
  // late-night-architect and velvet-mystic stay at 1.0
}

export function applyHedonicBias(scores, hedonic) {
  if (hedonic !== false) return scores
  const biased = {}
  let sum = 0
  for (const [id, score] of Object.entries(scores)) {
    const m = HEDONIC_FALSE_MULTIPLIERS[id] ?? 1.0
    const v = score * m
    biased[id] = v
    sum += v
  }
  // Renormalize so the result is still a valid distribution.
  const result = {}
  for (const [id, v] of Object.entries(biased)) {
    result[id] = sum > 0 ? v / sum : 0
  }
  return result
}
```

- [ ] **Step 4: Run test to verify passing**

Run: `npm test -- --run src/lib/__tests__/hedonicBias.test.js`
Expected: 5 tests PASS.

- [ ] **Step 5: Wire into `scoreArchetype.js`**

Edit `src/lib/scoreArchetype.js`. Add at the top of the file's imports:
```js
import { applyHedonicBias } from './hedonicBias.js'
```

Find the `scoreArchetype` function. Replace:
```js
export function scoreArchetype(avd, phaseData, rand = Math.random) {
  const scores = _archetypeScores(avd)
```
with:
```js
export function scoreArchetype(avd, phaseData, rand = Math.random) {
  const rawScores = _archetypeScores(avd)
  const scores = applyHedonicBias(rawScores, phaseData?.moment?.hedonic ?? null)
```

(Then the rest of the function reads `scores` as before — argmax, etc.)

- [ ] **Step 6: Add a regression test for the wiring**

In `src/lib/__tests__/scoreArchetype.test.js`, find the existing `describe('scoreArchetype', ...)` block. Add this test before the closing `})`:
```js
  it('hedonic === false shifts choice from Sky-Seeker to a low-V archetype', () => {
    // High AVD that would normally pick Sky-Seeker (a:0.78, v:0.75, d:0.78).
    const phaseDataPositive = {
      spectrum: { pairs: [], hoveredButNotChosen: [] },
      depth: { finalLayer: 4 },
      textures: { preferred: [], rejected: [], neutral: [] },
      gems: { excerpts: [] },
      moment: { totalDownbeats: 30, hedonic: true },
      autobio: { songs: [], eraSummary: null },
    }
    const phaseDataNegative = { ...phaseDataPositive, moment: { ...phaseDataPositive.moment, hedonic: false } }

    const positive = scoreArchetype({ a: 0.78, v: 0.75, d: 0.78 }, phaseDataPositive, () => 0.99)
    const negative = scoreArchetype({ a: 0.78, v: 0.75, d: 0.78 }, phaseDataNegative, () => 0.99)

    expect(positive.archetypeId).toBe('sky-seeker')
    // With hedonic=false, Sky-Seeker drops by 0.5× and Quiet Insurgent gains 1.6×;
    // for this pinned AVD the new top can be either Quiet Insurgent or Slow Glow,
    // but it MUST NOT be Sky-Seeker.
    expect(negative.archetypeId).not.toBe('sky-seeker')
  })
```

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: all tests pass (existing 80+ + 5 new hedonicBias + 1 wiring test).

- [ ] **Step 8: Commit**

```bash
git add src/lib/hedonicBias.js src/lib/__tests__/hedonicBias.test.js \
        src/lib/scoreArchetype.js src/lib/__tests__/scoreArchetype.test.js
git commit -m "feat(phase3): bias archetype scoring on hedonic=false toward low-V archetypes"
```

---

### Task 13: AVD getCompositionPlan — textures → gems

**Files:**
- Modify: `src/engine/avd.js`

The legacy `getCompositionPlan()` reads `textures.preferred` for `positiveGlobalStyles`. With Textures dropped in Phase 2, this is always `[]`. Replace with a gems-derived signal so the legacy method (still called by Reveal's session save) returns useful prompt fragments.

- [ ] **Step 1: Locate the `getCompositionPlan` method**

Read `src/engine/avd.js` lines 127–201. The current implementation reads `this.phaseData.textures` and uses `textures.preferred` and `textures.rejected` in style arrays.

- [ ] **Step 2: Replace the textures references with gems-derived styles**

In `src/engine/avd.js`, find the `getCompositionPlan` method. Replace the lines:
```js
    const textures = this.phaseData.textures
```
with:
```js
    // Textures phase was removed in Phase 2; derive style hints from the
    // gems phase's dominant emotion tag instead.
    const gemsExcerpts = this.phaseData.gems?.excerpts || []
    const gemsKeywordsByTag = {
      nostalgic:   ['nostalgic', 'warm memory'],
      awed:        ['sublime', 'cinematic'],
      tender:      ['intimate', 'soft'],
      melancholic: ['melancholy minor', 'pensive'],
      defiant:     ['urgent', 'driving'],
      peaceful:    ['calm sustained', 'still'],
    }
    let gemsKeywords = []
    {
      const counts = {}
      for (const ex of gemsExcerpts) {
        for (const t of ex.tilesSelected || []) counts[t] = (counts[t] || 0) + 1
      }
      let topTag = null, topCount = 0
      for (const [k, v] of Object.entries(counts)) {
        if (v > topCount) { topCount = v; topTag = k }
      }
      if (topTag && gemsKeywordsByTag[topTag]) gemsKeywords = gemsKeywordsByTag[topTag]
    }
```

Then in the same method, find:
```js
    const positiveGlobalStyles = [
      ...arousal.positive,
      ...valence.positive,
      `${bpm} BPM`,
      `key of ${key}`,
      ...textures.preferred,
    ]
    const negativeGlobalStyles = [
      ...arousal.negative,
      ...valence.negative,
      ...textures.rejected,
    ]
```
Replace with:
```js
    const positiveGlobalStyles = [
      ...arousal.positive,
      ...valence.positive,
      `${bpm} BPM`,
      `key of ${key}`,
      ...gemsKeywords,
    ]
    const negativeGlobalStyles = [
      ...arousal.negative,
      ...valence.negative,
    ]
```

- [ ] **Step 3: Verify**

Run: `npm test`
Expected: all tests still pass. (No tests directly exercise `getCompositionPlan` — the Reveal session save uses it but only writes the prompt to localStorage.)

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/engine/avd.js
git commit -m "fix(phase3): replace dead textures.preferred with gems-derived styles in getCompositionPlan"
```

---

### Task 14: itunesSearch abort test

**Files:**
- Modify: `src/lib/__tests__/itunesSearch.test.js`

Add a test that verifies a pre-aborted signal causes `searchTracks` to throw.

- [ ] **Step 1: Add the test**

In `src/lib/__tests__/itunesSearch.test.js`, find the existing `describe('searchTracks', ...)` block. Add this test before the closing `})`:
```js
  it('rejects with AbortError when signal is pre-aborted', async () => {
    global.fetch = vi.fn((_url, opts) => {
      // Simulate the browser's behavior: if the signal is already aborted,
      // fetch rejects with an AbortError.
      if (opts?.signal?.aborted) {
        return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      })
    })
    const controller = new AbortController()
    controller.abort()
    await expect(searchTracks('radiohead', controller.signal)).rejects.toThrow(/abort/i)
  })
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- --run src/lib/__tests__/itunesSearch.test.js`
Expected: 7 tests PASS (6 existing + 1 new).

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/itunesSearch.test.js
git commit -m "test(phase3): add iTunes search pre-aborted signal regression test"
```

---

### Task 15: Phase renumbering + spectrum pair label fix

**Files:**
- Modify: `src/phases/Moment.score.jsx`
- Modify: `src/phases/Autobio.score.jsx`
- Modify: `src/phases/Reflection.score.jsx`
- Modify: `src/phases/Reveal.score.jsx`
- Modify: `src/lib/spectrumPairs.js`
- Modify: `src/lib/__tests__/spectrumPairs.test.js`

Two unrelated polish items grouped to keep commit count manageable.

- [ ] **Step 1: Renumber Moment "v." → "v." (no change), Autobio "v." → "vi.", Reflection "v." → "vii.", Reveal "vi." → "viii."**

Phase order is `entry(0), spectrum(1), depth(2), gems(3), moment(4), autobio(5), reflection(6), reveal(7), orchestra(8)`.

Roman numerals (1-indexed for human readability):
- entry = i. (already shown as title not numeral — leave)
- spectrum = ii.
- depth = iii.
- gems = iv. (already correct — `iv. tell me what you heard`)
- moment = v.
- autobio = vi.
- reflection = vii.
- reveal = viii.

Edit `src/phases/Moment.score.jsx`. Find:
```jsx
v. moment
```
Confirm it's already `v.` — no change needed if already correct.

Edit `src/phases/Autobio.score.jsx`. Find:
```jsx
v. three songs you carry · {promptIdx + 1} / {PROMPTS.length}
```
Replace with:
```jsx
vi. three songs you carry · {promptIdx + 1} / {PROMPTS.length}
```

Edit `src/phases/Reflection.score.jsx`. Find:
```jsx
v. what i heard
```
Replace with:
```jsx
vii. what i heard
```

Edit `src/phases/Reveal.score.jsx`. Find:
```jsx
vi. reveal
```
Replace with:
```jsx
viii. reveal
```

- [ ] **Step 2: Spectrum slow/mid → slow/fast**

Edit `src/lib/spectrumPairs.js`. Find the slow/mid pair definition:
```js
  { left: 'slow',        right: 'mid',
    coordL: { a: 0.20, v: 0.50, d: 0.55 }, coordR: { a: 0.55, v: 0.50, d: 0.50 } },
```
Replace with:
```js
  { left: 'slow',        right: 'fast',
    coordL: { a: 0.20, v: 0.50, d: 0.55 }, coordR: { a: 0.80, v: 0.50, d: 0.50 } },
```

(coordR's `a` bumped from 0.55 to 0.80 — a clearer arousal contrast that matches the new "fast" label.)

- [ ] **Step 3: Update the existing spectrumPairs test**

The existing test asserts `axes.toContain('warm/cold')` etc. but doesn't pin slow/mid specifically. No test change strictly needed. But for clarity, update the test to assert the new label is in the v2 set:

In `src/lib/__tests__/spectrumPairs.test.js`, find:
```js
    expect(axes).toContain('sung/instrumental')
```
Add immediately after:
```js
    expect(axes).toContain('slow/fast')
```

- [ ] **Step 4: Verify**

Run: `npm test`
Expected: all tests still pass.

Run: `npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/phases/Autobio.score.jsx src/phases/Reflection.score.jsx src/phases/Reveal.score.jsx \
        src/lib/spectrumPairs.js src/lib/__tests__/spectrumPairs.test.js
git commit -m "fix(phase3): renumber phase Roman numerals + relabel slow/mid → slow/fast"
```

---

### Task 16: Final integration verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all tests pass. Phase 3 added unit tests for voiceRegister (5), textHash (5), admirerScripts (3), compositionPlan (10), hedonicBias (5), plus regressions for scoreArchetype (1) and itunesSearch (1). Total Phase 3 additions ~30 tests, bringing the suite to ~110+.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: pre-existing chamber/marks errors only — no new errors from Phase 3.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: clean. Bundle size should be similar to Phase 2 (~440 KB JS / ~136 KB gzip) — Phase 3 adds modest code.

- [ ] **Step 4: End-to-end manual walkthrough**

Run: `npm run dev`

Walk through the full flow from `entry`, with `.env.local` containing both `VITE_ELEVENLABS_API_KEY` and `ELEVENLABS_API_KEY`. Verify:

| Check | Expected |
|---|---|
| Entry: name capture works | Type a name, hit continue |
| Entry: 6s held tap fills the ring | Press and hold; ring fills clockwise |
| Entry: two 6s exhales play | Ring shrinks during exhale, rests, repeats |
| Entry: threshold statement plays | Voice "for the next sixteen minutes you are not your inbox" |
| Spectrum / Depth / Gems / Moment / Autobio / Reflection: voice plays at intro | Each phase has at least one voiced line |
| Gems: melancholic selection triggers pivot line | Tap "melancholic" tile, voice plays "you let the sad ones land..." |
| Moment: Hurley probe still works | After build, "did that feel good?" yes/no |
| Reveal: per-session track plays | Track audio is unique per session (you can verify by saving the localStorage entry — `selectedTrack: 'procedural'` was the old value; now Reveal plays a fresh blob URL) |
| Reveal → Orchestra: seamless audio handoff still works | Same audio element passes via `revealAudioRef` |
| Network failure: voice + music degrade gracefully | If you stop the dev server's `/api/admirer` (e.g., remove ELEVENLABS_API_KEY from .env.local and restart), the experience proceeds silently — no crashes |

- [ ] **Step 5: Push to origin**

```bash
git push origin score-v2
```

- [ ] **Step 6: Final cleanup commit (optional)**

If anything surfaced during E2E that needs a small fix:
```bash
git add -p
git commit -m "fix(phase3): polish from E2E walkthrough"
```

---

## Self-review checklist

- [ ] **Spec coverage:**
  - ElevenLabs server proxy → Tasks 3, 4 ✓
  - Asset generation script → Task 5 ✓
  - Admirer voice across phases → Tasks 1, 2, 6, 7, 9 ✓
  - Threshold rite (Phase 0) → Task 8 ✓
  - Composition plan derivation → Tasks 10, 11 ✓
  - Hedonic field consumption → Task 12 ✓
  - Phase label renumbering → Task 15 ✓
  - getCompositionPlan textures → gems → Task 13 ✓
  - itunesSearch abort test → Task 14 ✓
  - PAIRS_V2 slow/mid → slow/fast → Task 15 ✓

- [ ] **No placeholders** — every code block above is shippable. Asset paths are real (`public/gems/`, `public/spectrum/v2/`).

- [ ] **Type/name consistency:**
  - `register: 'caretaking' | 'present' | 'elevated'` — defined in Task 1 (`voiceRegister.js`), referenced in Tasks 3, 6, 7, 8, 9. Consistent.
  - `composition_plan` body shape `{ positive_global_styles, negative_global_styles, sections }` — produced by Task 10, consumed by Task 4 server route, posted by Task 11 client. Consistent.
  - `useAdmirer().play(text, register)` and `.preload(text, register)` signatures — defined Task 6, used Tasks 8, 9. Consistent.
  - `phaseData.moment.hedonic` — written by Phase 2 Moment.score.jsx, read by Tasks 11, 12 (compositionPlan, hedonicBias).

- [ ] **Constraint compliance:**
  - API key never sent to client ✓ (server-side only — VITE_ prefix omitted from new env var)
  - Vite middleware for dev, Vercel-compatible handlers for prod ✓
  - Idempotent asset script ✓
  - Existing Phase 1 + 2 code untouched except for documented modifications ✓
  - Tests added for all new pure-function modules ✓

---

## Out-of-scope notes (Phase 4+ territory)

- **Multi-section composition** — Task 10 emits a single 30s section. Phase 3.x can split into intro/build/climax once the Reveal stage extends.
- **Admirer voice line caching to disk** — currently in-memory only; refresh wipes cache. A service worker could persist Blob URLs across sessions.
- **Music API track caching by signal hash** — composition plans for the same archetype+variation+era+gems+hedonic combo could deduplicate. Not done because the current ε-greedy variation introduces non-determinism per session.
- **TTS streaming** — current implementation downloads full mp3 before play; ElevenLabs supports streaming TTS for ~75ms TTFB on Flash. If voice latency becomes a problem, switch to `eleven_flash_v2_5`.
- **Server route rate limiting** — both `/api/admirer` and `/api/compose` will pass through to ElevenLabs unrestricted. For multi-user demo / production, add per-IP rate limit middleware.
- **API key rotation** — currently lives in .env.local + Vercel env. If exposed, rotate via dashboard.
