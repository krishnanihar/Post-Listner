const STORAGE_KEY = 'dissolution_chamber_collective';

// Seed data: ~20 fictional previous users spanning the AVD space
const SEED_DATA = [
  { arousal: 0.72, valence: 0.45, depth: 0.68 },
  { arousal: 0.34, valence: 0.78, depth: 0.52 },
  { arousal: 0.88, valence: 0.22, depth: 0.41 },
  { arousal: 0.51, valence: 0.63, depth: 0.77 },
  { arousal: 0.29, valence: 0.41, depth: 0.85 },
  { arousal: 0.65, valence: 0.55, depth: 0.60 },
  { arousal: 0.81, valence: 0.71, depth: 0.33 },
  { arousal: 0.43, valence: 0.32, depth: 0.72 },
  { arousal: 0.57, valence: 0.84, depth: 0.48 },
  { arousal: 0.39, valence: 0.59, depth: 0.91 },
  { arousal: 0.76, valence: 0.38, depth: 0.55 },
  { arousal: 0.62, valence: 0.67, depth: 0.63 },
  { arousal: 0.48, valence: 0.51, depth: 0.44 },
  { arousal: 0.85, valence: 0.29, depth: 0.78 },
  { arousal: 0.33, valence: 0.72, depth: 0.36 },
  { arousal: 0.55, valence: 0.48, depth: 0.69 },
  { arousal: 0.71, valence: 0.61, depth: 0.57 },
  { arousal: 0.44, valence: 0.39, depth: 0.82 },
  { arousal: 0.67, valence: 0.76, depth: 0.45 },
  { arousal: 0.52, valence: 0.53, depth: 0.61 },
];

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return [];
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function computeMean(entries) {
  const all = [...SEED_DATA, ...entries];
  const count = all.length;
  const sum = all.reduce(
    (acc, e) => ({
      arousal: acc.arousal + e.arousal,
      valence: acc.valence + e.valence,
      depth: acc.depth + e.depth,
    }),
    { arousal: 0, valence: 0, depth: 0 }
  );
  return {
    arousal: sum.arousal / count,
    valence: sum.valence / count,
    depth: sum.depth / count,
  };
}

export function getCollective() {
  const entries = loadEntries();
  const all = [...SEED_DATA, ...entries];
  return {
    mean: computeMean(entries),
    count: all.length,
  };
}

export function addEntry(avd) {
  const entries = loadEntries();
  entries.push({
    arousal: avd.arousal,
    valence: avd.valence,
    depth: avd.depth,
  });
  saveEntries(entries);
  return computeMean(entries);
}
