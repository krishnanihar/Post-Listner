// Era cluster detection for the autobiographical module.
// Krumhansl & Zupnick 2013: songs cluster around age 14–22 (the reminiscence
// bump). Without user age we cannot detect parental cascade, but we CAN
// detect when their three songs gather in a tight window — strong evidence
// the user is showing us their own formative period.

export function detectEraCluster(years) {
  const valid = (years || []).filter(y => typeof y === 'number' && y > 0).sort((a, b) => a - b)
  if (valid.length === 0) return { median: null, span: 0, clustered: false, tightCluster: false }
  if (valid.length === 1) return { median: valid[0], span: 0, clustered: false, tightCluster: false }
  const median = valid[Math.floor(valid.length / 2)]
  const span = valid[valid.length - 1] - valid[0]
  // tightCluster: ≤5yr — strong bump-period signal.
  // clustered: ≤10yr — decade-imprint signal (looser but meaningful).
  const tightCluster = span <= 5
  const clustered = span <= 10
  return { median, span, clustered, tightCluster }
}

export function buildEraLine(cluster) {
  if (!cluster || !cluster.median) return null
  const { median, span, clustered, tightCluster } = cluster
  if (tightCluster && span <= 3) {
    return `three songs from ${median}-ish — your bump period, maybe`
  }
  if (tightCluster) {
    return `your songs gather around ${median} — that's bump-period clustering`
  }
  if (clustered) {
    return `songs from a single decade — that's where your imprint lives`
  }
  return `your songs span ${span} years — you don't anchor to one moment`
}
