import { useState, useEffect } from 'react'

export function useInputMode() {
  const [inputMode, setInputMode] = useState(() => {
    if (typeof window === 'undefined') return 'touch'
    return window.matchMedia('(pointer: fine)').matches ? 'mouse' : 'touch'
  })

  useEffect(() => {
    const handler = (e) => {
      const mode = e.pointerType === 'touch' ? 'touch' : 'mouse'
      setInputMode(mode)
    }

    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [])

  return inputMode
}
