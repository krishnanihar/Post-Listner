// Image-to-particles rasterizer for the Admirer phase's BackgroundGlyph.
// The async rasterizeTile() flow is browser-only (Image, canvas, getImageData);
// the pure helpers (extractActivePixels, downsampleTargets, normalizeTargets,
// pickRandomTileId) are unit-tested.
//
// The canonical pattern (Hoebregts, Mehul Nirala, ICS Media):
//   1. Render the target SVG tile to a hidden canvas at RESOLUTION × RESOLUTION
//   2. getImageData → scan RGBA, keep active (alpha+luminance-thresholded)
//      pixels as candidate positions. "Active" rather than "dark" because
//      the threshold is general — alpha first, luminance second — and a
//      future light-on-dark source would still work by inverting the
//      luminanceMax option.
//   3. Downsample to PARTICLE_BUDGET so frame cost is bounded
//   4. Normalise pixel positions to a ±halfExtent origin-centred coord space
//
// Output: { tileId, targets: [{x,y}, ...], bbox: {x, y, width, height},
//           pathElements: [{d, fill, fillRule}] }.
// targets feeds the particle system. pathElements + bbox feed the SVG
// fade-in overlay — fidelity to the source comes from the overlay rendered
// with the original fills, NOT from the particle stipple.

// Tiles in the 15-pattern pool. Layer_16 was excluded in v2 (196 paths, too busy at small scale) — kept excluded here.
export const TILE_IDS = [
  'Layer_2', 'Layer_3', 'Layer_4', 'Layer_5', 'Layer_6', 'Layer_7',
  'Layer_8', 'Layer_9', 'Layer_10', 'Layer_11', 'Layer_12', 'Layer_13',
  'Layer_14', 'Layer_15', 'Layer_17',
]

// Exported so BackgroundGlyph can size its particle array without hard-
// coding a magic number, and tests can pin the contract.
export const PARTICLE_BUDGET = 800

const SOURCE_SVG_URL = '/admirer/glyphs/source.svg'
const DEFAULT_RESOLUTION = 320

let sourceTextPromise = null
async function loadSource() {
  if (!sourceTextPromise) {
    sourceTextPromise = fetch(SOURCE_SVG_URL).then(r => r.text())
  }
  return sourceTextPromise
}

// Pick a tile at random for this rite.
export function pickRandomTileId(rand = Math.random) {
  const idx = Math.floor(rand() * TILE_IDS.length)
  return TILE_IDS[Math.min(idx, TILE_IDS.length - 1)]
}

// Pure: scan ImageData-shaped object, return positions of pixels that are
// both opaque enough (alpha >= alphaMin) AND active enough — for the
// current near-black source, "active" means luminance < luminanceMax;
// the helper stays general so a future light source can override.
// Catches filled regions, dots, and stroked lines uniformly.
export function extractActivePixels(imageData, options = {}) {
  const alphaMin = options.alphaMin ?? 128
  const luminanceMax = options.luminanceMax ?? 128
  const { data, width, height } = imageData
  const pixels = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const a = data[i + 3]
      if (a < alphaMin) continue
      const r = data[i], g = data[i + 1], b = data[i + 2]
      // Use max(r,g,b) as a cheap brightness check — it correctly rejects
      // saturated colours like pure red (max=255) that average-luminance
      // would wrongly mark as dark, while still catching near-black ink.
      const bright = r > g ? (r > b ? r : b) : (g > b ? g : b)
      if (bright >= luminanceMax) continue
      pixels.push({ x, y })
    }
  }
  return pixels
}

// Pure: random subset of size `budget`. If input.length <= budget, return
// the input unchanged. Otherwise use Fisher-Yates partial shuffle so each
// input has equal probability of selection.
export function downsampleTargets(targets, budget, rand = Math.random) {
  if (targets.length <= budget) return [...targets]
  // Fisher-Yates partial shuffle: shuffle first `budget` positions with
  // random swaps from the entire array, then truncate.
  const out = targets.slice()
  for (let i = 0; i < budget; i++) {
    const j = i + Math.floor(rand() * (out.length - i))
    const tmp = out[i]; out[i] = out[j]; out[j] = tmp
  }
  return out.slice(0, budget)
}

// Pure: re-project pixel positions to a centred ±halfExtent space, using
// the larger dimension as the scaling axis (preserves aspect ratio).
export function normalizeTargets(pixels, source, halfExtent = 50) {
  const w = source.width
  const h = source.height
  const cx = w / 2
  const cy = h / 2
  const scale = (2 * halfExtent) / Math.max(w, h)
  return pixels.map(p => ({
    x: (p.x - cx) * scale,
    y: (p.y - cy) * scale,
  }))
}

