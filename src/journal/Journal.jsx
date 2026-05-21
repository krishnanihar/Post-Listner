import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Environment, ContactShadows } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import { MOCK_ENTRIES } from './mockEntries'
import EntryPage from './EntryPage'
import CloudCanvas from './CloudCanvas'
import { Kuwahara } from './KuwaharaEffect'
import { applyCoverWash } from './coverTexture'
import ChapterIndex from './ChapterIndex'
import { MONTH_FULL, monthOf } from './chapters'

/**
 * Journal — the desktop journal route.
 *
 * The 3D book is a transition device; entries live on their own pages.
 * The book is the rigged model (journal-book-v2.glb) with a baked page-turn
 * animation. A page-turn = scrubbing that clip — forward for `next`, reversed
 * for `earlier`. The whole scene is rendered painterly: a Kuwahara post pass
 * + paper-grain overlay give it the watercolour look.
 *
 * Three transition kinds:
 *  - `open`  — landing → first page: the book opens in full view, then the
 *              camera pushes in through a cloud veil onto the entry page.
 *  - `turn`  — neighbouring entries: page-turn + intense zoom under a veil.
 *  - `jump`  — chapter index: a pure cloud crossfade to a distant entry.
 *
 * See docs/desktop-journal-design.md.
 */

const BOOK_URL = '/models/journal-book-v2.glb'
const BG = '#140f09'
const TRANS_MS = 3800
const JUMP_MS = 2400

// clip scrub positions (normalised 0..1 of the baked animation).
// The clip's first ~0.3 is a book-spin intro we never show; the page-turn
// region (open book) is ~0.3..0.77.
const OPEN_POS = 0.53 // book open, resting in the page-turn region
const TURN_DELTA = 0.12 // how far one page-turn scrubs
const SPIN_END = 0.227 // clip pos where the static-closed intro ends; the book opens from here

// book orientation — the model imports standing upright; lay it flat
const BOOK_ROT = [-Math.PI / 2, 0, 0]

// camera anchors
const CAM_LANDING = new THREE.Vector3(0, 3.7, 4.7) // intimate framing of the closed book
const TGT_LANDING = new THREE.Vector3(0, -0.18, 0.05)
const CAM_OVER = new THREE.Vector3(0, 5.0, 4.3) // book in full view (turn/jump anchor)
const TGT_OVER = new THREE.Vector3(0, 0, 0)
const CAM_OPEN_ZOOM = new THREE.Vector3(0, 2.6, 2.4)
const TGT_OPEN_ZOOM = new THREE.Vector3(0, -0.05, -0.3)
// next/earlier zooms much harder — further along the same approach line, so
// the angle still matches 'open'
const CAM_NEXT_ZOOM = new THREE.Vector3(0, 1.5, 1.55)

// grayscale paper-tooth grain — multiplied over the frame
const PAPER_SVG = encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>" +
    "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.7' " +
    "numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/>" +
    "</filter><rect width='200' height='200' filter='url(#n)'/></svg>",
)

const clamp01 = (t) => Math.min(1, Math.max(0, t))
const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}
// a steeper accel/decel than smoothstep — more cinematic camera weight
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
const pulse = (t, a, b, c, d) => {
  if (t <= a || t >= d) return 0
  if (t < b) return smoothstep(a, b, t)
  if (t <= c) return 1
  return 1 - smoothstep(c, d, t)
}

function Book({ bookRef }) {
  const { scene, animations } = useGLTF(BOOK_URL)
  const { camera } = useThree()
  const clip = animations && animations[0]
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene])
  const innerRef = useRef()

  useEffect(() => {
    if (clip) {
      mixer.clipAction(clip).play()
      mixer.setTime(0)
    }
    // watercolour wash on the cover — pigment variation for the painterly pass
    scene.traverse((o) => {
      if (o.isMesh && o.material && o.material.name === 'BookCover') {
        applyCoverWash(o.material)
      }
    })
    // lay the book flat, then auto-fit: centre at the origin, scale to ~3.2
    scene.rotation.set(BOOK_ROT[0], BOOK_ROT[1], BOOK_ROT[2])
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const s = 3.2 / Math.max(size.x, size.y, size.z, 0.001)
    if (innerRef.current) {
      innerRef.current.scale.setScalar(s)
      innerRef.current.position.copy(center).multiplyScalar(-s)
    }
    console.log('[book v2] size', size.toArray().map((n) => n.toFixed(2)), 'fit', s.toFixed(3))
  }, [scene, clip, mixer])

  useFrame(() => {
    const b = bookRef.current
    if (clip) mixer.setTime(clamp01(b.clipPos) * clip.duration)
    camera.position.copy(b.camPos)
    camera.lookAt(b.camTgt)
  })

  return (
    <group ref={innerRef}>
      <primitive object={scene} />
    </group>
  )
}
useGLTF.preload(BOOK_URL)

