/* Sacred geometry background layer for /conduct-glb.
 *
 * Renders Metatron's Cube from /public/conductor/sacred-metatron.glb in a
 * transparent R3F canvas behind the celestial field. The cube slowly
 * auto-rotates so the structure feels alive without the user doing
 * anything. Edges + nodes are styled in soft amber so they sit gently
 * against the parchment without competing with the ink trail.
 *
 * Later tasks add:
 *   - Trail-passage edge lighting (Task 2)
 *   - Stem-reactive node pulses (Task 5)
 */
import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'

const GEOMETRY_URL = '/conductor/sacred-metatron.glb'
useGLTF.preload(GEOMETRY_URL)

function MetatronCube() {
  const groupRef = useRef()
  const { scene } = useGLTF(GEOMETRY_URL)

  // Auto-rotate ~5°/s on Y, slight 1°/s drift on X for a non-flat look.
  useFrame((_, delta) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y += delta * (5 * Math.PI / 180)
    groupRef.current.rotation.x += delta * (1 * Math.PI / 180)
  })

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  )
}

export default function SacredGeometryLayer() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 38, near: 0.1, far: 20 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.6} color="#FFE2B0" />
        <directionalLight position={[2, 3, 2]} intensity={0.4} color="#FFD494" />
        <Suspense fallback={null}>
          <MetatronCube />
        </Suspense>
      </Canvas>
    </div>
  )
}
