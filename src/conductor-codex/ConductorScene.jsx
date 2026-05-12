import { forwardRef, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MathUtils, PCFShadowMap, Vector3 } from 'three'

// PostListener score-page palette — cream parchment with ink figure.
// (see src/score/tokens.js)
const PAPER = '#F2EBD8'    // paperCream — scene bg matches the shell bg
const INK = '#1C1814'      // inkCream — main figure/silhouette color
const INK_SOFT = '#3F3328' // softer ink for forms one step back
const AMBER = '#D4A053'    // scoreAmber accent
const AMBER_DEEP = '#8A6234'
const TRAIL_COUNT = 7

const Segment = forwardRef(function Segment(
  { radius = 0.04, color = BODY, emissive = '#000000', emissiveIntensity = 0 },
  ref,
) {
  return (
    <mesh ref={ref} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, 1, 18]} />
      <meshStandardMaterial
        color={color}
        roughness={0.58}
        metalness={0.05}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  )
})

function setSegment(mesh, start, end, scratch) {
  if (!mesh) return
  scratch.direction.copy(end).sub(start)
  const length = scratch.direction.length()
  if (length < 0.001) return

  scratch.midpoint.copy(start).add(end).multiplyScalar(0.5)
  mesh.position.copy(scratch.midpoint)
  mesh.scale.set(1, length, 1)
  mesh.quaternion.setFromUnitVectors(scratch.up, scratch.direction.normalize())
}

