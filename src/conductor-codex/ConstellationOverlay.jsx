/* Constellation + zodiac SVG overlay for /conduct-codex.
 *
 * Renders an ink-on-parchment celestial-chart layer behind the 3D scene:
 *   - concentric circles centered around the upper-frame (figure's head area)
 *   - hand-defined constellation patterns (clusters of stars + lines)
 *   - zodiac + planetary glyphs scattered around the periphery
 *
 * Pure decoration — no React state, no events, position: absolute pointer-events: none.
 * The viewBox is 1200x1200 and the SVG uses preserveAspectRatio="xMidYMid slice"
 * so it fills the viewport while keeping the celestial composition centered.
 */

const INK = '#1C1814'
const INK_SOFT = '#3F3328'

// Each constellation: array of [x, y] star positions + line pairs [i, j].
const CONSTELLATIONS = [
  // Top-left cluster (Big-Dipper-ish, sweeping curve)
  {
    points: [[180, 180], [230, 220], [295, 235], [365, 230], [395, 195], [445, 180], [480, 145]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
  },
  // Top-right cluster (small triangle + line)
  {
    points: [[900, 165], [970, 200], [1020, 145], [1080, 220], [1050, 285]],
    lines: [[0, 1], [1, 2], [1, 3], [3, 4]],
  },
  // Mid-right (Orion-belt-ish, 3-star line + outliers)
  {
    points: [[1010, 600], [1055, 615], [1095, 635], [1030, 560], [1080, 690]],
    lines: [[0, 1], [1, 2], [0, 3], [2, 4]],
  },
  // Bottom-left (V-shape, like Hyades)
  {
    points: [[160, 880], [220, 920], [275, 945], [330, 925], [385, 905]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  // Bottom-right (cross / kite)
  {
    points: [[900, 970], [955, 935], [990, 985], [950, 1030], [995, 905]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [1, 4]],
  },
  // Far left mid (single short arc)
  {
    points: [[80, 540], [115, 595], [105, 660]],
    lines: [[0, 1], [1, 2]],
  },
]

// Scattered loose stars (no lines) to fill negative space.
const LOOSE_STARS = [
  [310, 90], [550, 70], [720, 110], [820, 60], [1100, 80],
  [85, 290], [70, 410], [95, 720], [60, 820],
  [1130, 360], [1150, 480], [1115, 800], [1140, 920],
  [200, 1000], [430, 1050], [610, 1090], [780, 1060],
  [505, 380], [690, 420], [580, 470],
  [340, 530], [780, 540],
]

// Zodiac + planetary glyphs scattered around the outer ring. Each entry
// is [x, y, glyph, fontSize].
const GLYPHS = [
  [600, 60, '☉', 22],          // Sun, top
  [1090, 600, '☽', 22],        // Moon, right
  [600, 1140, '♄', 20],        // Saturn, bottom
  [110, 600, '♃', 20],         // Jupiter, left
  [880, 145, '♀', 16],         // Venus
  [320, 145, '♂', 16],         // Mars
  [950, 1055, '♅', 16],        // Uranus
  [250, 1055, '☿', 16],        // Mercury
  [1115, 270, '♈', 14],        // Aries
  [85, 270, '♎', 14],          // Libra
  [85, 930, '♍', 14],          // Virgo
  [1115, 930, '♓', 14],        // Pisces
  [600, 760, '♌', 12],         // Leo, lower mid
]

// Celestial chart center — lifted to the upper third of the viewBox so the
// rings sit "in the sky" above the figure rather than being occluded by it.
const CHART_CX = 600
const CHART_CY = 380

// Small alchemical-style decorative ticks around the largest circle.
const TICK_MARKS = (() => {
  const cx = CHART_CX
  const cy = CHART_CY
  const r = 520
  const out = []
  const count = 60
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2
    const x1 = cx + Math.cos(a) * r
    const y1 = cy + Math.sin(a) * r
    const len = i % 5 === 0 ? 14 : 6
    const x2 = cx + Math.cos(a) * (r + len)
    const y2 = cy + Math.sin(a) * (r + len)
    out.push([x1, y1, x2, y2])
  }
  return out
})()

export default function ConstellationOverlay() {
  return (
    <svg
      viewBox="0 0 1200 1200"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.7,
        mixBlendMode: 'multiply',
      }}
      aria-hidden="true"
    >
      {/* Concentric horoscope-style circles, centered in the upper sky
          area so the rings frame the figure's head and shoulders. */}
      <g stroke={INK_SOFT} fill="none" strokeLinecap="round">
        <circle cx={CHART_CX} cy={CHART_CY} r={520} strokeWidth={0.8} />
        <circle cx={CHART_CX} cy={CHART_CY} r={420} strokeWidth={0.7} strokeDasharray="3 5" />
        <circle cx={CHART_CX} cy={CHART_CY} r={320} strokeWidth={0.8} />
        <circle cx={CHART_CX} cy={CHART_CY} r={210} strokeWidth={0.6} strokeDasharray="1 3" />

        {/* Diagonal "ecliptic" lines crossing through the chart */}
        <line x1={140} y1={220} x2={1060} y2={540} strokeWidth={0.5} />
        <line x1={1080} y1={180} x2={120} y2={600} strokeWidth={0.5} />

        {/* Outer tick marks — alchemical-style chart graduations */}
        {TICK_MARKS.map(([x1, y1, x2, y2], i) => (
          <line
            key={`tick-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            strokeWidth={i % 5 === 0 ? 1 : 0.5}
          />
        ))}
      </g>

      {/* Constellation lines */}
      <g stroke={INK_SOFT} strokeWidth={0.6} fill="none" strokeLinecap="round">
        {CONSTELLATIONS.map((c, ci) =>
          c.lines.map(([a, b], li) => {
            const [x1, y1] = c.points[a]
            const [x2, y2] = c.points[b]
            return <line key={`${ci}-${li}`} x1={x1} y1={y1} x2={x2} y2={y2} />
          }),
        )}
      </g>

      {/* Constellation stars (dots at every constellation point) */}
      <g fill={INK}>
        {CONSTELLATIONS.map((c, ci) =>
          c.points.map(([x, y], pi) => (
            <circle key={`star-${ci}-${pi}`} cx={x} cy={y} r={2.2} />
          )),
        )}
      </g>

      {/* Loose scattered stars */}
      <g fill={INK}>
        {LOOSE_STARS.map(([x, y], i) => (
          <circle key={`loose-${i}`} cx={x} cy={y} r={1.4} />
        ))}
      </g>

      {/* Zodiac + planetary glyphs */}
      <g fill={INK_SOFT} fontFamily="'Iowan Old Style', Palatino, serif">
        {GLYPHS.map(([x, y, glyph, size], i) => (
          <text
            key={`glyph-${i}`}
            x={x}
            y={y}
            fontSize={size}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {glyph}
          </text>
        ))}
      </g>
    </svg>
  )
}
