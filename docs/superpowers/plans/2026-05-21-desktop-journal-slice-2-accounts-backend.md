# Desktop Journal — Slice 2: Accounts + Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the desktop journal behind a real account — Google sign-in, a Supabase backend, and first-timer-vs-returning routing — so the book reads the signed-in user's own entries.

**Architecture:** A single `Desktop` orchestrator owns the auth gate: a `useAuth` hook (Supabase Google OAuth) decides between a `SignIn` screen, a `FirstTimer` screen (QR only, zero entries), and the existing `Journal` (one or more entries). Entries live in one Supabase `entries` table protected by Row-Level Security. The `Journal` becomes a pure presentational component driven by an `entries` prop, so it renders mock data (no backend configured) or real data identically. The existing `Stage` root and the phone-rite/QR-pairing flow are untouched — the desktop journal lives auth-gated on the `/journal` route.

**Tech Stack:** React 19 + Vite 7, `@supabase/supabase-js` v2 (Postgres + Auth), `qrcode.react` (already a dependency), Vitest 4 for pure-function tests.

---

## Prerequisites (manual, one-time — the user does this)

The pure-code tasks (3–8) need no backend. The auth flow can only be **verified end-to-end** (Task 10) once Supabase is configured. Task 2 produces `docs/supabase-setup.md`; the user follows it to create the Supabase project, run the schema, configure Google OAuth, and add `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` to `.env.local`. Until then the desktop runs the **no-backend dev fallback** (the journal on mock data, no auth) — so every task remains independently verifiable.

## File Structure

**Create:**
- `src/lib/supabaseClient.js` — the single Supabase client; `null` when env is absent.
- `supabase/schema.sql` — the `entries` table + RLS migration (run once in the Supabase SQL editor).
- `docs/supabase-setup.md` — step-by-step backend setup for the user.
- `src/lib/entryFormat.js` — pure date/normalisation helpers (`mockDateToIso`, `formatEntryDate`, `normalizeEntries`, `loadMockEntries`, `timeOfDay`).
- `src/lib/__tests__/entryFormat.test.js` — unit tests for the above.
- `src/lib/entriesRepo.js` — Supabase IO: `fetchEntries`, `seedSampleEntries`.
- `src/hooks/useAuth.js` — auth state + `signInWithGoogle` + `signOut`.
- `src/desktop/SignIn.jsx` — signed-out screen.
- `src/desktop/FirstTimer.jsx` — signed-in, zero-entries screen (QR).
- `src/desktop/Desktop.jsx` — the auth-gated orchestrator.

**Modify:**
- `src/journal/Journal.jsx` — take an `entries` prop (+ optional `onSignOut`) instead of importing `MOCK_ENTRIES`.
- `src/journal/EntryPage.jsx` — key the roman numeral / glyph / wash off `entry.seq` instead of `entry.id`.
- `src/main.jsx` — route `/journal` → `Desktop`.
- `CLAUDE.md` — env-var table + a short desktop-journal section.

**Untouched (explicitly):** `src/phases/Stage.jsx`, `src/main.jsx`'s `Stage` root branch, the relay/QR-pairing rite flow, `src/journal/ChapterIndex.jsx`, `src/journal/chapters.js`, `src/journal/mockEntries.js`.

---

## Task 1: Supabase client

**Files:**
- Create: `src/lib/supabaseClient.js`
- Verify dependency: `package.json` (`@supabase/supabase-js` — already installed)

- [ ] **Step 1: Confirm the dependency is installed**

Run: `npm ls @supabase/supabase-js`
Expected: prints `@supabase/supabase-js@2.x.x` (no "missing"). If missing: `npm install @supabase/supabase-js`.

- [ ] **Step 2: Write the client**

Create `src/lib/supabaseClient.js`:

```js
import { createClient } from '@supabase/supabase-js'

/**
 * supabaseClient — the project's single Supabase client.
 *
 * Holds accounts (Supabase Auth, Google OAuth) and journal entries. The URL
 * and anon key are public-by-design (the anon key is safe in the browser —
 * Row-Level Security is what protects the data; see supabase/schema.sql).
 *
 * If the env vars are absent the export is `null` — the desktop then falls
 * back to a no-auth dev journal on mock data, so the route never hard-fails
 * before Supabase is configured. See docs/supabase-setup.md.
 */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
```

