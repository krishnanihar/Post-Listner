#!/usr/bin/env bash
# Run htdemucs on every master in public/music/ and lay the 4 stems into
# public/stems/{archetypeId}/{variationId}/{vocals,drums,bass,other}.mp3
# matching the layout src/lib/stemsCatalog.js expects.
#
# Idempotent — skips tracks that already have all 4 stems.
# Uses MPS (Apple GPU) when available; falls back to CPU otherwise.
#
# Usage: bash scripts/run-demucs.sh
# Logs:  /tmp/demucs-run.log  (full demucs output)
#        stdout                (one summary line per track)

set -uo pipefail

VENV="${HOME}/.venvs/demucs"
DEMUCS="${VENV}/bin/demucs"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INPUT_DIR="${ROOT}/public/music"
TMP_OUT="${ROOT}/tmp/demucs"
FINAL_OUT="${ROOT}/public/stems"
MODEL="htdemucs"
BITRATE=192
LOGFILE="/tmp/demucs-run.log"

# Choose device: mps (Apple GPU) if available, else cpu
DEVICE=$("${VENV}/bin/python" -c "import torch; print('mps' if torch.backends.mps.is_available() else 'cpu')")

if [[ ! -x "${DEMUCS}" ]]; then
  echo "ERROR: demucs not installed at ${DEMUCS}" >&2
  echo "Install: python3.12 -m venv ~/.venvs/demucs && ~/.venvs/demucs/bin/pip install demucs" >&2
  exit 1
fi

mkdir -p "${TMP_OUT}" "${FINAL_OUT}"
: > "${LOGFILE}"

count=0
skipped=0
processed=0
failed=0
total=$(find "${INPUT_DIR}" -maxdepth 1 -name '*.mp3' -type f | wc -l | tr -d ' ')

echo "Demucs runner starting"
echo "  input:    ${INPUT_DIR}"
echo "  output:   ${FINAL_OUT}"
echo "  model:    ${MODEL}"
echo "  device:   ${DEVICE}"
echo "  bitrate:  ${BITRATE} kbps"
echo "  total:    ${total} tracks"
echo "  log:      ${LOGFILE}"
echo ""

for src in "${INPUT_DIR}"/*.mp3; do
  count=$((count + 1))
  base=$(basename "${src}" .mp3)

  # Filename convention: {archetypeId}_{variationId}.mp3
  # archetype + variation each use hyphens internally; separator is _
  if [[ "${base}" != *_* ]]; then
    echo "[${count}/${total}] SKIP (no underscore separator): ${base}"
    skipped=$((skipped + 1))
    continue
  fi
  archetype="${base%%_*}"
  variation="${base#*_}"
  target_dir="${FINAL_OUT}/${archetype}/${variation}"

  if [[ -f "${target_dir}/vocals.mp3" && -f "${target_dir}/drums.mp3" \
     && -f "${target_dir}/bass.mp3"   && -f "${target_dir}/other.mp3" ]]; then
    echo "[${count}/${total}] SKIP ${archetype}/${variation} (stems already present)"
    skipped=$((skipped + 1))
    continue
  fi

  echo "[${count}/${total}] RUN  ${archetype}/${variation}"
  start_ts=$(date +%s)

  if ! "${DEMUCS}" -n "${MODEL}" \
        --mp3 --mp3-bitrate "${BITRATE}" \
        --device "${DEVICE}" \
        -o "${TMP_OUT}" \
        "${src}" >>"${LOGFILE}" 2>&1; then
    echo "[${count}/${total}] FAIL ${archetype}/${variation} (see ${LOGFILE})"
    failed=$((failed + 1))
    continue
  fi

  # Reorganise output into the catalog's expected layout
  mkdir -p "${target_dir}"
  for stem in vocals drums bass other; do
    mv "${TMP_OUT}/${MODEL}/${base}/${stem}.mp3" "${target_dir}/${stem}.mp3" 2>/dev/null || {
      echo "[${count}/${total}] FAIL ${archetype}/${variation} (missing ${stem}.mp3)"
      failed=$((failed + 1))
      continue 2
    }
  done
  rm -rf "${TMP_OUT}/${MODEL}/${base}"

  end_ts=$(date +%s)
  echo "[${count}/${total}] DONE ${archetype}/${variation} ($((end_ts - start_ts))s)"
  processed=$((processed + 1))
done

# Clean up tmp dir if empty
rmdir "${TMP_OUT}/${MODEL}" 2>/dev/null || true
rmdir "${TMP_OUT}" 2>/dev/null || true

echo ""
echo "Demucs runner finished"
echo "  processed: ${processed}"
echo "  skipped:   ${skipped}"
echo "  failed:    ${failed}"
echo "  total:     ${count}"
