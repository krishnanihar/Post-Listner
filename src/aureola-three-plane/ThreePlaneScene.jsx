import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  ClampToEdgeWrapping,
  LinearFilter,
  NoColorSpace,
  SRGBColorSpace,
  TextureLoader,
} from 'three/webgpu'
import AtmosphericGrain from './AtmosphericGrain'
import BackPlane from './BackPlane'
import MiddleShaderPlane from './MiddleShaderPlane'
import FrontFigurePlane from './FrontFigurePlane'

const PATHS = {
  back: '/three-plane-test/back-pool2-y1.png',
  backDepth: '/three-plane-test/back-pool2-y1-depth.png',
  front: '/three-plane-test/front-figure-v1.png',
  frontDepth: '/three-plane-test/front-figure-v1-depth.png',
}

const TILT_RANGE = 0.3 // world units of camera translation at ±1 normalized tilt

function configureColor(tex) {
  tex.colorSpace = SRGBColorSpace
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.wrapS = ClampToEdgeWrapping
  tex.wrapT = ClampToEdgeWrapping
}

function configureDepth(tex) {
  tex.colorSpace = NoColorSpace
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.wrapS = ClampToEdgeWrapping
  tex.wrapT = ClampToEdgeWrapping
}

// ThreePlaneScene — runs inside the Canvas. Owns texture loading + camera-tilt
// translation (single useFrame at this level rather than per-plane, so all
// three planes share one camera).
export default function ThreePlaneScene({
  getTilt,
  middleVisible,
  backDepthOn,
  frontVisible,
  middleZ,
  middleBaseRate,
}) {
  const {
    backColor,
    backDepth,
    frontColor,
    frontDepth,
  } = useMemo(() => {
    const loader = new TextureLoader()
    const backC = loader.load(PATHS.back)
    configureColor(backC)
    const backD = loader.load(PATHS.backDepth)
    configureDepth(backD)
    const frontC = loader.load(PATHS.front)
    configureColor(frontC)
    const frontD = loader.load(PATHS.frontDepth)
    configureDepth(frontD)
    return {
      backColor: backC,
      backDepth: backD,
      frontColor: frontC,
      frontDepth: frontD,
    }
  }, [])

  useEffect(() => () => {
    backColor.dispose()
    backDepth.dispose()
    frontColor.dispose()
    frontDepth.dispose()
  }, [backColor, backDepth, frontColor, frontDepth])

  // Camera tilt — one useFrame at the scene level so all three planes share
  // the same camera translation. The parallax between planes emerges from
  // their fixed z-positions (back -0.5, middle 0, front +0.5) under this
  // single shifted camera.
  useFrame(({ camera }, dt) => {
    const { x, y } = getTilt()
    const targetX = x * TILT_RANGE
    const targetY = y * TILT_RANGE
    const k = Math.min(1, dt * 6)
    camera.position.x += (targetX - camera.position.x) * k
    camera.position.y += (targetY - camera.position.y) * k
    camera.lookAt(0, 0, 0)
  })

  return (
    <>
      <BackPlane colorTex={backColor} depthTex={backDepth} depthOn={backDepthOn} />
      {middleVisible && (
        <MiddleShaderPlane
          getTilt={getTilt}
          baseRate={middleBaseRate}
          z={middleZ}
        />
      )}
      {frontVisible && (
        <FrontFigurePlane colorTex={frontColor} depthTex={frontDepth} />
      )}
      <AtmosphericGrain />
    </>
  )
}
