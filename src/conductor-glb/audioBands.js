/* Pure helpers for analyzing AnalyserNode frequency data.
 *
 * AnalyserNode.getByteFrequencyData fills a Uint8Array (length = fftSize / 2)
 * with values in [0, 255] per frequency bin. For fftSize = 256 you get 128
 * bins covering the audible range; bin 0 = lowest frequencies, bin 127 =
 * highest.
 *
 * Band slicing convention (for fftSize 256, 128 bins, 44.1 kHz sample rate):
 *   bass     = bins 0-3   (sub + bass)
 *   low-mid  = bins 4-15  (kick, snare body)
 *   mid      = bins 16-63 (vocals, midrange instruments)
 *   treble   = bins 64-127 (cymbals, air)
 */

export function bandAverage(freqData, startBin, endBin) {
  if (startBin > endBin) return 0
  const last = Math.min(endBin, freqData.length - 1)
  let sum = 0
  let count = 0
  for (let i = startBin; i <= last; i++) {
    sum += freqData[i]
    count++
  }
  return count > 0 ? sum / count / 255 : 0
}

/**
 * Detect a bass-band beat by edge-triggered threshold crossing with
 * refractory period. Same shape as the phone-side downbeat detector
 * (negative-Y zero-crossing) so the two beat sources feel consistent.
 *
 * @param {number} currentBass   bandAverage(bass) for this frame, 0..1
 * @param {number} prevBass      bandAverage(bass) from previous frame
 * @param {number} threshold     0..1 bass level that must be crossed
 * @param {number} refractoryEnd absolute timestamp; ignore beats until then
 * @param {number} now           current performance.now() timestamp
 * @returns {{ fired: boolean, nextRefractoryEnd: number }}
 */
export function detectBassBeat(currentBass, prevBass, threshold, refractoryEnd, now) {
  if (now < refractoryEnd) {
    return { fired: false, nextRefractoryEnd: refractoryEnd }
  }
  if (currentBass > threshold && prevBass <= threshold) {
    return { fired: true, nextRefractoryEnd: now + 250 }
  }
  return { fired: false, nextRefractoryEnd: refractoryEnd }
}
