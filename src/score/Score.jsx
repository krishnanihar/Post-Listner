import React from 'react'
import Paper from './Paper'
import Stave from './Stave'
import { ALL_MARKS } from './marks'
import { COLORS, FONTS } from './tokens'

export default function Score({
  variant = 'cream',
  pageTitle,
  pageNumber,
  voiceCue,
  staves = [],
  marks = [],
  footer,
  children,
}) {
  const inkColor = variant === 'cream' ? COLORS.inkCream : COLORS.inkDark
  const inkSecondary = variant === 'cream' ? COLORS.inkCreamSecondary : COLORS.inkDarkSecondary

  return (
    <Paper variant={variant}>
      {/* Page header */}
      <div style={{ position: 'absolute', top: 32, left: 24, right: 24, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: inkSecondary, fontFamily: FONTS.serif, fontStyle: 'italic' }}>
        <span>{pageTitle}</span>
        <span style={{ fontFamily: FONTS.mono, fontStyle: 'normal' }}>{pageNumber}</span>
      </div>
      <div style={{ position: 'absolute', top: 50, left: 24, right: 24, height: 0.5, background: inkSecondary, opacity: 0.5 }} />

      {/* SVG canvas */}
      <svg
        viewBox="0 0 360 600"
        preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', color: inkColor }}
      >
        {staves.map((s, i) => (
          <Stave key={i} x={s.x || 10} width={s.width || 340} y={s.y} color={inkColor} opacity={s.opacity || 1} />
        ))}
        {marks.map((m, i) => {
          const Mark = ALL_MARKS[m.type]
          if (!Mark) return null
          return (
            <g key={i} transform={`translate(${m.x}, ${m.y})`}>
              <Mark {...m.props} color={inkColor} />
            </g>
          )
        })}
        {children}
      </svg>

      {/* Voice cue */}
      {voiceCue && (
        <div style={{ position: 'absolute', bottom: 60, left: 24, right: 24, textAlign: 'center', fontSize: 14, color: inkColor, fontFamily: FONTS.serif, fontStyle: 'italic', lineHeight: 1.5 }}>
          {voiceCue}
        </div>
      )}

      {/* Footer */}
      {footer && (
        <div style={{ position: 'absolute', bottom: 24, left: 24, right: 24, fontSize: 9, color: inkSecondary, fontFamily: FONTS.mono, textAlign: 'left' }}>
          {footer}
        </div>
      )}
    </Paper>
  )
}
