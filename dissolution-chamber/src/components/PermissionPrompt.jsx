/**
 * Handles iOS DeviceMotion permission and AudioContext creation.
 * Must be called from a user gesture handler.
 */
export async function requestPermissions() {
  let hasMotionPermission = false;

  // Request iOS DeviceMotion permission
  if (
    typeof DeviceMotionEvent !== 'undefined' &&
    typeof DeviceMotionEvent.requestPermission === 'function'
  ) {
    try {
      const permission = await DeviceMotionEvent.requestPermission();
      hasMotionPermission = permission === 'granted';
    } catch {
      hasMotionPermission = false;
    }
  } else {
    // Android or desktop — no permission needed
    hasMotionPermission = true;
  }

  // Create AudioContext (must happen during user gesture)
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioCtx();
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  return { audioContext, hasMotionPermission };
}
