// src/phases/attunement/Listen.jsx
// The still tap beat. Plays N fragments seated in front; the user taps yes/no.
// Reuses FragmentControls (the existing playing-indicator + Yes/No buttons).
// The host supplies playFragment(fragment)->Promise<'yes'|'no'|'none'> and the
// fragment list; this component just sequences a small set and advances.
import { useEffect, useRef, useState } from 'react'
import FragmentControls from '../FragmentControls'

export default function Listen({ fragments, playFragment, onAdvance }) {
  const [playing, setPlaying] = useState(false)
  const [awaiting, setAwaiting] = useState(false)
  const rateRef = useRef(null)
  const idxRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      for (idxRef.current = 0; idxRef.current < fragments.length; idxRef.current++) {
        if (cancelled) return
        setPlaying(true); setAwaiting(false)
        try {
          await playFragment(fragments[idxRef.current], {
            onAwaitRating: () => { setPlaying(false); setAwaiting(true) },
            getRater: (fn) => { rateRef.current = fn },
          })
        } catch { /* a fragment failed to play — skip it and continue the run */ }
      }
      if (!cancelled) onAdvance()
    }
    run()
    return () => { cancelled = true }
  }, [fragments, playFragment, onAdvance])

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <FragmentControls
        fragmentPlaying={playing}
        showButtons={awaiting}
        onRate={(ans) => rateRef.current?.(ans)}
      />
    </div>
  )
}
