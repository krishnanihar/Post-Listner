/**
 * skyStyle — the journal sky's custom Mapbox style, code-defined (spec §4.2).
 *
 * A Mapbox style spec v8 object: a void-ocean background + a single faint ink
 * land fill from Mapbox's public country-boundaries tileset, drawn with no
 * outline so the union of country polygons reads as continents and no borders
 * show. Nothing else — no roads, labels, POIs, water, symbols.
 *
 * SKY_FOG is passed to map.setFog() once the style loads — the atmospheric
 * halo at the globe's edge.
 */

// One worldview only — drops disputed double-polygons so the faint fill never
// stacks into brighter seams.
const LAND_FILTER = [
  'all',
  ['==', ['get', 'disputed'], 'false'],
  ['any', ['==', 'all', ['get', 'worldview']], ['in', 'US', ['get', 'worldview']]],
]

export const SKY_STYLE = {
  version: 8,
  sources: {
    countries: {
      type: 'vector',
      url: 'mapbox://mapbox.country-boundaries-v1',
    },
  },
  layers: [
    {
      id: 'void-ocean',
      type: 'background',
      paint: { 'background-color': '#06070c' },
    },
    {
      id: 'ink-land',
      type: 'fill',
      source: 'countries',
      'source-layer': 'country_boundaries',
      filter: LAND_FILTER,
      paint: { 'fill-color': '#12141d', 'fill-opacity': 1 },
    },
  ],
}

export const SKY_FOG = {
  range: [0.8, 8],
  color: '#0a0b12',
  'high-color': '#1a1c2e',
  'space-color': '#04040a',
  'horizon-blend': 0.04,
  'star-intensity': 0.15,
}
