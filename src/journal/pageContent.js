import * as THREE from 'three'

/**
 * pageContent — draws a journal entry onto a canvas and returns a texture
 * for one page face. Cream paper, a faint date, a seeded ink glyph, and the
 * entry's one-line summary in italic serif.
 *
 * Slice 1: the glyph is a seeded placeholder squiggle. The real glyph is the
 * recorded gesture trace (a later slice). See docs/desktop-journal-design.md.
 */

const W = 1024
const H = 1444

// small seeded PRNG so each entry's glyph is unique but stable
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function drawGlyph(ctx, cx, cy, seed) {
  const rand = mulberry32(seed * 2654435761)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = 'rgba(40, 30, 18, 0.62)'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  let x = (rand() - 0.5) * 120
  let y = (rand() - 0.5) * 90
  const steps = 5 + Math.floor(rand() * 4)
  for (let i = 0; i < steps; i++) {
    const nx = (rand() - 0.5) * 280
    const ny = (rand() - 0.5) * 200
    const mx = (x + nx) / 2 + (rand() - 0.5) * 160
    const my = (y + ny) / 2 + (rand() - 0.5) * 160
    ctx.beginPath()
    ctx.lineWidth = 2.5 + rand() * 7
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(mx, my, nx, ny)
    ctx.stroke()
    x = nx
    y = ny
  }
  ctx.restore()
}

function wrapText(ctx, text, cx, top, maxW, lineH) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  lines.forEach((ln, i) => ctx.fillText(ln, cx, top + i * lineH))
}

export function makePageTexture(entry) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')

  // cream paper
  ctx.fillStyle = '#ece2c8'
  ctx.fillRect(0, 0, W, H)
  // faint aged edge darkening
  const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.72)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(70,52,28,0.16)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  ctx.textAlign = 'center'

  // date
  ctx.fillStyle = 'rgba(58, 46, 28, 0.6)'
  ctx.font = '300 34px "JetBrains Mono", ui-monospace, monospace'
  ctx.fillText(entry.date, W / 2, 190)

  // rule
  ctx.strokeStyle = 'rgba(58, 46, 28, 0.28)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(W * 0.34, 232)
  ctx.lineTo(W * 0.66, 232)
  ctx.stroke()

  // glyph
  drawGlyph(ctx, W / 2, H * 0.43, entry.id)

  // summary
  ctx.fillStyle = 'rgba(36, 28, 18, 0.92)'
  ctx.font = 'italic 52px Palatino, "Palatino Linotype", Georgia, serif'
  wrapText(ctx, entry.summary, W / 2, H * 0.72, W * 0.66, 70)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.flipY = false // glTF UV convention
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}