function OrchestraArc() {
  const stands = useMemo(() => {
    const rows = []
    for (let i = 0; i < 15; i += 1) {
      const t = i / 14
      const angle = MathUtils.lerp(-2.35, -0.78, t)
      const radius = i % 2 === 0 ? 3.15 : 3.65
      // Ink-on-cream: alternating full ink / softer ink for subtle arc depth.
      rows.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius + 1.05,
        rotation: -angle + Math.PI * 0.5,
        color: i % 2 === 0 ? INK : INK_SOFT,
      })
    }
    return rows
  }, [])

  return (
    <group>
      {stands.map((stand, index) => (
        <group key={index} position={[stand.x, 0.08, stand.z]} rotation={[0, stand.rotation, 0]}>
          <mesh castShadow receiveShadow position={[0, 0.18, 0]}>
            <boxGeometry args={[0.42, 0.08, 0.3]} />
            <meshStandardMaterial color={INK} roughness={0.85} />
          </mesh>
          <mesh castShadow position={[0, 0.55, -0.08]} rotation={[-0.35, 0, 0]}>
            <boxGeometry args={[0.46, 0.32, 0.035]} />
            <meshStandardMaterial color={stand.color} roughness={0.55} metalness={0} />
          </mesh>
          <mesh castShadow position={[0, 0.34, -0.02]}>
            <cylinderGeometry args={[0.018, 0.018, 0.58, 8]} />
            <meshStandardMaterial color={INK_SOFT} roughness={0.6} metalness={0} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Stage() {
  return (
    <group>
      {/* Sepia stage floor — a slightly darker shade than the paper so the
          figure has a believable base without breaking the cream-page look. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[4.9, 96]} />
        <meshStandardMaterial color="#D8C8A2" roughness={0.95} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <ringGeometry args={[0.72, 0.78, 96]} />
        <meshBasicMaterial color={INK_SOFT} transparent opacity={0.55} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0.34]} receiveShadow>
        <ringGeometry args={[1.72, 1.76, 128, 1, Math.PI * 0.05, Math.PI * 0.9]} />
        <meshBasicMaterial color={AMBER_DEEP} transparent opacity={0.42} />
      </mesh>
      <OrchestraArc />
    </group>
  )
}

function ConductorFigure({ stateRef }) {
  const groupRef = useRef(null)
  const torsoRef = useRef(null)
  const headRef = useRef(null)
  const rightUpperRef = useRef(null)
  const rightLowerRef = useRef(null)
  const leftUpperRef = useRef(null)
  const leftLowerRef = useRef(null)
  const batonRef = useRef(null)
  const batonTipRef = useRef(null)
  const rightHandRef = useRef(null)
  const leftHandRef = useRef(null)
  const targetRef = useRef(null)
  const beatRingRef = useRef(null)
  const trailRefs = useRef([])
  const trailPoints = useRef(Array.from({ length: TRAIL_COUNT }, () => new Vector3(0.45, 1.45, 0.5)))
  const smoothed = useRef({ pitch: 0, roll: 0, yaw: 0, energy: 0.08, articulation: 0 })

  const scratchRef = useRef({
    up: new Vector3(0, 1, 0),
    direction: new Vector3(),
    midpoint: new Vector3(),
    rightShoulder: new Vector3(),
    leftShoulder: new Vector3(),
    rightElbow: new Vector3(),
    leftElbow: new Vector3(),
    rightHand: new Vector3(),
    leftHand: new Vector3(),
    batonTip: new Vector3(),
    batonTail: new Vector3(),
    target: new Vector3(),
  })

  useFrame(({ clock }, delta) => {
    const scratch = scratchRef.current
    const relay = stateRef.current.controls
    const current = smoothed.current
    const elapsed = clock.elapsedTime

    current.pitch = MathUtils.damp(current.pitch, relay.pitch, 8.5, delta)
    current.roll = MathUtils.damp(current.roll, relay.roll, 8.5, delta)
    current.yaw = MathUtils.damp(current.yaw, relay.yaw, 7.5, delta)
    current.energy = MathUtils.damp(current.energy, Math.max(0.08, relay.energy), 4.5, delta)
    current.articulation = MathUtils.damp(current.articulation, relay.articulation, 7, delta)

    const now = performance.now()
    const beatAge = relay.lastDownbeatAt ? (now - relay.lastDownbeatAt) / 1000 : 999
    const beatIntensity = relay.downbeatIntensity || 0
    const downStroke = beatAge < 0.14 ? (1 - beatAge / 0.14) * beatIntensity : 0
    const rebound = beatAge >= 0.14 && beatAge < 0.42
      ? (1 - (beatAge - 0.14) / 0.28) * beatIntensity
      : 0
    const beatAlpha = Math.max(0, 1 - beatAge / 0.92) * beatIntensity
    const breath = Math.sin(elapsed * 1.35) * 0.025
    const quickness = 1 + current.articulation * 0.22

    if (groupRef.current) {
      groupRef.current.rotation.y = current.yaw * 0.34
      groupRef.current.rotation.z = current.roll * -0.035
    }
    if (torsoRef.current) {
      torsoRef.current.rotation.x = -current.pitch * 0.07
      torsoRef.current.rotation.z = current.roll * 0.035
      torsoRef.current.position.y = 0.88 + breath
    }
    if (headRef.current) {
      headRef.current.position.set(current.yaw * 0.035, 1.66 + breath * 0.55, 0.02)
      headRef.current.rotation.y = current.yaw * 0.4
      headRef.current.rotation.z = current.roll * -0.08
    }

    scratch.rightShoulder.set(0.34, 1.34 + breath, 0.02)
    scratch.leftShoulder.set(-0.34, 1.31 + breath, 0.02)

    // The figure faces -Z (away from camera, toward the orchestra arc).
    // All hand / baton Z components are NEGATIVE here so the conductor
    // extends the baton forward (toward orchestra), not backward (toward
    // the audience / camera). Forward tilt drives the hand further -Z;
    // back tilt pulls it toward 0 / slight +Z.
    scratch.rightHand.set(
      0.45 + current.roll * 0.72 + current.yaw * 0.42,
      1.28 + Math.max(current.pitch, 0) * 0.46 - Math.max(-current.pitch, 0) * 0.28 + breath
        - downStroke * 0.48 + rebound * 0.22,
      -0.4 - Math.max(current.pitch, 0) * 0.72 + Math.max(-current.pitch, 0) * 0.34
        - current.energy * 0.14 - downStroke * 0.34,
    )
    scratch.rightHand.multiplyScalar(quickness)
    scratch.rightHand.x += (1 - quickness) * 0.45
    scratch.rightHand.y += (1 - quickness) * 1.28
    scratch.rightHand.z += (1 - quickness) * -0.4

    scratch.leftHand.set(
      -0.42 + current.roll * 0.2 + current.yaw * 0.18,
      1.08 + current.pitch * 0.14 + breath * 0.6 + rebound * 0.08,
      -0.2 - Math.max(current.pitch, 0) * 0.2 + Math.max(-current.pitch, 0) * 0.12,
    )

    scratch.rightElbow.copy(scratch.rightShoulder).lerp(scratch.rightHand, 0.48)
    scratch.rightElbow.x += Math.sign(scratch.rightHand.x - scratch.rightShoulder.x || 1) * 0.18
    scratch.rightElbow.y -= 0.13 + downStroke * 0.08
    scratch.rightElbow.z -= 0.12   // elbow sits slightly forward of shoulder

    scratch.leftElbow.copy(scratch.leftShoulder).lerp(scratch.leftHand, 0.54)
    scratch.leftElbow.x -= 0.16
    scratch.leftElbow.y -= 0.1
    scratch.leftElbow.z -= 0.08

    // Baton extends from hand in -Z (forward, toward orchestra). Pitch
    // forward pushes the tip further forward; roll pulls it slightly back
    // toward the body as the arm sweeps sideways.
    scratch.batonTip.set(
      scratch.rightHand.x + current.roll * 0.28 + current.yaw * 0.16,
      scratch.rightHand.y + 0.22 + Math.max(current.pitch, 0) * 0.36 + rebound * 0.16,
      scratch.rightHand.z - 0.74 - Math.max(current.pitch, 0) * 0.18 + Math.abs(current.roll) * 0.08,
    )
    scratch.batonTail.copy(scratch.rightHand)

    setSegment(rightUpperRef.current, scratch.rightShoulder, scratch.rightElbow, scratch)
    setSegment(rightLowerRef.current, scratch.rightElbow, scratch.rightHand, scratch)
    setSegment(leftUpperRef.current, scratch.leftShoulder, scratch.leftElbow, scratch)
    setSegment(leftLowerRef.current, scratch.leftElbow, scratch.leftHand, scratch)
    setSegment(batonRef.current, scratch.batonTail, scratch.batonTip, scratch)

    if (rightHandRef.current) rightHandRef.current.position.copy(scratch.rightHand)
    if (leftHandRef.current) leftHandRef.current.position.copy(scratch.leftHand)
    if (batonTipRef.current) {
      batonTipRef.current.position.copy(scratch.batonTip)
      batonTipRef.current.scale.setScalar(1 + beatAlpha * 0.9)
    }
    if (targetRef.current) {
      targetRef.current.position.set(scratch.rightHand.x, 0.028, scratch.rightHand.z)
      targetRef.current.scale.setScalar(0.85 + current.energy * 0.45 + beatAlpha * 0.6)
    }
    if (beatRingRef.current) {
      beatRingRef.current.scale.setScalar(0.9 + Math.min(beatAge, 0.62) * 4.2)
      beatRingRef.current.material.opacity = beatAlpha * 0.42
    }

    trailPoints.current[0].lerp(scratch.batonTip, Math.min(1, delta * 16))
    for (let i = 1; i < trailPoints.current.length; i += 1) {
      trailPoints.current[i].lerp(trailPoints.current[i - 1], Math.min(1, delta * 8))
    }
    trailRefs.current.forEach((mesh, index) => {
      if (!mesh) return
      mesh.position.copy(trailPoints.current[index])
      mesh.scale.setScalar(Math.max(0.045, 0.12 - index * 0.011))
      mesh.material.opacity = Math.max(0.08, 0.46 - index * 0.055)
    })

    if (typeof window !== 'undefined') {
      window.__conductCodexReady = true
      window.__conductCodexPose = {
        controls: {
          pitch: Number(current.pitch.toFixed(3)),
          roll: Number(current.roll.toFixed(3)),
          yaw: Number(current.yaw.toFixed(3)),
          energy: Number(current.energy.toFixed(3)),
          articulation: Number(current.articulation.toFixed(3)),
        },
        rightHand: scratch.rightHand.toArray().map((value) => Number(value.toFixed(3))),
        batonTip: scratch.batonTip.toArray().map((value) => Number(value.toFixed(3))),
        torsoYaw: Number((groupRef.current?.rotation.y || 0).toFixed(3)),
        beatAlpha: Number(beatAlpha.toFixed(3)),
      }
    }
  })

  return (
    <group ref={groupRef} position={[0, 0.02, 0]}>
      {/* All body parts are pure ink — the figure reads as a silhouette
          against cream paper, matching the etched-illustration reference. */}
      <mesh ref={torsoRef} castShadow receiveShadow position={[0, 0.88, 0]}>
        <capsuleGeometry args={[0.28, 0.48, 8, 18]} />
        <meshStandardMaterial color={INK} roughness={0.9} metalness={0} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 1.29, 0.035]} scale={[1.4, 0.22, 0.18]}>
        <sphereGeometry args={[0.27, 24, 12]} />
        <meshStandardMaterial color={INK} roughness={0.85} />
      </mesh>
      {/* Head + hair tuft on the back of the skull. Group is the parent so
          headRef yaw/roll in useFrame rotates the hair with the head.
          Initial rotation.x tilts the head forward (chin to chest) —
          reads as "conductor looking down at score / orchestra" and
          asymmetrically distinguishes back-of-head from front. */}
      <group ref={headRef} position={[0, 1.66, 0.02]} rotation={[-0.2, 0, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.17, 32, 16]} />
          <meshStandardMaterial color={INK} roughness={0.85} />
        </mesh>
        {/* Hair tuft — slightly larger flattened dome on the back+top of
            the skull. The +Z offset puts it on the back side of the head
            since the figure faces -Z. */}
        <mesh castShadow position={[0, 0.04, 0.07]} scale={[0.95, 0.65, 1.0]}>
          <sphereGeometry args={[0.175, 24, 12]} />
          <meshStandardMaterial color={INK} roughness={0.95} />
        </mesh>
        {/* Headphone band — half-torus arcing from one ear over the
            crown to the other. Default TorusGeometry sits in the XY
            plane with arc from +X through +Y to -X — exactly what we
            need for an ear-over-crown-to-ear shape. Radius 0.19 > head
            radius 0.17 so the band rests just above the skin. */}
        <mesh castShadow position={[0, 0, -0.01]}>
          <torusGeometry args={[0.19, 0.014, 8, 28, Math.PI]} />
          <meshStandardMaterial color={INK} roughness={0.6} metalness={0.15} />
        </mesh>
        {/* Earpiece cups — short cylinders flanking the head at the
            band's anchor points. Cylinder default axis is Y; rotate
            π/2 around Z so axis becomes X, caps face outward from the
            skull. */}
        <mesh castShadow position={[0.18, 0, -0.005]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.055, 0.05, 0.05, 18]} />
          <meshStandardMaterial color={INK} roughness={0.7} />
        </mesh>
        <mesh castShadow position={[-0.18, 0, -0.005]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.055, 0.05, 18]} />
          <meshStandardMaterial color={INK} roughness={0.7} />
        </mesh>
      </group>
      {/* Long coat — replaces the small pedestal. Tapered cylinder from
          waist down to the hem near the floor, flared so the silhouette
          reads as a person in a knee-/floor-length coat from behind. */}
      <mesh castShadow receiveShadow position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.32, 0.5, 0.7, 24]} />
        <meshStandardMaterial color={INK} roughness={0.95} />
      </mesh>
      {/* Coat hem ring — slight darker band at the bottom for shape
          definition, matches the etched-illustration line work. */}
      <mesh receiveShadow position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.5, 32]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <Segment ref={rightUpperRef} radius={0.052} color={INK} />
      <Segment ref={rightLowerRef} radius={0.045} color={INK} />
      <Segment ref={leftUpperRef} radius={0.047} color={INK} />
      <Segment ref={leftLowerRef} radius={0.04} color={INK} />
      {/* Baton is amber-glow on cream — the single warm point of light. */}
      <Segment ref={batonRef} radius={0.012} color={AMBER} emissive={AMBER} emissiveIntensity={0.4} />
      <mesh ref={rightHandRef} castShadow>
        <sphereGeometry args={[0.072, 20, 12]} />
        <meshStandardMaterial color={INK} roughness={0.85} />
      </mesh>
      <mesh ref={leftHandRef} castShadow>
        <sphereGeometry args={[0.062, 18, 10]} />
        <meshStandardMaterial color={INK} roughness={0.85} />
      </mesh>
      <mesh ref={batonTipRef}>
        <sphereGeometry args={[0.06, 24, 12]} />
        <meshStandardMaterial color="#FFE8B3" emissive={AMBER} emissiveIntensity={1.45} />
      </mesh>
      {Array.from({ length: TRAIL_COUNT }).map((_, index) => (
        <mesh
          key={index}
          ref={(node) => {
            trailRefs.current[index] = node
          }}
        >
          <sphereGeometry args={[1, 16, 8]} />
          {/* On cream paper the trail needs strong contrast — use amber
              near the tip fading to deep amber, both readable against
              parchment. */}
          <meshBasicMaterial
            color={index < 3 ? AMBER : AMBER_DEEP}
            transparent
            opacity={0.35}
          />
        </mesh>
      ))}
      <mesh ref={targetRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.24, 40]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0.44} />
      </mesh>
      <mesh ref={beatRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0.18]}>
        <ringGeometry args={[0.52, 0.56, 72]} />
        <meshBasicMaterial color={AMBER} transparent opacity={0} />
      </mesh>
    </group>
  )
}