`detectSessionInUrl: true` makes the client exchange the OAuth `?code=` param for a session automatically when Google redirects back — no dedicated callback route needed.

- [ ] **Step 3: Verify the build is clean**

Run: `npm run build`
Expected: build succeeds (the file is imported by nothing yet, but must compile).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/supabaseClient.js
git commit -m "feat(desktop): add Supabase client"
```

---

## Task 2: Database schema + setup doc

**Files:**
- Create: `supabase/schema.sql`
- Create: `docs/supabase-setup.md`

- [ ] **Step 1: Write the schema migration**

Create `supabase/schema.sql`:

```sql
-- migration: create_entries
-- purpose: journal entries for the desktop PostListener journal
-- affected tables: public.entries
-- special considerations: RLS enabled; each user reads/writes only their own rows

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  song text,        -- archetype + variation id (set by the rite, slice 3)
  summary text,     -- the Admirer's one-line commitEntry sentence
  glyph jsonb,      -- serialised gesture path (recorded, slice 3)
  region text       -- coarsened location for the collective (slice 5/6)
);

alter table public.entries enable row level security;

-- a user may read only their own entries
create policy "read own entries" on public.entries
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- a user may insert only entries attributed to themselves
create policy "insert own entries" on public.entries
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- the journal always queries one user's entries newest-first
create index if not exists entries_user_created_idx
  on public.entries (user_id, created_at desc);
```

- [ ] **Step 2: Write the setup doc**

Create `docs/supabase-setup.md`:

```markdown
# Supabase setup — desktop journal accounts + backend

One-time setup for the desktop journal's auth + entries backend (design doc
slice 2). Until this is done the desktop runs a no-auth dev fallback (the
journal on mock data).

## 1. Create the project
1. Sign in at https://supabase.com and create a new project.
2. Wait for it to provision, then open **Project Settings → API**.
3. Copy the **Project URL** and the **anon / publishable key**.

## 2. Create the entries table
1. Open the Supabase **SQL Editor**.
2. Paste the contents of `supabase/schema.sql` and run it.
3. Confirm the `entries` table exists under **Table Editor** with RLS enabled.

## 3. Google OAuth — Google Cloud side
1. In the Google Cloud Console, create an **OAuth 2.0 Client ID** of type
   **Web application**.
2. **Authorized JavaScript origins:** add `http://localhost:5173`,
   `http://localhost:5174`, and `https://post-listner.vercel.app`.
3. **Authorized redirect URIs:** add the Supabase callback —
   `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Save; copy the **Client ID** and **Client Secret**.

## 4. Google OAuth — Supabase side
1. Supabase Dashboard → **Authentication → Providers → Google**.
2. Enable it; paste the Client ID and Client Secret; save.
3. **Authentication → URL Configuration → Redirect URLs:** add
   `http://localhost:5173/journal`, `http://localhost:5174/journal`, and
   `https://post-listner.vercel.app/journal` (the `redirectTo` allow list).

## 5. Local env
Add to `.env.local` (gitignored):

    VITE_SUPABASE_URL=https://<project-ref>.supabase.co
    VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>

Restart `npm run dev` after editing `.env.local`.

## 6. Production env
Add the same two variables to the Vercel project (**Settings → Environment
Variables**, Production environment), then redeploy.
```

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql docs/supabase-setup.md
git commit -m "feat(desktop): add entries schema + Supabase setup doc"
```

---

## Task 3: Entry-format helpers (TDD)

