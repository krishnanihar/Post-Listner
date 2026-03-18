const TRACK_LIBRARY = [
  { file: '/music/chamber-track.mp3', a: 0.5, v: 0.5, d: 0.6 },
  // Add more tracks here as they become available:
  // { file: '/music/high-arousal-high-valence.mp3', a: 0.8, v: 0.8, d: 0.5 },
  // { file: '/music/high-arousal-low-valence.mp3', a: 0.8, v: 0.2, d: 0.5 },
  // { file: '/music/low-arousal-high-valence.mp3', a: 0.2, v: 0.8, d: 0.5 },
  // { file: '/music/low-arousal-low-valence.mp3', a: 0.2, v: 0.2, d: 0.7 },
];

/**
 * Select the closest matching track to the user's AVD vector
 * by minimum Euclidean distance.
 */
export function selectTrack(userAVD) {
  let bestTrack = TRACK_LIBRARY[0];
  let bestDist = Infinity;

  for (const track of TRACK_LIBRARY) {
    const dist = Math.sqrt(
      (track.a - userAVD.arousal) ** 2 +
      (track.v - userAVD.valence) ** 2 +
      (track.d - userAVD.depth) ** 2
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestTrack = track;
    }
  }

  return bestTrack.file;
}
