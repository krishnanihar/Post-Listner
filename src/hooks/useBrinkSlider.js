// src/hooks/useBrinkSlider.js
// The shared brink-slider state machine behind the leanLift and listen beats.
// Both beats are the same interaction on different axes: a tilt-driven slider
// that runs a FEW sub-rounds in a row, each committing on the same outward
// brink-crossing and then "re-poling in place" — the cursor slides home, locks
// for LOCK_MS, returns to center, and the next round arms. Only the LAST round
// advances the beat. The two beats differ ONLY in which live axis they read
// (leanLift = 'pan' from roll, listen = 'filterNorm' from pitch) and their
// horizontal-vs-vertical rendering; the machine below is byte-identical.
//
// `live` = the score hook's liveRef; `axisKey` names the field on live.current
// (0..1) this beat drives. onCommit(axisValue, subIndex) writes that sub-round's
// read; onAdvance fires once `committed` flips (last round only). roundsLength is
// the sub-round count. Returns the render state the overlay draws from.
import { useEffect, useRef, useState } from 'react'
import { isBrinkCrossing } from '../lib/leanCommit.js'

export const LOCK_MS = 520 // how long the cursor holds at the pole before re-poling
// Generous backstop: if the brink is never crossed (orientation permission
// denied on iOS, a no-sensor device, or a listener who simply never leans), the
// beat force-commits its last sub-round so the beat can never dead-end the arc.
export const SAFETY_MS = 20000

export function useBrinkSlider({ live, axisKey, onCommit, onAdvance, committed, roundsLength }) {
  const [subIndex, setSubIndex] = useState(0)
  const [rb, setRb] = useState(0)
  const [fired, setFired] = useState(false)   // lock flash for the current round
  const [side, setSide] = useState(0)

  const subIndexRef = useRef(0)
  const phaseRef = useRef('leaning')          // 'leaning' | 'locking' | 'done'
  const initRef = useRef(false)
  const prevBRef = useRef(0)
  const sideRef = useRef(0)
  const rbRef = useRef(0)
  const lockStartRef = useRef(0)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const v = live.current[axisKey]
      const b = (v - 0.5) * 2
      if (phaseRef.current === 'leaning') {
        if (!initRef.current) {
          // First frame of this round: seed prevB without testing (a resting
          // tilt — or the lock position carried in — can't auto-commit).
          initRef.current = true
        } else if (isBrinkCrossing({ b, prevB: prevBRef.current })) {
          sideRef.current = Math.sign(b)
          setSide(Math.sign(b))
          setFired(true)
          onCommit(v, subIndexRef.current)
          phaseRef.current = 'locking'
          lockStartRef.current = performance.now()
        }
        prevBRef.current = b
        rbRef.current = b
        setRb(b)
      } else if (phaseRef.current === 'locking') {
        // Slide the cursor home to the chosen pole and hold.
        const target = sideRef.current || 0
        rbRef.current += (target - rbRef.current) * 0.18
        setRb(rbRef.current)
        if (performance.now() - lockStartRef.current > LOCK_MS) {
          if (subIndexRef.current >= roundsLength - 1) {
            phaseRef.current = 'done' // last round — committed prop drives advance
          } else {
            // Re-pole: next sub-round, cursor back to center, detector re-armed.
            subIndexRef.current += 1
            setSubIndex(subIndexRef.current)
            initRef.current = false
            prevBRef.current = 0
            rbRef.current = 0
            sideRef.current = 0
            setRb(0)
            setSide(0)
            setFired(false)
            phaseRef.current = 'leaning'
          }
        }
      }
      if (phaseRef.current !== 'done') raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [live, axisKey, onCommit, roundsLength])

  useEffect(() => {
    if (!committed) return undefined
    const t = setTimeout(onAdvance, 1100)
    return () => clearTimeout(t)
  }, [committed, onAdvance])

  // Safety net — mirrors Rise/Face. If no brink-crossing ever commits this beat
  // (orientation permission denied, or a device with no sensors), force-commit
  // the last sub-round with the current read after a generous delay, so the
  // gesture-gated beat can never permanently stall the whole experience.
  useEffect(() => {
    const t = setTimeout(() => {
      if (phaseRef.current === 'done') return
      phaseRef.current = 'done'
      setFired(true)
      onCommit(live.current[axisKey], roundsLength - 1)
    }, SAFETY_MS)
    return () => clearTimeout(t)
  }, [live, axisKey, onCommit, roundsLength])

  return { subIndex, rb, fired, side }
}
