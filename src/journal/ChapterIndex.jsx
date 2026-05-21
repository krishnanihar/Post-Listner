import { useState } from 'react'
import { buildChapters } from './chapters'

/**
 * ChapterIndex — the journal's deep-navigation rail (design doc §4).
 *
 * A quiet marginal index: entries grouped into month chapters, each a
 * station on a faint vertical rail. Clicking a chapter jumps to that
 * month's newest entry. Never a calendar grid — just a soft list in the
 * margin, faint until the eye goes looking for it.
 */

const ITEM_H = 38

export default function ChapterIndex({ entries, currentIndex, onJump }) {
  const [hover, setHover] = useState(-1)
  const [railHover, setRailHover] = useState(false)
  const chapters = buildChapters(entries)
  if (chapters.length < 2) return null

  // the active chapter is the last one whose newest entry is at or before the cursor
  let active = 0
  chapters.forEach((c, i) => {
    if (c.index <= currentIndex) active = i
  })

  return (
    <div
      onMouseEnter={() => setRailHover(true)}
      onMouseLeave={() => {
        setRailHover(false)
        setHover(-1)
      }}
      style={{
        position: 'absolute',
        left: 46,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        opacity: railHover ? 1 : 0.66,
        transition: 'opacity 0.45s ease',
      }}
    >
      {/* the rail — a hairline threading the chapter stations */}
      <div
        style={{
          position: 'absolute',
          left: 3,
          top: ITEM_H / 2,
          bottom: ITEM_H / 2,
          width: 1,
          background: 'rgba(28,24,20,0.22)',
        }}
      />
      {chapters.map((c, i) => {
        const isActive = i === active
        const isHover = i === hover
        const lit = isActive || isHover
        return (
          <button
            key={c.abbr}
            onClick={() => onJump(c.index)}
            onMouseEnter={() => setHover(i)}
            style={{
              height: ITEM_H,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                flexShrink: 0,
                border: `1px solid rgba(28,24,20,${isActive ? 0.8 : 0.32})`,
                background: isActive ? '#1C1814' : '#F2EBD8',
                transition: 'background 0.3s ease, border-color 0.3s ease',
              }}
            />
            <span
              style={{
                font: `italic ${isActive ? 16.5 : 14.5}px Palatino, "Palatino Linotype", Georgia, serif`,
                letterSpacing: '0.05em',
                color: `rgba(28,24,20,${isActive ? 0.84 : lit ? 0.62 : 0.34})`,
                transition: 'color 0.3s ease, font-size 0.3s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {c.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