**Files:**
- Create: `src/lib/entryFormat.js`
- Test: `src/lib/__tests__/entryFormat.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/entryFormat.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  timeOfDay,
  mockDateToIso,
  formatEntryDate,
  normalizeEntries,
  loadMockEntries,
} from '../entryFormat'

describe('timeOfDay', () => {
  it('buckets an hour into a part of the day', () => {
    expect(timeOfDay(8)).toBe('morning')
    expect(timeOfDay(14)).toBe('afternoon')
    expect(timeOfDay(19)).toBe('evening')
    expect(timeOfDay(23)).toBe('night')
    expect(timeOfDay(2)).toBe('night')
  })
})

describe('mockDateToIso / formatEntryDate', () => {
  it('round-trips every part of the day', () => {
    for (const s of [
      'may 21 · evening',
      'apr 02 · night',
      'mar 03 · morning',
      'jun 15 · afternoon',
    ]) {
      expect(formatEntryDate(mockDateToIso(s))).toBe(s)
    }
  })

  it('produces a valid UTC ISO timestamp in 2026', () => {
    expect(mockDateToIso('may 21 · evening')).toBe('2026-05-21T19:00:00.000Z')
  })
})

describe('normalizeEntries', () => {
  it('assigns seq (oldest=1, newest=n) and a display date', () => {
    const rows = [
      { id: 'b', created_at: '2026-05-21T19:00:00.000Z', summary: 'newer', song: null, glyph: null },
      { id: 'a', created_at: '2026-03-03T08:00:00.000Z', summary: 'older', song: null, glyph: null },
    ]
    const out = normalizeEntries(rows)
    expect(out[0]).toMatchObject({ id: 'b', seq: 2, date: 'may 21 · evening' })
    expect(out[1]).toMatchObject({ id: 'a', seq: 1, date: 'mar 03 · morning' })
  })
})

describe('loadMockEntries', () => {
  it('returns the 10 bundled mock entries, normalised, newest first', () => {
    const out = loadMockEntries()
    expect(out).toHaveLength(10)
    expect(out[0].seq).toBe(10)
    expect(out[9].seq).toBe(1)
    expect(out[0].date).toBe('may 21 · evening')
    expect(out[9].summary).toBe('where the record begins')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/entryFormat.test.js`
Expected: FAIL — `Failed to resolve import "../entryFormat"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/entryFormat.js`:

```js
import { MOCK_ENTRIES } from '../journal/mockEntries'

/**
 * entryFormat — pure helpers that translate between stored entry rows and
 * the shape the journal renders.
 *
 * A stored row has an ISO `created_at`; the journal wants a display `date`
 * ('may 21 · evening') and a chronological `seq` (oldest = 1) for the roman
 * numeral, glyph seed and wash seed. All date maths is UTC so it is
 * timezone-independent — `mockDateToIso` and `formatEntryDate` round-trip.
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// representative hour for each part of day — the inverse of timeOfDay()
const PART_HOUR = { morning: 8, afternoon: 14, evening: 19, night: 22 }

/** Bucket an hour (0–23) into a part of the day. */
export function timeOfDay(hour) {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

/** 'may 21 · evening' -> ISO timestamp (UTC, year 2026). */
export function mockDateToIso(dateStr) {
  const [mon, dayStr, , part] = dateStr.trim().split(/\s+/)
  const month = MONTHS.indexOf(mon.toLowerCase())
  const day = parseInt(dayStr, 10)
  const hour = PART_HOUR[part] ?? 12
  return new Date(Date.UTC(2026, month, day, hour, 0, 0)).toISOString()
}

/** ISO timestamp -> 'may 21 · evening' display string. */
export function formatEntryDate(iso) {
  const d = new Date(iso)
  const mon = MONTHS[d.getUTCMonth()]
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${mon} ${day} · ${timeOfDay(d.getUTCHours())}`
}

/**
 * Supabase rows (already newest-first) -> journal entries.
 * `seq` is the chronological position — 1 is the oldest, n the newest.
 */
export function normalizeEntries(rows) {
  const n = rows.length
  return rows.map((r, i) => ({
    id: String(r.id),
    seq: n - i,
    date: formatEntryDate(r.created_at),
    summary: r.summary,
    song: r.song ?? null,
    glyph: r.glyph ?? null,
  }))
}

