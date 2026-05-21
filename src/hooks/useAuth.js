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
  // loading is true only while there is a session to load — with no Supabase
  // client there is nothing to wait for, so it starts false.
  const [loading, setLoading] = useState(() => Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
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
    if (error) {
      // surface failure so the caller can recover its UI — on success the
      // browser has already redirected to Google and this never returns
      console.error('[useAuth] Google sign-in failed:', error.message)
      throw error
    }
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
