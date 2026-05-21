import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Environment, ContactShadows } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import EntryPage from './EntryPage'
import CloudCanvas from './CloudCanvas'
import { Kuwahara } from './KuwaharaEffect'
import { applyCoverWash } from './coverTexture'
import ChapterIndex from './ChapterIndex'
import { MONTH_FULL, monthOf } from './chapters'
import { QRCodeSVG } from 'qrcode.react'

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
const RISE_MS = 4200

// the collective sky is heavy (Mapbox GL) — load it only on the first rise
const CollectiveSky = lazy(() => import('./CollectiveSky.jsx'))
const HAS_MAPBOX = !!import.meta.env.VITE_MAPBOX_TOKEN

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

export default function Journal({ entries, onSignOut, newEntryId, sessionId, handStyle }) {
  const [view, setView] = useState('landing')
  const [index, setIndex] = useState(0)
  const [pageVisible, setPageVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [skyMounted, setSkyMounted] = useState(false)
  const [skyPhase, setSkyPhase] = useState('hidden')

  const bookRef = useRef({
    clipPos: 0,
    camPos: CAM_LANDING.clone(),
    camTgt: TGT_LANDING.clone(),
  })
  const veilRef = useRef({ opacity: 0 })
  const transRef = useRef(null)
  // book↔sky crossfade — applied to the two full-screen wrappers each frame
  const mixRef = useRef({ book: 1, sky: 0 })
  const bookWrapRef = useRef(null)
  const skyWrapRef = useRef(null)

  const maxIndex = entries.length - 1

  // the span of the record — a quiet temporal frame for the landing
  const span = useMemo(() => {
    const newest = monthOf(entries[0].date)
    const oldest = monthOf(entries[entries.length - 1].date)
    return `${MONTH_FULL[oldest] || oldest} – ${MONTH_FULL[newest] || newest}`
  }, [entries])

  // the entry to open on — the just-written entry after a rite settles,
  // otherwise the oldest entry (the last array index, since entries are
  // newest-first), matching the manual "open the journal" default
  const targetIndex = useMemo(() => {
    if (newEntryId) {
      const i = entries.findIndex((e) => e.id === newEntryId)
      if (i >= 0) return i
    }
    return entries.length - 1
  }, [entries, newEntryId])

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
            setIndex(tr.firstIndex)
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
        } else if (tr.kind === 'rise') {
          // book → sky: the veil covers, the wrappers crossfade behind it,
          // the veil clears onto the user's own cluster
          veilRef.current.opacity = pulse(t, 0.0, 0.42, 0.58, 1.0)
          {
            const mix = smoothstep(0.3, 0.7, t)
            mixRef.current.book = 1 - mix
            mixRef.current.sky = mix
          }
          if (t >= 0.5 && !tr.swapped) {
            tr.swapped = true
            setPageVisible(false)
            setView('sky')
          }
        } else if (tr.kind === 'descend') {
          // sky → book: the reverse crossfade
          veilRef.current.opacity = pulse(t, 0.0, 0.42, 0.58, 1.0)
          {
            const mix = smoothstep(0.3, 0.7, t)
            mixRef.current.book = mix
            mixRef.current.sky = 1 - mix
          }
          if (t >= 0.5 && !tr.swapped) {
            tr.swapped = true
            setView('page')
            setPageVisible(true)
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
          if (tr.kind === 'rise') setSkyPhase('open')
          if (tr.kind === 'descend') setSkyPhase('hidden')
          setBusy(false)
        }
      }
      if (bookWrapRef.current) bookWrapRef.current.style.opacity = String(mixRef.current.book)
      if (skyWrapRef.current) skyWrapRef.current.style.opacity = String(mixRef.current.sky)
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])

  const open = useCallback(() => {
    if (transRef.current) return
    setBusy(true)
    transRef.current = {
      kind: 'open',
      start: performance.now(),
      firstIndex: targetIndex,
    }
  }, [targetIndex])

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

  const rise = useCallback(() => {
    if (transRef.current || view !== 'page') return
    setBusy(true)
    setSkyMounted(true)
    setSkyPhase('rising')
    transRef.current = { kind: 'rise', dur: RISE_MS, start: performance.now() }
  }, [view])

  const descend = useCallback(() => {
    if (transRef.current || view !== 'sky') return
    setBusy(true)
    transRef.current = { kind: 'descend', dur: RISE_MS, start: performance.now() }
  }, [view])

  // after a rite settles the journal opens itself, turned to the new entry —
  // the desktop "lands on" the page rather than showing the landing screen
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (newEntryId && view === 'landing' && !transRef.current) open()
  }, [newEntryId, view, open])

  useEffect(() => {
    const onKey = (e) => {
      if (view === 'landing' && (e.key === 'Enter' || e.key === ' ')) open()
      // entries are newest-first: turn(+1) = older = earlier in time
      if (view === 'page' && e.key === 'ArrowLeft') turn(1)
      if (view === 'page' && e.key === 'ArrowRight') turn(-1)
      if (view === 'sky' && e.key === 'Escape') descend()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, open, turn, descend])

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
      {onSignOut && (
        <button
          onClick={onSignOut}
          style={{
            position: 'absolute',
            top: 20,
            right: 24,
            zIndex: 5,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            font: 'italic 13px Palatino, Georgia, serif',
            color: view === 'page' ? 'rgba(28,24,20,0.4)' : 'rgba(231,222,198,0.4)',
          }}
        >
          sign out
        </button>
      )}
      {sessionId && (
        <div
          style={{
            position: 'absolute',
            bottom: 22,
            left: 24,
            zIndex: 5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <div
            style={{
              padding: 7,
              background: '#fff',
              borderRadius: 3,
              border: '1px solid rgba(28,24,20,0.12)',
            }}
          >
            <QRCodeSVG
              value={`${window.location.origin}/?s=${sessionId}`}
              size={78}
              fgColor="#1C1814"
              bgColor="#fff"
              level="M"
            />
          </div>
          <div
            style={{
              font: '300 9px ui-monospace, SFMono-Regular, monospace',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: view === 'page' ? 'rgba(28,24,20,0.45)' : 'rgba(231,222,198,0.5)',
            }}
          >
            begin again
          </div>
        </div>
      )}
      <style>{`@keyframes jFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div ref={bookWrapRef} style={{ position: 'absolute', inset: 0 }}>
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
      </div>

      {skyMounted && (
        <div ref={skyWrapRef} style={{ position: 'absolute', inset: 0, opacity: 0 }}>
          <Suspense fallback={null}>
            <CollectiveSky entries={entries} hand={handStyle} phase={skyPhase} />
          </Suspense>
        </div>
      )}

      {pageVisible && <EntryPage entry={entries[index]} handStyle={handStyle} />}

      {!busy && view === 'page' && (
        <ChapterIndex entries={entries} currentIndex={index} onJump={jumpTo} />
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
            {entries.length - index} of {entries.length}
          </span>
          <button style={{ ...inkBtn, opacity: index <= 0 ? 0.3 : 1 }} onClick={() => turn(-1)}>
            later →
          </button>
        </div>
      )}
      {!busy && view === 'page' && HAS_MAPBOX && (
        <button
          onClick={rise}
          style={{
            position: 'absolute',
            top: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 5,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            font: 'italic 14px Palatino, Georgia, serif',
            letterSpacing: '0.12em',
            color: 'rgba(28,24,20,0.42)',
          }}
        >
          ↑ rise to the field
        </button>
      )}
      {!busy && view === 'sky' && (
        <button
          onClick={descend}
          style={{
            position: 'absolute',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 5,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            font: 'italic 14px Palatino, Georgia, serif',
            letterSpacing: '0.12em',
            color: 'rgba(231,222,198,0.5)',
          }}
        >
          ↓ return to the book
        </button>
      )}
    </div>
  )
}