export default function Journal() {
  const [view, setView] = useState('landing')
  const [index, setIndex] = useState(0)
  const [pageVisible, setPageVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  const bookRef = useRef({
    clipPos: 0,
    camPos: CAM_LANDING.clone(),
    camTgt: TGT_LANDING.clone(),
  })
  const veilRef = useRef({ opacity: 0 })
  const transRef = useRef(null)

  const maxIndex = MOCK_ENTRIES.length - 1

  // the span of the record — a quiet temporal frame for the landing
  const span = useMemo(() => {
    const newest = monthOf(MOCK_ENTRIES[0].date)
    const oldest = monthOf(MOCK_ENTRIES[MOCK_ENTRIES.length - 1].date)
    return `${MONTH_FULL[oldest] || oldest} – ${MONTH_FULL[newest] || newest}`
  }, [])

  useEffect(() => {
    let raf
    const loop = () => {
      const tr = transRef.current
      if (tr) {
        const dur = tr.dur || TRANS_MS
        const t = clamp01((performance.now() - tr.start) / dur)
        const b = bookRef.current

        if (tr.kind === 'open') {
          // the book opens in full view, no cloud; the camera holds while it
          // opens, then pushes in through the cloud onto the entry page
          b.clipPos = SPIN_END + (OPEN_POS - SPIN_END) * smoothstep(0, 0.55, t)
          const cz = easeInOutCubic(smoothstep(0.42, 1.0, t))
          b.camPos.lerpVectors(CAM_LANDING, CAM_OPEN_ZOOM, cz)
          b.camTgt.lerpVectors(TGT_LANDING, TGT_OPEN_ZOOM, cz)
          veilRef.current.opacity = pulse(t, 0.6, 0.78, 0.85, 1.0)
          if (t >= 0.8 && !tr.showPage) {
            tr.showPage = true
            // open on the first entry — the beginning of the record. Entries
            // are newest-first, so the oldest sits at the last array index.
            setIndex(MOCK_ENTRIES.length - 1)
            setPageVisible(true)
          }
        } else if (tr.kind === 'jump') {
          // a pure cloud crossfade — the veil fully covers, the entry swaps
          // behind it, the veil clears onto the new page
          veilRef.current.opacity = pulse(t, 0.0, 0.42, 0.58, 1.0)
          if (t >= 0.5 && !tr.swapped) {
            tr.swapped = true
            setIndex(tr.to)
          }
        } else {
          // turn: page turn (visible) -> intense zoom-in (visible) -> cloud -> page.
          // dir is +1 for 'earlier', -1 for 'later'; negate so the page flips
          // forward when moving later and backward when moving earlier.
          b.clipPos = OPEN_POS - tr.dir * TURN_DELTA * smoothstep(0.3, 0.6, t)
          const cz = easeInOutCubic(smoothstep(0.5, 0.86, t))
          b.camPos.lerpVectors(CAM_OVER, CAM_NEXT_ZOOM, cz)
          b.camTgt.lerpVectors(TGT_OVER, TGT_OPEN_ZOOM, cz)
          const coverA = pulse(t, 0.0, 0.12, 0.18, 0.32)
          const coverD = pulse(t, 0.78, 0.88, 0.92, 1.0)
          veilRef.current.opacity = Math.max(coverA, coverD)
          if (t >= 0.16 && !tr.hidPage) {
            tr.hidPage = true
            setPageVisible(false)
          }
          if (t >= 0.5 && !tr.swapped) {
            tr.swapped = true
            setIndex(tr.to)
          }
          if (t >= 0.89 && !tr.showPage) {
            tr.showPage = true
            setPageVisible(true)
          }
        }

        if (t >= 1) {
          transRef.current = null
          b.clipPos = OPEN_POS // book rests open (hidden behind the entry page)
          b.camPos.copy(CAM_OVER)
          b.camTgt.copy(TGT_OVER)
          veilRef.current.opacity = 0
          if (tr.kind === 'open') setView('page')
          setBusy(false)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])

  const open = useCallback(() => {
    if (transRef.current) return
    setBusy(true)
    transRef.current = { kind: 'open', start: performance.now() }
  }, [])

  const turn = useCallback(
    (dir) => {
      if (transRef.current) return
      const to = index + dir
      if (to < 0 || to > maxIndex) return
      setBusy(true)
      transRef.current = { kind: 'turn', from: index, to, dir, start: performance.now() }
    },
    [index, maxIndex],
  )

  const jumpTo = useCallback(
    (to) => {
      if (transRef.current) return
      if (to === index || to < 0 || to > maxIndex) return
      setBusy(true)
      transRef.current = { kind: 'jump', to, dur: JUMP_MS, start: performance.now() }
    },
    [index, maxIndex],
  )

  useEffect(() => {
    const onKey = (e) => {
      if (view === 'landing' && (e.key === 'Enter' || e.key === ' ')) open()
      // entries are newest-first: turn(+1) = older = earlier in time
      if (view === 'page' && e.key === 'ArrowLeft') turn(1)
      if (view === 'page' && e.key === 'ArrowRight') turn(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, open, turn])

  // debug hook for the screenshot harness
  useEffect(() => {
    window.__bookRef = bookRef
  }, [])

  const btn = {
    background: 'none',
    border: '1px solid rgba(231, 222, 198, 0.34)',
    color: '#e7dec6',
    font: 'italic 15px Palatino, Georgia, serif',
    letterSpacing: '0.08em',
    padding: '11px 26px',
    borderRadius: 2,
    cursor: 'pointer',
  }
  const inkBtn = { ...btn, border: '1px solid rgba(28,24,20,0.3)', color: '#1C1814' }

  return (
    <div className="h-full w-full" style={{ background: BG, position: 'relative' }}>
      <style>{`@keyframes jFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <Canvas camera={{ position: [0, 3.7, 4.7], fov: 36 }} gl={{ antialias: true }} dpr={[1, 2]}>
        <color attach="background" args={[BG]} />
        {/* warm key */}
        <directionalLight position={[3, 6.5, 4.5]} intensity={2.1} color="#ffd49a" />
        {/* warm grazing side — rakes the cover so the wash texture reads */}
        <directionalLight position={[6, 1.2, 2]} intensity={1.15} color="#ffb877" />
        {/* cool fill — keeps the shadows from going dead */}
        <directionalLight position={[-5, 3, -4]} intensity={0.7} color="#8a9bc4" />
        {/* warm rim/back — lifts the book's silhouette off the dark ground */}
        <directionalLight position={[0, 3.5, -6.5]} intensity={1.35} color="#ffe2b4" />
        <ambientLight intensity={0.38} color="#b9a98c" />
        <Suspense fallback={null}>
          <Book bookRef={bookRef} />
          <Environment files="/hdri/studio.hdr" background={false} environmentIntensity={0.45} />
          <ContactShadows
            position={[0, -1.6, 0]}
            opacity={0.5}
            scale={13}
            blur={3.4}
            far={5}
            color="#160d04"
          />
        </Suspense>
        <EffectComposer>
          <Kuwahara />
          <Bloom mipmapBlur luminanceThreshold={0.62} luminanceSmoothing={0.32} intensity={0.4} />
          <Vignette offset={0.3} darkness={0.78} />
          <Noise opacity={0.03} />
        </EffectComposer>
      </Canvas>

      {pageVisible && <EntryPage entry={MOCK_ENTRIES[index]} />}

      {!busy && view === 'page' && (
        <ChapterIndex entries={MOCK_ENTRIES} currentIndex={index} onJump={jumpTo} />
      )}

      <CloudCanvas veilRef={veilRef} />

      {/* paper-grain overlay — the watercolour 'tooth' */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          mixBlendMode: 'multiply',
          opacity: 0.45,
          backgroundImage: `url("data:image/svg+xml,${PAPER_SVG}")`,
        }}
      />

      {!busy && view === 'landing' && (
        <>
          <div
            style={{
              position: 'absolute',
              top: '13%',
              left: 0,
              right: 0,
              textAlign: 'center',
              animation: 'jFadeUp 1.5s ease-out both',
            }}
          >
            <div
              style={{
                font: 'italic 42px Palatino, "Palatino Linotype", Georgia, serif',
                color: '#ede4cc',
                letterSpacing: '0.03em',
              }}
            >
              the journal
            </div>
            {/* hairline ornament */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 11,
                margin: '18px 0 14px',
              }}
            >
              <div
                style={{
                  height: 1,
                  width: 56,
                  background:
                    'linear-gradient(to right, transparent, rgba(231,222,198,0.4), transparent)',
                }}
              />
              <div
                style={{
                  width: 4,
                  height: 4,
                  transform: 'rotate(45deg)',
                  background: 'rgba(231,222,198,0.5)',
                }}
              />
              <div
                style={{
                  height: 1,
                  width: 56,
                  background:
                    'linear-gradient(to right, transparent, rgba(231,222,198,0.4), transparent)',
                }}
              />
            </div>
            <div
              style={{
                font: '300 12px ui-monospace, SFMono-Regular, monospace',
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                color: 'rgba(237,228,204,0.42)',
              }}
            >
              {span}
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 52,
              left: 0,
              right: 0,
              textAlign: 'center',
              animation: 'jFadeUp 1.5s ease-out 0.45s both',
            }}
          >
            <button style={btn} onClick={open}>
              open the journal
            </button>
          </div>
        </>
      )}
      {!busy && view === 'page' && (
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            alignItems: 'center',
          }}
        >
          {/* entries are newest-first: 'earlier' walks toward older entries */}
          <button style={{ ...inkBtn, opacity: index >= maxIndex ? 0.3 : 1 }} onClick={() => turn(1)}>
            ← earlier
          </button>
          <span
            style={{
              font: 'italic 13px Palatino, Georgia, serif',
              color: '#1C1814',
              opacity: 0.5,
              minWidth: 80,
              textAlign: 'center',
            }}
          >
            {MOCK_ENTRIES.length - index} of {MOCK_ENTRIES.length}
          </span>
          <button style={{ ...inkBtn, opacity: index <= 0 ? 0.3 : 1 }} onClick={() => turn(-1)}>
            later →
          </button>
        </div>
      )}
    </div>
  )
}
