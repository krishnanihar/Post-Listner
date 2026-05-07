// Era cluster detection for the autobiographical module.
// Krumhansl & Zupnick 2013: songs cluster around age 14–16 (the reminiscence bump).
// Without user age we cannot detect parental cascade — phase 2 only flags
// tight clusters and reports the median.

export function detectEraCluster(years) {
  const valid = (years || []).filter(y => typeof y === 'number' && y > 0).sort((a, b) => a - b)
  if (valid.length === 0) return { median: null, span: 0, clustered: false }
  if (valid.length === 1) return { median: valid[0], span: 0, clustered: false }
  const median = valid[Math.floor(valid.length / 2)]
  const span = valid[valid.length - 1] - valid[0]
  const clustered = span <= 5
  return { median, span, clustered }
}

export function buildEraLine(cluster) {
  if (!cluster || !cluster.median) return null
  const { median, span, clustered } = cluster
  if (clustered && span <= 3) {
    return `three songs from ${median}-ish — your bump period, maybe`
  }
  if (clustered) {
    return `your songs cluster around ${median}. that means something.`
  }
  return `your songs span ${span} years — you don't anchor to one moment`
}