/** The bundled mock entries, normalised — the no-backend dev fallback. */
export function loadMockEntries() {
  return normalizeEntries(
    MOCK_ENTRIES.map((e) => ({
      id: e.id,
      created_at: mockDateToIso(e.date),
      summary: e.summary,
      song: null,
      glyph: null,
    })),
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/entryFormat.test.js`
Expected: PASS — 4 test files' worth of `describe` blocks, all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/entryFormat.js src/lib/__tests__/entryFormat.test.js
git commit -m "feat(desktop): add entry-format helpers with tests"
```

---

## Task 4: Entries repository

**Files:**
- Create: `src/lib/entriesRepo.js`

- [ ] **Step 1: Write the repository**

Create `src/lib/entriesRepo.js`:

```js
import { supabase } from './supabaseClient'
import { normalizeEntries, mockDateToIso } from './entryFormat'
import { MOCK_ENTRIES } from '../journal/mockEntries'

/**
 * entriesRepo — Supabase IO for journal entries.
 *
 * The pure shaping lives in entryFormat.js; this file is the thin data layer.
 * Every function is null-safe: with no Supabase client it degrades quietly so
 * the no-backend dev fallback never throws.
 */

/** Fetch one user's entries, newest-first, normalised for the journal. */
export async function fetchEntries(userId) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('entries')
    .select('id, created_at, song, summary, glyph')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[entriesRepo] fetch failed:', error.message)
    return []
  }
  return normalizeEntries(data || [])
}

/**
 * Dev helper — populate a signed-in account with the 10 bundled mock entries
 * so the returning-journal flow is testable before the rite writes real
 * entries (slice 3). Exposed only via the FirstTimer dev affordance.
 */
export async function seedSampleEntries(userId) {
  if (!supabase) return
  const rows = MOCK_ENTRIES.map((e) => ({
    user_id: userId,
    created_at: mockDateToIso(e.date),
    summary: e.summary,
    song: null,
  }))
  const { error } = await supabase.from('entries').insert(rows)
  if (error) console.error('[entriesRepo] seed failed:', error.message)
}
```

- [ ] **Step 2: Verify lint + build**

Run: `npx eslint src/lib/entriesRepo.js && npm run build`
Expected: no lint errors; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/entriesRepo.js
git commit -m "feat(desktop): add entries repository"
```

---

## Task 5: useAuth hook

**Files:**
- Create: `src/hooks/useAuth.js`

- [ ] **Step 1: Write the hook**

Create `src/hooks/useAuth.js`:

```js
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * useAuth — Supabase auth state for the desktop.
 *
 * Loads the current session, subscribes to auth changes, and exposes Google
 * sign-in / sign-out. With no Supabase client it resolves immediately to a
 * signed-out, not-loading state so the desktop can fall back to the dev
 * journal. Google OAuth uses the PKCE redirect flow — the client picks the
 * session back up via detectSessionInUrl on return to /journal.
 */
export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/journal` },
    })
    if (error) console.error('[useAuth] Google sign-in failed:', error.message)
  }, [])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
  }, [])

  return {
    session,
    user: session?.user ?? null,
    loading,
    signInWithGoogle,
    signOut,
  }
}
```

- [ ] **Step 2: Verify lint + build**

Run: `npx eslint src/hooks/useAuth.js && npm run build`
Expected: no lint errors; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAuth.js
git commit -m "feat(desktop): add useAuth hook (Supabase Google OAuth)"
```

---

## Task 6: SignIn screen

**Files:**
- Create: `src/desktop/SignIn.jsx`

- [ ] **Step 1: Write the component**

Create `src/desktop/SignIn.jsx`:

```jsx
import { useState } from 'react'

/**
 * SignIn — the desktop's signed-out screen.
 *
 * Cream-paper aesthetic. One honest line about what the journal is, then a
 * single Google sign-in — no password, no signup wall (design doc §2: a wall
 * must never precede a first session).
 */

const PAPER = '#F2EBD8'
const INK = '#1C1814'

function GoogleG() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  )
}