// Async: rasterise the chosen tile, return particle targets + path elements
// + bbox. Browser-only — uses Image and a hidden <canvas>. Caches the source
// fetch so multiple calls only download once.
//
// Returns:
//   tileId:       the input tile id
//   targets:      Array<{x, y}>            ~budget items in ±halfExtent space
//   bbox:         { x, y, width, height }  tile bbox in source SVG coords
//   pathElements: Array<{ d, fill, fillRule }>  for the SVG fade-in layer
export async function rasterizeTile(tileId, resolution = DEFAULT_RESOLUTION) {
  const svgText = await loadSource()

  // Parse the source, isolate the requested tile.
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')
  const tileGroup = doc.getElementById(tileId)
  if (!tileGroup) throw new Error(`rasterizeTile: ${tileId} not found in source SVG`)

  // Need bbox to crop. Insert temporarily into a hidden DOM so getBBox works.
  const tempWrapper = document.createElement('div')
  tempWrapper.setAttribute('aria-hidden', 'true')
  tempWrapper.style.cssText = 'position:absolute;left:-99999px;top:-99999px;width:450px;height:450px;visibility:hidden;'
  // Wrap a fresh SVG around the tile (clone so we don't mutate the parsed doc).
  const cloneSvg = doc.documentElement.cloneNode(false)
  cloneSvg.setAttribute('viewBox', '0 0 450 450')
  const cloneTile = tileGroup.cloneNode(true)
  cloneSvg.appendChild(cloneTile)
  tempWrapper.appendChild(cloneSvg)
  document.body.appendChild(tempWrapper)

  let bbox
  let pathElements
  try {
    const liveTile = cloneSvg.querySelector(`#${tileId}`)
    if (!liveTile) throw new Error(`rasterizeTile: ${tileId} disappeared after cloning`)
    bbox = liveTile.getBBox()
    // Extract path elements for the SVG fade-in overlay (preserve fills).
    pathElements = Array.from(liveTile.querySelectorAll('path')).map(p => ({
      d: p.getAttribute('d') || '',
      fill: p.getAttribute('fill') || (p.style && p.style.fill) || 'currentColor',
      fillRule: p.getAttribute('fill-rule') || 'nonzero',
    }))
  } finally {
    tempWrapper.remove()
  }

  // Build a tight-cropped SVG string for rasterisation. viewBox = bbox, so the
  // tile fills the canvas with no margin. Set a transparent background.
  const cropSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}" width="${resolution}" height="${resolution}">${new XMLSerializer().serializeToString(tileGroup)}</svg>`

  // Load into an Image via a data URL. Data URLs do not taint the canvas,
  // so getImageData will work — but Safari has been twitchy historically,
  // so we await img.decode() to surface failures cleanly and wrap the
  // getImageData call in a try/catch with a console.warn fallback.
  // encodeURIComponent is safer than btoa for non-ASCII chars in SVG.
  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(cropSvg)}`
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = dataUrl
  try {
    await img.decode()
  } catch (e) {
    throw new Error(`rasterizeTile: image decode failed for ${tileId} — ${e?.message || e}`)
  }

  // Draw onto an offscreen canvas at resolution×resolution.
  const canvas = document.createElement('canvas')
  canvas.width = resolution
  canvas.height = resolution
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.clearRect(0, 0, resolution, resolution)
  ctx.drawImage(img, 0, 0, resolution, resolution)

  // Scan, downsample, normalise. getImageData wrapped defensively even
  // though data URLs shouldn't taint; a SecurityError here means the
  // tile won't render but the rite continues unspatialised.
  let imageData
  try {
    imageData = ctx.getImageData(0, 0, resolution, resolution)
  } catch (e) {
    console.warn(`[rasterizeTile] getImageData failed for ${tileId} — canvas tainted? ${e?.message || e}`)
    return { tileId, bbox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }, targets: [], pathElements }
  }
  const active = extractActivePixels(imageData)
  if (active.length === 0) {
    console.warn(`[rasterizeTile] ${tileId} produced 0 active pixels — check threshold or source`)
  }
  const sampled = downsampleTargets(active, PARTICLE_BUDGET)
  const targets = normalizeTargets(sampled, { width: resolution, height: resolution }, 50)

  return {
    tileId,
    bbox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height },
    targets,
    pathElements,
  }
}
