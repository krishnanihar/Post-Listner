/* Programmatic Metatron's Cube geometry.
 *
 * 13 node positions derived from the Fruit of Life:
 *   1 center  + 6 inner hexagon (radius r) + 6 outer hexagon (radius 2r)
 *
 * All hexagon nodes share the same angles (0°, 60°, 120°, 180°, 240°, 300°);
 * the outer ring sits on the same rays as the inner ring at double the radius.
 *
 * The canonical Metatron's Cube is the complete graph on these 13 nodes —
 * every pair connected — yielding 78 unique edges. Drawing all 78 produces
 * the recognizable star-and-cube watermark pattern.
 */

export function computeMetatronNodes(radius = 1) {
  const nodes = [{ x: 0, y: 0 }]
  for (let i = 0; i < 6; i++) {
    const a = (i * 60) * Math.PI / 180
    nodes.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius })
  }
  for (let i = 0; i < 6; i++) {
    const a = (i * 60) * Math.PI / 180
    nodes.push({ x: Math.cos(a) * radius * 2, y: Math.sin(a) * radius * 2 })
  }
  return nodes
}

export function computeMetatronEdges(nodeCount = 13) {
  const edges = []
  for (let i = 0; i < nodeCount; i++) {
    for (let j = i + 1; j < nodeCount; j++) {
      edges.push([i, j])
    }
  }
  return edges
}
