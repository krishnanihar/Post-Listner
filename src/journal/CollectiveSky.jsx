import { useEffect, useMemo, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { SKY_STYLE, SKY_FOG } from './skyStyle.js'
import { INTIMATE, EXPANDED, easeExpansion } from '../lib/skyPresets.js'
import { MOCK_COLLECTIVE } from '../lib/mockCollective.js'
import { jitterInCell } from '../lib/geo.js'

/**
 * CollectiveSky — the journal's third surface: a Mapbox GL globe of glyph-
 * lights (design doc §7, spec §4.1).
 *
 * The user's own entries glow warm in their "hand" hue; a mock collective is
 * a cooler, faint wash around them. Driven by `phase` from Journal:
 *   'rising' — held at the intimate framing on the user's cluster (under the
 *              cloud veil while the rise transition runs)
 *   'open'   — the one-shot slow zoom-out reveal, then idle auto-rotation
 *   'hidden' — descended; the map stays alive, idle
 *
 * Mounted inside Journal and crossfaded by an opacity wrapper Journal owns —
 * this component only fills its container.
 */

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const REVEAL_MS = 7000
const SPIN_DEG_PER_SEC = 1.4
// framing when the user has no placed entries — a calm globe overview
const DEFAULT_CENTER = { lat: 20, lng: 0 }

// [{ lat, lng }] → a GeoJSON FeatureCollection of Points
function toFeatureCollection(points) {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {},
    })),
  }
}

export default function CollectiveSky({ entries, hand, phase }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layersAddedRef = useRef(false)
  const revealingRef = useRef(false)

  // the user's own placed lights — entries that carry a region (spec §5.1)
  const selfPoints = useMemo(
    () =>
      (entries || [])
        .filter((e) => e && e.region)
        .map((e) => jitterInCell(e.region, e.id))
        .filter(Boolean),
    [entries],
  )

  // the framing the rise zooms to: the mean of the user's own lights
  const centroid = useMemo(() => {
    if (selfPoints.length === 0) return DEFAULT_CENTER
    const sum = selfPoints.reduce(
      (a, p) => ({ lat: a.lat + p.lat, lng: a.lng + p.lng }),
      { lat: 0, lng: 0 },
    )
    return { lat: sum.lat / selfPoints.length, lng: sum.lng / selfPoints.length }
  }, [selfPoints])

  const hasCluster = selfPoints.length > 0
  const selfColor = `hsl(${hand?.inkHue ?? 30}, 85%, 62%)`

  // build the map once
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return
    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: SKY_STYLE,
      projection: 'globe',
      center: [centroid.lng, centroid.lat],
      zoom: hasCluster ? INTIMATE.zoom : EXPANDED.zoom,
      minZoom: 1.1,
      maxZoom: 4.5, // privacy floor — no single light is individually resolvable
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: true, // Mapbox TOS requires attribution
    })
    mapRef.current = map

    map.on('style.load', () => {
      map.setFog(SKY_FOG)
      if (layersAddedRef.current) return
      layersAddedRef.current = true

      map.addSource('collective', {
        type: 'geojson',
        data: toFeatureCollection(MOCK_COLLECTIVE),
      })
      map.addLayer({
        id: 'collective-lights',
        type: 'circle',
        source: 'collective',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 1.1, 4.5, 3.6],
          'circle-color': '#7c90c0',
          'circle-blur': 1.0,
          'circle-opacity': 0.32,
        },
      })

      map.addSource('self', { type: 'geojson', data: toFeatureCollection(selfPoints) })
      map.addLayer({
        id: 'self-halo',
        type: 'circle',
        source: 'self',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 7, 4.5, 24],
          'circle-color': selfColor,
          'circle-blur': 1.0,
          'circle-opacity': 0.22,
        },
      })
      map.addLayer({
        id: 'self-core',
        type: 'circle',
        source: 'self',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 1.8, 4.5, 6.5],
          'circle-color': selfColor,
          'circle-blur': 0.45,
          'circle-opacity': 0.95,
        },
      })
      map.resize()
    })

    return () => {
      map.remove()
      mapRef.current = null
      layersAddedRef.current = false
    }
    // build once — centroid/hasCluster/selfPoints seed the constructor and
    // are then kept current by the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // keep the self layer in sync as entries change (e.g. a new rite settles)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersAddedRef.current) return
    const src = map.getSource('self')
    if (src) src.setData(toFeatureCollection(selfPoints))
  }, [selfPoints])

  // recolour the self lights if the hand changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !layersAddedRef.current) return
    map.setPaintProperty('self-halo', 'circle-color', selfColor)
    map.setPaintProperty('self-core', 'circle-color', selfColor)
  }, [selfColor])

  // phase choreography: hold INTIMATE while rising, run the reveal on 'open'
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (phase === 'rising') {
      map.jumpTo({
        center: [centroid.lng, centroid.lat],
        zoom: hasCluster ? INTIMATE.zoom : EXPANDED.zoom,
      })
    } else if (phase === 'open') {
      revealingRef.current = true
      map.easeTo({
        center: [centroid.lng, centroid.lat],
        zoom: EXPANDED.zoom,
        duration: REVEAL_MS,
        easing: easeExpansion,
      })
      map.once('moveend', () => {
        revealingRef.current = false
      })
    }
  }, [phase, centroid, hasCluster])

  // slow idle auto-rotation while the sky is open
  useEffect(() => {
    const map = mapRef.current
    if (!map || phase !== 'open') return
    let raf = 0
    let interacting = false
    let last = performance.now()
    const onDown = () => {
      interacting = true
    }
    const onUp = () => {
      interacting = false
    }
    map.on('mousedown', onDown)
    map.on('touchstart', onDown)
    map.on('mouseup', onUp)
    map.on('touchend', onUp)
    map.on('dragend', onUp)
    const spin = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!interacting && !revealingRef.current && !map.isMoving()) {
        const c = map.getCenter()
        c.lng += dt * SPIN_DEG_PER_SEC
        map.setCenter(c)
      }
      raf = requestAnimationFrame(spin)
    }
    raf = requestAnimationFrame(spin)
    return () => {
      cancelAnimationFrame(raf)
      map.off('mousedown', onDown)
      map.off('touchstart', onDown)
      map.off('mouseup', onUp)
      map.off('touchend', onUp)
      map.off('dragend', onUp)
    }
  }, [phase])

  if (!TOKEN) {
    // belt-and-braces — Journal hides the rise affordance without a token,
    // so this component is in practice never mounted unconfigured
    return <div style={{ position: 'absolute', inset: 0, background: '#06070c' }} />
  }
  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
}
