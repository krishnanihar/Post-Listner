import { useEffect, useRef, useState } from 'react'
import CloudCanvas from './CloudCanvas'

/**
 * CloudTest — standalone dev route (/cloud-test) for developing the
 * volumetric cloud veil in isolation.
 *
 * `?cover=0.6` holds the coverage steady at that value; with no param the
 * coverage slowly oscillates 0 -> 1 -> 0 so the bloom-in/out can be seen.
 */
export default function CloudTest() {
  const veilRef = useRef({ opacity: 0 })
  const [cover, setCover] = useState(0)

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('cover')
    if (param != null) {
      const v = Math.min(1, Math.max(0, parseFloat(param)))
      veilRef.current.opacity = v
      setCover(v)
      return
    }
    let raf
    const t0 = performance.now()
    const tick = () => {
      const t = (performance.now() - t0) / 1000
      const v = 0.5 - 0.5 * Math.cos(t * 2.6) // 0..1..0
      veilRef.current.opacity = v
      setCover(v)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="h-full w-full" style={{ background: '#140f09', position: 'relative' }}>
      <CloudCanvas veilRef={veilRef} />
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: '#e7dec6',
          font: '300 13px ui-monospace, monospace',
          opacity: 0.7,
        }}
      >
        cover {cover.toFixed(2)}
      </div>
    </div>
  )
}
