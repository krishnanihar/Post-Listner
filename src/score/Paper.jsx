import React from 'react'
import { COLORS } from './tokens'

const GRAIN_SVG_URL = "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

export default function Paper({ variant = 'cream', children }) {
  const isCream = variant === 'cream'
  const isPureBlack = variant === 'pure-black'

  const bg = isCream ? COLORS.paperCream : isPureBlack ? COLORS.paperPureBlack : COLORS.paperDark
  const grainOpacity = isCream ? 0.06 : isPureBlack ? 0 : 0.03

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: bg,
        overflow: 'hidden',
      }}
    >
      {grainOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: GRAIN_SVG_URL,
            backgroundRepeat: 'repeat',
            backgroundSize: '256px 256px',
            opacity: grainOpacity,
            pointerEvents: 'none',
            mixBlendMode: isCream ? 'multiply' : 'screen',
          }}
        />
      )}
      {children}
    </div>
  )
}
