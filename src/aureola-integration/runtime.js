// Shared runtime state for the integration test: module-scoped TSL uniforms
// for live toggle switching, plus the imperative setters the route calls when
// debug toggles flip. Single instance per route assumed.
//
// Why separate from the components? React's fast-refresh requires .jsx files
// to export components only — non-component exports go here.

import { uniform } from 'three/tsl'

// ---- IntegrationBase shared constants ----
const IMAGE_ASPECT = 1672 / 941

export const INTEGRATION_BASE_CONSTANTS = {
  IMAGE_ASPECT,
  BASE_PLANE_W: 1.6,
  BASE_PLANE_H: 1.6 / IMAGE_ASPECT,
  COVER_HEADROOM: 1.45,
  DEPTH_STRENGTH: 0.4,
}

// ---- IntegrationEye / halo uniforms ----
export const DESATURATION_AMOUNT = 0.30

// desat: 0 normally, DESATURATION_AMOUNT when toggle C on.
// haloEnabled: 0 when toggle A off, 1 when on.
// basePlaneW/H: current world dimensions of the base plane (cover-scaled),
// updated each viewport resize so the halo can sample base color per-fragment.
export const desatU = uniform(0)
export const haloEnabledU = uniform(1)
export const basePlaneWU = uniform(1)
export const basePlaneHU = uniform(1)

export function setDesaturationEnabled(on) {
  desatU.value = on ? DESATURATION_AMOUNT : 0
}

export function setHaloEnabled(on) {
  haloEnabledU.value = on ? 1 : 0
}

export function setBasePlaneSize(w, h) {
  basePlaneWU.value = w
  basePlaneHU.value = h
}

// ---- AtmosphericGrain uniforms ----
export const GRAIN_OPACITY = 0.04
export const grainEnabledU = uniform(1)

export function setGrainEnabled(on) {
  grainEnabledU.value = on ? 1 : 0
}
