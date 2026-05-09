import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import Paper from '../score/Paper'
import { COLORS, FONTS } from '../score/tokens'
import { getArchetype } from '../lib/archetypes'

/**
 * Orchestra v3 closing card.
 *
 * Replaces the v2 Return phase. Holds for `durationMs` showing the
 * archetype's last Forer sentence on cream paper, then auto-advances
 * via `onComplete` (Orchestra.jsx routes back to entry).
 *
 * Per the brief: peak-end rule says the last impression dominates the
 * memory; the Forer line ties the experience back to the Mirror beat.
 */
export default function ClosingCard({ archetypeId, durationMs = 7000, onComplete }) {
  const completedRef = useRef(false)

  useEffect(() => {
    const id = setTimeout(() => {
      if (completedRef.current) return
      completedRef.current = true
      onComplete?.()
    }, durationMs)
    return () => clearTimeout(id)
  }, [durationMs, onComplete])

  const archetype = archetypeId ? getArchetype(archetypeId) : null
  // Last sentence of the Forer template (the unfalsifiable image / mild
  // challenge per Furnham & Schofield 1987 recipe).
  const line = archetype?.forerTemplate?.[archetype.forerTemplate.length - 1] || 'You were here.'

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Paper variant="cream">
        <motion.div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 36px',
            textAlign: 'center',
            fontFamily: FONTS.serif,
            fontStyle: 'italic',
            fontSize: 22,
            lineHeight: 1.45,
            color: COLORS.inkCream,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 1, 0] }}
          transition={{
            duration: durationMs / 1000,
            times: [0, 0.18, 0.5, 0.82, 1],
            ease: 'easeInOut',
          }}
        >
          {line}
        </motion.div>
      </Paper>
    </div>
  )
}