export default function SignIn({ onSignIn }) {
  const [busy, setBusy] = useState(false)
  const handle = () => {
    setBusy(true)
    onSignIn()
  }
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: PAPER,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          font: 'italic 44px Palatino, "Palatino Linotype", Georgia, serif',
          color: INK,
          letterSpacing: '0.03em',
        }}
      >
        the journal
      </div>
      <div
        style={{
          font: 'italic 18px Palatino, Georgia, serif',
          color: 'rgba(28,24,20,0.55)',
          marginTop: 18,
          maxWidth: 420,
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        a record of who you were, and who you are becoming
      </div>
      <button
        onClick={handle}
        disabled={busy}
        style={{
          marginTop: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          background: '#fff',
          border: '1px solid rgba(28,24,20,0.22)',
          borderRadius: 3,
          padding: '12px 22px',
          cursor: busy ? 'default' : 'pointer',
          font: '500 14px Palatino, Georgia, serif',
          color: INK,
          opacity: busy ? 0.55 : 1,
        }}
      >
        <GoogleG />
        {busy ? 'opening Google…' : 'continue with Google'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify lint + build**

Run: `npx eslint src/desktop/SignIn.jsx && npm run build`
Expected: no lint errors; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/desktop/SignIn.jsx
git commit -m "feat(desktop): add SignIn screen"
```

---

## Task 7: FirstTimer screen

**Files:**
- Create: `src/desktop/FirstTimer.jsx`

- [ ] **Step 1: Write the component**

Create `src/desktop/FirstTimer.jsx`:

```jsx
import { useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { generateSessionId } from '../lib/sessionId'

/**
 * FirstTimer — the desktop's signed-in, zero-entries screen (design doc §3).
 *
 * No empty journal is ever shown. Instead: one honest line naming the
 * promise, and the QR to begin the first session on the phone. The QR
 * encodes the same `?s=<id>` session-join URL the Stage pairing screen uses.
 */

const PAPER = '#F2EBD8'
const INK = '#1C1814'

export default function FirstTimer({ onSignOut, onSeed }) {
  const sessionId = useMemo(() => generateSessionId(), [])
  const joinUrl = `${window.location.origin}/?s=${sessionId}`
  const isDev = import.meta.env.DEV

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: PAPER,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          font: 'italic 26px Palatino, "Palatino Linotype", Georgia, serif',
          color: INK,
          maxWidth: 500,
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        Each session leaves one mark. In time, this becomes the trace of you.
      </div>
      <div
        style={{
          marginTop: 42,
          padding: 18,
          background: '#fff',
          border: '1px solid rgba(28,24,20,0.14)',
          borderRadius: 4,
        }}
      >
        <QRCodeSVG value={joinUrl} size={172} fgColor={INK} bgColor="#fff" level="M" />
      </div>
      <div
        style={{
          marginTop: 20,
          font: '300 12px ui-monospace, SFMono-Regular, monospace',
          letterSpacing: '0.26em',
          textTransform: 'uppercase',
          color: 'rgba(28,24,20,0.5)',
        }}
      >
        scan with your phone to begin
      </div>
      <button
        onClick={onSignOut}
        style={{
          position: 'fixed',
          top: 22,
          right: 26,
          background: 'none',
          border: 'none',
          font: 'italic 13px Palatino, Georgia, serif',
          color: 'rgba(28,24,20,0.4)',
          cursor: 'pointer',
        }}
      >
        sign out
      </button>
      {isDev && (
        <button
          onClick={onSeed}
          style={{
            position: 'fixed',
            bottom: 20,
            right: 26,
            background: 'none',
            border: 'none',
            font: 'italic 12px Palatino, Georgia, serif',
            color: 'rgba(28,24,20,0.3)',
            cursor: 'pointer',
          }}
        >
          seed sample entries (dev)
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify lint + build**

Run: `npx eslint src/desktop/FirstTimer.jsx && npm run build`
Expected: no lint errors; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/desktop/FirstTimer.jsx
git commit -m "feat(desktop): add FirstTimer screen with QR"
```

---

## Task 8: Desktop orchestrator

**Files:**
- Create: `src/desktop/Desktop.jsx`

Note: this task imports `Journal` and passes it an `entries` prop the current
`Journal` does not yet read — React ignores unknown props, so `Desktop`
renders the mock journal until Task 9 wires the prop. `Desktop` is created
but not yet routed; nothing in the app changes at this commit.

- [ ] **Step 1: Write the orchestrator**

Create `src/desktop/Desktop.jsx`:

```jsx
import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { fetchEntries, seedSampleEntries } from '../lib/entriesRepo'
import { loadMockEntries } from '../lib/entryFormat'
import Journal from '../journal/Journal'
import SignIn from './SignIn'
import FirstTimer from './FirstTimer'

/**
 * Desktop — the auth-gated desktop journal (design doc §2).
 *
 * Resolves to one of four states: a quiet loading card, the SignIn screen,
 * the FirstTimer screen (signed in, zero entries), or the Journal (signed in,
 * one or more entries). With no Supabase configured it falls straight through
 * to a no-auth dev journal on mock data, so /journal always renders.
 */

const PAPER = '#F2EBD8'

function DesktopLoading() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: PAPER,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: 'italic 18px Palatino, Georgia, serif',
        color: 'rgba(28,24,20,0.4)',
      }}
    >
      a moment…
    </div>
  )
}

export default function Desktop() {
  const { user, loading, signInWithGoogle, signOut } = useAuth()
  const [entries, setEntries] = useState(null) // null = not yet loaded
  const [entriesLoading, setEntriesLoading] = useState(false)

  const reload = useCallback(async (uid) => {
    setEntriesLoading(true)
    setEntries(await fetchEntries(uid))
    setEntriesLoading(false)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    if (user) reload(user.id)
    else setEntries(null)
  }, [user, reload])

  // no backend configured — browse the journal on mock data, no auth
  if (!isSupabaseConfigured) {
    return <Journal entries={loadMockEntries()} />
  }
  if (loading) return <DesktopLoading />
  if (!user) return <SignIn onSignIn={signInWithGoogle} />
  if (entries === null || entriesLoading) return <DesktopLoading />
  if (entries.length === 0) {
    return (
      <FirstTimer
        onSignOut={signOut}
        onSeed={async () => {
          await seedSampleEntries(user.id)
          await reload(user.id)
        }}
      />
    )
  }
  return <Journal entries={entries} onSignOut={signOut} />
}
```

All hooks (`useAuth`, `useState` ×2, `useCallback`, `useEffect`) run unconditionally before any `return` — the early returns below them are render branches, not conditional hooks.

- [ ] **Step 2: Verify lint + build**

Run: `npx eslint src/desktop/Desktop.jsx && npm run build`
Expected: no lint errors (in particular no `react-hooks/rules-of-hooks`); build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/desktop/Desktop.jsx
git commit -m "feat(desktop): add auth-gated Desktop orchestrator"
```

---

## Task 9: Journal reads entries; route /journal → Desktop

**Files:**
- Modify: `src/journal/Journal.jsx`
- Modify: `src/journal/EntryPage.jsx`
- Modify: `src/main.jsx`

- [ ] **Step 1: EntryPage — key visuals off `entry.seq`**

In `src/journal/EntryPage.jsx`, change the three `entry.id` reads to `entry.seq` (the chronological position; `id` is now a string uuid).

Change the wash memo:

```jsx
  const wash = useMemo(() => (entry ? washBackground(entry.seq) : ''), [entry])
```

Change the glyph:

```jsx
        <Glyph seed={entry.seq} />
```

Change the roman numeral line:

```jsx
          {roman(entry.seq)}.
```

- [ ] **Step 2: Journal — accept an `entries` prop**

In `src/journal/Journal.jsx`, remove the mock import:

```jsx
// DELETE this line:
import { MOCK_ENTRIES } from './mockEntries'
```

Change the component signature and derive everything from the prop:

```jsx
export default function Journal({ entries, onSignOut }) {
  const [view, setView] = useState('landing')
  const [index, setIndex] = useState(0)
  const [pageVisible, setPageVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  const bookRef = useRef({
    clipPos: 0,
    camPos: CAM_LANDING.clone(),
    camTgt: TGT_LANDING.clone(),
  })
  const veilRef = useRef({ opacity: 0 })
  const transRef = useRef(null)

  const maxIndex = entries.length - 1

  // the span of the record — a quiet temporal frame for the landing
  const span = useMemo(() => {
    const newest = monthOf(entries[0].date)
    const oldest = monthOf(entries[entries.length - 1].date)
    return `${MONTH_FULL[oldest] || oldest} – ${MONTH_FULL[newest] || newest}`
  }, [entries])
```

- [ ] **Step 3: Journal — carry the first index through the open transition**

The rAF loop runs inside a `useEffect([])`; instead of closing over `entries`,
the `open` transition carries the first index it should land on.

Change the `open` callback:

```jsx
  const open = useCallback(() => {
    if (transRef.current) return
    setBusy(true)
    // open on the first entry — the oldest sits at the last array index
    transRef.current = {
      kind: 'open',
      start: performance.now(),
      firstIndex: entries.length - 1,
    }
  }, [entries.length])
```

In the rAF loop's `open` branch, replace the `setIndex` call:

```jsx
          if (t >= 0.8 && !tr.showPage) {
            tr.showPage = true
            setIndex(tr.firstIndex)
            setPageVisible(true)
          }
```

- [ ] **Step 4: Journal — render from the prop**

Replace the entry-page render:

```jsx
      {pageVisible && <EntryPage entry={entries[index]} />}
```

Replace the chapter-index render:

```jsx
      {!busy && view === 'page' && (
        <ChapterIndex entries={entries} currentIndex={index} onJump={jumpTo} />
      )}
```

Replace the counter span text:

```jsx
            {entries.length - index} of {entries.length}
```

- [ ] **Step 5: Journal — add the sign-out control**

Immediately after the opening `<div ...>` of the returned JSX (right before
the `<style>` tag), add the sign-out affordance — faint, corner, only when
`onSignOut` is supplied (the returning, real-data mode):

```jsx
      {onSignOut && (
        <button
          onClick={onSignOut}
          style={{
            position: 'absolute',
            top: 20,
            right: 24,
            zIndex: 5,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            font: 'italic 13px Palatino, Georgia, serif',
            color: view === 'landing' ? 'rgba(231,222,198,0.4)' : 'rgba(28,24,20,0.4)',
          }}
        >
          sign out
        </button>
      )}
```

- [ ] **Step 6: main.jsx — route /journal to Desktop**

In `src/main.jsx`, swap the `/journal` route's component:

```jsx
// change the import:
import Desktop from './desktop/Desktop.jsx'
// (remove the `import Journal from './journal/Journal.jsx'` line)

const ROUTES = {
  '/conduct': ConductorView,
  '/conduct-codex': ConductCodex,
  '/conduct-glb': ConductGlb,
  '/journal': Desktop,
  '/cloud-test': CloudTest,
}
```

- [ ] **Step 7: Verify lint, build, and tests**

Run: `npm run lint && npm run build && npm test`
Expected: lint clean, build succeeds, all tests pass (265 existing + the new `entryFormat` tests).

- [ ] **Step 8: Verify the dev fallback in the browser**

Run `npm run dev`, open `/journal` (note the dev port — 5173 or 5174).
Expected: with no Supabase env set, the journal renders on mock data exactly
as before — landing screen, "open the journal", page-through, the chapter
rail, "1 of 10" counter. No sign-out control is shown (dev fallback).

- [ ] **Step 9: Commit**

```bash
git add src/journal/Journal.jsx src/journal/EntryPage.jsx src/main.jsx
git commit -m "feat(desktop): journal reads entries via prop; route /journal to Desktop"
```

---

## Task 10: Docs + end-to-end verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the env vars to CLAUDE.md**

In `CLAUDE.md`, in the `## Environment` table, add two rows:

```markdown
| `VITE_SUPABASE_URL` | Runtime (`supabaseClient.js`) | Desktop journal accounts + entries |
| `VITE_SUPABASE_ANON_KEY` | Runtime (`supabaseClient.js`) | Desktop journal accounts + entries |
```

- [ ] **Step 2: Add a desktop-journal section to CLAUDE.md**

In `CLAUDE.md`, after the `### QR-paired desktop canvas` section, add:

```markdown
### Desktop journal (slice 2 — accounts + backend)

The `/journal` route is the **auth-gated desktop journal**. `src/desktop/Desktop.jsx`
is the orchestrator: `useAuth` (Supabase Google OAuth) gates between `SignIn`,
`FirstTimer` (signed in, zero entries — QR only), and the `Journal` (one or
more entries). Entries live in one Supabase `entries` table behind RLS
(`supabase/schema.sql`); `src/lib/entriesRepo.js` is the data layer and
`src/lib/entryFormat.js` the pure shaping (tested). With no Supabase env set,
`Desktop` falls back to a no-auth journal on mock data. Backend setup:
`docs/supabase-setup.md`. The original `Stage` root + phone-rite/QR-pairing
flow are unchanged.
```

- [ ] **Step 3: Commit the docs**

```bash
git add CLAUDE.md
git commit -m "docs: document the desktop journal accounts + backend"
```

- [ ] **Step 4: End-to-end verification (requires the Prerequisites done)**

Once `docs/supabase-setup.md` has been followed and `.env.local` has the two
`VITE_SUPABASE_*` vars, restart `npm run dev` and verify the full flow:

1. Open `/journal` → the **SignIn** screen ("the journal" + "continue with Google").
2. Click **continue with Google** → Google's consent screen → redirect back to `/journal`.
3. First sign-in (zero entries) → the **FirstTimer** screen: the promise line + the QR + "scan with your phone to begin".
4. Click **seed sample entries (dev)** → the screen becomes the **Journal** with the 10 seeded entries; "open the journal" → opens on "1 of 10".
5. Reload `/journal` → still signed in, lands straight on the Journal (returning).
6. Click **sign out** (top-right) → back to the SignIn screen.

Expected: each step behaves as described; the browser console shows no errors.

---

## Self-Review

**Spec coverage (design doc §12, slice 2 — "Desktop sign-in; backend with accounts + entries; first-timer vs. returning routing; the book reads the signed-in user's real entries"):**
- Desktop sign-in — Task 5 (`useAuth`, Google OAuth) + Task 6 (`SignIn`). ✓
- Backend with accounts + entries — Task 1 (client) + Task 2 (`entries` table, RLS; accounts are Supabase Auth's `auth.users`). ✓
- First-timer vs. returning routing — Task 8 (`Desktop` orchestrator: SignIn / FirstTimer / Journal). ✓
- Book reads the user's real entries — Task 4 (`fetchEntries`) + Task 9 (`Journal` `entries` prop). ✓
- First-timer = "QR only + one line" (design doc §3) — Task 7 (`FirstTimer`: the verbatim promise line + QR). ✓

**Deliberately scoped out of slice 2 (belongs to slice 3 "close the loop"):** the returning journal's "begin again" QR, relaying `song`/`summary` from the phone, recording the glyph, and writing a real entry at settle. The seeded-entries dev affordance stands in for real entries so the returning flow is testable now. The full `main.jsx` root swap (`Stage` → `Desktop` with the live-rite mirror folded in) also stays out — `Stage` and the QR-pairing rite are untouched; the desktop journal lives on `/journal`.

**Placeholder scan:** no `TBD`/`TODO`/"handle edge cases"/"similar to Task N" — every step carries its full code. The one allowed not-implemented item, `glyph`/`song` on seeded entries, is explicitly `null` with a comment, not a placeholder.

**Type consistency:** the normalised entry shape `{ id, seq, date, summary, song, glyph }` is produced by `normalizeEntries` (Task 3) and consumed by `Journal`/`EntryPage` (Task 9) and `ChapterIndex` (`entry.date`, unchanged). `fetchEntries`/`loadMockEntries` both return that shape. `useAuth` returns `{ session, user, loading, signInWithGoogle, signOut }` — consumed by `Desktop` with matching names. `Desktop` passes `entries`/`onSignOut` to `Journal`, `onSignIn` to `SignIn`, `onSignOut`/`onSeed` to `FirstTimer` — all matching each component's props. `seedSampleEntries`/`fetchEntries` names match between `entriesRepo.js` and `Desktop.jsx`. Consistent.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-21-desktop-journal-slice-2-accounts-backend.md`.**
