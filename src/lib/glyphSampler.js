// Loads public/admirer/glyphs/source.svg, isolates one tile by id, and
// samples its <path> elements into a flat list of line segments. Each
// segment is one "particle" — start xy and end xy in a normalized
// coordinate space where (0,0) is the tile's centre and ±50 are its edges.
//
// All 16 patterns share the same source. Sampling is target-budget
// based: TARGET_SEGMENTS segments are distributed across paths
// proportionally to path length, so a busy tile and a sparse tile
// produce similar visual weights.
//
// Sampling uses the native browser SVGPathElement.getPointAtLength —
// the source SVG must be inserted into the live DOM (an offscreen div
// works) for the API to be available. This module owns that detail.

// Layers we'll actually use (15 tiles — Layer_16 has 196 paths and reads
// as too busy at small scale; we drop it).
export const TILE_IDS = [
  'Layer_2', 'Layer_3', 'Layer_4', 'Layer_5', 'Layer_6', 'Layer_7',
  'Layer_8', 'Layer_9', 'Layer_10', 'Layer_11', 'Layer_12', 'Layer_13',
  'Layer_14', 'Layer_15', 'Layer_17',
]

const TARGET_SEGMENTS = 180

let sourceTextPromise = null
async function loadSource() {
  if (!sourceTextPromise) {
    sourceTextPromise = fetch('/admirer/glyphs/source.svg').then(r => r.text())
  }
  return sourceTextPromise
}

// Returns:
// {
//   tileId,
//   bbox: { x, y, width, height, cx, cy, halfExtent, scale },
//   paths: [
//     {
//       d: '<verbatim path d attribute>',
//       length: <getTotalLength()>,
//       segments: [{ x1, y1, x2, y2 }, ...],  // in normalised ±50 coords
//     },
//     ...
//   ]
// }
export async function sampleTile(tileId) {
  const svgText = await loadSource()
  // Parse and insert into a hidden, offscreen, but laid-out container so
  // getPointAtLength / getBBox work. We must NOT use display:none (some
  // browsers refuse measurements on display:none subtrees).
  const wrapper = document.createElement('div')
  wrapper.setAttribute('aria-hidden', 'true')
  wrapper.style.cssText = 'position:absolute;left:-99999px;top:-99999px;width:450px;height:450px;visibility:hidden;'
  wrapper.innerHTML = svgText
  document.body.appendChild(wrapper)
  try {
    const tileGroup = wrapper.querySelector(`#${tileId}`)
    if (!tileGroup) throw new Error(`tile ${tileId} not found in source SVG`)
    const paths = Array.from(tileGroup.querySelectorAll('path'))
    if (paths.length === 0) throw new Error(`tile ${tileId} has no paths`)

    // Compute the tile's bbox by querying the group directly. getBBox
    // returns the union of all child geometries in the SVG coord space.
    const rawBbox = tileGroup.getBBox()
    const cx = rawBbox.x + rawBbox.width / 2
    const cy = rawBbox.y + rawBbox.height / 2
    // Normalise to a half-extent of 50 (so the tile fills -50..50). Pick
    // the larger dimension as the scaling axis to preserve aspect ratio.
    const halfExtent = Math.max(rawBbox.width, rawBbox.height) / 2
    const scale = 50 / halfExtent

    // Expose bbox so the SVG layer can render with the correct viewBox.
    const bbox = {
      x: rawBbox.x,
      y: rawBbox.y,
      width: rawBbox.width,
      height: rawBbox.height,
      cx,
      cy,
      halfExtent,
      scale,
    }

    // Per-path lengths.
    const pathLengths = paths.map(p => {
      try { return p.getTotalLength() } catch { return 0 }
    })
    const totalLength = pathLengths.reduce((a, b) => a + b, 0)
    if (totalLength <= 0) throw new Error(`tile ${tileId} has zero total path length`)

    const result = []
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i]
      const len = pathLengths[i]
      if (len <= 0) continue
      // Capture the verbatim d attribute for the SVG layer.
      const d = path.getAttribute('d') || ''
      // Distribute the segment budget proportionally to path length.
      const nSegs = Math.max(1, Math.round(TARGET_SEGMENTS * (len / totalLength)))
      // We need nSegs+1 sample points to produce nSegs segments.
      const step = len / nSegs
      let prev = path.getPointAtLength(0)
      const segments = []
      for (let s = 1; s <= nSegs; s++) {
        const cur = path.getPointAtLength(Math.min(s * step, len))
        // Normalise: subtract centre, scale to ±50.
        segments.push({
          x1: (prev.x - cx) * scale,
          y1: (prev.y - cy) * scale,
          x2: (cur.x - cx) * scale,
          y2: (cur.y - cy) * scale,
        })
        prev = cur
      }
      result.push({ d, length: len, segments })
    }

    return { tileId, bbox, paths: result }
  } finally {
    wrapper.remove()
  }
}

// Pick a random tile for this rite. Per-rite random (different every session).
export function pickRandomTileId(rand = Math.random) {
  const idx = Math.floor(rand() * TILE_IDS.length)
  return TILE_IDS[Math.min(idx, TILE_IDS.length - 1)]
}
