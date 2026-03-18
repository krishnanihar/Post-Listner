/**
 * Reads AVD (Arousal, Valence, Depth) from URL parameter or localStorage.
 * URL format: ?avd=0.65,0.35,0.72
 * localStorage key: postlistener_session → { avd: { a, v, d } }
 */
export function readAVD() {
  // Try URL parameter first
  const params = new URLSearchParams(window.location.search);
  const avdParam = params.get('avd');
  if (avdParam) {
    const parts = avdParam.split(',').map(Number);
    if (parts.length === 3 && parts.every((n) => !isNaN(n) && n >= 0 && n <= 1)) {
      return { arousal: parts[0], valence: parts[1], depth: parts[2] };
    }
  }

  // Fall back to localStorage
  try {
    const raw = localStorage.getItem('postlistener_session');
    if (raw) {
      const session = JSON.parse(raw);
      const avd = session.avd;
      if (avd && typeof avd.a === 'number') {
        return { arousal: avd.a, valence: avd.v, depth: avd.d };
      }
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}
