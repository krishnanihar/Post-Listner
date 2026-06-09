// Samples the AVD vector at ~1 Hz over a session into a trajectory. The live
// setInterval is the only untested glue; the start/sample/stop shaping is
// pure and injectable (read + explicit timestamps) for tests.

import { getAvd } from './avdStore.js'

function shapePoint(v, t) {
  return { t: t | 0, a: v.a, v: v.v, d: v.d }
}

export function createAvdRecorder({ read = getAvd } = {}) {
  let active = false
  let startedAt = 0
  let traj = []
  let timer = null

  return {
    isRecording: () => active,
    start(now, { intervalMs = 1000 } = {}) {
      active = true
      startedAt = now
      traj = [shapePoint(read(), 0)]
      if (intervalMs > 0 && typeof setInterval === 'function') {
        timer = setInterval(() => {
          if (active) traj.push(shapePoint(read(), Date.now() - startedAt))
        }, intervalMs)
      }
    },
    sample(now) {
      if (active) traj.push(shapePoint(read(), now - startedAt))
    },
    stop(now) {
      if (timer) { clearInterval(timer); timer = null }
      const finalVector = read()
      const result = {
        startedAt,
        endedAt: now,
        trajectory: [...traj, shapePoint(finalVector, now - startedAt)],
        finalVector,
      }
      active = false
      traj = []
      return result
    },
  }
}

// Host singleton (reads the live avdStore).
export const avdRecorder = createAvdRecorder()
