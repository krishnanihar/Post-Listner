import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import {
  TextureLoader,
  SRGBColorSpace,
  NoColorSpace,
  LinearFilter,
  ClampToEdgeWrapping,
} from 'three/webgpu'
import { AUREOLA_V3 } from '../aureola/config'
import IntegrationBase from './IntegrationBase'
import { INTEGRATION_BASE_CONSTANTS } from './runtime'
import IntegrationEye from './IntegrationEye'
import AtmosphericGrain from './AtmosphericGrain'

const COLOR_PATH = '/test-integration/base-scene-pool2-y1.png'
const DEPTH_PATH = '/test-integration/base-scene-pool2-y1-depth.png'
const EYE_PATH = '/test-integration/object-eye-v1.png'

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

// IntegrationScene — runs inside Canvas. Owns texture loading + viewport-derived
// world geometry. Loads base color, base depth, and Eye textures once; derives
// the current world dimensions of the base plane and the bindu's world position
// from viewport. Threads the base color texture into IntegrationEye so the
// halo can sample it per-fragment for the light-wrap effect.
export default function IntegrationScene({ getTilt, hideEye, grainOn }) {
  const { viewport } = useThree()

  // Load + configure all textures once
  const { colorTex, depthTex, eyeTex } = useMemo(() => {
    const loader = new TextureLoader()
    const color = loader.load(COLOR_PATH)
    configureColor(color)
    const depth = loader.load(DEPTH_PATH)
    configureDepth(depth)
    const eye = loader.load(EYE_PATH)
    configureColor(eye)
    return { colorTex: color, depthTex: depth, eyeTex: eye }
  }, [])

  useEffect(() => () => {
    colorTex.dispose()
    depthTex.dispose()
    eyeTex.dispose()
  }, [colorTex, depthTex, eyeTex])

  // Viewport-derived world geometry — base plane scales to cover the viewport
  // (matches IntegrationBase's mesh.scale calculation), so the bindu's world
  // position changes with viewport. AUREOLA_V3.bindu provides the normalized
  // image-coords; we map to R3F world (Y+ up).
  const { basePlaneW, basePlaneH, binduWorld, halfDiag } = useMemo(() => {
    const aspect = viewport.width / viewport.height
    const baseScale = aspect > INTEGRATION_BASE_CONSTANTS.IMAGE_ASPECT
      ? viewport.width / INTEGRATION_BASE_CONSTANTS.BASE_PLANE_W
      : viewport.height / INTEGRATION_BASE_CONSTANTS.BASE_PLANE_H
    const scale = baseScale * INTEGRATION_BASE_CONSTANTS.COVER_HEADROOM
    const planeW = INTEGRATION_BASE_CONSTANTS.BASE_PLANE_W * scale
    const planeH = INTEGRATION_BASE_CONSTANTS.BASE_PLANE_H * scale
    return {
      basePlaneW: planeW,
      basePlaneH: planeH,
      binduWorld: {
        x: (AUREOLA_V3.bindu.cx - 0.5) * planeW,
        y: (0.5 - AUREOLA_V3.bindu.cy) * planeH,
        z: 0,
      },
      halfDiag: Math.sqrt(planeW * planeW + planeH * planeH) / 2,
    }
  }, [viewport.width, viewport.height])

  return (
    <>
      <IntegrationBase colorTex={colorTex} depthTex={depthTex} getTilt={getTilt} />
      {!hideEye && (
        <IntegrationEye
          eyeTex={eyeTex}
          baseColorTex={colorTex}
          binduWorld={binduWorld}
          halfDiag={halfDiag}
          basePlaneW={basePlaneW}
          basePlaneH={basePlaneH}
        />
      )}
      {grainOn && <AtmosphericGrain />}
    </>
  )
}
