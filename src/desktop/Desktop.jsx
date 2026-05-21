import { useCallback, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useRiteSession } from '../hooks/useRiteSession'
import { fetchEntries, seedSampleEntries } from '../lib/entriesRepo'
import { loadMockEntries } from '../lib/entryFormat'
import { deriveHand } from '../lib/glyph'
import Journal from '../journal/Journal'
import StageCosmos from '../phases/StageCosmos'
import SignIn from './SignIn'
import FirstTimer from './FirstTimer'

/**
 * Desktop — the desktop root (design doc §2; spec §5).
 *
 * Auth-gates between SignIn, FirstTimer (signed in, zero entries) and the
 * Journal. While a paired phone runs a rite the desktop is the live mirror;
 * when the phone relays its entry at settle, useRiteSession writes the row
 * and the Journal reopens turned to the new page. With no Supabase configured
 * it falls through to a no-auth journal on mock data.
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

/**
 * RiteMirror — what the desktop shows while a paired phone runs the rite.
 * Pre-Orchestra: a calm "in the rite" card. Orchestra: the cosmos canvas
 * driven by the phone's relayed gesture + audio.
 */
function RiteMirror({ stage, sessionId, latestFreq }) {
  if (stage === 'orchestra') {
    return (
      <div style={{ position: 'fixed', inset: 0 }}>
        <StageCosmos sessionId={sessionId} latestFreq={latestFreq} />
      </div>
    )
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
      <style>{`@keyframes ritepulse{0%,100%{opacity:.3}50%{opacity:.85}}`}</style>
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#1C1814',
          marginBottom: 24,
          animation: 'ritepulse 4s ease-in-out infinite',
        }}
      />
      <div
        style={{
          font: 'italic 22px Palatino, Georgia, serif',
          color: '#1C1814',
          opacity: 0.7,
        }}
      >
        your conductor is in the rite
      </div>
    </div>
  )
}

export default function Desktop() {
  const { user, loading, signInWithGoogle, signOut } = useAuth()
  const [loaded, setLoaded] = useState({ uid: null, entries: null })
  // true while the post-settle refetch is in flight — holds the loading card
  // so the pre-rite view never flashes between settle and the new page
  const [awaitingSettle, setAwaitingSettle] = useState(false)

  // refetch for the current user — used after seeding and after a rite
  // settles; called from callbacks, never synchronously in render
  const load = useCallback(async (uid) => {
    setLoaded({ uid, entries: await fetchEntries(uid) })
  }, [])

  // the relay viewer + rite state machine. Writes the journal row when the
  // phone relays its entry at settle, then refetches via onEntryWritten.
  const { sessionId, riteStage, latestFreq, newEntryId } = useRiteSession({
    userId: user?.id ?? null,
    onEntryWritten: async () => {
      if (!user) return
      setAwaitingSettle(true)
      await load(user.id)
      setAwaitingSettle(false)
    },
  })

  // the per-account "hand" — a stable glyph render style across all of one
  // user's entries (design doc §8)
  const handStyle = useMemo(() => deriveHand(user?.id || 'mock'), [user])

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return
    let active = true
    fetchEntries(user.id).then((e) => {
      if (active) setLoaded({ uid: user.id, entries: e })
    })
    return () => {
      active = false
    }
  }, [user])

  // no backend configured — browse the journal on mock data, no auth
  if (!isSupabaseConfigured) {
    return <Journal entries={loadMockEntries()} handStyle={handStyle} sessionId={sessionId} />
  }
  if (loading) return <DesktopLoading />
  if (!user) return <SignIn onSignIn={signInWithGoogle} />

  // a paired phone is mid-rite — the desktop is the live mirror
  if (riteStage === 'rite' || riteStage === 'orchestra') {
    return <RiteMirror stage={riteStage} sessionId={sessionId} latestFreq={latestFreq} />
  }

  // the entry is being written ('settling') or the post-write refetch is in
  // flight ('awaitingSettle') — hold the loading card so the pre-rite view
  // never flashes. On a write failure useRiteSession reverts to 'idle' and we
  // fall through; on a refetch that returns nothing we land on FirstTimer —
  // either way the desktop recovers and never spins forever.
  if (riteStage === 'settling' || awaitingSettle) {
    return <DesktopLoading />
  }

  // entries are ready only once they have been loaded for the current user
  const entries = loaded.uid === user.id ? loaded.entries : null
  if (entries === null) return <DesktopLoading />
  if (entries.length === 0) {
    return (
      <FirstTimer
        sessionId={sessionId}
        onSignOut={signOut}
        onSeed={async () => {
          await seedSampleEntries(user.id)
          await load(user.id)
        }}
      />
    )
  }
  return (
    <Journal
      entries={entries}
      onSignOut={signOut}
      sessionId={sessionId}
      handStyle={handStyle}
      newEntryId={riteStage === 'settled' ? newEntryId : null}
    />
  )
}
