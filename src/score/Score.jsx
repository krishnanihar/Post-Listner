import React from 'react'
import Paper from './Paper'
import Stave from './Stave'
import { ALL_MARKS } from './marks'
import { COLORS, FONTS } from './tokens'

// All content lives inside one SVG viewBox — single coordinate system.
// No CSS/SVG misalignment on any screen size.
const VB_W = 360
const VB_H = 660
const MARGIN_X = 20
const HEADER_Y = 30
const DIVIDER_Y = 42

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
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        {/* Page header — inside SVG */}
        {pageTitle && (
          <text
            x={MARGIN_X}
            y={HEADER_Y}
            fill={inkSecondary}
            fontSize="11"
            fontFamily={FONTS.serif}
            fontStyle="italic"
          >
            {pageTitle}
          </text>
        )}
        {pageNumber && (
          <text
            x={VB_W - MARGIN_X}
            y={HEADER_Y}
            fill={inkSecondary}
            fontSize="11"
            fontFamily={FONTS.mono}
            textAnchor="end"
          >
            {pageNumber}
          </text>
        )}
        {/* Divider line */}
        <line
          x1={MARGIN_X}
          y1={DIVIDER_Y}
          x2={VB_W - MARGIN_X}
          y2={DIVIDER_Y}
          stroke={inkSecondary}
          strokeWidth="0.5"
          opacity="0.5"
        />

        {/* Staves */}
        {staves.map((s, i) => (
          <Stave
            key={i}
            x={s.x != null ? s.x : MARGIN_X}
            width={s.width || (VB_W - MARGIN_X * 2)}
            y={s.y}
            color={inkColor}
            opacity={s.opacity || 1}
          />
        ))}

        {/* Marks from props */}
        {marks.map((m, i) => {
          const Mark = ALL_MARKS[m.type]
          if (!Mark) return null
          return (
            <g key={i} transform={`translate(${m.x}, ${m.y})`}>
              <Mark {...m.props} color={inkColor} />
            </g>
          )
        })}

        {/* Phase-specific SVG children */}
        {children}

        {/* Voice cue — bottom center */}
        {voiceCue && (
          <text
            x={VB_W / 2}
            y={VB_H - 50}
            fill={inkColor}
            fontSize="14"
            fontFamily={FONTS.serif}
            fontStyle="italic"
            textAnchor="middle"
          >
            {voiceCue}
          </text>
        )}

        {/* Footer — bottom left */}
        {footer && (
          <text
            x={MARGIN_X}
            y={VB_H - 20}
            fill={inkSecondary}
            fontSize="9"
            fontFamily={FONTS.mono}
          >
            {footer}
          </text>
        )}
      </svg>
    </Paper>
  )
}