function SceneContents({ stateRef }) {
  return (
    <>
      {/* No <color attach="background"> — the canvas is transparent so the
          parchment + constellation overlay underneath show through where
          the figure / stands don't occlude. Fog still uses PAPER so distant
          geometry fades cleanly into the paper color matching the shell. */}
      <fog attach="fog" args={[PAPER, 5.5, 11]} />
      {/* Bright, neutral lighting — the figure is meant to read as a flat
          ink silhouette, so we don't sculpt it with directional gradients. */}
      <ambientLight intensity={0.9} color="#FFF5E0" />
      <directionalLight
        castShadow
        position={[2.4, 5.5, 3.8]}
        intensity={0.55}
        color="#FFF0D2"
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={10}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      {/* Subtle amber accent light from the baton side. */}
      <pointLight position={[1.2, 1.6, 1.2]} intensity={0.6} color={AMBER} distance={4} />
      <Stage />
      <ConductorFigure stateRef={stateRef} />
    </>
  )
}

export default function ConductorScene({ stateRef }) {
  return (
    <Canvas
      shadows={{ type: PCFShadowMap }}
      dpr={[1, 2]}
      // Slightly elevated, looking down at the figure — matches the book-plate
      // reference framing where the figure is photographed from behind and
      // above, standing on its grassy mound.
      camera={{ position: [0, 2.05, 4.7], fov: 40, near: 0.1, far: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ camera }) => {
        camera.lookAt(0, 0.95, 0.1)
      }}
    >
      <SceneContents stateRef={stateRef} />
    </Canvas>
  )
}
