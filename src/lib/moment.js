// Shared helpers for the Moment phase data shape.
//
// Two flows write different fields:
//   • Score flow (Moment.score.jsx, the active path) writes
//     { totalDownbeats, avgGestureGain, tactus } over a 30s phase.
//   • Legacy flow (Moment.jsx) wrote { peakTapRate, totalTaps, ... }.
//
// computeBpm prefers the score-flow signal and falls back to the legacy one
// so both shapes produce a real BPM (not the 40 BPM clamp from a missing field).

const MOMENT_DURATION_SEC = 30

export function computeBpm(moment) {
  if (!moment) return null
  if (typeof moment.totalDownbeats === 'number' && moment.totalDownbeats > 0) {
    return Math.round((moment.totalDownbeats * 60) / MOMENT_DURATION_SEC)
  }
  if (typeof moment.peakTapRate === 'number' && moment.peakTapRate > 0) {
    return Math.round(moment.peakTapRate * 60)
  }
  return null
}
