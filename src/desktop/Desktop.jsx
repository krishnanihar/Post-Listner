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
 *
 * Entries are held tagged with the user id they were loaded for (`loaded.uid`).
 * The render derives "still loading" by comparing that tag to the current
 * user — so the fetch effect only ever setStates inside its async callback,
 * never synchronously, and a previous user's entries can never flash.
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
  const [loaded, setLoaded] = useState({ uid: null, entries: null })

  // refetch for the current user — used after seeding; called from an event
  // handler, never from an effect
  const load = useCallback(async (uid) => {
    setLoaded({ uid, entries: await fetchEntries(uid) })
  }, [])

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
    return <Journal entries={loadMockEntries()} />
  }
  if (loading) return <DesktopLoading />
  if (!user) return <SignIn onSignIn={signInWithGoogle} />

  // entries are ready only once they have been loaded for the current user
  const entries = loaded.uid === user.id ? loaded.entries : null
  if (entries === null) return <DesktopLoading />
  if (entries.length === 0) {
    return (
      <FirstTimer
        onSignOut={signOut}
        onSeed={async () => {
          await seedSampleEntries(user.id)
          await load(user.id)
        }}
      />
    )
  }
  return <Journal entries={entries} onSignOut={signOut} />
}
