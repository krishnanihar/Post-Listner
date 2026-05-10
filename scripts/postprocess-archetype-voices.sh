#!/bin/bash
# Trim leading silence from the 6 archetype Forer voiceovers.
# The model takes ~400ms to generate the first phoneme — without trimming,
# audio starts with dead silence and listeners perceive the first word
# as missing.
#
# This is the ONLY post-processing applied. No volume normalization
# (dynaudnorm pumps at sentence breaks; loudnorm changes the voice's
# inherent dynamics). Voice settings + script formatting carry the rest.
#
# Usage: bash scripts/postprocess-archetype-voices.sh

set -euo pipefail

VOICE_DIR="$(dirname "$0")/../public/archetypes/voice"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

cd "$VOICE_DIR"

for f in *.mp3; do
  echo "→ $f"
  ffmpeg -y -loglevel error -i "$f" \
    -af "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB" \
    -c:a libmp3lame -b:a 192k \
    "$TMP_DIR/$f"
  mv "$TMP_DIR/$f" "$f"
  dur=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$f")
  printf "  ✓ %s (%.1fs)\n" "$f" "$dur"
done

echo
echo "Done. Leading silence trimmed on all 6 files."
