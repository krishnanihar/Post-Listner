/**
 * skyPresets — the camera presets for the journal→collective "rise" (spec §4.3).
 *
 * Mirrors roomPresets.js: two named endpoints + the project's one canonical
 * expansion curve. The design doc (§7, §9) frames the whole desktop
 * transition as the INTIMATE ↔ EXPANDED interpolation; this is that pattern
 * applied to the globe camera. CollectiveSky feeds these two zoom endpoints
 * and the easing into a single Mapbox easeTo, which interpolates internally —
 * so unlike roomPresets there is no per-frame sampler here.
 */
import { easeExpansion } from './roomPresets.js'

// INTIMATE — the user's own cluster, close. EXPANDED — the whole turning globe.
export const INTIMATE = { zoom: 4.2 }
export const EXPANDED = { zoom: 1.4 }

export { easeExpansion }
